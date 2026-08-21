import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

const checks = [
  ['tutorial class', app.includes('visible-background-tour')],
  ['no dim node', !app.includes('<div className="tour-dim compact-dim"></div>')],
  ['non modal tutorial', app.includes('role="complementary"') && app.includes('aria-live="polite"')],
  ['visible layout class', app.includes("tour-visible-layout")],
  ['visible background CSS', css.includes('.visible-background-tour .compact-dim')],
  ['no backdrop filter override', css.includes('backdrop-filter: none !important;')],
  ['desktop reserved column', css.includes('.tour-visible-layout .app-frame')],
  ['mobile compact card', css.includes('max-height: 42vh !important;')],
  ['look at screen guidance', app.includes('Mire la pantalla.')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('LINKARE_TUTORIAL_VISIBLE_QA_FAILED');
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}

console.log('LINKARE_TUTORIAL_VISIBLE_QA_OK');
console.log(JSON.stringify({ checks: checks.length, version: '1.5.1' }, null, 2));
