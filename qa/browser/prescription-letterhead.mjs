import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: process.env.LINKARE_BROWSER || 'msedge', headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(15000);
const checks = [];
const patientName = `QA Letterhead ${Date.now()}`;

try {
  await page.goto('http://127.0.0.1:4173');
  await page.locator('input[type=email]').fill('owner@example.invalid');
  await page.locator('input[type=password]').fill('qa-password-123');
  await page.getByRole('button', { name: 'Ingresar a Linkare', exact: true }).click();

  await page.locator('.profile-chip-button').click();
  await page.getByRole('dialog', { name: 'Mi cuenta' }).getByRole('button', { name: 'Configuración', exact: true }).click();
  await page.getByRole('button', { name: 'Editar datos y logotipo', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('N.º de junta o licencia').fill('JVPM 4328');
  const labels = ['Teléfono clínica', 'Celular clínica', 'Teléfono doctor'];
  const numbers = ['2519-3396', '7920-2034', '7600-7989'];
  for (let index = 0; index < 3; index += 1) {
    await dialog.getByLabel(`Tipo de teléfono ${index + 1}`).fill(labels[index]);
    await dialog.getByLabel(`Número de teléfono ${index + 1}`).fill(numbers[index]);
  }
  await dialog.getByRole('button', { name: 'Guardar identidad', exact: true }).click();
  await page.getByText('Identidad de la clínica actualizada.', { exact: true }).waitFor();
  await page.reload();
  await page.locator('.profile-chip-button').click();
  await page.getByRole('dialog', { name: 'Mi cuenta' }).getByRole('button', { name: 'Configuración', exact: true }).click();
  await page.getByRole('button', { name: 'Editar datos y logotipo', exact: true }).click();
  dialog = page.getByRole('dialog');
  for (let index = 0; index < 3; index += 1) assert.equal(await dialog.getByLabel(`Número de teléfono ${index + 1}`).inputValue(), numbers[index]);
  checks.push('three labeled clinic and doctor phones persist after reload');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();

  await page.getByRole('button', { name: 'Pacientes', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo paciente', exact: true }).first().click();
  await page.getByLabel('Nombre completo').fill(patientName);
  await page.getByRole('spinbutton', { name: 'Edad', exact: true }).fill('40');
  await page.getByLabel('Diagnóstico principal').fill('QA impresión');
  await page.getByRole('button', { name: 'Crear paciente', exact: true }).click();
  await page.getByText('Paciente registrado correctamente.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Nueva receta', exact: true }).click();
  for (let index = 0; index < 3; index += 1) await page.getByRole('button', { name: 'Agregar otro medicamento', exact: true }).click();
  const medicines = ['A nocturna', 'B rescate', 'Z matutina', 'C mediodía'];
  const directions = ['cada noche', 'según necesidad (PRN)', 'cada mañana', 'al mediodía'];
  const medicationInputs = page.getByRole('textbox', { name: /^Medicamento/ });
  const directionInputs = page.getByLabel('Cómo tomarlo');
  for (let index = 0; index < medicines.length; index += 1) {
    await medicationInputs.nth(index).fill(medicines[index]);
    await directionInputs.nth(index).fill(directions[index]);
  }
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Guardar y abrir receta', exact: true }).click();
  const prescription = await popupPromise;
  await prescription.waitForLoadState('domcontentloaded');
  const html = await prescription.content();
  const text = await prescription.locator('body').innerText();
  for (const number of numbers) assert.match(text, new RegExp(number));
  assert.equal((text.match(/JVPM 4328/g) || []).length, 1);
  assert.doesNotMatch(html.slice(html.indexOf('<div class="signature">')), /JVPM 4328/);
  assert.ok(text.indexOf('Z matutina') < text.indexOf('C mediodía'));
  assert.ok(text.indexOf('C mediodía') < text.indexOf('A nocturna'));
  assert.ok(text.indexOf('A nocturna') < text.indexOf('B rescate'));
  checks.push('printed prescription shows all phones, one header JVPM and intake-time medication order');

  console.log(JSON.stringify({ passed: checks.length, checks, scope: 'Isolated browser + PostgreSQL; no production writes' }, null, 2));
} finally {
  await browser.close();
}
