import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const title=`Evento general QA ${Date.now()}`;
const login=async()=>{
 await page.getByLabel('Correo').fill('owner@example.invalid');
 await page.locator('input[type=password]').fill('qa-password-123');
 await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).click();
 await page.getByRole('button',{name:'Agenda',exact:true}).waitFor();
};
try{
 await page.goto('http://127.0.0.1:4173');await login();
 await page.getByRole('button',{name:'Configuración',exact:true}).click();
 const largeText=page.locator('.setting-toggle',{hasText:'Texto grande'});const largeTextBefore=await largeText.getByRole('checkbox').isChecked();await largeText.click();assert.notEqual(await largeText.getByRole('checkbox').isChecked(),largeTextBefore);const expectedSwitchColor=largeTextBefore?'rgb(233, 238, 242)':'rgb(5, 49, 110)';await page.waitForFunction(expected=>getComputedStyle(document.querySelector('.setting-toggle-track')).backgroundColor===expected,expectedSwitchColor);const switchColor=await largeText.locator('.setting-toggle-track').evaluate(node=>getComputedStyle(node).backgroundColor);assert.equal(switchColor,expectedSwitchColor);
 await page.getByRole('button',{name:'Agregar usuario',exact:true}).click();
 let dialog=page.getByRole('dialog');await dialog.getByText('Todos los permisos permitidos',{exact:true}).waitFor();await dialog.getByText('Personalizados',{exact:true}).click();await dialog.getByRole('button',{name:'Limpiar todos',exact:true}).click();assert.equal(await dialog.locator('.permission-row input:checked').count(),0);await dialog.getByRole('button',{name:'Seleccionar todos',exact:true}).click();assert.ok(await dialog.locator('.permission-row input:checked').count()>0);assert.ok((await dialog.locator('.permission-selection-count').innerText()).includes('permisos activos'));await dialog.getByLabel('Nombre completo').fill('Invitada QA');await dialog.getByLabel('Correo').fill(`invite-${Date.now()}@example.invalid`);await dialog.getByRole('button',{name:'Enviar invitación',exact:true}).click();await dialog.getByText('No existe una contraseña predeterminada.',{exact:false}).waitFor();await dialog.getByRole('button',{name:'Entendido',exact:true}).click();
 const secretaryRow=page.locator('.team-member',{hasText:'secretary@example.invalid'});await secretaryRow.getByRole('button',{name:'Permisos',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByText('Personalizados',{exact:true}).waitFor();const createPatientsRow=dialog.locator('.permission-row',{hasText:'Crear pacientes'});const createPatients=createPatientsRow.getByRole('checkbox');assert.equal(await createPatients.isChecked(),true);await createPatientsRow.click();assert.equal(await createPatients.isChecked(),false);assert.equal(await createPatientsRow.evaluate(node=>node.classList.contains('active')),false);await dialog.getByRole('button',{name:'Guardar permisos',exact:true}).click();const saveResult=page.getByText('Permisos actualizados en el servidor.',{exact:true}).or(page.locator('.form-error'));await saveResult.waitFor();if(await page.locator('.form-error').count())throw new Error(`permission save failed: ${await page.locator('.form-error').innerText()}`);await secretaryRow.getByRole('button',{name:'Permisos',exact:true}).click();dialog=page.getByRole('dialog');assert.equal(await dialog.locator('.permission-row',{hasText:'Crear pacientes'}).getByRole('checkbox').isChecked(),false);await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Agenda',exact:true}).click();
 for(const name of ['Doctor','Esposa','General'])await page.locator('.calendar-filter',{hasText:name}).waitFor();
 assert.equal(await page.locator('.calendar-filter input:checked').count(),3);
 await page.getByRole('button',{name:'Nuevo evento',exact:true}).click();
 dialog=page.getByRole('dialog');
 await dialog.waitFor();const eventTypeSelect=dialog.getByLabel('Clase de evento');
 assert.equal(await dialog.locator('input[name=appointmentCalendar]:checked').count(),0);await dialog.getByText('Falta elegir el calendario.',{exact:false}).waitFor();
 await eventTypeSelect.selectOption('general');
 assert.equal(await dialog.locator('input[name=appointmentCalendar]:checked').count(),0);await dialog.locator('.calendar-choice',{hasText:'General'}).click();assert.equal(await dialog.locator('input[name=appointmentCalendar]:checked').count(),1);
 await dialog.getByLabel('Título del evento').fill(title);
 await dialog.getByRole('button',{name:'Crear evento',exact:true}).click();
 await page.getByText('Evento creado correctamente.',{exact:true}).waitFor();
 await page.reload();await page.getByRole('button',{name:'Agenda',exact:true}).click();await page.getByRole('button',{name:'Día',exact:true}).click();
 await page.getByText(title,{exact:true}).waitFor();
 await page.getByText('General',{exact:true}).last().waitFor();
 for(const name of ['Doctor','Esposa'])await page.locator('.calendar-filter',{hasText:name}).click();
 assert.equal(await page.locator('.calendar-filter input:checked').count(),1);
 await page.getByText(title,{exact:true}).waitFor();
 for(const viewport of [{width:768,height:1024},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.getByText('Calendarios visibles',{exact:true}).waitFor();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);assert.equal(overflow,false,`horizontal overflow at ${viewport.width}px`);
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('.profile-chip-button').click();await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).waitFor();
 await login();await page.getByRole('button',{name:'Agenda',exact:true}).click();await page.getByRole('button',{name:'Día',exact:true}).click();await page.getByText(title,{exact:true}).waitFor();
 console.log(JSON.stringify({passed:15,checks:['visible settings switch','all/custom mode during user creation','permission bulk selection has visible state','invite explains private password setup','existing Secretary permission can be changed','permission persists after reopening','three named calendars','all selected without reload','new event starts without implicit calendar','visual calendar choice is explicit','general event without patient','event persisted after refresh','combined filtering','responsive tablet/mobile','persisted after logout/login'],scope:'isolated PostgreSQL; no production writes'},null,2));
}finally{await browser.close();}
