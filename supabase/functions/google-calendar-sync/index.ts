import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabase-admin.ts';

async function validAccessToken(db: ReturnType<typeof supabaseAdmin>, connection: any) {
  if (connection.access_token && new Date(connection.token_expires_at || 0).getTime() > Date.now() + 60_000) return connection.access_token;
  if (!connection.refresh_token) throw new Error('Google Calendar requiere volver a conectarse.');
  const clientId = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID')?.trim();
  const clientSecret = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET')?.trim();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId || '', client_secret: clientSecret || '', refresh_token: connection.refresh_token, grant_type: 'refresh_token' }),
  });
  const tokens = await response.json().catch(() => ({}));
  if (!response.ok || !tokens.access_token) throw new Error(tokens.error_description || 'Google no pudo renovar el acceso.');
  const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString();
  await db.from('calendar_connections').update({ access_token: tokens.access_token, token_expires_at: expiresAt, updated_at: new Date().toISOString() }).eq('id', connection.id);
  return tokens.access_token;
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  try {
    const user = await requireUser(request);
    const { organizationId, appointment } = await request.json();
    if (!organizationId || !appointment?.start || !appointment?.end) throw new Error('Faltan datos de la cita.');
    const db = supabaseAdmin();
    const { data: member } = await db.from('organization_members').select('active').eq('organization_id', organizationId).eq('user_id', user.id).maybeSingle();
    if (!member?.active) throw new Error('No tiene acceso a la organización.');
    const { data: connection } = await db.from('calendar_connections').select('*').eq('organization_id', organizationId).eq('user_id', user.id).eq('provider', 'google').eq('active', true).maybeSingle();
    if (!connection) throw new Error('Conecte Google Calendar primero.');
    const token = await validAccessToken(db, connection);
    const event = {
      summary: 'Consulta privada',
      description: [appointment.type, appointment.modality].filter(Boolean).join(' · '),
      start: { dateTime: new Date(appointment.start).toISOString(), timeZone: Deno.env.get('CLINIC_TIMEZONE') || 'America/El_Salvador' },
      end: { dateTime: new Date(appointment.end).toISOString(), timeZone: Deno.env.get('CLINIC_TIMEZONE') || 'America/El_Salvador' },
      extendedProperties: { private: { linkareAppointmentId: String(appointment.id || '') } },
    };
    const calendarId = encodeURIComponent(connection.calendar_id || 'primary');
    const existingId = appointment.googleEventId ? encodeURIComponent(appointment.googleEventId) : '';
    const endpoint = existingId
      ? `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${existingId}`
      : `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
    const response = await fetch(endpoint, {
      method: existingId ? 'PUT' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || `Google Calendar respondió ${response.status}.`);
    return jsonResponse(request, { ok: true, event: { id: payload.id, htmlLink: payload.htmlLink, updated: payload.updated } });
  } catch (error) {
    return jsonResponse(request, { ok: false, message: error instanceof Error ? error.message : 'No se pudo sincronizar la cita.' }, 400);
  }
});
