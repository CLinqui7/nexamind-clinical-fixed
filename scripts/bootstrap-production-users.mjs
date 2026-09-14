import { createClient } from '@supabase/supabase-js';

const getArg = name => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
};

const url = getArg('url') || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const orgName = getArg('org') || 'Consultorio Principal';
const adminEmail = (getArg('admin-email') || 'linquicarloss@gmail.com').toLowerCase();
const adminPassword = process.env.LINKARE_ADMIN_PASSWORD;
const doctorEmail = (getArg('doctor-email') || 'linquicarloss+doctor@gmail.com').toLowerCase();
const secretaryEmail = (getArg('secretary-email') || 'linquicarloss+secretaria@gmail.com').toLowerCase();
const doctorPassword = process.env.LINKARE_DOCTOR_PASSWORD;
const secretaryPassword = process.env.LINKARE_SECRETARY_PASSWORD;

if (!url || !/^https:\/\/[a-z]{20}\.supabase\.co$/i.test(url)) {
  throw new Error('SUPABASE_URL inválida. Use https://<project-ref>.supabase.co');
}
if (!serviceKey) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY.');
if (!adminPassword) throw new Error('Falta LINKARE_ADMIN_PASSWORD.');
if (!doctorPassword) throw new Error('Falta LINKARE_DOCTOR_PASSWORD.');
if (!secretaryPassword) throw new Error('Falta LINKARE_SECRETARY_PASSWORD.');

const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function findUser(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find(user => String(user.email || '').toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function upsertUser({ email, password, fullName, roleLabel }) {
  let user = await findUser(email);
  const metadata = { full_name: fullName, linkare_role_label: roleLabel, production_account: true };
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) throw new Error(`No se pudo crear ${email}: ${error.message}`);
    user = data.user;
  } else {
    const { data, error } = await db.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(user.user_metadata || {}), ...metadata },
    });
    if (error) throw new Error(`No se pudo actualizar ${email}: ${error.message}`);
    user = data.user;
  }
  return user;
}

async function assertV3Schema() {
  const required = ['linkare_records', 'linkare_plans_v3', 'linkare_subscriptions_v3'];
  for (const table of required) {
    const { error } = await db.from(table).select('*', { head: true, count: 'exact' }).limit(1);
    if (error) throw new Error(`Falta la migración Linkare v3 (${table}): ${error.message}`);
  }
}

function slugify(value) {
  return String(value || 'consultorio')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'consultorio';
}

async function ensureOrganization(adminUser) {
  const { data: existing, error: existingError } = await db
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', adminUser.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.organization_id) return existing.organization_id;

  const slug = `${slugify(orgName)}-${adminUser.id.replaceAll('-', '').slice(0, 8)}`;
  const { data: org, error } = await db
    .from('organizations')
    .insert({ name: orgName, slug, is_demo: false, timezone: 'America/El_Salvador' })
    .select('id')
    .single();
  if (error) throw new Error(`No se pudo crear el consultorio: ${error.message}`);
  return org.id;
}

async function upsertMember(orgId, user, role, displayName, title, permissions = {}) {
  const row = {
    organization_id: orgId,
    user_id: user.id,
    role,
    display_name: displayName,
    professional_title: title,
    active: true,
    permissions,
  };
  const { error } = await db
    .from('organization_members')
    .upsert(row, { onConflict: 'organization_id,user_id' });
  if (error) throw new Error(`No se pudo asignar ${role} a ${user.email}: ${error.message}`);
}

async function ensureClinicRecords(orgId, doctorEmail) {
  const now = new Date().toISOString();
  const profile = {
    name: orgName,
    clinician: 'Médico Principal',
    specialty: 'Psiquiatría',
    professionalLicense: '',
    address: '',
    phone: '',
    email: doctorEmail,
    website: '',
    clinicLogo: '/assets/linkare-logo.jpg',
    doctorPhoto: '',
    prescriptionFooter: 'Documento emitido para revisión, firma y sello del profesional tratante.',
    updatedAt: now,
  };
  const settings = {
    largeText: false,
    reducedMotion: false,
    simpleMode: true,
    theme: 'light',
    reminderHours: [24, 8],
    reminderChannels: ['email'],
  };
  for (const record of [
    { kind: 'profile', id: 'clinic', payload: profile },
    { kind: 'settings', id: 'clinic', payload: settings },
  ]) {
    const { error } = await db.from('linkare_records').upsert({
      organization_id: orgId,
      ...record,
      deleted: false,
    }, { onConflict: 'organization_id,kind,id' });
    if (error) throw error;
  }
  const { error: subscriptionError } = await db
    .from('linkare_subscriptions_v3')
    .upsert({ organization_id: orgId }, { onConflict: 'organization_id', ignoreDuplicates: true });
  if (subscriptionError) throw subscriptionError;
}

await assertV3Schema();

const admin = await upsertUser({
  email: adminEmail,
  password: adminPassword,
  fullName: 'Carlos Linqui',
  roleLabel: 'Administrador',
});
const doctor = await upsertUser({
  email: doctorEmail,
  password: doctorPassword,
  fullName: 'Médico Principal',
  roleLabel: 'Médico',
});
const secretary = await upsertUser({
  email: secretaryEmail,
  password: secretaryPassword,
  fullName: 'Secretaría Principal',
  roleLabel: 'Secretaría',
});

const orgId = await ensureOrganization(admin);

await upsertMember(orgId, admin, 'owner', 'Carlos Linqui', 'Administrador', {});
await upsertMember(orgId, doctor, 'psychiatrist', 'Médico Principal', 'Psiquiatría', {});
await upsertMember(orgId, secretary, 'secretary', 'Secretaría Principal', 'Secretaría clínica', {
  patientsView: true,
  patientsCreate: true,
  patientsEdit: true,
  appointmentsManage: true,
  remindersManage: true,
});
await ensureClinicRecords(orgId, doctorEmail);

await db.from('linkare_audit_v3').insert([
  { organization_id: orgId, actor_id: admin.id, action: 'production.bootstrap.admin' },
  { organization_id: orgId, actor_id: admin.id, action: 'production.bootstrap.doctor', record_id: doctor.id },
  { organization_id: orgId, actor_id: admin.id, action: 'production.bootstrap.secretary', record_id: secretary.id },
]);

console.log(JSON.stringify({
  ok: true,
  organizationId: orgId,
  users: [
    { email: adminEmail, role: 'Administrador (owner)' },
    { email: doctorEmail, role: 'Médico' },
    { email: secretaryEmail, role: 'Secretaría' },
  ],
  subscription: 'Sin periodo activo todavía. El médico/administrador debe elegir un plan y pagar con Wompi.',
}, null, 2));
