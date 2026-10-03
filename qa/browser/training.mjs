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
  assert.ok(trainingFor('secretary', { patients: true, agenda: false }).steps.every(step => step.view !== 'agenda'));
  assert.ok(trainingFor('secretary', { patients: true, agenda: true, hasCalendars: false, createEvent: false }).steps.every(step => !['calendar-filter-first','agenda-new-event','appointment-calendar-first'].includes(step.target)));
  assert.equal(trainingFor('secretary', { patients:false, agenda:true, hasCalendars:true }).steps[0].target,'nav-agenda');
  assert.deepEqual(trainingFor('doctor', { patients:false, agenda:false, settings:false }).steps.map(step=>step.target),['help-button','help-guide-tab','help-close']);
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
    { role: 'secretary', size: { width: 1440, height: 900 }, steps: 14 },
    { role: 'owner', size: { width: 1440, height: 900 }, steps: 16 },
    { role: 'secretary', size: { width: 800, height: 1280 }, steps: 14, touch: true },
    { role: 'owner', size: { width: 1280, height: 800 }, steps: 16, touch: true },
    { role: 'secretary', size: { width: 390, height: 844 }, steps: 14, touch: true },
  ];
  for (const { role, size, steps, touch = false } of cases) {
    const chapter = trainingFor(role, { patients:true, agenda:true, settings:true, usersManage:true, hasCalendars:true, createEvent:true }).steps;
    assert.equal(chapter.length, steps);
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
    assert.equal(await rail.locator('.training-step-list span').count(), steps);
    assert.equal(await rail.locator('.training-step-list button').count(), 0, 'future steps must not be clickable');
    for (let index = 0; index < steps; index++) {
      const chapterTarget=chapter[index].target;
      const next = rail.getByRole('button', { name: index === steps - 1 ? 'Finalizar' : 'Siguiente' });
      assert.equal(await next.isDisabled(), true, `${role} step ${index + 1}: Next must wait for action`);
      const target = page.locator('[data-tour-active-target="true"]');
      await target.waitFor();
      assert.equal(await target.count(), 1);
      await page.locator('.training-beacon').waitFor();
      assert.ok(await page.locator('.training-connector > path[stroke]').getAttribute('d'));
      const separated = await page.evaluate(() => {
        const target = document.querySelector('[data-tour-active-target]')?.getBoundingClientRect();
        const panel = document.querySelector('.training-rail')?.getBoundingClientRect();
        return target && panel && (target.right <= panel.left + 1 || target.bottom <= panel.top + 1 || target.top >= panel.bottom - 1);
      });
      assert.ok(separated, `${role} ${size.width}: guide overlaps highlighted control at step ${index + 1}`);
      const space = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth }));
      assert.ok(space.document <= space.width + 1, `${role} ${size.width}: horizontal overflow`);
      if (process.env.LINKARE_TOUR_SHOTS === '1' && [0, 7, 11].includes(index)) {
        await page.screenshot({ path: `${process.env.TEMP}/linkare-tour-${role}-${size.width}-${index + 1}.png` });
      }
      const calendarWasChecked=chapterTarget==='calendar-filter-first'?await target.locator('input').isChecked():null;
      await target.click();
      await rail.locator('.training-step-status.done').waitFor();
      if(chapterTarget==='nav-patients')await page.getByRole('heading',{name:'Pacientes',exact:true}).waitFor();
      if(chapterTarget==='nav-agenda')await page.getByRole('heading',{name:'Calendarios',exact:true}).waitFor();
      if(chapterTarget==='calendar-filter-first')assert.notEqual(await target.locator('input').isChecked(),calendarWasChecked);
      if(chapterTarget==='agenda-new-event')assert.equal(await page.getByRole('dialog').locator('input[name=appointmentCalendar]:checked').count(),0);
      if(chapterTarget==='appointment-calendar-first')assert.equal(await page.getByRole('dialog').locator('input[name=appointmentCalendar]:checked').count(),1);
      if(['appointment-cancel','team-cancel','help-close'].includes(chapterTarget))assert.equal(await page.getByRole('dialog').count(),0);
      if(chapterTarget==='team-add-user')await page.getByRole('dialog',{name:'Agregar usuario'}).waitFor();
      if(chapterTarget==='team-permissions-custom')assert.equal(await page.getByRole('radio',{name:'Personalizados'}).isChecked(),true);
      if(chapterTarget==='help-guide-tab')assert.ok(await page.getByRole('dialog').locator('.training-guide section').count()>=6);
      assert.equal(await next.isEnabled(), true, `${role} step ${index + 1}: action unlocks Next`);
      await next.click();
    }
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
  console.log('TRAINING_QA_OK: video, gated guided actions, visual targets, role guides, desktop/tablet/mobile, no JS errors');
} finally {
  await browser.close();
}
