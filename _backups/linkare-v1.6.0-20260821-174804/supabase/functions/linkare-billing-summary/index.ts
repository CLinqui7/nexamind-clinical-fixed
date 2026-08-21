import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabase-admin.ts';

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { ok: false, message: 'Método no permitido.' }, 405);

  try {
    const slug = Deno.env.get('LINKARE_BILLING_ACCOUNT_SLUG')?.trim() || 'consultorio-demo';
    const db = supabaseAdmin();
    const { data: account, error: accountError } = await db
      .from('linkare_billing_accounts')
      .select('id,slug,clinic_name,billing_email,plan_name,price,currency,billing_cycle,active,is_demo,updated_at')
      .eq('slug', slug)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) throw new Error(`No existe la cuenta de cobro ${slug}. Ejecute la migración v1.6.`);

    const { data: invoice, error: invoiceError } = await db
      .from('linkare_billing_invoices')
      .select('id,payment_token,period_label,amount,currency,due_date,status,payment_url,qr_url,is_test,paid_at,created_at,updated_at')
      .eq('account_id', account.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (invoiceError) throw invoiceError;

    return jsonResponse(request, { ok: true, account, invoice });
  } catch (error) {
    return jsonResponse(request, {
      ok: false,
      message: error instanceof Error ? error.message : 'No se pudo cargar la facturación.',
    }, 500);
  }
});
