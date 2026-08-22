import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'src/services/appState.js',
  'src/services/wompi.js',
  'supabase/migrations/20260821_v1_7_platform_billing_and_state.sql',
  'supabase/functions/wompi-app-info/index.ts',
  'supabase/functions/wompi-create-link/index.ts',
  'supabase/functions/wompi-webhook/index.ts',
  'supabase/SQL-EDITOR-PRODUCCION.md',
  'supabase/LINKARE-PRODUCTION-SETUP-FRESH.sql',
];
const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error('LINKARE_V1_7_MISSING_FILES', missing);
  process.exit(1);
}

const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const data = fs.readFileSync(path.join(root, 'src/data.js'), 'utf8');
const appState = fs.readFileSync(path.join(root, 'src/services/appState.js'), 'utf8');
const createFunction = fs.readFileSync(path.join(root, 'supabase/functions/wompi-create-link/index.ts'), 'utf8');
const appInfoFunction = fs.readFileSync(path.join(root, 'supabase/functions/wompi-app-info/index.ts'), 'utf8');
const webhookFunction = fs.readFileSync(path.join(root, 'supabase/functions/wompi-webhook/index.ts'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260821_v1_7_platform_billing_and_state.sql'), 'utf8');
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');

const checks = {
  platformOwner: data.includes("role: 'owner'") && (app.includes('Administración Linkare') || app.includes("user?.role === 'owner'") || app.includes("role === 'owner'")),
  subscriptionPage: app.includes('Mi plan Linkare') && app.includes('Generar enlace Wompi'),
  editablePrice: app.includes('Editar precio') && app.includes('subscriptionPrice'),
  noPatientBilling: !app.includes('Paciente y consulta'),
  productionAuth: appState.includes('signInWithPassword') && app.includes('productionMode'),
  remotePersistence: appState.includes('linkare_app_state') && app.includes('saveProductionState'),
  remoteBillingPersistence: appState.includes('savePlatformBillingSettings') && app.includes('savePlatformBillingSettings'),
  subscriptionInvoiceFunction: createFunction.includes('linkare_subscription_invoices'),
  serverUsesStoredPrice: createFunction.includes('linkare_platform_billing_settings') && createFunction.includes('subscription_price'),
  ownerOnlyLinkCreation: createFunction.includes("member.role !== 'owner'") && migration.includes("array['owner']::public.member_role[]"),
  appInfoRequiresSession: appInfoFunction.includes('verifySession') && appInfoFunction.includes('config.requireAuth'),
  webhookValidation: webhookFunction.includes('verifyWompiWebhook') && webhookFunction.includes('linkare_wompi_events'),
  webhookIdempotency: webhookFunction.includes('transaction_id') && migration.includes('linkare_event_transaction_unique_idx'),
  noWompiSecretInVite: !/VITE_WOMPI_(CLIENT_SECRET|API_SECRET|SECRET)/.test(envExample),
};

const failed = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
if (failed.length) {
  console.error('LINKARE_V1_7_QA_FAILED', failed);
  process.exit(1);
}
console.log('LINKARE_V1_7_QA_OK');
console.log(JSON.stringify(checks, null, 2));
