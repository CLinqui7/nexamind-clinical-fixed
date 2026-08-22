import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyWompiWebhook, wompiConfig } from '../_shared/wompi.ts';

function getSecretKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    return String(keys.default || '').trim();
  } catch (_) {
    return '';
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Método no permitido', { status: 405 });

  const rawBody = await request.text();
  try {
    const config = wompiConfig();
    const valid = await verifyWompiWebhook(rawBody, request.headers.get('wompi_hash'), config.clientSecret);
    if (!valid) return new Response('Firma inválida', { status: 401 });

    const payload = JSON.parse(rawBody);
    const reference = payload?.EnlacePago?.IdentificadorEnlaceComercio
      || payload?.enlacePago?.identificadorEnlaceComercio
      || null;
    const transactionId = payload?.IdTransaccion || payload?.idTransaccion || null;
    const result = String(payload?.ResultadoTransaccion || payload?.resultadoTransaccion || '');
    const approved = result.toLowerCase() === 'exitosaaprobada';
    const isProductive = Boolean(payload?.EsProductiva ?? payload?.esProductiva);

    if (!reference) return new Response('Referencia ausente', { status: 400 });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const secretKey = getSecretKey();
    if (!secretKey) return new Response('Falta llave secreta de Supabase', { status: 500 });
    const db = createClient(supabaseUrl, secretKey);

    if (transactionId) {
      const { data: previousEvent } = await db
        .from('linkare_wompi_events')
        .select('id')
        .eq('transaction_id', String(transactionId))
        .maybeSingle();
      if (previousEvent?.id) return new Response('ok', { status: 200 });
    }

    const { error: updateError } = await db.from('linkare_subscription_invoices')
      .update({
        status: approved ? 'paid' : 'cancelled',
        external_transaction_id: transactionId,
        is_test: !isProductive,
        provider_payload: payload,
        paid_at: approved ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('external_reference', reference);

    if (updateError) return new Response(`No se pudo actualizar la factura: ${updateError.message}`, { status: 500 });

    await db.from('linkare_wompi_events').insert({
      external_reference: reference,
      transaction_id: transactionId,
      result,
      is_productive: isProductive,
      payload,
    });

    return new Response('ok', { status: 200 });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Error de webhook', { status: 500 });
  }
});
