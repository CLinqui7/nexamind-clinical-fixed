import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'src/services/appState.js',
  'src/services/wompi.js',
  'supabase/functions/wompi-app-info/index.ts',
  'supabase/functions/wompi-create-link/index.ts',
  'supabase/functions/wompi-webhook/index.ts',
  'supabase/functions/_shared/cors.ts',
];
const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error('LINKARE_PRODUCTION_MISSING_FILES', missing);
  process.exit(1);
}

const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const data = fs.readFileSync(path.join(root, 'src/data.js'), 'utf8');
const appState = fs.readFileSync(path.join(root, 'src/services/appState.js'), 'utf8');
const createFunction = fs.readFileSync(path.join(root, 'supabase/functions/wompi-create-link/index.ts'), 'utf8');
const appInfoFunction = fs.readFileSync(path.join(root, 'supabase/functions/wompi-app-info/index.ts'), 'utf8');
const webhookFunction = fs.readFileSync(path.join(root, 'supabase/functions/wompi-webhook/index.ts'), 'utf8');
const cors = fs.readFileSync(path.join(root, 'supabase/functions/_shared/cors.ts'), 'utf8');
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');

const checks = {
  twoDemoRoles: data.includes("id: 'user_doctor_1'") && data.includes("id: 'user_secretary_1'") && !data.includes("id: 'user_owner_1'"),
  ownerDemoHidden: !app.includes('Administración Linkare</b><span>${owner.email}'),
  doctorCanRequestOwnPayment: app.includes("['owner', 'doctor'].includes(this.activeUser()?.role)") && app.includes('openWompiPaymentRequest'),
  productionAuth: appState.includes('signInWithPassword') && app.includes('productionMode'),
  remotePersistence: appState.includes('linkare_app_state') && app.includes('saveProductionState'),
  subscriptionPage: app.includes('Mi plan Linkare'),
  price40: data.includes('subscriptionPrice: 40'),
  noAdminMustGenerateText: !app.includes('Administración debe generar el enlace.'),
  serverUsesStoredPrice: createFunction.includes('linkare_platform_billing_settings') && createFunction.includes('subscription_price'),
  doctorOrOwnerServerPermission: createFunction.includes("['owner', 'doctor']"),
  appInfoRequiresSession: appInfoFunction.includes('verifySession'),
  webhookValidation: webhookFunction.includes('verifyWompiWebhook'),
  corsUsesRequestOrigin: cors.includes("request.headers.get('origin')") && cors.includes('Access-Control-Allow-Origin'),
  noWompiSecretInVite: !/VITE_WOMPI_(CLIENT_SECRET|API_SECRET|SECRET)/.test(envExample),
};

const failed = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
if (failed.length) {
  console.error('LINKARE_PRODUCTION_QA_FAILED', failed);
  process.exit(1);
}
console.log('LINKARE_PRODUCTION_QA_OK');
console.log(JSON.stringify(checks, null, 2));
