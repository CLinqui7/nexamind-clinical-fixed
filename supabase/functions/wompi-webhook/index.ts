import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyWompiWebhook, wompiConfig } from '../_shared/wompi.ts';

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
    const approved = String(payload?.ResultadoTransaccion || payload?.resultadoTransaccion || '').toLowerCase() === 'exitosaaprobada';
    const isProductive = Boolean(payload?.EsProductiva ?? payload?.esProductiva);

    if (!reference) return new Response('Referencia ausente', { status: 400 });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const secretMap = Deno.env.get('SUPABASE_SECRET_KEYS');
    let secretKey = serviceRole;
    if (!secretKey && secretMap) {
      try { secretKey = JSON.parse(secretMap)?.default || ''; } catch (_) { /* ignore */ }
    }
    if (!secretKey) throw new Error('Supabase secret key is not available.');
    const db = createClient(supabaseUrl, secretKey);
    const update = {
      status: approved ? 'paid' : 'cancelled',
      external_transaction_id: transactionId,
      is_test: !isProductive,
      provider_payload: payload,
      paid_at: approved ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { data: platformRows, error: platformError } = await db
      .from('linkare_billing_invoices')
      .update(update)
      .eq('external_reference', reference)
      .select('id');
    if (platformError) return new Response(`No se pudo actualizar la factura Linkare: ${platformError.message}`, { status: 500 });

    if (!platformRows?.length) {
      const { error: legacyError } = await db.from('clinic_payments').update(update).eq('external_reference', reference);
      if (legacyError) return new Response(`No se pudo actualizar el pago: ${legacyError.message}`, { status: 500 });
    }
    return new Response('ok', { status: 200 });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Error de webhook', { status: 500 });
  }
});
