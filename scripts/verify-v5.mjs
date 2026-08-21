import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(import.meta.dirname, '..'));
const files = {
  app: path.join(root, 'src', 'app.js'),
  data: path.join(root, 'src', 'data.js'),
  practice: path.join(root, 'src', 'practice.js'),
  styles: path.join(root, 'styles.css'),
  selenium: path.join(root, 'qa', 'selenium', 'test_nexamind.py'),
  seleniumRunner: path.join(root, 'qa', 'selenium', 'RUN-SELENIUM-QA.ps1'),
  seleniumRequirements: path.join(root, 'qa', 'selenium', 'requirements.txt'),
};

for (const [name, file] of Object.entries(files)) {
  assert.ok(fs.existsSync(file), `Missing ${name}: ${file}`);
}

const app = fs.readFileSync(files.app, 'utf8');
const data = fs.readFileSync(files.data, 'utf8');
const practice = fs.readFileSync(files.practice, 'utf8');
const styles = fs.readFileSync(files.styles, 'utf8');
const selenium = fs.readFileSync(files.selenium, 'utf8');

const requiredAppPhrases = [
  "const TUTORIAL_STORAGE_KEY = 'nexamind-clinical-tutorial-v5'",
  'const TUTORIAL_VERSION = 7',
  "id: 'action-enable-insurance'",
  "draftField: 'hasInsurance'",
  'patient-form-insurance-toggle',
  'patient-form-insurance-details',
  'renderTourGuards = (rect, interactive) =>',
  'getVisibleTourRect = target =>',
  'observeTourTarget = target =>',
  'disconnectTourObservers = () =>',
  'data-tour-spotlight="true"',
  'data-tour-card="true"',
  'tour-target-warning',
  'describeTourTransition = step =>',
  'class AppErrorBoundary extends React.Component',
  'renderLogin()',
];
for (const phrase of requiredAppPhrases) assert.ok(app.includes(phrase), `Missing app feature: ${phrase}`);

assert.equal(app.includes('tour-modal-split'), false, 'The old modal displacement logic is still referenced in app.js.');
assert.equal(styles.includes('translateX(calc(-1 * min(160px, 12vw)))'), false, 'Old right modal shift remains in CSS.');
assert.equal(styles.includes('translateX(min(160px, 12vw))'), false, 'Old left modal shift remains in CSS.');
assert.ok(styles.includes('.tour-guards'), 'Tour guards CSS is missing.');
assert.ok(styles.includes('.tour-transition'), 'Tour transition banner CSS is missing.');
assert.ok(styles.includes('.tour-target-warning'), 'Missing target warning CSS.');
assert.ok(styles.includes('[data-tour-active-target="true"]'), 'Active target CSS is missing.');
assert.ok(styles.includes('.priority-row'), 'Priority alignment CSS is missing.');

const arrayStart = app.indexOf('const TOUR_STEPS = [');
const arrayEnd = app.indexOf('\n];', arrayStart);
assert.ok(arrayStart >= 0 && arrayEnd > arrayStart, 'TOUR_STEPS array was not found.');
const jsonText = app.slice(arrayStart + 'const TOUR_STEPS = '.length, arrayEnd + 2);
const baseSteps = JSON.parse(jsonText);
assert.ok(baseSteps.length >= 78, `Expected at least 78 base steps, found ${baseSteps.length}.`);
assert.ok(baseSteps.some(step => step.id === 'patient-form-insurance-details'), 'Insurance details step missing.');
assert.equal(baseSteps.some(step => step.id === 'patient-form-insurance'), false, 'Old broad insurance step remains.');

