import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabase-admin.ts';

function slugify(value: string) {
  return String(value || 'linkare-clinic')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'linkare-clinic';
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { ok: false, error: 'Método no permitido.' }, 405);

  try {
    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return jsonResponse(request, { ok: false, error: 'Debe iniciar sesión.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
    if (!supabaseUrl || !anonKey) throw new Error('Supabase runtime credentials are missing.');

    const sessionClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await sessionClient.auth.getUser();
    if (userError || !userData?.user) return jsonResponse(request, { ok: false, error: 'Sesión inválida.' }, 401);

    const user = userData.user;
    const db = supabaseAdmin();
    const { requestedName } = await request.json().catch(() => ({ requestedName: null }));

    const { data: existing, error: existingError } = await db
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.organization_id) {
      return jsonResponse(request, { ok: true, organizationId: existing.organization_id, existed: true });
    }

    const metadata = user.user_metadata || {};
    const organizationName = String(requestedName || metadata.clinic_name || 'Linkare Clinic').trim() || 'Linkare Clinic';
    const ownerName = String(metadata.full_name || user.email || 'Profesional Linkare').trim();
    const slug = `${slugify(organizationName)}-${String(user.id).replace(/-/g, '').slice(0, 8)}`;

    const { data: organization, error: orgError } = await db
      .from('organizations')
      .insert({ name: organizationName, slug, is_demo: false })
      .select('id')
      .single();
    if (orgError) throw orgError;

    const organizationId = organization.id;
    const { error: memberError } = await db.from('organization_members').insert({
      organization_id: organizationId,
      user_id: user.id,
      role: 'owner',
      display_name: ownerName,
      active: true,
    });
    if (memberError) throw memberError;

    const { error: billingError } = await db.from('linkare_platform_billing_settings').upsert({
      organization_id: organizationId,
      plan_name: 'Plan Profesional Linkare',
      plan_description: 'Licencia mensual de Linkare para gestión psiquiátrica.',
      subscription_price: 40,
      currency: 'USD',
      billing_cycle: 'mensual',
      payer_name: ownerName,
      payer_email: user.email || null,
      active: true,
    }, { onConflict: 'organization_id' });
    if (billingError) throw billingError;

    return jsonResponse(request, { ok: true, organizationId, existed: false });
  } catch (error) {
    return jsonResponse(request, {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo crear la organización.',
    }, 500);
  }
});
