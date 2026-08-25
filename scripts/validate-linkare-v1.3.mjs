import fs from 'node:fs';
const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const data = fs.readFileSync(new URL('../src/data.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const checks = {
  visibleTutorial: app.includes("linkare-tutorial-v3") && app.includes('visible-background-tour'),
  noBlurOverlay: css.includes('.visible-background-tour .compact-dim') && css.includes('display: none !important'),
  subscriptionView: app.includes('renderPayments()') && app.includes("['payments', 'insurance', 'Mi plan'"),
  ownerPriceControl: app.includes('Administración Linkare') && app.includes('subscriptionPrice'),
  billingModal: app.includes('renderBillingSettingsModal()') && app.includes('Precio y plan de Linkare'),
  loginPreserved: app.includes('renderLogin()') && app.includes('authenticateLocalUser'),
  productionLogin: app.includes('productionMode') && app.includes('signInProduction'),
  linkareLogo: data.includes('/assets/linkare-logo.jpg'),
  subscriptionData: data.includes('Plan Profesional Linkare') && data.includes('billingPeriod'),
};
const failed = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
if (failed.length) {
  console.error('LINKARE_V1_7_UI_QA_FAILED', failed);
  process.exit(1);
}
console.log('LINKARE_V1_7_UI_QA_OK');
console.log(JSON.stringify(checks, null, 2));
