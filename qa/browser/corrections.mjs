import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
const consoleErrors = [];
page.on('pageerror', error => console.error('PAGE ERROR:', error));
page.on('console', message => {
  if (message.type() === 'error') {
    consoleErrors.push(message.text());
    console.error('BROWSER ERROR:', message.text());
  }
});
const checks = [];
const patientName = `QA Corrections ${Date.now()}`;

const dialogSubmit = async (name) => {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name, exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
};
const archiveFromDialog = async (reason = 'Registro agregado por error') => {
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Motivo/).fill(reason);
  await dialog.getByRole('button', { name: 'Eliminar y conservar historial', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
};

try {
  await page.goto('http://127.0.0.1:4173');
  await page.locator('input[type=email]').fill('owner@example.invalid');
  await page.locator('input[type=password]').fill('qa-password-123');
  await page.getByRole('button', { name: 'Ingresar a Linkare', exact: true }).click();
  await page.getByRole('button', { name: 'Pacientes', exact: true }).click();

  await page.getByRole('button', { name: 'Nuevo paciente', exact: true }).first().click();
  await page.getByLabel('Nombre completo').fill(patientName);
  await page.getByRole('spinbutton', { name: 'Edad', exact: true }).fill('32');
  await page.getByLabel('Diagnóstico principal').fill('QA corrections');
  await dialogSubmit('Crear paciente');
  await page.getByText(patientName, { exact: true }).waitFor();

  await page.getByRole('tab', { name: 'Medicamentos', exact: true }).click();
  await page.getByRole('button', { name: 'Agregar medicamento', exact: true }).first().click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Medicamento', exact: true }).fill('Medicamento original');
  await dialog.getByRole('spinbutton', { name: 'Dosis', exact: true }).fill('10');
  await dialogSubmit('Agregar medicamento');
  const medicationCard = page.locator('.medication-card').filter({ hasText: 'Medicamento original' });
  await medicationCard.getByRole('button', { name: 'Editar medicamento', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Medicamento', exact: true }).fill('Medicamento corregido (QA)');
  await dialog.getByRole('spinbutton', { name: 'Dosis', exact: true }).fill('20');
  await dialogSubmit('Guardar corrección');
  await page.locator('.medication-card').filter({ hasText: 'Medicamento corregido (QA)' }).waitFor();
  checks.push('medication full edit works and keeps the same record');

  await page.getByRole('tab', { name: 'Seguimiento', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar evolución', exact: true }).first().click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('spinbutton', { name: /^Puntaje/ }).fill('12');
  await dialogSubmit('Guardar evolución');
  await page.getByRole('button', { name: 'Editar última', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('spinbutton', { name: /^Puntaje/ }).fill('10');
  await dialogSubmit('Guardar corrección');
  await page.locator('.assessment-row').getByRole('button', { name: 'Eliminar', exact: true }).click();
  await archiveFromDialog();
  await page.getByText('Registros de seguimiento eliminados', { exact: true }).waitFor();

  await page.getByRole('button', { name: 'Nuevo control', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('spinbutton', { name: 'Peso (kg)', exact: true }).fill('70');
  await dialogSubmit('Guardar control');
  const controlsTable = page.getByRole('table');
  await controlsTable.getByRole('button', { name: 'Editar', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('spinbutton', { name: 'Peso (kg)', exact: true }).fill('69');
  await dialogSubmit('Guardar corrección');
  await controlsTable.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await archiveFromDialog();
  checks.push('assessment and physical control can be edited and removed with history');

  await page.getByRole('tab', { name: 'Efectos y controles', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar efecto', exact: true }).first().click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Relación temporal').fill('Registro inicial QA');
  await dialogSubmit('Guardar efecto');
  let adverseCard = page.locator('.adverse-card').filter({ hasText: 'Náusea' });
  await adverseCard.getByRole('button', { name: 'Editar', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Severidad').selectOption('moderate');
  await dialogSubmit('Guardar corrección');
  adverseCard = page.locator('.adverse-card').filter({ hasText: 'Náusea' });
  await adverseCard.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await archiveFromDialog();

  await page.getByRole('button', { name: 'Nuevo resultado', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Prueba', exact: true }).fill('TSH QA');
  await dialog.getByRole('textbox', { name: 'Resultado', exact: true }).fill('4');
  await dialogSubmit('Guardar resultado');
  let labRow = page.getByRole('row').filter({ hasText: 'TSH QA' });
  await labRow.getByRole('button', { name: 'Editar', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Resultado', exact: true }).fill('3.5');
  await dialogSubmit('Guardar corrección');
  labRow = page.getByRole('row').filter({ hasText: 'TSH QA' });
  await labRow.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await archiveFromDialog();
  await page.getByText('Efectos y resultados eliminados', { exact: true }).waitFor();
  checks.push('adverse effect and laboratory result can be edited and removed with history');

  await page.getByRole('tab', { name: 'Documentos', exact: true }).click();
  await page.getByRole('button', { name: 'Subir archivo', exact: true }).first().click();
  dialog = page.getByRole('dialog');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'documento-qa.txt', mimeType: 'text/plain', buffer: Buffer.from('documento aislado de prueba') });
  await dialog.getByLabel('Descripción').fill('Descripción original');
  await dialogSubmit('Agregar al expediente');
  await page.getByText('Documento guardado en el expediente.', { exact: true }).waitFor();
  let documentCard = page.locator('.document-card').filter({ hasText: 'documento-qa.txt' });
  await documentCard.getByRole('button', { name: 'Editar', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Nombre/).fill('Documento QA corregido');
  await dialogSubmit('Guardar corrección');
  documentCard = page.locator('.document-card').filter({ hasText: 'Documento QA corregido' });
  await documentCard.locator('.document-delete').click();
  await archiveFromDialog();
  await page.getByText('Documentos eliminados', { exact: true }).waitFor();
  checks.push('document metadata can be edited and document can be archived with history');

  await page.getByRole('tab', { name: 'Consultas', exact: true }).click();
  await page.getByRole('button', { name: 'Iniciar consulta', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Notas libres', exact: true }).fill('Borrador QA para retirar');
  await page.locator('.notebook-toolbar .back-button').click();
  await page.getByText('La nota quedó guardada como borrador.', { exact: true }).waitFor();
  const consultationCard = page.locator('.consultation-note-card').filter({ hasText: 'Borrador QA para retirar' });
  await consultationCard.getByRole('button', { name: 'Eliminar borrador', exact: true }).click();
  await archiveFromDialog('Borrador creado por error');
  await page.getByText('Consultas anuladas o retiradas', { exact: true }).waitFor();
  checks.push('consultation draft can be removed while remaining in audit history');

  await page.reload();
  await page.getByRole('button', { name: 'Pacientes', exact: true }).click();
  await page.locator('.patient-card').filter({ hasText: patientName }).click();
  await page.getByRole('tab', { name: /^Efectos y controles/ }).click();
  await page.getByText('Efectos y resultados eliminados', { exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Documentos', exact: true }).click();
  await page.getByText('Documentos eliminados', { exact: true }).waitFor();
  checks.push('all corrections and archived records persist after reload');

  await page.getByRole('button', { name: 'Datos y seguro', exact: true }).click();
  await page.getByRole('button', { name: 'Archivar paciente', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Motivo/).fill('Expediente QA creado para pruebas');
  await dialog.getByRole('button', { name: 'Archivar paciente', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Archivados', exact: true }).click();
  await page.getByText(patientName, { exact: true }).waitFor();
  checks.push('patient can be archived and found in the archived filter');

  assert.deepEqual(consoleErrors, []);
  checks.push('correction and archive workflows render without browser console errors');

  console.log(JSON.stringify({ passed: checks.length, checks, scope: 'React/Vite browser + isolated PostgreSQL; no production data' }, null, 2));
} finally {
  await browser.close();
}
