import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { requireMember,limitAction } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabase-admin.ts';

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { ok: false, message: 'Método no permitido.' }, 405);
  try {
    const { organizationId } = await request.json();
    if (!organizationId) throw new Error('Falta la organización.');
    const clientId = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID')?.trim();
    if (!clientId) throw new Error('Google Calendar no está configurado. Falta GOOGLE_CALENDAR_CLIENT_ID.');
    const {db,user}=await requireMember(request,organizationId,'appointmentsManage');
    await limitAction(db,'google-connect',user.id,20);
    const state = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
    await db.from('calendar_oauth_states').delete().lt('expires_at', new Date().toISOString());
    const { error } = await db.from('calendar_oauth_states').insert({
      state, organization_id: organizationId, user_id: user.id, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) throw new Error(error.message);
    const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
    const redirectUri = Deno.env.get('GOOGLE_CALENDAR_REDIRECT_URI')?.trim() || `${supabaseUrl}/functions/v1/google-calendar-callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email',
      state,
    });
    return jsonResponse(request, { ok: true, url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, redirectUri });
  } catch (error) {
    return jsonResponse(request, { ok: false, message: error instanceof Error ? error.message : 'No se pudo conectar Google Calendar.' }, 400);
  }
});
