import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabase-admin.ts';
import { wompiConfig, wompiRequest } from '../_shared/wompi.ts';

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { ok: false, message: 'Método no permitido.' }, 405);

  try {
    const input = await request.json();
    const paymentToken = String(input.paymentToken || '').trim();
    if (!paymentToken) throw new Error('Falta el token de la factura.');

    const db = supabaseAdmin();
    const { data: invoice, error: invoiceError } = await db
      .from('linkare_billing_invoices')
      .select('id,account_id,payment_token,period_label,amount,currency,due_date,status,payment_url,qr_url')
      .eq('payment_token', paymentToken)
      .maybeSingle();
    if (invoiceError) throw invoiceError;
    if (!invoice) throw new Error('La factura no existe.');
    if (invoice.status === 'paid') throw new Error('Esta factura ya está pagada.');

    const { data: account, error: accountError } = await db
      .from('linkare_billing_accounts')
      .select('id,clinic_name,billing_email,plan_name')
      .eq('id', invoice.account_id)
      .single();
    if (accountError) throw accountError;

    const config = wompiConfig();
    const reference = `LINKARE-SUB-${String(invoice.id).replaceAll('-', '').toUpperCase()}`;
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const webhookUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/wompi-webhook`;
    const redirectUrl = `${config.appPublicUrl.replace(/\/$/, '')}/?payment=return`;
    const notificationEmail = account.billing_email || config.notificationEmail || '';

    const requestBody = {
      identificadorEnlaceComercio: reference,
      monto: Number(invoice.amount),
      nombreProducto: `${account.plan_name} · ${invoice.period_label}`,
      configuracion: {
        urlRedirect: redirectUrl,
        urlRetorno: config.appPublicUrl,
        urlWebhook: webhookUrl,
        ...(notificationEmail ? { emailsNotificacion: notificationEmail } : {}),
        notificarTransaccionCliente: Boolean(notificationEmail),
        esMontoEditable: false,
        esCantidadEditable: false,
        cantidadPorDefecto: 1,
      },
      limitesDeUso: {
        cantidadMaximaPagosExitosos: 1,
        cantidadMaximaPagosFallidos: 5,
      },
    };

    const wompi = await wompiRequest('/EnlacePago', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    }, config);

    const { data: updated, error: updateError } = await db
      .from('linkare_billing_invoices')
      .update({
        status: 'pending',
        external_reference: reference,
        payment_link_id: wompi.idEnlace ? String(wompi.idEnlace) : null,
        payment_url: wompi.urlEnlace || null,
        qr_url: wompi.urlQrCodeEnlace || null,
        is_test: wompi.estaProductivo === false,
        provider_payload: wompi,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id)
      .select('id,payment_token,period_label,amount,currency,due_date,status,payment_url,qr_url,is_test,paid_at,created_at,updated_at')
      .single();
    if (updateError) throw updateError;

    return jsonResponse(request, {
      ok: true,
      invoice: updated,
      payment: {
        id: wompi.idEnlace,
        url: wompi.urlEnlace,
        qrUrl: wompi.urlQrCodeEnlace,
        productive: wompi.estaProductivo,
      },
    });
  } catch (error) {
    return jsonResponse(request, {
      ok: false,
      message: error instanceof Error ? error.message : 'No se pudo crear el enlace de pago.',
    }, 400);
  }
});
