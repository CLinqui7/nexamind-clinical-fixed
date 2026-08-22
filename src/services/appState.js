import { supabase, supabaseConfigured } from '../lib/supabase.js';

export const appMode = String(import.meta.env.VITE_APP_MODE || 'demo').trim().toLowerCase();
export const productionMode = appMode === 'production';
export const publicAppUrl = String(
  import.meta.env.VITE_PUBLIC_APP_URL || 'https://nexamind-clinical.vercel.app'
).trim().replace(/\/+$/, '');

export async function signUpProduction({ fullName, clinicName, email, password }) {
  if (!productionMode) return null;
  if (!supabaseConfigured || !supabase) throw new Error('Supabase no está configurado para producción.');
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(fullName || '').trim();
  const cleanClinic = String(clinicName || '').trim();
  if (!cleanName) throw new Error('Escriba su nombre completo.');
  if (!cleanClinic) throw new Error('Escriba el nombre de su clínica o consultorio.');
  if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Escriba un correo válido.');
  if (String(password || '').length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      emailRedirectTo: `${publicAppUrl || window.location.origin}/?email_confirmed=1`,
      data: {
        full_name: cleanName,
        clinic_name: cleanClinic,
        role: 'doctor',
      },
    },
  });
  if (error) throw new Error(error.message || 'No se pudo crear la cuenta.');
  return {
    user: data.user || null,
    session: data.session || null,
    needsEmailConfirmation: Boolean(data.user && !data.session),
    clinicName: cleanClinic,
  };
}

export async function signInProduction(email, password) {
  if (!productionMode) return null;
  if (!supabaseConfigured || !supabase) throw new Error('Supabase no está configurado para producción.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message || 'No se pudo iniciar sesión en Supabase.');
  return data.session;
}

export async function getProductionSession() {
  if (!productionMode || !supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message || 'No se pudo leer la sesión.');
  return data.session;
}

export async function signOutProduction() {
  if (!productionMode || !supabaseConfigured || !supabase) return;
  await supabase.auth.signOut();
}

export async function bootstrapAndLoadState(seedPayload, requestedOrganizationName = null) {
  if (!productionMode) return { organizationId: null, payload: seedPayload };
  if (!supabaseConfigured || !supabase) throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');

  const requestedName = requestedOrganizationName || seedPayload?.organization?.name || 'Linkare Clinic';
  let organizationId = null;

  const { data: rpcOrganizationId, error: bootstrapError } = await supabase.rpc('linkare_bootstrap_organization', {
    requested_name: requestedName,
    requested_slug: null,
  });

  if (!bootstrapError && rpcOrganizationId) {
    organizationId = rpcOrganizationId;
  } else {
    const missingRpc = /Could not find the function|schema cache|PGRST202/i.test(String(bootstrapError?.message || ''));
    if (!missingRpc) throw new Error(bootstrapError?.message || 'No se pudo preparar la organización.');

    const { data: functionData, error: functionError } = await supabase.functions.invoke('linkare-bootstrap', {
      body: { requestedName },
    });
    if (functionError) throw new Error(functionError.message || 'No se pudo preparar la organización.');
    organizationId = functionData?.organizationId || null;
    if (!organizationId) throw new Error(functionData?.error || 'No se pudo crear la organización en Supabase.');
  }

  const { data: userData } = await supabase.auth.getUser();
  const currentUserId = userData?.user?.id || null;
  let memberRole = null;
  let memberName = null;
  if (currentUserId) {
    const { data: memberRow } = await supabase
      .from('organization_members')
      .select('role, display_name')
      .eq('organization_id', organizationId)
      .eq('user_id', currentUserId)
      .maybeSingle();
    memberRole = memberRow?.role || null;
    memberName = memberRow?.display_name || null;
  }

  const { data: stateRow, error: stateError } = await supabase
    .from('linkare_app_state')
    .select('payload, version')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (stateError) throw new Error(stateError.message || 'No se pudo cargar el estado de Linkare.');

  const remoteBilling = await loadPlatformBillingSettings(organizationId);
  const mergeBilling = payload => remoteBilling
    ? { ...payload, billing: { ...(payload?.billing || {}), ...remoteBilling } }
    : payload;

  if (stateRow?.payload && Object.keys(stateRow.payload).length) {
    return { organizationId, payload: mergeBilling(stateRow.payload), memberRole, memberName };
  }

  const initialPayload = mergeBilling(seedPayload);
  const { error: insertError } = await supabase.from('linkare_app_state').upsert({
    organization_id: organizationId,
    payload: initialPayload,
    version: 1,
  }, { onConflict: 'organization_id' });
  if (insertError) throw new Error(insertError.message || 'No se pudo crear el estado inicial.');

  return { organizationId, payload: initialPayload, memberRole, memberName };
}

export async function saveProductionState(organizationId, payload) {
  if (!productionMode || !organizationId || !supabaseConfigured || !supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  const safePayload = {
    ...payload,
    users: Array.isArray(payload?.users)
      ? payload.users.map(({ password, ...user }) => user)
      : [],
  };
  const { error } = await supabase.from('linkare_app_state').upsert({
    organization_id: organizationId,
    payload: safePayload,
    version: 1,
    updated_by: userData?.user?.id || null,
  }, { onConflict: 'organization_id' });
  if (error) throw new Error(error.message || 'No se pudo guardar en Supabase.');
}

export async function loadPlatformBillingSettings(organizationId) {
  if (!productionMode || !organizationId || !supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('linkare_platform_billing_settings')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message || 'No se pudo cargar la configuración de la licencia.');
  if (!data) return null;
  return {
    planName: data.plan_name,
    planDescription: data.plan_description,
    subscriptionPrice: Number(data.subscription_price) || 0,
    currency: data.currency || 'USD',
    billingCycle: data.billing_cycle || 'mensual',
    payerName: data.payer_name || '',
    payerEmail: data.payer_email || '',
    active: data.active !== false,
  };
}

export async function savePlatformBillingSettings(organizationId, billing) {
  if (!productionMode || !organizationId || !supabaseConfigured || !supabase) return;
  const { error } = await supabase.from('linkare_platform_billing_settings').upsert({
    organization_id: organizationId,
    plan_name: billing.planName,
    plan_description: billing.planDescription,
    subscription_price: Number(billing.subscriptionPrice),
    currency: billing.currency || 'USD',
    billing_cycle: billing.billingCycle || 'mensual',
    payer_name: billing.payerName || null,
    payer_email: billing.payerEmail || null,
    active: billing.active !== false,
  }, { onConflict: 'organization_id' });
  if (error) throw new Error(error.message || 'No se pudo guardar el precio de la licencia en Supabase.');
}
