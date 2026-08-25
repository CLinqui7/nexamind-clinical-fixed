import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabase-admin.ts';

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  try {
    const user = await requireUser(request);
    const { organizationId } = await request.json();
    const db = supabaseAdmin();
    const { data: member } = await db.from('organization_members').select('active').eq('organization_id', organizationId).eq('user_id', user.id).maybeSingle();
    if (!member?.active) throw new Error('No tiene acceso a la organización.');
    const { data: google } = await db.from('calendar_connections').select('provider_account_email, active, updated_at').eq('organization_id', organizationId).eq('user_id', user.id).eq('provider', 'google').maybeSingle();
    const { data: feed } = await db.from('calendar_feed_tokens').select('token, active').eq('organization_id', organizationId).eq('active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
    return jsonResponse(request, { ok: true, status: {
      google: { connected: Boolean(google?.active), email: google?.provider_account_email || '', updatedAt: google?.updated_at || null },
      apple: { connected: Boolean(feed?.active), feedUrl: feed?.token ? `${supabaseUrl}/functions/v1/calendar-feed?token=${feed.token}` : '' },
    } });
  } catch (error) {
    return jsonResponse(request, { ok: false, message: error instanceof Error ? error.message : 'No se pudo consultar el calendario.' }, 400);
  }
});
