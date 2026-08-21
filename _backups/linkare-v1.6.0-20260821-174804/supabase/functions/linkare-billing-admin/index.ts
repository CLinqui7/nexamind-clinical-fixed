import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabase-admin.ts';

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { ok: false, message: 'Método no permitido.' }, 405);

  try {
    const expected = Deno.env.get('LINKARE_ADMIN_KEY')?.trim();
    const received = request.headers.get('x-linkare-admin-key')?.trim();
    if (!expected) throw new Error('Falta LINKARE_ADMIN_KEY en Supabase Secrets.');
    if (!received || received !== expected) return jsonResponse(request, { ok: false, message: 'Clave administrativa incorrecta.' }, 401);

    const input = await request.json();
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount < 0.01) throw new Error('El precio debe ser mayor o igual a US$0.01.');

    const slug = Deno.env.get('LINKARE_BILLING_ACCOUNT_SLUG')?.trim() || 'consultorio-demo';
    const currency = String(input.currency || 'USD').trim().toUpperCase();
    const clinicName = String(input.clinicName || 'Consultorio').trim();
    const billingEmail = String(input.billingEmail || '').trim();
    const planName = String(input.planName || 'Plan Profesional Linkare').trim();
    const billingCycle = String(input.billingCycle || 'monthly').trim();
    const periodLabel = String(input.periodLabel || 'Suscripción Linkare').trim();
    const dueDate = input.dueDate || null;
    const isDemo = Boolean(input.isDemo);

    const db = supabaseAdmin();
    const { data: account, error: accountError } = await db
      .from('linkare_billing_accounts')
      .upsert({
        slug,
        clinic_name: clinicName,
        billing_email: billingEmail || null,
        plan_name: planName,
        price: amount,
        currency,
        billing_cycle: billingCycle,
        active: true,
        is_demo: isDemo,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'slug' })
      .select('id,slug,clinic_name,billing_email,plan_name,price,currency,billing_cycle,active,is_demo,updated_at')
      .single();
    if (accountError) throw accountError;

    const { data: existing, error: existingError } = await db
      .from('linkare_billing_invoices')
      .select('id,status')
      .eq('account_id', account.id)
      .in('status', ['draft','pending','overdue'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    let invoice;
    if (existing) {
      const { data, error } = await db
        .from('linkare_billing_invoices')
        .update({
          period_label: periodLabel,
          amount,
          currency,
          due_date: dueDate,
          status: 'pending',
          external_reference: null,
          payment_link_id: null,
          payment_url: null,
          qr_url: null,
          external_transaction_id: null,
          provider_payload: {},
          paid_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('id,payment_token,period_label,amount,currency,due_date,status,payment_url,qr_url,is_test,paid_at,created_at,updated_at')
        .single();
      if (error) throw error;
      invoice = data;
    } else {
      const { data, error } = await db
        .from('linkare_billing_invoices')
        .insert({ account_id: account.id, period_label: periodLabel, amount, currency, due_date: dueDate, status: 'pending' })
        .select('id,payment_token,period_label,amount,currency,due_date,status,payment_url,qr_url,is_test,paid_at,created_at,updated_at')
        .single();
      if (error) throw error;
      invoice = data;
    }

    return jsonResponse(request, { ok: true, account, invoice });
  } catch (error) {
    return jsonResponse(request, {
      ok: false,
      message: error instanceof Error ? error.message : 'No se pudo actualizar el precio.',
    }, 400);
  }
});
