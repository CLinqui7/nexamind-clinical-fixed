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
    let { data: row } = await db.from('calendar_feed_tokens').select('*').eq('organization_id', organizationId).eq('active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!row) {
      const result = await db.from('calendar_feed_tokens').insert({ organization_id: organizationId, created_by: user.id }).select('*').single();
      if (result.error) throw new Error(result.error.message);
      row = result.data;
    }
    const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
    return jsonResponse(request, { ok: true, feedUrl: `${supabaseUrl}/functions/v1/calendar-feed?token=${row.token}` });
  } catch (error) {
    return jsonResponse(request, { ok: false, message: error instanceof Error ? error.message : 'No se pudo crear el calendario privado.' }, 400);
  }
});
