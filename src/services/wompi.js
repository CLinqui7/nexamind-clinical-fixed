import { assertSupabaseConfigured, supabaseConfigured } from '../lib/supabase.js';

export { supabaseConfigured };

async function extractFunctionError(error) {
  if (!error) return '';
  let message = error?.message || '';
  const context = error?.context;
  try {
    if (context instanceof Response) {
      const clone = context.clone();
      const payload = await clone.json().catch(async () => ({ message: await clone.text().catch(() => '') }));
      message = payload?.message || payload?.error || payload?.msg || message;
    } else if (context?.body) {
      if (typeof context.body === 'string') {
        try {
          const parsed = JSON.parse(context.body);
          message = parsed?.message || parsed?.error || context.body || message;
        } catch (_) {
          message = context.body || message;
        }
      } else {
        message = context.body?.message || context.body?.error || message;
      }
    }
  } catch (_) {
    // Keep the original Supabase error message.
  }
  return message || 'No se pudo completar la operación con Wompi.';
}

async function unwrapFunctionResponse(data, error) {
  if (error) throw new Error(await extractFunctionError(error));
  if (!data?.ok) throw new Error(data?.message || 'Wompi devolvió una respuesta incompleta.');
  return data;
}

export async function fetchWompiAppInfo() {
  const client = assertSupabaseConfigured();
  const { data, error } = await client.functions.invoke('wompi-app-info', { body: {} });
  return (await unwrapFunctionResponse(data, error)).app;
}

export async function createWompiPaymentLink(payload) {
  const client = assertSupabaseConfigured();
  const { data, error } = await client.functions.invoke('wompi-create-link', { body: payload });
  return await unwrapFunctionResponse(data, error);
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
