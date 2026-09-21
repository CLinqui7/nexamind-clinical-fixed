import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.LINKARE_BROWSER||'msedge',headless:true});
const page=await browser.newPage();page.setDefaultTimeout(12000);
const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
const name='QA Modules '+Date.now(),diagnosis='SYNTHETIC_PRIVATE_DIAGNOSIS';
const login=async role=>{await page.locator('input[type=email]').fill(role+'@example.invalid');await page.locator('input[type=password]').fill('qa-password-123');await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).click();await page.getByRole('button',{name:'Pacientes',exact:true}).waitFor();};
const logout=async()=>{await page.locator('.profile-chip-button').click();await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).waitFor();};
const patient=async()=>{await page.getByRole('button',{name:'Pacientes',exact:true}).click();await page.getByText(name,{exact:true}).click();};
const reload=async()=>{await page.reload();await patient();};
const state=()=>page.evaluate(async()=>{
 const session=JSON.parse(localStorage.getItem('linkare-isolated-qa-session'));
 const rpc=async(name,args)=>(await (await fetch('/__qa',{method:'POST',body:JSON.stringify({user:session.user.id,name,args})})).json()).data;
 return rpc('linkare_load_state_v3',{org:await rpc('linkare_bootstrap_v3',{})});
});
try{
 await page.goto('http://127.0.0.1:4173');await login('owner');
 await page.getByRole('button',{name:'Mi plan',exact:true}).click();await page.getByText('US$0',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:/Pagar|Suscribirse/}).count(),0);checks.push('free plan shows US$0 without checkout');
 await page.getByRole('button',{name:'Pacientes',exact:true}).click();await page.getByRole('button',{name:'Nuevo paciente',exact:true}).first().click();
 await page.getByLabel('Nombre completo').fill(name);await page.getByRole('spinbutton',{name:'Edad',exact:true}).fill('32');await page.getByLabel('Diagnóstico principal').fill(diagnosis);await page.getByRole('button',{name:'Crear paciente',exact:true}).click();await page.getByText('Paciente registrado correctamente.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Datos y seguro',exact:true}).click();await page.getByLabel('Teléfono',{exact:true}).first().fill('+50370000000');await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();await page.getByText('Datos del paciente actualizados.',{exact:true}).waitFor();await reload();assert.equal((await state()).payload.patients.find(p=>p.name===name).phone,'+50370000000');checks.push('patient edit persists after reload');
 await page.getByRole('button',{name:'Agendar',exact:true}).click();await page.getByLabel('Fecha y hora').fill('2026-10-05T10:00');await page.getByLabel('Notas de preparación').fill('Synthetic appointment notes');await page.getByRole('button',{name:'Crear cita',exact:true}).click();await page.getByRole('dialog',{name:'Detalle de la cita'}).waitFor();await reload();assert.ok((await state()).payload.appointments.some(a=>a.notes==='Synthetic appointment notes'));checks.push('appointment and private notes persist after reload');
 await page.getByRole('button',{name:'Registrar evolución',exact:true}).click();await page.getByRole('spinbutton',{name:/Puntaje/}).fill('5');await page.getByLabel('Nota clínica').fill('Synthetic evolution');await page.getByRole('button',{name:'Guardar evolución',exact:true}).click();await page.getByText('Evolución clínica registrada.',{exact:true}).waitFor();await reload();assert.ok(JSON.stringify((await state()).payload.patients.find(p=>p.name===name)).includes('Synthetic evolution'));checks.push('clinical evolution persists after reload');
 await page.getByRole('button',{name:'Subir archivo',exact:true}).click();await page.locator('.modal input[type=file]').setInputFiles({name:'qa-synthetic.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic QA only')});await page.getByLabel('Descripción').fill('QA document');await page.getByRole('button',{name:'Agregar al expediente',exact:true}).click();await page.getByText('Documento guardado en el expediente.',{exact:true}).waitFor();await reload();assert.ok((await state()).payload.patients.find(p=>p.name===name).documents.some(d=>d.name==='qa-synthetic.txt'));checks.push('document metadata persists; Storage insert and audit policies accepted');
 await page.locator('.profile-chip-button').click();await page.getByRole('dialog',{name:'Mi cuenta'}).getByRole('button',{name:'Configuración',exact:true}).click();await page.getByRole('button',{name:'Agregar usuario',exact:true}).click();
 for(const role of ['doctor','nurse','secretary']){await page.getByRole('dialog').getByRole('combobox').selectOption(role);assert.equal(await page.getByLabel(/Gestionar usuarios/).count(),0);if(role==='secretary')assert.equal(await page.getByLabel(/Ver información clínica/).count(),0);else assert.equal(await page.getByLabel(/Ver información clínica/).count(),1);}
 checks.push('owner invitation UI exposes three roles and safe permission groups');await page.getByRole('button',{name:'Cerrar',exact:true}).click();await logout();
 for(const role of ['doctor','nurse','secretary']){
  await login(role);assert.equal(await page.getByRole('button',{name:'Mi plan',exact:true}).count(),0);await patient();const d=await state();const p=d.payload.patients.find(p=>p.name===name);
  assert.equal(p.diagnosis,role==='doctor'?diagnosis:undefined);assert.equal(p.documents?.length||0,role==='nurse'?1:0);
  if(role==='nurse')await page.getByText('qa-synthetic.txt',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Registrar evolución',exact:true}).count(),0);
  checks.push(role+' receives only permitted clinical/document data and no plan access');await logout();
 }
 await login('owner');await patient();assert.equal((await state()).payload.patients.find(p=>p.name===name).diagnosis,diagnosis);checks.push('owner data remains after multiple role logins');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:checks.length,checks,scope:'Browser + isolated PostgreSQL, mocked Auth and file bytes; no email or real provider calls'},null,2));
}finally{await browser.close();}
