import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { wompiConfig, wompiRequest } from '../_shared/wompi.ts';

type CreateSubscriptionPayload = {
  organizationId?: string;
  planName?: string;
  description?: string;
  amount?: number;
  customerEmail?: string;
  payerName?: string;
  billingPeriod?: string;
  purpose?: string;
  reference?: string;
};

function createReference() {
  return `LINKARE-SUB-${crypto.randomUUID().replaceAll('-', '').toUpperCase()}`;
}

function getPublishableKey() {
  const legacy = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
    return String(keys.default || '').trim();
  } catch (_) { return ''; }
}

function getSecretKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    return String(keys.default || '').trim();
  } catch (_) { return ''; }
}

async function getUser(request: Request, requireAuth: boolean) {
  if (!requireAuth) return null;
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const publishableKey = getPublishableKey();
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization) throw new Error('Debe iniciar sesión para generar un enlace de Wompi.');
  if (!publishableKey) throw new Error('Supabase no expuso una llave pública para validar la sesión.');
  const client = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('La sesión de Supabase no es válida.');
  return data.user;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { ok: false, message: 'Método no permitido.' }, 405);

  try {
    const config = wompiConfig();
    const user = await getUser(request, config.requireAuth);
    const input = await request.json() as CreateSubscriptionPayload;
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const secretKey = getSecretKey();
    if (!secretKey) throw new Error('Supabase no expuso una llave secreta para guardar la factura.');
    const db = createClient(supabaseUrl, secretKey);

    let planName = String(input.planName || 'Plan Profesional Linkare').trim();
    let description = String(input.description || '').trim();
    let amount = Number(input.amount);
    let payerName = String(input.payerName || '').trim();
    let payerEmail = String(input.customerEmail || config.notificationEmail || '').trim();
    let currency = 'USD';
    const billingPeriod = String(input.billingPeriod || new Date().toISOString().slice(0, 7)).trim();
    const reference = String(input.reference || '').trim() || createReference();
    const organizationId = String(input.organizationId || '').trim() || null;

    if (config.requireAuth) {
      if (!user) throw new Error('Debe iniciar sesión.');
      if (!organizationId) throw new Error('No se recibió la organización de Linkare.');

      const { data: member, error: memberError } = await db
        .from('organization_members')
        .select('role, active')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (memberError) throw new Error(`No se pudo validar el permiso: ${memberError.message}`);
      if (!member?.active || !['owner', 'doctor'].includes(String(member.role))) {
        throw new Error('Solo el médico responsable puede generar el enlace de pago de su licencia.');
      }

      const { data: billing, error: billingError } = await db
        .from('linkare_platform_billing_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .single();
      if (billingError || !billing) throw new Error('No se encontró la configuración del plan Linkare.');

      planName = String(billing.plan_name || planName).trim();
      description = String(input.description || `${planName} · ${billingPeriod}`).trim();
      amount = Number(billing.subscription_price);
      payerName = String(billing.payer_name || payerName).trim();
      payerEmail = String(billing.payer_email || payerEmail || config.notificationEmail).trim();
      currency = String(billing.currency || 'USD').trim().toUpperCase();
    }

    if (!Number.isFinite(amount) || amount < 0.01) throw new Error('El precio guardado debe ser mayor o igual a US$0.01.');
    if (!description) description = `${planName} · ${billingPeriod}`;
    if (!payerEmail) throw new Error('Configure el correo del psiquiatra que pagará.');

    const webhookUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/wompi-webhook`;
    const redirectUrl = `${config.appPublicUrl.replace(/\/$/, '')}/?payment=return`;
    const requestBody = {
      identificadorEnlaceComercio: reference,
      monto: amount,
      nombreProducto: description,
      infoProducto: { descripcionProducto: `${planName} · Periodo ${billingPeriod}` },
      configuracion: {
        urlRedirect: redirectUrl,
        urlRetorno: config.appPublicUrl,
        urlWebhook: webhookUrl,
        emailsNotificacion: payerEmail,
        notificarTransaccionCliente: true,
        esMontoEditable: false,
        esCantidadEditable: false,
        cantidadPorDefecto: 1,
      },
      limitesDeUso: { cantidadMaximaPagosExitosos: 1, cantidadMaximaPagosFallidos: 5 },
    };

    const wompi = await wompiRequest('/EnlacePago', { method: 'POST', body: JSON.stringify(requestBody) }, config);
    const { error: insertError } = await db.from('linkare_subscription_invoices').insert({
      organization_id: organizationId,
      payer_user_id: user?.id || null,
      plan_name: planName,
      description,
      billing_period: billingPeriod,
      payer_name: payerName || null,
      payer_email: payerEmail,
      amount,
      currency,
      status: 'pending',
      external_reference: reference,
      provider: 'wompi_sv',
      payment_link_id: wompi.idEnlace ? String(wompi.idEnlace) : null,
      payment_url: wompi.urlEnlace || null,
      qr_url: wompi.urlQrCodeEnlace || null,
      is_test: wompi.estaProductivo === false,
      provider_payload: wompi,
      metadata: { purpose: input.purpose || 'linkare_subscription', requestedBy: user?.email || 'unknown' },
    });
    if (insertError) throw new Error(`Wompi creó el enlace, pero Supabase no pudo guardar la factura: ${insertError.message}`);

    return jsonResponse(request, {
      ok: true,
      reference,
      payment: {
        id: wompi.idEnlace,
        url: wompi.urlEnlace,
        qrUrl: wompi.urlQrCodeEnlace,
        productive: wompi.estaProductivo,
        amount,
        currency,
      },
    });
  } catch (error) {
    return jsonResponse(request, {
      ok: false,
      message: error instanceof Error ? error.message : 'No se pudo crear el enlace de pago.',
    }, 400);
  }
});
