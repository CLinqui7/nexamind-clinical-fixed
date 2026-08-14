import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const requiredFiles = [
  'src/app.js', 'src/clinical.js', 'src/data.js', 'src/practice.js', 'src/utils.js',
  'styles.css', 'setup.ps1', 'run.ps1', 'INSTALAR-Y-ABRIR.bat', 'ABRIR-NEXAMIND.bat',
  'supabase/schema.sql', 'supabase/migrations/20260814_v1_2_practice_features.sql',
];
for (const file of requiredFiles) assert.ok(existsSync(file), `Falta ${file}`);

const app = readFileSync('src/app.js', 'utf8');
const practice = readFileSync('src/practice.js', 'utf8');
const data = readFileSync('src/data.js', 'utf8');
const styles = readFileSync('styles.css', 'utf8');

for (const token of [
  'openPrescription', 'openClinicProfile', 'openSecretary', 'openUserPermissions',
  'handlePatientPhotoUpload', 'renderGuidedTour', 'renderPrescriptionModal',
  'renderClinicProfileModal', 'renderSecretaryModal', 'getReminderQueue',
]) assert.ok(app.includes(token), `La interfaz no contiene ${token}`);

for (const token of [
  'optimizeImageFile', 'savePracticeProfile', 'savePatientPhoto', 'savePrescription',
  'buildPrescriptionPrintHtml', 'createSecretaryUser', 'updateUserPermissions', 'REMINDER_OPTIONS',
]) assert.ok(practice.includes(token), `La lógica de práctica no contiene ${token}`);

assert.ok(data.includes("version: 3"), 'El seed no está en versión 3.');
assert.ok(data.includes('insurance:'), 'El modelo local no contiene seguro médico.');
for (const color of ['#FCFDF6', '#8FACCB', '#05316E']) {
  assert.ok(styles.includes(color) || data.includes(color), `Falta el color ${color}`);
}
assert.ok(styles.includes('prefers-reduced-motion'), 'Falta soporte para reducir movimiento.');

console.log('RELEASE_STRUCTURE_QA_OK');
