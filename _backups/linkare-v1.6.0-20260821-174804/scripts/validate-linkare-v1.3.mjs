import fs from 'node:fs';
const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const data = fs.readFileSync(new URL('../src/data.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const checks = {
  compactTutorial: app.includes("linkare-tutorial-v4") && app.includes('compact-guided-tour') && app.includes('visible-background-tour'),
  paymentsView: app.includes('renderPayments()') && app.includes("['payments', 'insurance', 'Mi plan'"),
  billingModal: app.includes("billingSettings") && app.includes('renderBillingSettingsModal()'),
  loginPreserved: app.includes('renderLogin()') && app.includes('authenticateLocalUser'),
  linkareLogo: data.includes("/assets/linkare-logo.jpg"),
  paymentData: data.includes('wompiCheckoutUrl') && data.includes('payments:'),
  responsiveTutorial: css.includes('.compact-guided-tour .compact-card'),
};
const failed = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
if (failed.length) {
  console.error('LINKARE_V130_QA_FAILED', failed);
  process.exit(1);
}
console.log('LINKARE_V130_QA_OK');
console.log(JSON.stringify(checks, null, 2));
