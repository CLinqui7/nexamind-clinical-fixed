import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base = 'http://127.0.0.1:4173';
const owner = '10000000-0000-4000-8000-000000000001';
const secretary = '10000000-0000-4000-8000-000000000005';
const viewer = '10000000-0000-4000-8000-000000000006';
const browser = await chromium.launch({channel: 'msedge', headless: true});
const page = await browser.newPage({acceptDownloads: true});
const errors = [];
page.on('pageerror', error => errors.push(error.message));

async function rpc(user, name, args = {}) {
  const response = await page.request.post(base + '/__qa', {data: {user, name, args}});
  return response.json();
}

async function login(name) {
  await page.getByLabel('Correo', {exact: true}).fill(name + '@example.invalid');
  await page.locator('input[type=password]').fill('qa-password-123');
  await page.getByRole('button', {name: 'Ingresar a Linkare', exact: true}).click();
}

function eventRequest(action) {
  return page.waitForResponse(response => {
    if (!response.url().endsWith('/__qa')) return false;
    const body = response.request().postDataJSON();
    return body?.name === 'linkare_record_activity_v1' && body.args.p_action === action;
  }).then(async response => assert.equal((await response.json()).data, true));
}

try {
  for (const identity of [owner, secretary, null]) {
    const denied = await rpc(identity, 'linkare_activity_report_v1', {p_refresh: true});
    assert.equal(denied.error?.code, '42501');
  }
  const blockedClinic = await rpc(viewer, 'linkare_bootstrap_v3', {requested_name: 'QA Forbidden'});
  assert.equal(blockedClinic.error?.code, '42501');
  assert.equal((await rpc(viewer, 'linkare_activity_report_v1')).data.rows.length, 0);

  await page.goto(base);
  const entered = eventRequest('access');
  await login('owner');
  await entered;
  assert.equal(await page.getByRole('heading', {name: 'Accesos y actividad'}).count(), 0);

  const opened = eventRequest('agenda_open');
  await page.getByRole('button', {name: 'Agenda', exact: true}).click();
  await opened;

  const downloaded = eventRequest('agenda_download');
  const file = page.waitForEvent('download');
  await page.locator('.agenda-sheet').getByRole('button', {name: 'Guardar PDF', exact: true}).click();
  assert.match((await file).suggestedFilename(), /^Agenda_del_dia_.*\.pdf$/);
  await downloaded;

  const printed = eventRequest('agenda_print');
  const popup = page.waitForEvent('popup');
  await page.locator('.agenda-sheet').getByRole('button', {name: 'Imprimir', exact: true}).click();
  const paper = await popup;
  await paper.getByRole('heading', {name: 'Agenda del día', exact: true}).waitFor();
  await printed;
  await paper.close();

  const pending = await rpc(viewer, 'linkare_activity_report_v1');
  assert.equal(pending.data.checkedAt, null);
  assert.deepEqual(pending.data.rows, []);
  await page.locator('.profile-chip-button').click();
  await page.getByRole('button', {name: 'Cerrar sesión', exact: true}).click();
  await login('activity');
  await page.getByRole('heading', {name: 'Accesos y actividad'}).waitFor();
  await page.getByText('Pendiente de la primera consulta.').waitFor();
  await page.getByRole('button', {name: 'Consultar', exact: true}).click();
  for (const label of ['Entró a Linkare', 'Abrió la hoja del día', 'Descargó el PDF', 'Envió la hoja a imprimir']) {
    await page.getByRole('cell', {name: label, exact: true}).waitFor();
  }
  const report = await rpc(viewer, 'linkare_activity_report_v1');
  assert.equal(report.data.checkSource, 'manual');
  assert.equal(report.data.rows.length, 4);
  assert.ok(report.data.rows.every(row => row.actor === 'QA Owner' && row.clinic === 'QA Isolated'));
  assert.ok(report.data.rows.filter(row => row.action !== 'access').every(row => row.agendaDate));
  await page.getByLabel('Acción', {exact: true}).selectOption('agenda_print');
  await page.getByRole('cell', {name: 'Descargó el PDF', exact: true}).waitFor({state: 'hidden'});
  assert.equal(await page.locator('tbody tr').count(), 1);
  assert.deepEqual(errors, []);
  console.log('ACTIVITY_REPORT_OK: private reader, four actions, publication, identity and filter');
} finally {
  await browser.close();
}
