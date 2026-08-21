import { assertSupabaseConfigured, supabaseConfigured } from '../lib/supabase.js';

export { supabaseConfigured };

function unwrap(data, error, fallback) {
  if (error) {
    const message = error?.context?.body?.message || error?.message;
    throw new Error(message || fallback);
  }
  if (!data?.ok) throw new Error(data?.message || fallback);
  return data;
}

export async function fetchPlatformBillingSummary() {
  const client = assertSupabaseConfigured();
  const { data, error } = await client.functions.invoke('linkare-billing-summary', { body: {} });
  return unwrap(data, error, 'No se pudo cargar el plan de Linkare.');
}

export async function savePlatformBillingPrice(payload, adminKey) {
  const client = assertSupabaseConfigured();
  const { data, error } = await client.functions.invoke('linkare-billing-admin', {
    body: payload,
    headers: { 'x-linkare-admin-key': adminKey },
  });
  return unwrap(data, error, 'No se pudo actualizar el precio.');
}

export async function createPlatformPaymentLink(paymentToken) {
  const client = assertSupabaseConfigured();
  const { data, error } = await client.functions.invoke('linkare-create-payment-link', {
    body: { paymentToken },
  });
  return unwrap(data, error, 'No se pudo crear el enlace de pago.');
}
