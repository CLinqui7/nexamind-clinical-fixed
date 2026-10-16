import { supabaseAdmin } from '../_shared/supabase-admin.ts';
import { gmailConfigured, sendGmailEmail } from '../_shared/gmail.ts';
import { smtpConfigured, sendSmtpEmail } from '../_shared/smtp.ts';
import { localDate, secretaryAgendaItems, secretaryAgendaMessage } from '../_shared/secretary-agenda.ts';
import { calendarPermissionAllowed, permissionAllowed } from '../_shared/permissions.ts';

function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

Deno.serve(async request => {
  const secret = Deno.env.get('LINKARE_CRON_SECRET') || '';
  const received = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (request.method !== 'POST' || secret.length < 32 || !same(secret, received)) return new Response('Unauthorized', { status: 401 });
  const organizationId = Deno.env.get('LINKARE_DAILY_AGENDA_ORG_ID') || '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationId) || !(smtpConfigured() || gmailConfigured())) {
    return Response.json({ ok: false, code: 'DAILY_AGENDA_NOT_CONFIGURED' }, { status: 503 });
  }
  try {
    const db = supabaseAdmin();
    const timezone = Deno.env.get('CLINIC_TIMEZONE') || 'America/El_Salvador';
    const now = new Date(), date = localDate(now, timezone);
    const { data: calendar, error: calendarError } = await db.from('linkare_calendars_v1').select('id').eq('organization_id', organizationId).eq('code', 'doctor').eq('is_active', true).maybeSingle();
    if (calendarError || !calendar) throw new Error('No se encontró el calendario Doctor.');
    const { data: members, error: memberError } = await db.from('organization_members').select('user_id,role,active,permissions').eq('organization_id', organizationId).eq('role', 'secretary').eq('active', true);
    if (memberError) throw memberError;
    const secretaries = (members || []).filter(member => permissionAllowed(member, 'patientsView') && calendarPermissionAllowed(member, 'doctor', 'View'));
    if (!secretaries.length) return Response.json({ ok: true, date, recipients: 0, accepted: 0, skipped: 0, failed: 0 });

    const appointments: any[] = [];
    const lower = new Date(now.getTime() - 36 * 3600000).toISOString();
    const upper = new Date(now.getTime() + 36 * 3600000).toISOString();
    for (let offset = 0; offset < 5000; offset += 500) {
      const { data: page, error } = await db.from('linkare_records').select('id,payload').eq('organization_id', organizationId).eq('kind', 'appointment').eq('deleted', false).gte('payload->>start', lower).lt('payload->>start', upper).order('id').range(offset, offset + 499);
      if (error) throw error;
      appointments.push(...(page || []));
      if (!page || page.length < 500) break;
      if (offset === 4500) throw new Error('La agenda supera el límite de consulta; no se enviará un resumen incompleto.');
    }
    const patientIds = [...new Set(appointments.map(row => String(row.payload?.patientId || '')).filter(Boolean))];
    const patients = new Map<string, any>();
    for (let offset = 0; offset < patientIds.length; offset += 100) {
      const { data: rows, error } = await db.from('linkare_records').select('id,payload').eq('organization_id', organizationId).eq('kind', 'patient_admin').eq('deleted', false).in('id', patientIds.slice(offset, offset + 100));
      if (error) throw error;
      for (const row of rows || []) patients.set(row.id, row.payload);
    }

    let accepted = 0, skipped = 0, failed = 0;
    for (const member of secretaries) {
      const { data: identity, error: identityError } = await db.auth.admin.getUserById(member.user_id);
      const destination = String(identity?.user?.email || '').trim();
      if (identityError || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(destination)) { failed++; continue; }
      const items = secretaryAgendaItems(appointments, patients, member, calendar.id, date, timezone);
      const dedupeKey = `${organizationId}:secretary:${member.user_id}:daily_agenda:${date}`;
      const { data: delivery, error: reserveError } = await db.from('linkare_notification_deliveries').insert({
        organization_id: organizationId, channel: 'email', destination, status: 'queued', dedupe_key: dedupeKey,
        message_preview: `Agenda de citas ${date}`, metadata: { type: 'secretary_daily_agenda', date, recipientUserId: member.user_id, appointmentCount: items.length },
      }).select('id').single();
      if (reserveError?.code === '23505') { skipped++; continue; }
      if (reserveError || !delivery) { failed++; continue; }
      try {
        const subject = `Agenda de citas de hoy - ${date}`;
        const message = secretaryAgendaMessage(date, items);
        const sent = smtpConfigured() ? await sendSmtpEmail(destination, subject, message) : await sendGmailEmail(destination, subject, message);
        const { error: updateError } = await db.from('linkare_notification_deliveries').update({ status: 'sent', provider: sent.provider, provider_message_id: sent.id, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', delivery.id);
        if (updateError) throw updateError;
        accepted++;
      } catch {
        failed++;
        await db.from('linkare_notification_deliveries').update({ status: 'failed', error_message: 'No se pudo confirmar la aceptación del correo; revisar antes de reintentar.', updated_at: new Date().toISOString() }).eq('id', delivery.id);
      }
    }
    return Response.json({ ok: failed === 0, date, recipients: secretaries.length, accepted, skipped, failed }, { status: failed ? 503 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ ok: false, code: 'DAILY_AGENDA_DISPATCH_FAILED' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
});
