import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const required = [
  'src/app.js', 'src/data.js', 'src/clinical.js', 'src/practice.js', 'src/v2features.js',
  'src/services/documents.js', 'src/services/reminders.js', 'src/services/calendar.js',
  'supabase/migrations/20260825_v2_0_annual_documents_encounters.sql',
  'supabase/functions/send-reminder/index.ts',
  'supabase/functions/reminder-provider-status/index.ts',
  'supabase/functions/google-calendar-auth-url/index.ts',
  'supabase/functions/google-calendar-callback/index.ts',
  'supabase/functions/google-calendar-sync/index.ts',
  'supabase/functions/calendar-status/index.ts',
  'supabase/functions/calendar-feed-token/index.ts',
  'supabase/functions/calendar-feed/index.ts',
];
const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error('LINKARE_V2_MISSING_FILES', missing);
  process.exit(1);
}

const app = read('src/app.js');
const data = read('src/data.js');
const clinical = read('src/clinical.js');
const practice = read('src/practice.js');
const features = read('src/v2features.js');
const documents = read('src/services/documents.js');
const migration = read('supabase/migrations/20260825_v2_0_annual_documents_encounters.sql');
const wompiCreate = read('supabase/functions/wompi-create-link/index.ts');
const wompiWebhook = read('supabase/functions/wompi-webhook/index.ts');
const env = read('.env.example');

const checks = {
  annualPlan400: data.includes('subscriptionPrice: 400') && data.includes("billingCycle: 'anual'") && app.includes('US$400'),
  currentPlanExperience: app.includes('Mi plan Linkare') && app.includes('Próxima renovación') && app.includes('Comparar planes'),
  annualWompiServerPrice: wompiCreate.includes('subscription_price') && wompiCreate.includes('period_start') && wompiCreate.includes('period_end') && wompiCreate.includes("'psychiatrist'"),
  annualWebhookActivation: wompiWebhook.includes("subscription_status: 'active'") && wompiWebhook.includes('current_period_end'),
  documentsPrivateStorage: documents.includes("const BUCKET = 'patient-documents'") && migration.includes("'patient-documents'") && documents.includes('createSignedUrl'),
  documentAudit: migration.includes('patient_document_audit') && documents.includes('logPatientDocumentAction'),
  consultationPrompt: app.includes('¿Ya está con el paciente?') && app.includes('checkConsultationPrompt'),
  virtualNotebook: app.includes('Libreta de consulta') && app.includes('Guardado automático') && app.includes('Firmar y finalizar'),
  consultationVersioning: features.includes('versions:') && features.includes('signedAt') && features.includes('upsertEncounter'),
  patientIdentity: clinical.includes('sexualOrientation') && clinical.includes('genderIdentity') && app.includes('Orientación sexual'),
  safetyHistory: clinical.includes('suicideAttemptsCount') && app.includes('Antecedentes de seguridad') && features.includes('Plan de seguridad'),
  vitalStatus: clinical.includes("vitalStatus === 'deceased'") && app.includes('Expediente en modo post mortem'),
  postmortemReport: features.includes('Resumen clínico post mortem') && features.includes('No determina causa o manera de muerte'),
  multichannelReminders: practice.includes("['email'") || (app.includes('REMINDER_CHANNELS') && app.includes('sendReminderChannel')),
  reminderProviders: fs.existsSync(path.join(root, 'supabase/functions/send-reminder/index.ts')) && migration.includes('linkare_notification_deliveries'),
  googleCalendar: app.includes('Google Calendar') && fs.existsSync(path.join(root, 'supabase/functions/google-calendar-sync/index.ts')),
  appleCalendar: app.includes('Apple Calendar') && fs.existsSync(path.join(root, 'supabase/functions/calendar-feed/index.ts')),
  privateCalendarFeed: read('supabase/functions/calendar-feed/index.ts').includes('Consulta privada') && migration.includes('calendar_feed_tokens'),
  doctorAndSecretaryDemo: data.includes("user_doctor_1") && data.includes("user_secretary_1") && app.includes('Entrar como Médico') && app.includes('Entrar como Secretaría'),
  secretaryRestricted: practice.includes('documentsView: false') && practice.includes('consultationsManage: false') && practice.includes('postmortemExport: false') && migration.includes("array['owner','psychiatrist']"),
  calendarTokensServerOnly: migration.includes('Tokens de OAuth y feeds se consultan únicamente mediante Edge Functions') && !migration.includes('create policy calendar_connections_select'),
  noClientSecrets: !/VITE_(WOMPI|TWILIO|RESEND|META|GOOGLE).*SECRET/i.test(env),
};

const failed = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
if (failed.length) {
  console.error('LINKARE_V2_QA_FAILED', failed);
  console.error(JSON.stringify(checks, null, 2));
  process.exit(1);
}
console.log('LINKARE_V2_QA_OK');
console.log(JSON.stringify(checks, null, 2));
