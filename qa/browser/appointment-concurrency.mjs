import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({channel:process.env.LINKARE_BROWSER||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.setDefaultTimeout(15000);
const errors=[];
const calls=[];
const base=process.env.LINKARE_QA_URL||'http://127.0.0.1:4173';
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{
  if(!request.url().endsWith('/__qa'))return;
  try{const body=request.postDataJSON();if(body?.name)calls.push(body.name);}catch(_){/* Ignore non-RPC controls. */}
});

async function rpc(user,name,args){
  const response=await page.evaluate(async ({user,name,args})=>{
    const result=await fetch('/__qa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user,name,args})});
    return result.json();
  },{user,name,args});
  if(response.error)throw Error(response.error.message);
  return response.data;
}

try{
  await page.goto(base);
  const owner='10000000-0000-4000-8000-000000000001';
  const secretary='10000000-0000-4000-8000-000000000005';
  const org=await rpc(owner,'linkare_bootstrap_v3',{});
  const calendarId=(await rpc(owner,'linkare_bootstrap_state_v4',{org})).payload.calendars.find(item=>item.code==='doctor').id;
  const id='concurrent-browser-qa-event';
  await rpc(owner,'linkare_save_changes_v3',{org,changes:[
    {kind:'patient_admin',id:'concurrent-browser-qa-patient',expectedRevision:0,payload:{id:'concurrent-browser-qa-patient',name:'Paciente Concurrencia QA'}},
    {kind:'appointment',id,expectedRevision:0,payload:{id,calendarId,eventType:'appointment',patientId:'concurrent-browser-qa-patient',title:'Paciente Concurrencia QA',start:'2026-10-20T15:00:00Z',end:'2026-10-20T15:45:00Z',type:'Seguimiento',modality:'Presencial',status:'pending',adminReviewStatus:'none'}}
  ]});

  await page.getByLabel('Correo').fill('owner@example.invalid');
  await page.locator('input[type=password]').fill('qa-password-123');
  await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).click();
  await page.getByRole('button',{name:'Agenda',exact:true}).click();
  await page.locator('.upcoming-list').getByText('Paciente Concurrencia QA',{exact:true}).click();
  let detail=page.getByRole('dialog',{name:'Detalle de la cita'});
  await detail.getByRole('button',{name:'Editar evento'}).click();
  let form=page.getByRole('dialog',{name:'Editar evento'});
  await form.locator('select').filter({hasText:'Prioritaria'}).selectOption('Prioritaria');
  await rpc(secretary,'linkare_patch_appointment_v1',{org,p_appointment_id:id,p_expected_revision:1,p_base:{status:'pending'},p_changes:{status:'confirmed'}});
  await form.getByRole('button',{name:'Guardar cambios'}).click();
  await form.waitFor({state:'hidden'});
  let saved=(await rpc(owner,'linkare_load_state_v3',{org})).payload.appointments.find(item=>item.id===id);
  assert.equal(saved.type,'Prioritaria');assert.equal(saved.status,'confirmed');
  assert.ok(calls.includes('linkare_patch_appointment_v1'));

  detail=page.getByRole('dialog',{name:'Detalle de la cita'});
  await detail.getByRole('button',{name:'Editar evento'}).click();
  form=page.getByRole('dialog',{name:'Editar evento'});
  await form.locator('select').filter({hasText:'Prioritaria'}).selectOption('Seguimiento');
  await rpc(secretary,'linkare_patch_appointment_v1',{org,p_appointment_id:id,p_expected_revision:3,p_base:{type:'Prioritaria'},p_changes:{type:'Seguridad'}});
  await form.getByRole('button',{name:'Guardar cambios'}).click();
  await form.getByText('Otra persona editó este evento al mismo tiempo').waitFor();
  assert.equal(await form.locator('select').filter({hasText:'Prioritaria'}).inputValue(),'Seguimiento','the local draft remains visible');
  await form.getByRole('button',{name:'Usar cambio reciente'}).click();
  assert.equal(await form.locator('select').filter({hasText:'Prioritaria'}).inputValue(),'Seguridad');
  await form.getByRole('button',{name:'Guardar cambios'}).click();
  await form.waitFor({state:'hidden'});
  saved=(await rpc(owner,'linkare_load_state_v3',{org})).payload.appointments.find(item=>item.id===id);
  assert.equal(saved.type,'Seguridad');assert.equal(saved.status,'confirmed');

  detail=page.getByRole('dialog',{name:'Detalle de la cita'});
  await detail.getByRole('button',{name:'Editar evento'}).click();
  form=page.getByRole('dialog',{name:'Editar evento'});
  await form.locator('select').filter({hasText:'Prioritaria'}).selectOption('Prioritaria');
  await rpc(secretary,'linkare_patch_appointment_v1',{org,p_appointment_id:id,p_expected_revision:4,p_base:{type:'Seguridad'},p_changes:{type:'Seguimiento'}});
  await form.getByRole('button',{name:'Guardar cambios'}).click();
  await form.getByText('Otra persona editó este evento al mismo tiempo').waitFor();
  await form.getByRole('button',{name:'Conservar mi cambio'}).click();
  assert.equal(await form.locator('select').filter({hasText:'Prioritaria'}).inputValue(),'Prioritaria');
  await form.getByRole('button',{name:'Guardar cambios'}).click();
  await form.waitFor({state:'hidden'});
  saved=(await rpc(owner,'linkare_load_state_v3',{org})).payload.appointments.find(item=>item.id===id);
  assert.equal(saved.type,'Prioritaria');assert.equal(saved.status,'confirmed');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log(JSON.stringify({passed:6,checks:['two users merge separate appointment fields','same-field edit keeps the local draft','editor can choose the server value','editor can explicitly keep their own value','merged record survives reload in isolated PostgreSQL','no browser errors'],scope:'Playwright + isolated PostgreSQL; synthetic data only'},null,2));
}finally{await browser.close();}
