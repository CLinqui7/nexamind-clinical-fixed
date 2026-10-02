import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const baseUrl = 'http://127.0.0.1:4173';

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  assert.equal(await page.locator('.login-card').evaluate(element => getComputedStyle(element).animationName), 'linkare-page-enter');

  await page.getByLabel('Correo').fill('owner@example.invalid');
  await page.locator('input[type=password]').fill('qa-password-123');
  await page.getByRole('button', { name: 'Ingresar a Linkare', exact: true }).click();
  await page.getByRole('button', { name: 'Configuración', exact: true }).click();
  assert.equal(await page.locator('.view-enter').evaluate(element => getComputedStyle(element).animationName), 'linkare-page-enter');

  await page.getByRole('button', { name: 'Agregar usuario', exact: true }).click();
  const dialog = page.getByRole('dialog');
  assert.equal(await dialog.evaluate(element => getComputedStyle(element).animationName), 'linkare-dialog-enter');
  const permission = dialog.locator('.permission-row', { hasText: 'Crear pacientes' });
  await permission.click();
  assert.equal(await permission.getByRole('checkbox').isChecked(), false);
  assert.notEqual(await permission.locator('.permission-check svg').evaluate(element => getComputedStyle(element).transitionDuration), '0s');
  await page.keyboard.press('Escape');

  const reducedToggle = page.locator('.setting-toggle', { hasText: 'Reducir movimiento' });
  if (!await reducedToggle.getByRole('checkbox').isChecked()) await reducedToggle.click();
  assert.equal(await reducedToggle.getByRole('checkbox').isChecked(), true);
  await page.locator('.app-shell.reduced-motion-mode').waitFor();
  await page.getByRole('button', { name: 'Agregar usuario', exact: true }).click();
  assert.equal(await page.getByRole('dialog').evaluate(element => getComputedStyle(element).animationName), 'none');
  await page.keyboard.press('Escape');

  const reducedContext = await browser.newContext({ reducedMotion: 'reduce' });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(baseUrl, { waitUntil: 'networkidle' });
  assert.equal(await reducedPage.locator('.login-card').evaluate(element => getComputedStyle(element).animationName), 'none');
  await reducedContext.close();
  assert.deepEqual(errors, []);
  console.log('MOTION_QA_OK page, modal, selection feedback, app preference and system preference');
} finally {
  await browser.close();
}
