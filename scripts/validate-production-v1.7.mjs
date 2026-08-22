import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'src/app.js',
  'src/data.js',
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

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('src/app.js');
const data = read('src/data.js');
const appState = read('src/services/appState.js');
const wompiClient = read('src/services/wompi.js');
const createFunction = read('supabase/functions/wompi-create-link/index.ts');
const appInfoFunction = read('supabase/functions/wompi-app-info/index.ts');
const webhookFunction = read('supabase/functions/wompi-webhook/index.ts');
const cors = read('supabase/functions/_shared/cors.ts');
const envExample = fs.existsSync(path.join(root, '.env.example')) ? read('.env.example') : '';

const checks = {
  twoDemoRoles:
    data.includes("id: 'user_doctor_1'") &&
    data.includes("id: 'user_secretary_1'") &&
    !data.includes("id: 'user_owner_1'"),

  secretaryVisibleInLogin:
    app.includes("fillDemoCredentials('secretary')") &&
    app.includes("role === 'secretary'") &&
    data.includes('secretaria@nexamind.demo'),

  doctorVisibleInLogin:
    app.includes("fillDemoCredentials('doctor')") &&
    app.includes("role === 'doctor'") &&
    data.includes('doctora@nexamind.demo'),

  doctorCanRequestOwnPayment:
    app.includes("['owner', 'doctor'].includes(this.activeUser()?.role)") &&
    app.includes('openWompiPaymentRequest'),

  demoCannotCreateRealPayment:
    app.includes('if (!this.state.remoteOrganizationId)') &&
    app.includes('Este acceso es de demostración') &&
    app.includes('inicie sesión con una cuenta registrada'),

  productionAuth:
    appState.includes('signInWithPassword') && app.includes('productionMode'),

  remotePersistence:
    appState.includes('linkare_app_state') && app.includes('saveProductionState'),

  subscriptionPage:
    app.includes('Mi plan Linkare'),

  price40:
    data.includes('subscriptionPrice: 40'),

  noAdminMustGenerateText:
    !app.includes('Administración debe generar el enlace.'),

  serverUsesStoredPrice:
    createFunction.includes('linkare_platform_billing_settings') &&
    createFunction.includes('subscription_price'),

  doctorOrOwnerServerPermission:
    createFunction.includes("['owner', 'doctor']"),

  createLinkRequiresRealSession:
    createFunction.includes("request.headers.get('Authorization')") &&
    createFunction.includes('auth.getUser') &&
    createFunction.includes('config.requireAuth'),

  appInfoIsPublicSafeHealthCheck:
    !appInfoFunction.includes('verifySession') &&
    appInfoFunction.includes("wompiRequest('/Aplicativo'") &&
    !appInfoFunction.includes('WOMPI_CLIENT_SECRET') &&
    !appInfoFunction.includes('clientSecret'),

  frontendShowsRealWompiError:
    wompiClient.includes('extractFunctionError') &&
    wompiClient.includes('data?.message'),

  webhookValidation:
    webhookFunction.includes('verifyWompiWebhook'),

  corsUsesRequestOrigin:
    cors.includes("request.headers.get('origin')") &&
    cors.includes('Access-Control-Allow-Origin'),

  noWompiSecretInVite:
    !/VITE_WOMPI_(CLIENT_SECRET|API_SECRET|SECRET)/.test(envExample),
};

const failed = Object.entries(checks)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (failed.length) {
  console.error('LINKARE_PRODUCTION_QA_FAILED', failed);
  console.error(JSON.stringify(checks, null, 2));
  process.exit(1);
}

console.log('LINKARE_PRODUCTION_QA_OK');
console.log(JSON.stringify(checks, null, 2));
