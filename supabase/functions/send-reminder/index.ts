import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabase-admin.ts';

type Payload = {
  organizationId?: string;
  patientId?: string;
  appointmentId?: string;
  channel?: 'email' | 'sms' | 'whatsapp';
  destination?: string;
  message?: string;
  subject?: string;
};

function publishableKey() {
  const legacy = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (legacy) return legacy;
  try {
    return String(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default || '').trim();
  } catch (_) { return ''; }
}

async function authenticatedUser(request: Request) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization) throw new Error('Debe iniciar sesión para enviar recordatorios.');
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = publishableKey();
  if (!key) throw new Error('No se encontró una llave pública de Supabase.');
  const client = createClient(url, key, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('La sesión de Supabase no es válida.');
  return data.user;
}

async function verifyMembership(db: ReturnType<typeof supabaseAdmin>, organizationId: string, userId: string) {
  const { data, error } = await db.from('organization_members')
    .select('role, active')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data?.active) throw new Error('No tiene acceso a esta organización.');
  if (!['owner', 'psychiatrist', 'secretary', 'clinical_assistant'].includes(String(data.role))) {
    throw new Error('Su rol no puede enviar recordatorios.');
  }
}

async function sendEmail(destination: string, subject: string, message: string) {
  const key = Deno.env.get('RESEND_API_KEY')?.trim();
  const from = Deno.env.get('REMINDER_EMAIL_FROM')?.trim();
  if (!key || !from) throw new Error('Correo automático no configurado. Agregue RESEND_API_KEY y REMINDER_EMAIL_FROM.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [destination], subject, text: message }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || `El proveedor de correo respondió ${response.status}.`);
  return { provider: 'resend', id: body?.id || null };
}

async function sendSms(destination: string, message: string) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')?.trim();
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')?.trim();
  const from = Deno.env.get('TWILIO_FROM_NUMBER')?.trim();
  if (!sid || !token || !from) throw new Error('SMS automático no configurado. Agregue las credenciales de Twilio.');
  const body = new URLSearchParams({ To: destination, From: from, Body: message });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || `El proveedor SMS respondió ${response.status}.`);
  return { provider: 'twilio', id: payload?.sid || null };
}

async function sendWhatsApp(destination: string, message: string) {
  const token = Deno.env.get('META_WHATSAPP_TOKEN')?.trim();
  const phoneNumberId = Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID')?.trim();
  const template = Deno.env.get('META_WHATSAPP_TEMPLATE_NAME')?.trim();
  const language = Deno.env.get('META_WHATSAPP_TEMPLATE_LANGUAGE')?.trim() || 'es';
  const version = Deno.env.get('META_GRAPH_VERSION')?.trim() || 'v23.0';
  if (!token || !phoneNumberId || !template) {
    throw new Error('WhatsApp automático no configurado. Agregue token, Phone Number ID y plantilla aprobada.');
  }
  const digits = destination.replace(/\D/g, '');
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: digits,
      type: 'template',
      template: {
        name: template,
        language: { code: language },
        components: [{ type: 'body', parameters: [{ type: 'text', text: message.slice(0, 900) }] }],
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Meta respondió ${response.status}.`);
  return { provider: 'meta_whatsapp', id: payload?.messages?.[0]?.id || null };
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { ok: false, message: 'Método no permitido.' }, 405);
  let auditId: string | null = null;
  try {
    const user = await authenticatedUser(request);
    const input = await request.json() as Payload;
    const organizationId = String(input.organizationId || '').trim();
    const channel = input.channel;
    const destination = String(input.destination || '').trim();
    const message = String(input.message || '').trim();
    if (!organizationId) throw new Error('Falta la organización.');
    if (!channel || !['email', 'sms', 'whatsapp'].includes(channel)) throw new Error('Canal no válido.');
    if (!destination) throw new Error('Falta el correo o teléfono de destino.');
    if (!message) throw new Error('Falta el mensaje.');
    const db = supabaseAdmin();
    await verifyMembership(db, organizationId, user.id);

    const { data: audit } = await db.from('linkare_notification_deliveries').insert({
      organization_id: organizationId,
      patient_id: input.patientId || null,
      appointment_id: input.appointmentId || null,
      channel,
      destination,
      status: 'queued',
      message_preview: message.slice(0, 240),
      created_by: user.id,
    }).select('id').single();
    auditId = audit?.id || null;

    const result = channel === 'email'
      ? await sendEmail(destination, input.subject || 'Recordatorio de cita', message)
      : channel === 'sms'
        ? await sendSms(destination, message)
        : await sendWhatsApp(destination, message);

    if (auditId) await db.from('linkare_notification_deliveries').update({
      status: 'sent', provider: result.provider, provider_message_id: result.id, sent_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', auditId);
    return jsonResponse(request, { ok: true, deliveryId: auditId, provider: result.provider, providerMessageId: result.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo enviar el recordatorio.';
    if (auditId) {
      try { await supabaseAdmin().from('linkare_notification_deliveries').update({ status: 'failed', error_message: message, updated_at: new Date().toISOString() }).eq('id', auditId); } catch (_) { /* Best effort. */ }
    }
    return jsonResponse(request, { ok: false, message }, 400);
  }
});
