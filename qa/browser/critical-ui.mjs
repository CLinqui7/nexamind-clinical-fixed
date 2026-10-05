import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: process.env.LINKARE_BROWSER || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(15000);
const errors = [];
const rpcCalls = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (!request.url().endsWith('/__qa')) return;
  try {
    const body = request.postDataJSON();
    if (body?.name) rpcCalls.push(body.name);
  } catch (_) { /* Non-RPC test controls are irrelevant to this assertion. */ }
});

try {
  await page.goto('http://127.0.0.1:4173');
  await page.locator('input[type=email]').fill('owner@example.invalid');
  await page.locator('input[type=password]').fill('qa-password-123');
  await page.getByRole('button', { name: 'Ingresar a Linkare', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo paciente', exact: true }).first().waitFor();
  await page.waitForTimeout(1200);
  assert.equal(rpcCalls.filter(name => name === 'linkare_save_changes_v3').length, 0, 'read-only bootstrap must not trigger a save RPC');
  await page.getByRole('button', { name: 'Nuevo paciente', exact: true }).first().click();

  const patientDialog = page.getByRole('dialog', { name: 'Nuevo paciente' });
  await patientDialog.getByLabel('Nombre completo').fill('Paciente crítico QA');
  await patientDialog.getByRole('spinbutton', { name: 'Edad', exact: true }).fill('30');
  await patientDialog.getByLabel('Diagnóstico principal').fill('Diagnóstico sintético QA');
  await patientDialog.getByLabel('Tarifa habitual de consulta (USD)').fill('120');
  const insuranceToggle = patientDialog.locator('[data-tour="patient-form-insurance-toggle"]');
  assert.equal(await insuranceToggle.getAttribute('aria-pressed'), 'false');
  await insuranceToggle.click();
  assert.equal(await insuranceToggle.getAttribute('aria-pressed'), 'true');
  assert.equal(await patientDialog.locator('.insurance-form-panel').count(), 1);
  await patientDialog.getByLabel('Aseguradora').fill('Seguro sintético QA');
  const twoHourReminder=patientDialog.getByRole('button',{name:'2 horas antes',exact:true});
  assert.equal(await twoHourReminder.getAttribute('aria-pressed'),'false');
  await twoHourReminder.click();
  assert.equal(await twoHourReminder.getAttribute('aria-pressed'),'true');
  assert.equal(errors.length, 0, errors.join('\n'));
  await patientDialog.getByRole('button', { name: 'Crear paciente', exact: true }).click();
  await page.getByText('Paciente registrado correctamente.', { exact: true }).waitFor();
  await page.getByText('Consulta $120', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Agendar', exact: true }).click();
  const appointmentDialog = page.getByRole('dialog', { name: 'Nuevo evento' });
  await appointmentDialog.getByText('Paciente crítico QA', { exact: true }).waitFor();
  await appointmentDialog.getByText('Tarifa habitual: $120', { exact: true }).waitFor();
  assert.equal(await appointmentDialog.getByRole('combobox', { name: 'Paciente' }).count(), 1);
  assert.equal(await appointmentDialog.getByLabel('AM o PM', { exact: true }).count(), 1);
  await appointmentDialog.getByLabel('AM o PM', { exact: true }).selectOption('PM');
  assert.equal(await appointmentDialog.getByLabel('AM o PM', { exact: true }).inputValue(), 'PM');
  await appointmentDialog.locator('.calendar-choice', { hasText: 'Doctor' }).click();
  await appointmentDialog.locator('[data-appointment-date]').fill('2026-10-05');
  await appointmentDialog.getByLabel(/^Hora/).selectOption('2');
  await appointmentDialog.getByLabel(/^Minutos/).selectOption('15');
  await appointmentDialog.getByLabel('Notas de preparación').fill('Cita sintética crítica QA');
  const startedAt = performance.now();
  await appointmentDialog.getByRole('button', { name: 'Crear evento', exact: true }).click();
  await page.getByRole('dialog', { name: 'Detalle de la cita' }).waitFor();
  const saveMilliseconds = Math.round(performance.now() - startedAt);
  assert.ok(saveMilliseconds < 5000, `appointment save took ${saveMilliseconds}ms`);
  const persisted = await page.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem('linkare-isolated-qa-session'));
    const rpc = async (name, args) => (await (await fetch('/__qa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: session.user.id, name, args }) })).json()).data;
    const org = await rpc('linkare_bootstrap_v3', {});
    return rpc('linkare_load_state_v3', { org });
  });
  assert.ok(persisted.payload.appointments.some(item => item.notes === 'Cita sintética crítica QA'));
  assert.ok(persisted.payload.patients.find(item=>item.name==='Paciente crítico QA')?.notificationPreferences?.reminderHours?.includes(2));
  assert.equal(persisted.payload.patients.find(item=>item.name==='Paciente crítico QA')?.consultationFeeCents,12000);
  assert.equal(errors.length, 0, errors.join('\n'));

  console.log(JSON.stringify({
    passed: 11,
    checks: [
      'read-only bootstrap and directory hydration trigger zero save RPCs',
      'insurance plus reveals fields without blanking the modal',
      'insurance state remains controlled and accessible',
      'patient reminder timing is selectable instead of fixed globally',
      'consultation fee is visible in the patient record and appointment flow',
      'appointment patient search is a single combobox',
      'appointment form exposes explicit AM/PM selection',
      `appointment save is acknowledged in ${saveMilliseconds}ms`,
      'appointment remains persisted in isolated PostgreSQL',
      'patient-specific reminder timing survives a server reload',
      'consultation fee survives a server reload as exact integer cents',
    ],
    scope: 'Playwright + isolated PostgreSQL; synthetic data only; no production writes',
  }, null, 2));
} finally {
  await browser.close();
}
