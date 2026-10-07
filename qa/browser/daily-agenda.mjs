import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({channel:process.env.LINKARE_BROWSER||'msedge',headless:true});
const page=await browser.newPage({acceptDownloads:true,viewport:{width:1440,height:1000}});
page.setDefaultTimeout(15000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:4173');
 await page.locator('input[type=email]').fill('owner@example.invalid');
 await page.locator('input[type=password]').fill('qa-password-123');
 await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).click();
 await page.getByRole('button',{name:'Agenda',exact:true}).waitFor();
 await page.evaluate(async()=>{
  const user=JSON.parse(localStorage.getItem('linkare-isolated-qa-session')).user.id;
  const rpc=async(name,args)=>{const response=await(await fetch('/__qa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user,name,args})})).json();if(response.error)throw Error(response.error.message);return response.data;};
  const org=await rpc('linkare_bootstrap_v3',{});
  const state=await rpc('linkare_bootstrap_state_v4',{org});
  const doctor=state.payload.calendars.find(calendar=>calendar.code==='doctor');
  await rpc('linkare_save_changes_v3',{org,changes:[
   {kind:'patient_admin',id:'agenda-browser-qa',expectedRevision:0,payload:{name:'Paciente sintético Agenda'}},
  {kind:'patient_clinical',id:'agenda-browser-qa',expectedRevision:0,payload:{medications:[{id:'agenda-med-1',name:'Sertralina',dose:'50 mg',frequency:'cada mañana',status:'active'},{id:'agenda-med-2',name:'Clonazepam',dose:'1/2 tableta',frequency:'cada noche',status:'active'}]}},
   {kind:'appointment',id:'agenda-appointment-qa',expectedRevision:0,payload:{calendarId:doctor.id,eventType:'appointment',patientId:'agenda-browser-qa',title:'Paciente sintético Agenda',start:'2026-10-06T14:00:00Z',end:'2026-10-06T14:45:00Z',status:'confirmed'}}
  ]});
 });
 await page.getByRole('button',{name:'Agenda',exact:true}).click();
 await page.getByLabel('Fecha de la agenda').fill('2026-10-06');
 const row=page.locator('.agenda-sheet-item');
 await row.getByText('Paciente sintético Agenda').waitFor();
 assert.match(await row.innerText(),/Sertralina · 50 mg · cada mañana/);
 assert.match(await row.innerText(),/Clonazepam · 1\/2 tableta · cada noche/);
 await row.getByLabel('Nota de agenda para imprimir').fill('Preparar resultados sintéticos');
 await row.getByRole('button',{name:'Guardar nota'}).click();
 await page.getByText('Nota de agenda guardada.').waitFor();
 await page.reload();
 await page.getByRole('button',{name:'Agenda',exact:true}).click();
 await page.getByLabel('Fecha de la agenda').fill('2026-10-06');
 await page.locator('.agenda-sheet-item').getByLabel('Nota de agenda para imprimir').waitFor();
 assert.equal(await page.locator('.agenda-sheet-item').getByLabel('Nota de agenda para imprimir').inputValue(),'Preparar resultados sintéticos');
 const downloadPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:'Guardar PDF',exact:true}).click();
 const download=await downloadPromise;
 assert.equal(download.suggestedFilename(),'Agenda_del_dia_2026-10-06.pdf');
 await page.locator('.profile-chip-button').click();
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
 await page.locator('input[type=email]').fill('secretary@example.invalid');
 await page.locator('input[type=password]').fill('qa-password-123');
 await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).click();
 await page.getByRole('button',{name:'Agenda',exact:true}).click();
 await page.getByLabel('Fecha de la agenda').fill('2026-10-06');
 await page.locator('.agenda-sheet-item').getByText('Sertralina · 50 mg · cada mañana').waitFor();
 assert.equal(await page.locator('.agenda-sheet-item').getByLabel('Nota de agenda para imprimir').inputValue(),'Preparar resultados sintéticos');
 const secretaryDownload=page.waitForEvent('download');
 await page.getByRole('button',{name:'Guardar PDF',exact:true}).click();
 assert.equal((await secretaryDownload).suggestedFilename(),'Agenda_del_dia_2026-10-06.pdf');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,checks:['doctor agenda includes active medication and dose','daily note is saved and survives reload','owner PDF is downloaded with the chosen date','Secretary sees the scoped medication list and saved note','Secretary downloads the same dated PDF','no browser errors'],scope:'Playwright + isolated PostgreSQL; synthetic data only'},null,2));
}finally{await browser.close();}
