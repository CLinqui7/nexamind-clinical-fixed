import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({channel:process.env.LINKARE_BROWSER||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}});
page.setDefaultTimeout(15000);
const errors=[];
page.on('pageerror',error=>errors.push(error.stack||error.message));
const patientName=`Paciente cita Secretaría QA ${Date.now()}`;
const login=async email=>{
 await page.goto('http://127.0.0.1:4173');
 await page.getByLabel('Correo').fill(email);
 await page.locator('input[type=password]').fill('qa-password-123');
 await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).click();
 await page.getByRole('button',{name:'Agenda',exact:true}).waitFor();
};
try{
 await login('owner@example.invalid');
 await page.getByRole('button',{name:'Nuevo paciente',exact:true}).first().click();
 const patientDialog=page.getByRole('dialog',{name:'Nuevo paciente'});
 await patientDialog.getByLabel('Nombre completo').fill(patientName);
 await patientDialog.getByRole('spinbutton',{name:'Edad',exact:true}).fill('40');
 await patientDialog.getByLabel('Diagnóstico principal').fill('Dato sintético');
 await patientDialog.getByRole('button',{name:'Crear paciente',exact:true}).click();
 await page.getByText('Paciente registrado correctamente.',{exact:true}).waitFor();
 const team=await page.evaluate(async()=>{
  const response=await fetch('/__qa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:'10000000-0000-4000-8000-000000000001',team:true,teamInput:{action:'update',userId:'10000000-0000-4000-8000-000000000005',role:'secretary',name:'Secretaría QA',permissions:{patientsView:true,patientsCreate:true,appointmentsManage:true,calendarDoctorView:true,calendarDoctorCreate:true,calendarDoctorEdit:true,remindersManage:true,consultationFeeView:true,prescriptionsEdit:true}}})});
  return response.json();
 });
 assert.equal(team.error,null);
 await page.locator('.profile-chip-button').click();
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
 await login('secretary@example.invalid');
 const raceQuery='qa-directory-race-no-patient';
 let releaseDirectory;
 let requestSeen;
 const directoryRequest=new Promise(resolve=>{requestSeen=resolve;});
 await page.route('**/__qa',async route=>{
  const request=route.request();
  const body=request.postDataJSON();
  if(body?.name==='linkare_patient_directory_v1'&&body.args?.p_query===raceQuery){
   requestSeen();
   await new Promise(resolve=>{releaseDirectory=resolve;});
  }
  await route.continue();
 });
 await page.getByRole('button',{name:'Pacientes',exact:true}).click();
 await page.locator('[data-tour="patients-search"]').fill(raceQuery);
 await directoryRequest;
 await page.getByRole('button',{name:'Agenda',exact:true}).click();
 await page.getByRole('button',{name:'Nuevo evento',exact:true}).first().click();
 const dialog=page.getByRole('dialog',{name:'Nuevo evento'});
 await dialog.waitFor();
 await dialog.locator('.calendar-choice',{hasText:'Doctor'}).click();
 await dialog.getByRole('combobox',{name:'Paciente'}).fill(patientName);
 await dialog.getByRole('option',{name:new RegExp(patientName)}).click();
 releaseDirectory();
 await page.waitForTimeout(500);
 assert.equal(await page.getByRole('heading',{name:'No pudimos mostrar esta pantalla'}).count(),0,'directory refresh must not crash an open appointment form');
 await dialog.waitFor();
 await dialog.locator('[data-appointment-date]').fill('2099-11-12');
 await dialog.getByRole('button',{name:'Crear evento',exact:true}).click();
 await page.waitForTimeout(500);
 const diagnostic={formError:await page.locator('.form-error').allInnerTexts(),fatal:await page.getByRole('heading',{name:'No pudimos mostrar esta pantalla'}).count(),errors};
 if(diagnostic.formError.length||diagnostic.fatal||diagnostic.errors.length)console.log(JSON.stringify(diagnostic));
 await page.getByRole('dialog',{name:'Detalle de la cita'}).waitFor();
 const persisted=await page.evaluate(async name=>{
  const session=JSON.parse(localStorage.getItem('linkare-isolated-qa-session'));
  const rpc=async(name,args)=>(await(await fetch('/__qa',{method:'POST',body:JSON.stringify({user:session.user.id,name,args})})).json()).data;
  const org=await rpc('linkare_bootstrap_v3',{});
  const loaded=await rpc('linkare_load_state_v3',{org});
  return loaded.payload.appointments.filter(item=>item.title.includes(name)).length;
 },patientName);
 assert.equal(persisted,1,'the appointment must be acknowledged in isolated PostgreSQL');
 assert.equal(errors.length,0,errors.join('\n'));
 console.log(JSON.stringify({passed:2,checks:['Secretary creates a patient appointment without crashing','Appointment is stored exactly once in isolated PostgreSQL'],scope:'isolated PostgreSQL; synthetic data only'},null,2));
}finally{await browser.close();}
