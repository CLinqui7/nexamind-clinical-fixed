import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const data = fs.readFileSync(new URL('../src/data.js', import.meta.url), 'utf8');
const billingService = fs.readFileSync(new URL('../src/services/billing.js', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260821_v1_6_platform_billing.sql', import.meta.url), 'utf8');
const createFunction = fs.readFileSync(new URL('../supabase/functions/linkare-create-payment-link/index.ts', import.meta.url), 'utf8');
const adminFunction = fs.readFileSync(new URL('../supabase/functions/linkare-billing-admin/index.ts', import.meta.url), 'utf8');

const checks = [
  ['owner account', data.includes("role: 'owner'") && data.includes('LinkareAdmin2026!')],
  ['doctor pays platform copy', app.includes('El psiquiatra paga Linkare') || app.includes('Mi plan Linkare')],
  ['price admin flow', app.includes('openPlatformBillingAdmin') && app.includes('submitPlatformBillingAdmin')],
  ['fixed invoice payment', app.includes('createPlatformPaymentLink(invoice.payment_token)')],
  ['billing service', billingService.includes('linkare-billing-summary') && billingService.includes('linkare-billing-admin')],
  ['billing tables', migration.includes('linkare_billing_accounts') && migration.includes('linkare_billing_invoices')],
  ['amount from database', createFunction.includes('Number(invoice.amount)') && !createFunction.includes('Number(input.amount)')],
  ['admin secret', adminFunction.includes('LINKARE_ADMIN_KEY') && adminFunction.includes('x-linkare-admin-key')],
  ['wompi credentials backend only', !app.includes('import.meta.env.VITE_WOMPI')],
  ['visible tutorial', app.includes('visible-background-tour')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('LINKARE_PLATFORM_BILLING_QA_FAILED');
  failed.forEach(([name]) => console.error(`- ${name}`));
  process.exit(1);
}

console.log('LINKARE_PLATFORM_BILLING_QA_OK');
console.log(JSON.stringify({ checks: checks.length, version: '1.6.0' }, null, 2));