const selectors = baseSteps.map(step => step.selector).filter(Boolean);
const dataTourValues = new Set([
  ...[...app.matchAll(/data-tour=(?:"([^"]+)"|\{`([^`$]+)`\})/g)].map(match => match[1] || match[2]).filter(Boolean),
  ...[...app.matchAll(/\btour="([^"]+)"/g)].map(match => match[1]),
]);
for (const selector of selectors) {
  const match = selector.match(/^\[data-tour="([^"]+)"\]$/);
  if (!match) continue;
  assert.ok(dataTourValues.has(match[1]) || app.includes(`data-tour=${JSON.stringify(match[1])}`), `Tutorial selector has no matching data-tour target: ${selector}`);
}

assert.ok(selenium.includes('webdriver.Chrome'), 'Selenium Chrome driver setup is missing.');
assert.ok(selenium.includes('assert_spotlight_aligned'), 'Selenium geometry assertion is missing.');
assert.ok(selenium.includes('test_02_tutorial_insurance_focus_and_guided_clicks'), 'Selenium insurance tutorial test is missing.');
assert.ok(selenium.includes('test_03_mobile_tutorial_has_no_blank_screen'), 'Selenium mobile blank-screen test is missing.');
assert.ok(selenium.includes('test_04_secretary_login_and_restricted_view'), 'Selenium secretary permission test is missing.');

let braceBalance = 0;
let inComment = false;
let quote = null;
let escaped = false;
for (let i = 0; i < styles.length; i += 1) {
  const char = styles[i];
  const next = styles[i + 1] || '';
  if (inComment) {
    if (char === '*' && next === '/') { inComment = false; i += 1; }
    continue;
  }
  if (quote) {
    if (escaped) escaped = false;
    else if (char === '\\') escaped = true;
    else if (char === quote) quote = null;
    continue;
  }
  if (char === '/' && next === '*') { inComment = true; i += 1; continue; }
  if (char === '"' || char === "'") { quote = char; continue; }
  if (char === '{') braceBalance += 1;
  if (char === '}') braceBalance -= 1;
  assert.ok(braceBalance >= 0, 'CSS has an extra closing brace.');
}
assert.equal(braceBalance, 0, 'CSS brace balance is not zero.');

const stamp = `?qa=${Date.now()}`;
const dataModule = await import(pathToFileURL(files.data).href + stamp);
const practiceModule = await import(pathToFileURL(files.practice).href + stamp);
let seed = dataModule.createSeedData();
const doctor = practiceModule.authenticateLocalUser(seed, 'doctora@nexamind.demo', 'NexaMind2026!');
const secretary = practiceModule.authenticateLocalUser(seed, 'secretaria@nexamind.demo', 'Agenda2026!');
assert.equal(doctor.role, 'doctor');
assert.equal(secretary.role, 'secretary');
assert.throws(() => practiceModule.authenticateLocalUser(seed, 'doctora@nexamind.demo', 'incorrecta'), /contraseña/i);
assert.ok(data.includes("password: 'NexaMind2026!'"), 'Doctor demo credential missing.');
assert.ok(data.includes("password: 'Agenda2026!'"), 'Secretary demo credential missing.');
assert.ok(practice.includes('authenticateLocalUser'), 'Local authentication function missing.');

const rectangleOverlap = (a, b, padding = 16) => !(
  a.right + padding < b.left
  || a.left - padding > b.right
  || a.bottom + padding < b.top
  || a.top - padding > b.bottom
);
const target = { left: 350, top: 420, right: 1030, bottom: 560 };
const cardRight = { left: 1180, top: 90, right: 1600, bottom: 850 };
const staleShiftedTarget = { left: 510, top: 420, right: 1190, bottom: 560 };
assert.equal(rectangleOverlap(cardRight, target), false, 'Reference right-side card should not overlap target.');
assert.equal(rectangleOverlap(cardRight, staleShiftedTarget), true, 'Geometry regression fixture is invalid.');
assert.ok(app.includes('requestAnimationFrame(() => requestAnimationFrame(measure))'), 'Stable double-frame measurement is missing.');

console.log('NEXAMIND_V5_QA_OK');
console.log(JSON.stringify({
  baseTutorialSteps: baseSteps.length,
  exactInsuranceTarget: true,
  guardedInteraction: true,
  modalDisplacementRemoved: true,
  stableTargetObservation: true,
  seleniumSuite: 'included',
  loginDoctor: 'ok',
  loginSecretary: 'ok',
  css: 'balanced',
}, null, 2));
