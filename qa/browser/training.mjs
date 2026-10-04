import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { defaultPermissions } from '../../src/domain/permissions.js';
import { DEMO_PATIENT_NAME, DEMO_MEDICATION_NAME, trainingFor } from '../../src/training.js';

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
  assert.ok(trainingFor('secretary',{patients:true,agenda:true,demoPatient:true,demoAppointment:true}).steps.every(step=>!['patient-tab-medications','consultations-start'].includes(step.target)));
  assert.equal(trainingFor('secretary',{patients:true,agenda:false,demoPatient:true}).steps.find(step=>step.title==='Vuelva al directorio')?.view,'patient');
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
    { role: 'secretary', size: { width: 1440, height: 900 }, steps: 23 },
    { role: 'owner', size: { width: 1440, height: 900 }, steps: 33 },
    { role: 'secretary', size: { width: 800, height: 1280 }, steps: 23, touch: true },
    { role: 'owner', size: { width: 1280, height: 800 }, steps: 33, touch: true },
    { role: 'secretary', size: { width: 390, height: 844 }, steps: 23, touch: true },
  ];
  for (const { role, size, steps, touch = false } of cases) {
    if(process.env.LINKARE_TOUR_ROLE&&role!==process.env.LINKARE_TOUR_ROLE)continue;
    if(process.env.LINKARE_TOUR_WIDTH&&size.width!==Number(process.env.LINKARE_TOUR_WIDTH))continue;
    const chapter = trainingFor(role, { patients:true, agenda:true, settings:true, usersManage:true, hasCalendars:true, createEvent:true,demoPatient:true,demoAppointment:true,medicationsCapture:role==='secretary',medicationsManage:role==='owner',consultationsManage:role==='owner' }).steps;
    assert.equal(chapter.length, steps);
    const page = await browser.newPage({ viewport: size, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 1.5 : 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const remoteWrites=[];
    page.on('request',request=>{if(request.url().endsWith('/__qa')&&request.method()==='POST'){try{const body=JSON.parse(request.postData()||'{}');if(body.name==='linkare_save_changes_v3'||body.name?.includes('capture'))remoteWrites.push(body.name);}catch(_){}}});
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
    assert.ok(await dialog.locator('.training-guide section').count() >= 8);
    await dialog.getByRole('tab', { name: 'Preguntas frecuentes' }).click();
    assert.ok(await dialog.getByText('¿Por qué falta un botón?').count());
    await dialog.getByRole('button', { name: 'Iniciar recorrido interactivo' }).click();
    remoteWrites.length=0;
    const guide = page.locator('.training-popover');
    await guide.waitFor();
    await page.locator('.training-sandbox-banner').waitFor();
    assert.equal(await guide.getByRole('button', { name: /Siguiente|Finalizar/ }).count(), 0, 'the tour must advance from real actions, never Next');
    for (let index = 0; index < steps; index++) {
      const chapterTarget=chapter[index].target;
      if(process.env.LINKARE_TOUR_TRACE==='1')console.log(`TOUR ${role} ${size.width} ${index+1}/${steps} ${chapterTarget}`);
      await page.locator(`.training-popover[data-tour-step="${index+1}"]`).waitFor();
      const target = page.locator('[data-tour-active-target="true"]');
      await target.waitFor();
      assert.equal(await target.count(), 1);
      await page.locator('.training-target-pin').waitFor();
      const geometry = await page.evaluate(() => {
        const target = document.querySelector('[data-tour-active-target]')?.getBoundingClientRect();
        const panel = document.querySelector('.training-popover')?.getBoundingClientRect();
        return {
          separated:target && panel && (target.right <= panel.left + 1 || target.left >= panel.right - 1 || target.bottom <= panel.top + 1 || target.top >= panel.bottom - 1),
          targetVisible:target && target.right>0 && target.left<innerWidth && target.bottom>0 && target.top<innerHeight,
          cardVisible:panel && panel.left>=0 && panel.right<=innerWidth+1 && panel.top>=0 && panel.bottom<=innerHeight+1,
          targetRect:target&&{x:target.x,y:target.y,width:target.width,height:target.height},
          cardRect:panel&&{x:panel.x,y:panel.y,width:panel.width,height:panel.height},
        };
      });
      if(!geometry.separated)await page.screenshot({path:`${process.env.TEMP}/linkare-tour-overlap-${role}-${size.width}-${index+1}.png`});
      assert.ok(geometry.separated, `${role} ${size.width}: guide overlaps highlighted control at step ${index + 1}: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.targetVisible && geometry.cardVisible, `${role} ${size.width}: target or guide leaves the viewport at step ${index + 1}`);
      const space = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth }));
      assert.ok(space.document <= space.width + 1, `${role} ${size.width}: horizontal overflow`);
      if(index===0){
        await page.evaluate(()=>document.querySelector('[data-tour="help-button"]').click());
        assert.equal(await page.getByRole('dialog').count(),0,'non-target clicks must not change the screen');
        assert.equal(await guide.getAttribute('data-tour-step'),'1');
      }
      if (process.env.LINKARE_TOUR_SHOTS === '1' && [0, 6, 13, 20].includes(index)) {
        await page.screenshot({ path: `${process.env.TEMP}/linkare-tour-${role}-${size.width}-${index + 1}.png` });
      }
      const calendarWasChecked=chapterTarget==='calendar-filter-first'?await target.locator('input').isChecked():null;
      if(chapter[index].event==='input')await target.fill(chapter[index].expected||'Nota ficticia de capacitación, sin datos de personas reales.');
      else if(chapterTarget==='appointment-start'){
        const date=new Date(Date.now()+7*86400000);date.setHours(10,0,0,0);
        const value=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        await target.fill(value);
      } else if(await target.evaluate(node=>node.tagName==='SELECT')){
        await target.selectOption(chapter[index].expected);
      } else await target.click();
      if(chapterTarget==='nav-patients')await page.getByRole('heading',{name:'Pacientes',exact:true}).waitFor();
      if(chapterTarget==='nav-agenda')await page.getByRole('heading',{name:'Calendarios',exact:true}).waitFor();
      if(chapterTarget==='calendar-filter-first')assert.notEqual(await target.locator('input').isChecked(),calendarWasChecked);
      if(chapterTarget==='agenda-new-event')assert.equal(await page.getByRole('dialog').locator('input[name=appointmentCalendar]:checked').count(),0);
      if(chapterTarget==='appointment-calendar-first')assert.equal(await page.getByRole('dialog').locator('input[name=appointmentCalendar]:checked').count(),1);
      if(chapterTarget==='patient-form-save')await page.getByRole('heading',{name:DEMO_PATIENT_NAME}).waitFor();
      if(chapterTarget==='medication-form-save')assert.ok(await page.getByText(DEMO_MEDICATION_NAME,{exact:true}).count());
      if(chapterTarget==='consultations-start')await page.getByRole('heading',{name:'Notas de la consulta'}).waitFor();
      if(chapterTarget==='appointment-form-save')await page.getByRole('dialog',{name:'Detalle de la cita'}).waitFor();
      if(chapterTarget==='appointment-detail-close')assert.equal(await page.getByRole('dialog').count(),0);
      if(['appointment-cancel','team-cancel','help-close'].includes(chapterTarget))assert.equal(await page.getByRole('dialog').count(),0);
      if(chapterTarget==='team-add-user')await page.getByRole('dialog',{name:'Agregar usuario'}).waitFor();
      if(chapterTarget==='team-permissions-custom')assert.equal(await page.getByRole('radio',{name:'Personalizados'}).isChecked(),true);
      if(chapterTarget==='help-guide-tab')assert.ok(await page.getByRole('dialog').locator('.training-guide section').count()>=6);
      if(index<steps-1)await page.locator(`.training-popover[data-tour-step="${index+2}"]`).waitFor();
      else await guide.waitFor({state:'detached'});
    }
    assert.equal(await guide.count(), 0);
    assert.equal(await page.locator('[data-tour-active-target]').count(), 0);
    assert.equal(await page.locator('.training-sandbox-banner').count(),0);
    assert.equal(await page.getByText(DEMO_PATIENT_NAME,{exact:true}).count(),0,'demo patient must vanish when tour ends');
    assert.deepEqual(remoteWrites,[],`${role} ${size.width}: tour attempted a remote write`);
    assert.deepEqual(errors, [], `${role} ${size.width} JavaScript errors`);
    await page.close();
  }
  const reduced = await browser.newPage({ reducedMotion: 'reduce' });
  await login(reduced, 'owner');
  await reduced.getByRole('button', { name: 'Ayuda', exact: true }).click();
  await reduced.getByRole('button', { name: 'Iniciar recorrido interactivo' }).click();
  assert.equal(await reduced.locator('.training-popover').evaluate(element => getComputedStyle(element).animationName), 'none');
  await reduced.keyboard.press('Escape');
  assert.equal(await reduced.locator('.training-popover').count(), 0);
  await reduced.getByRole('button', { name: 'Ayuda', exact: true }).click();
  await reduced.getByRole('button', { name: 'Iniciar recorrido interactivo' }).click();
  const earlyActions=[null,null,DEMO_PATIENT_NAME,'35','Caso ficticio para capacitación',null];
  for(let index=0;index<earlyActions.length;index++){
    await reduced.locator(`.training-popover[data-tour-step="${index+1}"]`).waitFor();
    const control=reduced.locator('[data-tour-active-target="true"]');
    if(earlyActions[index]===null)await control.click();
    else await control.fill(earlyActions[index]);
  }
  await reduced.getByRole('heading',{name:DEMO_PATIENT_NAME}).waitFor();
  await reduced.keyboard.press('Escape');
  assert.equal(await reduced.locator('.training-popover').count(),0);
  assert.equal(await reduced.locator('.training-sandbox-banner').count(),0);
  assert.equal(await reduced.getByText(DEMO_PATIENT_NAME,{exact:true}).count(),0,'early exit must discard the demo patient');
  await reduced.close();
  console.log('TRAINING_QA_OK: isolated demo patient, medicine, notebook, appointment, role guides, desktop/tablet/mobile, no remote writes or JS errors');
} finally {
  await browser.close();
}
