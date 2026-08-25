import { supabaseAdmin } from '../_shared/supabase-admin.ts';

function escapeIcs(value = '') { return String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
function date(value: unknown) { return new Date(String(value || '')).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'); }

Deno.serve(async request => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return new Response('Token requerido', { status: 400 });
  try {
    const db = supabaseAdmin();
    const { data: feed } = await db.from('calendar_feed_tokens').select('*').eq('token', token).eq('active', true).maybeSingle();
    if (!feed) return new Response('Calendario no disponible', { status: 404 });
    const { data: state } = await db.from('linkare_app_state').select('payload').eq('organization_id', feed.organization_id).maybeSingle();
    const appointments = Array.isArray(state?.payload?.appointments) ? state.payload.appointments : [];
    const rows = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Linkare//Agenda privada//ES','CALSCALE:GREGORIAN','X-WR-CALNAME:Linkare · Agenda privada'];
    for (const item of appointments.filter((appointment: any) => appointment.status !== 'cancelled')) {
      rows.push('BEGIN:VEVENT', `UID:${escapeIcs(item.id)}@linkare`, `DTSTAMP:${date(new Date())}`, `DTSTART:${date(item.start)}`, `DTEND:${date(item.end)}`, 'SUMMARY:Consulta privada', `DESCRIPTION:${escapeIcs([item.type, item.modality].filter(Boolean).join(' · '))}`, 'END:VEVENT');
    }
    rows.push('END:VCALENDAR');
    await db.from('calendar_feed_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', feed.id);
    return new Response(rows.join('\r\n'), { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=300' } });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'No se pudo generar el calendario.', { status: 500 });
  }
});
