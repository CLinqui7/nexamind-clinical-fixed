import { assertSupabaseConfigured, supabaseConfigured } from '../lib/supabase.js';

export { supabaseConfigured };

async function extractFunctionMessage(error, fallback) {
  if (!error) return fallback;
  let message = error.message || fallback;
  try {
    if (error.context instanceof Response) {
      const payload = await error.context.clone().json().catch(() => null);
      message = payload?.message || payload?.error || message;
    }
  } catch (_) { /* Keep original message. */ }
  return message;
}

export async function sendReminderThroughProvider(payload) {
  const client = assertSupabaseConfigured();
  const { data, error } = await client.functions.invoke('send-reminder', { body: payload });
  if (error) throw new Error(await extractFunctionMessage(error, 'No se pudo enviar el recordatorio.'));
  if (!data?.ok) throw new Error(data?.message || 'No se pudo enviar el recordatorio.');
  return data;
}

export async function fetchReminderProviderStatus() {
  const client = assertSupabaseConfigured();
  const { data, error } = await client.functions.invoke('reminder-provider-status', { body: {} });
  if (error) throw new Error(await extractFunctionMessage(error, 'No se pudo consultar los canales.'));
  return data?.providers || { email: false, sms: false, whatsapp: false };
}
