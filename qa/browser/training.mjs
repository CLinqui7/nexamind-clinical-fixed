import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { defaultPermissions } from '../../src/domain/permissions.js';
import { trainingFor } from '../../src/training.js';

const base = 'http://127.0.0.1:4173';
const ownerId = '10000000-0000-4000-8000-000000000001';
const secretaryId = '10000000-0000-4000-8000-000000000005';
const browser = await chromium.launch({ channel: process.env.LINKARE_BROWSER || 'msedge', headless: true });

const login = async (page, role) => {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByLabel('Correo').fill(`${role}@example.invalid`);
  await page.locator('input[type=password]').fill('qa-password-123');
  await page.getByRole('button', { name: 'Ingresar a Linkare', exact: true }).click();
  await page.getByRole('button', { name: 'Ayuda', exact: true }).waitFor();
};

try {
  assert.deepEqual(trainingFor('secretary', { patients: true, agenda: false }).steps.map(step => step.view), ['dashboard', 'patients', 'patients', 'dashboard']);
  // The isolated Secretary fixture starts with no calendar grants. Grant only
  // QA permissions so every training chapter can be exercised without writes
  // to Supabase or production users.
  const fixture = await browser.newPage();
  const setup = await fixture.request.post(`${base}/__qa`, {
    data: { user: ownerId, team: true, teamInput: {
      action: 'update', userId: secretaryId, name: 'Secretaría QA', role: 'secretary',
      title: '', phone: '', permissions: defaultPermissions('secretary'),
    } },
  });
  assert.equal(setup.status(), 200);
  assert.equal((await setup.json()).error, null);
  await fixture.close();

  const cases = [
    { role: 'secretary', size: { width: 1440, height: 900 }, steps: 7 },
    { role: 'owner', size: { width: 1440, height: 900 }, steps: 9 },
    { role: 'secretary', size: { width: 800, height: 1280 }, steps: 7, touch: true },
    { role: 'owner', size: { width: 1280, height: 800 }, steps: 9, touch: true },
    { role: 'secretary', size: { width: 390, height: 844 }, steps: 7, touch: true },
  ];
  for (const { role, size, steps, touch = false } of cases) {
    const page = await browser.newPage({ viewport: size, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 1.5 : 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await login(page, role);
    await page.getByRole('button', { name: 'Ayuda', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const video = dialog.locator('video.training-video');
    assert.match(await video.getAttribute('src'), role === 'secretary' ? /secretaria\.webm$/ : /doctor\.webm$/);
    const media = await video.evaluate(element => new Promise((resolve, reject) => {
      if (element.readyState >= 1) return resolve({ duration: element.duration, width: element.videoWidth });
      element.addEventListener('loadedmetadata', () => resolve({ duration: element.duration, width: element.videoWidth }), { once: true });
      element.addEventListener('error', () => reject(new Error('Training video failed to load')), { once: true });
      element.load();
    }));
    assert.ok(media.duration > 40 && media.width === 1280, `${role}: invalid training video`);
    await dialog.getByRole('tab', { name: 'Guía rápida' }).click();
    assert.ok(await dialog.locator('.training-guide section').count() >= 6);
    await dialog.getByRole('tab', { name: 'Preguntas frecuentes' }).click();
    assert.ok(await dialog.getByText('¿Por qué falta un botón?').count());
    await dialog.getByRole('button', { name: 'Iniciar recorrido interactivo' }).click();
    const rail = page.locator('.training-rail');
    await rail.waitFor();
    assert.equal(await rail.locator('.training-step-list button').count(), steps);
    await rail.getByRole('button', { name: 'Siguiente' }).click();
    assert.match(await rail.locator('.training-count').innerText(), /02/);
    await rail.getByRole('button', { name: 'Anterior' }).click();
    assert.match(await rail.locator('.training-count').innerText(), /01/);
    await rail.getByRole('button', { name: 'Volver a videos y guía rápida' }).click();
    assert.equal(await rail.count(), 0);
    await page.getByRole('dialog').getByRole('button', { name: 'Iniciar recorrido interactivo' }).click();
    await rail.waitFor();
    for (let index = 0; index < steps; index++) {
      await rail.getByRole('button', { name: `Ir al paso ${index + 1}:`, exact: false })[touch ? 'tap' : 'click']();
      const target = page.locator('[data-tour-active-target="true"]');
      await target.waitFor();
      assert.equal(await target.count(), 1);
      await page.waitForTimeout(360);
      const separated = await page.evaluate(() => {
        const target = document.querySelector('[data-tour-active-target]')?.getBoundingClientRect();
        const panel = document.querySelector('.training-rail')?.getBoundingClientRect();
        return target && panel && (target.right <= panel.left + 1 || target.bottom <= panel.top + 1 || target.top >= panel.bottom - 1);
      });
      assert.ok(separated, `${role} ${size.width}: guide overlaps highlighted control at step ${index + 1}`);
      const space = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth }));
      assert.ok(space.document <= space.width + 1, `${role} ${size.width}: horizontal overflow`);
      if (index === 2 && role === 'secretary') {
        const checkbox = page.locator('.calendar-filter input').first();
        const before = await checkbox.isChecked();
        await page.locator('.calendar-filter').first()[touch ? 'tap' : 'click']();
        assert.notEqual(await checkbox.isChecked(), before);
      }
      if (index === 3 && role === 'secretary') {
        await target[touch ? 'tap' : 'click']();
        const eventDialog = page.getByRole('dialog');
        await eventDialog.waitFor();
        const modalSeparated = await page.evaluate(() => {
          const modal = document.querySelector('.modal')?.getBoundingClientRect();
          const panel = document.querySelector('.training-rail')?.getBoundingClientRect();
          return modal && panel && (modal.right <= panel.left + 1 || modal.bottom <= panel.top + 1);
        });
        assert.ok(modalSeparated, `${role} ${size.width}: guide overlaps event dialog`);
        assert.equal(await eventDialog.locator('input[name=appointmentCalendar]:checked').count(), 0);
        const choice = eventDialog.locator('.calendar-choice').first();
        await choice.click();
        assert.equal(await eventDialog.locator('input[name=appointmentCalendar]:checked').count(), 1);
        await page.keyboard.press('Escape');
      }
    }
    await rail.getByRole('button', { name: 'Finalizar' }).click();
    assert.equal(await rail.count(), 0);
    assert.equal(await page.locator('[data-tour-active-target]').count(), 0);
    assert.deepEqual(errors, [], `${role} ${size.width} JavaScript errors`);
    await page.close();
  }
  const reduced = await browser.newPage({ reducedMotion: 'reduce' });
  await login(reduced, 'owner');
  await reduced.getByRole('button', { name: 'Ayuda', exact: true }).click();
  await reduced.getByRole('button', { name: 'Iniciar recorrido interactivo' }).click();
  assert.equal(await reduced.locator('.training-rail').evaluate(element => getComputedStyle(element).animationName), 'none');
  await reduced.keyboard.press('Escape');
  assert.equal(await reduced.locator('.training-rail').count(), 0);
  await reduced.close();
  console.log('TRAINING_QA_OK: video, role guides, every tour step, live controls, tablet sizes, no JS errors');
} finally {
  await browser.close();
}
