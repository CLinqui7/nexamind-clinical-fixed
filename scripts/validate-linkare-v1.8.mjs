import fs from 'node:fs';
const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const appState = fs.readFileSync(new URL('../src/services/appState.js', import.meta.url), 'utf8');
const data = fs.readFileSync(new URL('../src/data.js', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260821_v1_8_self_signup_and_price.sql', import.meta.url), 'utf8');
const checks = {
  registrationUi: app.includes('Crear mi cuenta Linkare') && app.includes('submitRegister') && app.includes('registerDraft'),
  supabaseSignup: appState.includes('signUpProduction') && appState.includes('supabase.auth.signUp'),
  clinicMetadata: appState.includes('clinic_name') && appState.includes('full_name'),
  productionLogin: app.includes('productionMode') && app.includes('signInProduction'),
  isolatedBootstrap: appState.includes('bootstrapAndLoadState(seed, requestedOrganizationName)') || appState.includes('requestedOrganizationName'),
  price40Frontend: data.includes('subscriptionPrice: 40') && app.includes('|| 40'),
  price40Database: migration.includes('subscription_price set default 40') && migration.includes("'Plan Profesional Linkare'"),
  wompiEdgeFunctions: fs.existsSync(new URL('../supabase/functions/wompi-create-link/index.ts', import.meta.url)) && fs.existsSync(new URL('../supabase/functions/wompi-webhook/index.ts', import.meta.url)),
};
const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key);
if (failed.length) {
  console.error('LINKARE_V1_8_QA_FAILED', failed);
  process.exit(1);
}
console.log('LINKARE_V1_8_QA_OK');
console.log(JSON.stringify(checks, null, 2));
