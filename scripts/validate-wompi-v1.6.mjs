import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'src/lib/supabase.js',
  'src/services/wompi.js',
  'src/services/billing.js',
  'supabase/functions/_shared/cors.ts',
  'supabase/functions/_shared/wompi.ts',
  'supabase/functions/_shared/supabase-admin.ts',
  'supabase/functions/wompi-app-info/index.ts',
  'supabase/functions/linkare-billing-summary/index.ts',
  'supabase/functions/linkare-billing-admin/index.ts',
  'supabase/functions/linkare-create-payment-link/index.ts',
  'supabase/functions/wompi-webhook/index.ts',
  'supabase/migrations/20260821_v1_6_platform_billing.sql',
  'supabase/DEPLOY-WOMPI.ps1',
];

const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error('WOMPI_V1_6_MISSING_FILES', missing);
  process.exit(1);
}

const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const billingService = fs.readFileSync(path.join(root, 'src/services/billing.js'), 'utf8');
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const functionsEnv = fs.readFileSync(path.join(root, 'supabase/.env.functions.example'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const requiredTokens = [
  'fetchPlatformBillingSummary',
  'savePlatformBillingPrice',
  'createPlatformPaymentLink',
  'linkare-billing-summary',
  'linkare-billing-admin',
  'linkare-create-payment-link',
  'WOMPI_CLIENT_ID',
  'WOMPI_CLIENT_SECRET',
  'LINKARE_ADMIN_KEY',
];
const combined = app + billingService + functionsEnv;
const absent = requiredTokens.filter(token => !combined.includes(token));
if (absent.length) {
  console.error('WOMPI_V1_6_TOKENS_MISSING', absent);
  process.exit(1);
}

if (!packageJson.dependencies?.['@supabase/supabase-js']) {
  console.error('WOMPI_V1_6_SUPABASE_DEPENDENCY_MISSING');
  process.exit(1);
}

if (/VITE_WOMPI_CLIENT_SECRET|VITE_WOMPI_API_SECRET|VITE_WOMPI_SECRET/.test(envExample)) {
  console.error('WOMPI_V1_6_SECRET_EXPOSED_IN_VITE_ENV');
  process.exit(1);
}

console.log('WOMPI_V1_6_QA_OK');
console.log(JSON.stringify({ requiredFiles: required.length, tokens: requiredTokens.length }, null, 2));
