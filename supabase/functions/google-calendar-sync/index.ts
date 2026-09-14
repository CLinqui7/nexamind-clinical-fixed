import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { requireMember,limitAction } from '../_shared/auth.ts';
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
    if(request.method!=='POST')return jsonResponse(request,{ok:false,message:'Método no permitido.'},405);
    const { organizationId, appointmentId } = await request.json();
    const {db,user}=await requireMember(request,organizationId,'appointmentsManage');
    await limitAction(db,'google-sync',user.id,100);
    const {data:record,error}=await db.from('linkare_records').select('payload').eq('organization_id',organizationId).eq('kind','appointment').eq('id',appointmentId).eq('deleted',false).maybeSingle();
    if(error||!record)throw new Error('Guarde primero la cita.');
    const appointment=record.payload;
    const { data: connection } = await db.from('calendar_connections').select('*').eq('organization_id', organizationId).eq('user_id', user.id).eq('provider', 'google').eq('active', true).maybeSingle();
    if (!connection) throw new Error('Conecte Google Calendar primero.');
    const token = await validAccessToken(db, connection);
    const event = {
      summary: 'Consulta privada',
      description: 'Consulta privada', visibility: 'private',
      start: { dateTime: new Date(appointment.start).toISOString(), timeZone: Deno.env.get('CLINIC_TIMEZONE') || 'America/El_Salvador' },
      end: { dateTime: new Date(appointment.end).toISOString(), timeZone: Deno.env.get('CLINIC_TIMEZONE') || 'America/El_Salvador' },
      extendedProperties: { private: { linkareAppointmentId: String(appointment.id || '') } },
    };
    const calendarId = encodeURIComponent(connection.calendar_id || 'primary');
    const {data:link}=await db.from('linkare_calendar_links_v3').select('google_event_id').eq('organization_id',organizationId).eq('user_id',user.id).eq('appointment_id',appointmentId).maybeSingle();
    const existingId=link?.google_event_id?encodeURIComponent(link.google_event_id):'';
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(organizationId+':'+user.id+':'+appointmentId));
    const eventId=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
    if(!existingId)Object.assign(event,{id:eventId});
    if(appointment.status==='cancelled')Object.assign(event,{status:'cancelled'});
    const endpoint = existingId
      ? `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${existingId}`
      : `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
    const response = await fetch(endpoint, {
      method: existingId ? 'PUT' : 'POST', signal:AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || `Google Calendar respondió ${response.status}.`);
    const {error:saveError}=await db.from('linkare_calendar_links_v3').upsert({organization_id:organizationId,user_id:user.id,appointment_id:appointmentId,google_event_id:payload.id,updated_at:new Date().toISOString()},{onConflict:'organization_id,user_id,appointment_id'});
    if(saveError)throw new Error('Google recibió la cita, pero no se pudo guardar la referencia. Contacte a soporte antes de repetir.');
    return jsonResponse(request, { ok: true, event: { id: payload.id, htmlLink: payload.htmlLink, updated: payload.updated } });
  } catch (error) {
    return jsonResponse(request, { ok: false, message: error instanceof Error ? error.message : 'No se pudo sincronizar la cita.' }, 400);
  }
});
