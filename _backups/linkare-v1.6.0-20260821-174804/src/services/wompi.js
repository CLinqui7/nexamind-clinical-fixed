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
