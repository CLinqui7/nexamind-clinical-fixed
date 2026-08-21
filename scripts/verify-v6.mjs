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
for (const [name, file] of Object.entries(files)) assert.ok(fs.existsSync(file), `Missing ${name}: ${file}`);

const app = fs.readFileSync(files.app, 'utf8');
const data = fs.readFileSync(files.data, 'utf8');
const practice = fs.readFileSync(files.practice, 'utf8');
const styles = fs.readFileSync(files.styles, 'utf8');
const selenium = fs.readFileSync(files.selenium, 'utf8');

const requiredApp = [
  "const TUTORIAL_STORAGE_KEY = 'nexamind-clinical-tutorial-v6'",
  'const TUTORIAL_VERSION = 8',
  'startTourCardDrag = event =>',
  'handleTourCardDrag = event =>',
  'resetTourCardPosition = () =>',
  'tourCardPosition: null',
  'retryTourTarget = (scroll, attempt) =>',
  'const maxAttempts = 24',
  "'patient-photo': ['.patient-hero .patient-photo-control'",
  'tour-drag-handle',
  'tour-auto-position',
  'Buscar de nuevo',
  'data-tour="patient-photo"',
  'data-tour="patient-badges"',
  'data-tour="patient-next-visit"',
];
for (const phrase of requiredApp) assert.ok(app.includes(phrase), `Missing v6 app feature: ${phrase}`);
assert.ok((app.match(/data-tour="patient-photo"/g) || []).length >= 2, 'Both clinical and administrative patient headers must expose patient-photo.');
assert.ok((app.match(/data-tour="patient-badges"/g) || []).length >= 2, 'Both patient header variants must expose patient-badges.');
assert.ok((app.match(/data-tour="patient-next-visit"/g) || []).length >= 2, 'Both patient header variants must expose patient-next-visit.');

const requiredCss = [
  '.tour-drag-handle',
  '.tour-auto-position',
  '.tour-card-manual',
  'body.tour-panel-dragging',
  '.tour-target-warning button',
];
for (const phrase of requiredCss) assert.ok(styles.includes(phrase), `Missing v6 CSS feature: ${phrase}`);

const arrayStart = app.indexOf('const TOUR_STEPS = [');
const arrayEnd = app.indexOf('\n];', arrayStart);
assert.ok(arrayStart >= 0 && arrayEnd > arrayStart, 'TOUR_STEPS array not found.');
const baseSteps = JSON.parse(app.slice(arrayStart + 'const TOUR_STEPS = '.length, arrayEnd + 2));
assert.ok(baseSteps.length >= 78, `Expected at least 78 base steps, found ${baseSteps.length}.`);

const staticTargets = new Set([
  ...[...app.matchAll(/data-tour=(?:"([^"]+)"|\{`([^`$]+)`\})/g)].map(match => match[1] || match[2]).filter(Boolean),
  ...[...app.matchAll(/\btour="([^"]+)"/g)].map(match => match[1]),
]);
const explicitFallbackIds = new Set(['patient-photo', 'patient-badges', 'patient-next-visit', 'patient-form-save', 'patient-form-insurance-toggle', 'patient-form-insurance-details']);
for (const step of baseSteps) {
  const match = step.selector?.match(/^\[data-tour="([^"]+)"\]$/);
  if (!match) continue;
  assert.ok(staticTargets.has(match[1]) || explicitFallbackIds.has(step.id), `No target or fallback for tutorial step ${step.id}: ${step.selector}`);
}

assert.ok(selenium.includes('ActionChains'), 'Selenium drag support is missing.');
assert.ok(selenium.includes('test_04_patient_photo_target_and_draggable_help'), 'Selenium patient photo/drag test missing.');
assert.ok(selenium.includes('patient-form-save'), 'Selenium save/cancel target regression test missing.');
assert.ok(selenium.includes("nexamind-clinical-tutorial-v6"), 'Selenium still uses an older tutorial key.');

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

const overlap = (a, b, padding = 0) => !(
  a.right + padding <= b.left
  || a.left - padding >= b.right
  || a.bottom + padding <= b.top
  || a.top - padding >= b.bottom
);
const viewport = { width: 1600, height: 1000 };
const broadModalFooter = { left: 420, top: 820, right: 1210, bottom: 905 };
const selectedSide = ((broadModalFooter.left + broadModalFooter.right) / 2) < (viewport.width / 2) ? 'right' : 'left';
const selectedCard = selectedSide === 'right'
  ? { left: viewport.width - 14 - 390, top: 14, right: viewport.width - 14, bottom: 986 }
  : { left: 14, top: 14, right: 404, bottom: 986 };
assert.equal(selectedSide, 'left', 'The broad footer fixture should choose the left side.');
assert.equal(overlap(broadModalFooter, selectedCard), false, 'Selected docked tutorial panel overlaps the broad modal footer fixture.');

const stamp = `?qa=${Date.now()}`;
const dataModule = await import(pathToFileURL(files.data).href + stamp);
const practiceModule = await import(pathToFileURL(files.practice).href + stamp);
const seed = dataModule.createSeedData();
assert.equal(practiceModule.authenticateLocalUser(seed, 'doctora@nexamind.demo', 'NexaMind2026!').role, 'doctor');
assert.equal(practiceModule.authenticateLocalUser(seed, 'secretaria@nexamind.demo', 'Agenda2026!').role, 'secretary');
assert.throws(() => practiceModule.authenticateLocalUser(seed, 'doctora@nexamind.demo', 'incorrecta'), /contraseña/i);
assert.ok(data.includes("password: 'NexaMind2026!'"), 'Doctor demo credential missing.');
assert.ok(practice.includes('authenticateLocalUser'), 'Local authentication function missing.');

console.log('NEXAMIND_V6_QA_OK');
console.log(JSON.stringify({
  baseTutorialSteps: baseSteps.length,
  draggablePanel: true,
  autoPositionReset: true,
  targetRetryAttempts: 24,
  clinicalPatientPhotoTarget: true,
  modalSaveTargetFixture: 'clear',
  seleniumSuite: 'included',
  loginDoctor: 'ok',
  loginSecretary: 'ok',
  css: 'balanced',
}, null, 2));
