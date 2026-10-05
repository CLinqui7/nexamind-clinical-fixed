import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
  await page.getByLabel('Diagnóstico principal').fill('SENSITIVE_DIAGNOSIS_DO_NOT_PRINT');
  await page.getByLabel('Código diagnóstico').fill('SENSITIVE_DX_DO_NOT_PRINT');
  await page.locator('[data-tour="patient-form-insurance-toggle"]').click();
  await page.getByLabel('Aseguradora').fill('SENSITIVE_INSURER_DO_NOT_PRINT');
  await page.getByLabel('Plan', { exact: true }).fill('SENSITIVE_PLAN_DO_NOT_PRINT');
  await page.getByRole('button', { name: 'Crear paciente', exact: true }).click();
  await page.getByText('Paciente registrado correctamente.', { exact: true }).waitFor();

  const medicines = ['A nocturna', 'B rescate', 'Z matutina', 'C mediodía'];
  const directions = ['cada noche', 'según necesidad (PRN)', 'cada mañana', 'al mediodía'];
  for (let index = 0; index < medicines.length; index += 1) {
    await page.getByRole('button', { name: 'Agregar medicamento', exact: true }).first().click();
    dialog = page.getByRole('dialog', { name: 'Agregar medicamento' });
    await dialog.getByRole('textbox', { name: 'Medicamento', exact: true }).fill(medicines[index]);
    await dialog.getByRole('textbox', { name: 'Dosis', exact: true }).fill('10');
    await dialog.getByLabel('Frecuencia').selectOption({ label: directions[index] });
    await dialog.getByRole('button', { name: 'Agregar medicamento', exact: true }).click();
    await page.getByText('Medicamento agregado al tratamiento.', { exact: true }).waitFor();
  }

  await page.getByRole('button', { name: 'Nueva receta', exact: true }).click();
  for (let index = 0; index < medicines.length; index += 1) {
    await page.getByLabel('Medicamento del tratamiento activo').selectOption({ label: `${medicines[index]} · 10 mg · ${directions[index]}` });
    await page.locator('.prescription-item-editor').last().getByLabel('Cómo tomarlo').fill(directions[index]);
  }
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Guardar y abrir receta', exact: true }).click();
  const prescription = await popupPromise;
  await prescription.waitForLoadState('domcontentloaded');
  await prescription.getByText(patientName, { exact: true }).waitFor();
  const html = await prescription.content();
  const text = await prescription.locator('body').innerText();
  for (const number of numbers) assert.match(text, new RegExp(number));
  assert.equal((text.match(/JVPM 4328/g) || []).length, 1);
  assert.doesNotMatch(html.slice(html.indexOf('<div class="signature">')), /JVPM 4328/);
  assert.ok(text.indexOf('Z matutina') < text.indexOf('C mediodía'));
  assert.ok(text.indexOf('C mediodía') < text.indexOf('A nocturna'));
  assert.ok(text.indexOf('A nocturna') < text.indexOf('B rescate'));
  assert.match(text, new RegExp(patientName));
  for (const forbidden of ['Edad', 'Diagnóstico', 'Seguro médico', '40 años', 'SENSITIVE_DIAGNOSIS_DO_NOT_PRINT', 'SENSITIVE_DX_DO_NOT_PRINT', 'SENSITIVE_INSURER_DO_NOT_PRINT', 'SENSITIVE_PLAN_DO_NOT_PRINT']) assert.doesNotMatch(text, new RegExp(forbidden));
  checks.push('printed prescription shows all phones, one header JVPM and intake-time medication order');
  checks.push('printed prescription contains the patient name but excludes age, diagnosis, DX and insurance');
  await prescription.close();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Guardar PDF', exact: true }).click();
  const download = await downloadPromise;
  const pdfPath = await download.path();
  assert.ok(pdfPath);
  const pdf = fs.readFileSync(pdfPath);
  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.ok(pdf.length > 1000);
  assert.match(download.suggestedFilename(), /^Receta_RX-\d{4}-\d+_QA_Letterhead_\d+\.pdf$/);
  await page.getByText(/PDF descargado: Receta_RX-/).waitFor();
  checks.push('Guardar PDF downloads a valid PDF file beside the existing print action');

  console.log(JSON.stringify({ passed: checks.length, checks, scope: 'Isolated browser + PostgreSQL; no production writes' }, null, 2));
} finally {
  await browser.close();
}
