import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
const checks = [];
const name = `QA Confirmed ${Date.now()}`;
const medications = [
  { name: 'Vessone (Vilazodona)', dose: '10' },
  { name: 'Ansiogen (Bromazepam)', dose: '3' },
  { name: 'Calcigam', dose: '1' },
  { name: 'Coenzima Q10', dose: '100' },
  { name: 'Medicamento QA (5)', dose: '5' },
];

const control = async (data) => page.request.post('http://127.0.0.1:4173/__qa', { data: { control: true, ...data } });
const login = async (email) => {
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill('qa-password-123');
  await page.getByRole('button', { name: 'Ingresar a Linkare', exact: true }).click();
  await page.getByRole('button', { name: 'Pacientes', exact: true }).waitFor();
};
const logout = async () => {
  await page.locator('.profile-chip-button').click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.getByRole('button', { name: 'Ingresar a Linkare', exact: true }).waitFor();
};
const openPatientMedications = async () => {
  await page.getByRole('button', { name: 'Pacientes', exact: true }).click();
  await page.getByText(name, { exact: true }).click();
  await page.getByRole('tab', { name: 'Medicamentos', exact: true }).click();
};

try {
  await page.goto('http://127.0.0.1:4173');
  await login('owner@example.invalid');

  await page.getByRole('button', { name: 'Nuevo paciente', exact: true }).first().click();
  await page.getByLabel('Nombre completo').fill(name);
  await page.getByRole('spinbutton', { name: 'Edad', exact: true }).fill('30');
  await page.getByLabel('Diagnóstico principal').fill('QA synthetic diagnosis');
  await control({ delay: 1500 });
  await page.getByRole('button', { name: 'Crear paciente', exact: true }).click();
  assert.equal(await page.getByText('Paciente registrado correctamente.', { exact: true }).count(), 0);
  assert.equal(await page.getByLabel('Nombre completo').inputValue(), name);
  checks.push('no premature success while database is pending');

  await page.getByText('Paciente registrado correctamente.', { exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Pacientes', exact: true }).click();
  await page.getByText(name, { exact: true }).waitFor();
  checks.push('patient remains after immediate reload following success');

  await page.getByText(name, { exact: true }).click();
  await page.getByRole('tab', { name: 'Medicamentos', exact: true }).click();
  for (let index = 0; index < medications.length; index += 1) {
    const medication = medications[index];
    await page.getByRole('button', { name: 'Agregar medicamento', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Medicamento', exact: true }).fill(medication.name);
    await dialog.getByRole('spinbutton', { name: 'Dosis', exact: true }).fill(medication.dose);
    await dialog.getByRole('button', { name: 'Agregar medicamento', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    await page.locator('.medication-card').filter({ hasText: medication.name }).waitFor();
    assert.equal(await page.locator('.medication-card').count(), index + 1);
  }
  checks.push('1 through 5 medications save consecutively without reload, including parentheses');

  await page.reload();
  await openPatientMedications();
  assert.equal(await page.locator('.medication-card').count(), medications.length);
  for (const medication of medications) {
    await page.locator('.medication-card').filter({ hasText: medication.name }).waitFor();
  }
  checks.push('patient and all 5 medications remain after reload');

  const archivedMedication = medications[1];
  await page.locator('.medication-card').filter({ hasText: archivedMedication.name }).getByRole('button', { name: 'Eliminar', exact: true }).click();
  await page.getByLabel('Motivo de eliminación').fill('Registro de prueba duplicado');
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar medicamento', exact: true }).click();
  await page.getByText('Medicamento eliminado de la lista activa y conservado en el historial.', { exact: true }).waitFor();
  await page.reload();
  await openPatientMedications();
  await page.getByText('Medicamentos eliminados', { exact: true }).waitFor();
  assert.equal(await page.locator('.medication-card').count(), medications.length - 1);
  assert.equal(await page.locator('.medication-card').filter({ hasText: archivedMedication.name }).count(), 0);
  await page.getByText(archivedMedication.name, { exact: true }).waitFor();
  for (const medication of medications.filter((item) => item.name !== archivedMedication.name)) {
    await page.locator('.medication-card').filter({ hasText: medication.name }).waitFor();
  }
  checks.push('one medication can be archived while the patient and other 4 remain intact after reload');

  await control({ fail: true });
  await page.getByRole('button', { name: 'Pacientes', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo paciente', exact: true }).first().click();
  await page.getByLabel('Nombre completo').fill(`${name} failed`);
  await page.getByRole('spinbutton', { name: 'Edad', exact: true }).fill('31');
  await page.getByLabel('Diagnóstico principal').fill('QA synthetic');
  await page.getByRole('button', { name: 'Crear paciente', exact: true }).click();
  await page.getByText(/No se guardó el registro/).waitFor();
  assert.equal(await page.getByLabel('Nombre completo').inputValue(), `${name} failed`);
  checks.push('failed save preserves the draft and reports failure');

  await control({ fail: false });
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await logout();
  assert.equal(await page.getByText(name, { exact: true }).count(), 0);
  checks.push('logout clears patient from screen');

  await login('other@example.invalid');
  await page.getByRole('button', { name: 'Pacientes', exact: true }).click();
  assert.equal(await page.getByText(name, { exact: true }).count(), 0);
  checks.push('second organization cannot see the first patient');
  await logout();

  await login('owner@example.invalid');
  await openPatientMedications();
  assert.equal(await page.locator('.medication-card').count(), medications.length - 1);
  await page.getByText(archivedMedication.name, { exact: true }).waitFor();
  checks.push('patient, 4 active medications and archived medication persist across logout and login');

  console.log(JSON.stringify({ passed: checks.length, checks, scope: 'React/Vite browser + isolated PostgreSQL; Auth adapter, no production data' }, null, 2));
} finally {
  await browser.close();
}
