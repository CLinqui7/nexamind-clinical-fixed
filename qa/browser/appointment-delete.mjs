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

try{
  await page.goto(base);
  const org=await page.evaluate(async()=>{
    const user='10000000-0000-4000-8000-000000000001';
    const rpc=async(name,args)=>{
      const response=await fetch('/__qa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user,name,args})});
      const result=await response.json();if(result.error)throw Error(result.error.message);return result.data;
    };
    const org=await rpc('linkare_bootstrap_v3',{});
    const calendarId=(await rpc('linkare_bootstrap_state_v4',{org})).payload.calendars.find(calendar=>calendar.code==='doctor').id;
    await rpc('linkare_save_changes_v3',{org,changes:[
      {kind:'patient_admin',id:'delete-browser-qa-patient',expectedRevision:0,payload:{id:'delete-browser-qa-patient',name:'Paciente Eliminación QA'}},
      {kind:'appointment',id:'delete-browser-qa-event',expectedRevision:0,payload:{id:'delete-browser-qa-event',calendarId,eventType:'appointment',patientId:'delete-browser-qa-patient',title:'Paciente Eliminación QA',start:'2026-10-18T15:00:00Z',end:'2026-10-18T15:45:00Z',status:'pending'}}
    ]});
    return org;
  });
  await page.getByLabel('Correo').fill('owner@example.invalid');
  await page.locator('input[type=password]').fill('qa-password-123');
  await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).click();
  await page.getByRole('button',{name:'Agenda',exact:true}).click();
  await page.locator('.upcoming-list').getByText('Paciente Eliminación QA',{exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Detalle de la cita'});
  await dialog.getByText('Paciente Eliminación QA',{exact:true}).waitFor();

  // A month refresh replaces the visible list, but the detail must remain usable.
  await page.locator('.calendar-nav button[aria-label="Periodo anterior"]').evaluate(button=>button.click());
  await page.waitForFunction(()=>!document.querySelector('.upcoming-list')?.textContent?.includes('Paciente Eliminación QA'));
  assert.equal(await dialog.count(),1);
  page.once('dialog',confirm=>confirm.accept());
  await dialog.getByRole('button',{name:'Eliminar evento',exact:true}).click();
  await dialog.waitFor({state:'hidden'});
  assert.ok(calls.includes('linkare_delete_appointment_v1'));
  assert.equal(errors.length,0,errors.join('\n'));
  const saved=await page.evaluate(async org=>{
    const response=await fetch('/__qa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:'10000000-0000-4000-8000-000000000001',name:'linkare_load_state_v3',args:{org}})});
    const result=await response.json();if(result.error)throw Error(result.error.message);
    return result.data.payload;
  },org);
  assert.equal(saved.appointments.some(item=>item.id==='delete-browser-qa-event'),false);
  assert.equal(saved.patients.some(item=>item.id==='delete-browser-qa-patient'),true);
  console.log(JSON.stringify({passed:5,checks:['stale detail remains open after month refresh','delete uses one targeted RPC','server no longer lists deleted appointment','patient remains intact','no browser errors'],scope:'Playwright + isolated PostgreSQL; synthetic data only'},null,2));
}finally{await browser.close();}
