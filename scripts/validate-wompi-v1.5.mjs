import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'src/lib/supabase.js',
  'src/services/wompi.js',
  'supabase/functions/_shared/cors.ts',
  'supabase/functions/_shared/wompi.ts',
  'supabase/functions/wompi-app-info/index.ts',
  'supabase/functions/wompi-create-link/index.ts',
  'supabase/functions/wompi-webhook/index.ts',
  'supabase/migrations/20260821_v1_5_wompi_api.sql',
  'supabase/DEPLOY-WOMPI.ps1',
];

const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error('WOMPI_V1_5_MISSING_FILES', missing);
  process.exit(1);
}

const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const wompiService = fs.readFileSync(path.join(root, 'src/services/wompi.js'), 'utf8');
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const requiredAppTokens = [
  'createWompiPaymentLink',
  'fetchWompiAppInfo',
  'openWompiPaymentRequest',
  'submitWompiPaymentRequest',
  'wompi-create-link',
];
const absentTokens = requiredAppTokens.filter(token => !(app + wompiService).includes(token));
if (absentTokens.length) {
  console.error('WOMPI_V1_5_APP_TOKENS_MISSING', absentTokens);
  process.exit(1);
}

if (!packageJson.dependencies?.['@supabase/supabase-js']) {
  console.error('WOMPI_V1_5_SUPABASE_DEPENDENCY_MISSING');
  process.exit(1);
}

if (/VITE_WOMPI_CLIENT_SECRET|VITE_WOMPI_API_SECRET/.test(envExample)) {
  console.error('WOMPI_V1_5_SECRET_EXPOSED_IN_VITE_ENV');
  process.exit(1);
}

console.log('WOMPI_V1_5_QA_OK');
console.log(JSON.stringify({ requiredFiles: required.length, appTokens: requiredAppTokens.length }, null, 2));
