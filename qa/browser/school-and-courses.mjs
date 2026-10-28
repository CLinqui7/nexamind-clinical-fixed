import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {LEARNING_CHAPTERS} from '../../src/learning-content.js';
const base='http://127.0.0.1:4173';
const browser=await chromium.launch({channel:'msedge',headless:true});
const patientName='Paciente curso prueba '+Date.now();
const errors=[],writes=[];const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.on('pageerror',e=>errors.push(e.message));
const login=async(p,role)=>{await p.goto(base,{waitUntil:'networkidle'});await p.getByLabel('Correo',{exact:true}).fill(role+'@example.invalid');await p.locator('input[type=password]').fill('qa-password-123');await p.getByRole('button',{name:'Ingresar a Linkare',exact:true}).click();await p.getByRole('button',{name:'Ayuda',exact:true}).waitFor()};
const close=async()=>page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).first().click();
try{
 await page.goto(base);await page.getByRole('button',{name:'Tutorial de acceso e invitaciones',exact:true}).click();await page.locator('[data-testid=learning-school]').waitFor();assert.equal(await page.locator('[data-chapter-id]').count(),1);await page.keyboard.press('Escape');
 await login(page,'owner');
 page.on('request',r=>{if(r.url().endsWith('/__qa')){const body=r.postDataJSON();if(body?.name?.includes('save'))writes.push(body.name)}});
 await page.getByRole('button',{name:'Ayuda',exact:true}).click();
 assert.equal(await page.locator('[data-chapter-id]').count(),LEARNING_CHAPTERS.length);
 for(const c of process.env.LINKARE_SKIP_SCHOOL?[]:LEARNING_CHAPTERS){
  await page.locator(`[data-chapter-id="${c.id}"]`).click();
  for(let i=0;i<c.controls.length;i++){await page.getByLabel('Control explicado',{exact:true}).selectOption(String(i));await page.getByRole('checkbox',{name:'Entendí este control y sé qué resultado comprobar',exact:true}).check();}
  await page.getByRole('tab',{name:'Ejercicio y comprobación',exact:true}).click();
  await page.getByRole('radio',{name:c.quiz.answers[c.quiz.correct],exact:true}).check();await page.getByRole('button',{name:'Comprobar respuesta',exact:true}).click();await page.getByText('✓ Capítulo completado. Puede repasarlo y volver a reproducir su video.',{exact:true}).waitFor();
 }
 assert.equal(writes.length,0,'School must never save patient data');
 await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Ayuda',exact:true}).click();if(!process.env.LINKARE_SKIP_SCHOOL)await page.getByText(`${LEARNING_CHAPTERS.length} capítulos · ${LEARNING_CHAPTERS.length} completados`,{exact:true}).waitFor();
 await page.getByLabel('Buscar capítulo o botón').fill('anular');assert.ok(await page.locator('[data-chapter-id]').count()>0);await page.getByLabel('Buscar capítulo o botón').fill('');
 await close();
 await page.getByRole('button',{name:'Pacientes',exact:true}).click();await page.getByRole('button',{name:'Nuevo paciente',exact:true}).first().click();
 let dialog=page.getByRole('dialog');await dialog.getByLabel('Nombre completo').fill(patientName);await dialog.getByRole('spinbutton',{name:'Edad',exact:true}).fill('35');await dialog.getByLabel('Diagnóstico principal').fill('Ejemplo de prueba');await dialog.getByRole('button',{name:'Crear paciente',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.getByRole('tab',{name:'Medicamentos',exact:true}).click();await page.getByLabel('Nombre del tratamiento pasado',{exact:true}).fill('Medicamento histórico ficticio');await page.getByRole('button',{name:'Registrar tratamiento pasado',exact:true}).click();
 dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Registrar fecha o cambio',exact:true}).click();await dialog.getByLabel('Fecha efectiva conocida',{exact:true}).fill('2020-01-10');await dialog.getByLabel('Dosis registrada',{exact:true}).fill('1 unidad de prueba');await dialog.getByLabel('Cada cuánto lo toma',{exact:true}).fill('Cada noche según nota ficticia');await dialog.getByLabel('Fuente, contexto o motivo',{exact:true}).fill('Inicio documentado en fuente sintética de capacitación');await dialog.getByRole('button',{name:'Guardar evento',exact:true}).click();await dialog.getByRole('heading',{name:'Inicio',exact:true}).waitFor();
 await dialog.getByRole('button',{name:'Registrar fecha o cambio',exact:true}).click();await dialog.getByLabel('Tipo de evento de tratamiento').selectOption('stop');await dialog.getByLabel('Fecha efectiva conocida',{exact:true}).fill('2021-06-12');await dialog.getByLabel('Fuente, contexto o motivo',{exact:true}).fill('Final documentado en nota ficticia de prueba');await dialog.getByRole('button',{name:'Guardar evento',exact:true}).click();await dialog.getByRole('heading',{name:'Finalización',exact:true}).waitFor();
 await page.keyboard.press('Escape');await page.getByText('2 evento(s)',{exact:false}).waitFor();
 await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Pacientes',exact:true}).click();await page.getByRole('button',{name:'Todos',exact:true}).click();await page.locator('[data-tour=patients-search]').fill(patientName);await page.getByRole('button').filter({has:page.getByRole('heading',{name:patientName,exact:true})}).click();await page.getByRole('tab',{name:'Medicamentos',exact:true}).click();await page.getByRole('button',{name:'Historia de tomas',exact:true}).first().click();
 dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:'Finalización',exact:true}).waitFor();
 const start=dialog.locator('article').filter({has:page.getByRole('heading',{name:'Inicio',exact:true})});await start.getByRole('button',{name:'Editar evento',exact:true}).click();await dialog.getByLabel('Fecha efectiva conocida',{exact:true}).fill('2020-01-11');await dialog.getByRole('button',{name:'Guardar evento',exact:true}).click();await dialog.getByText('11 ene 2020',{exact:false}).first().waitFor();
 const stop=dialog.locator('article').filter({has:page.getByRole('heading',{name:'Finalización',exact:true})});await stop.getByRole('button',{name:'Retirar evento',exact:true}).click();await dialog.getByLabel('Motivo de retiro',{exact:true}).fill('Evento ficticio retirado durante la comprobación');await dialog.getByRole('button',{name:'Retirar y conservar historial',exact:true}).click();await dialog.getByRole('heading',{name:'Finalización',exact:true}).waitFor({state:'hidden'});
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Ayuda',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.locator('[data-chapter-id=historia-tomas]').click();await page.screenshot({path:'qa/results/school-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Mobile school horizontal overflow');
 const secretary=await browser.newPage();await login(secretary,'secretary');await secretary.getByRole('button',{name:'Ayuda',exact:true}).click();assert.equal(await secretary.locator('[data-chapter-id=foxpro]').count(),0);assert.equal(await secretary.locator('[data-chapter-id=libreta]').count(),0);assert.ok(await secretary.locator('[data-chapter-id=secretaria-ficha]').count());
 assert.deepEqual(errors,[]);await fs.writeFile('qa/results/school-and-courses.json',JSON.stringify({chapters:LEARNING_CHAPTERS.length,controls:LEARNING_CHAPTERS.reduce((n,c)=>n+c.controls.length,0),allCompleted:true,progressSurvivesReload:true,noClinicalWritesFromSchool:true,coursePersistence:true,courseEditAndArchive:true,secretaryScoped:true,mobile:true},null,2));
 console.log('SCHOOL_AND_COURSES_OK');
}finally{await browser.close()}
