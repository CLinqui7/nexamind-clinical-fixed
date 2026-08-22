import { assertSupabaseConfigured, supabaseConfigured } from '../lib/supabase.js';

export { supabaseConfigured };

function unwrapFunctionResponse(data, error) {
  if (error) {
    const contextMessage = error?.context?.body?.message || error?.message;
    throw new Error(contextMessage || 'No se pudo completar la operación con Wompi.');
  }
  if (!data?.ok) throw new Error(data?.message || 'Wompi devolvió una respuesta incompleta.');
  return data;
}

export async function fetchWompiAppInfo() {
  const client = assertSupabaseConfigured();
  const { data, error } = await client.functions.invoke('wompi-app-info', { body: {} });
  return unwrapFunctionResponse(data, error).app;
}

export async function createWompiPaymentLink(payload) {
  const client = assertSupabaseConfigured();
  const { data, error } = await client.functions.invoke('wompi-create-link', {
    body: payload,
  });
  return unwrapFunctionResponse(data, error);
}

export async function fetchSubscriptionInvoices(organizationId) {
  const client = assertSupabaseConfigured();
  if (!organizationId) return [];
  const { data, error } = await client
    .from('linkare_subscription_invoices')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message || 'No se pudo cargar el historial de facturación.');
  return (data || []).map(row => ({
    id: row.id,
    description: row.description,
    amount: Number(row.amount) || 0,
    method: row.method || 'wompi',
    status: row.status || 'pending',
    payerName: row.payer_name || '',
    payerEmail: row.payer_email || '',
    billingPeriod: row.billing_period || '',
    externalReference: row.external_reference || '',
    paymentUrl: row.payment_url || '',
    qrUrl: row.qr_url || '',
    isTest: Boolean(row.is_test),
    createdAt: row.created_at,
    paidAt: row.paid_at,
  }));
}
