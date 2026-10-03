import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const base='http://127.0.0.1:4173';
const browser=await chromium.launch({channel:process.env.LINKARE_BROWSER||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(18000);
const rpcNames=[],errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().endsWith('/__qa'))try{const body=request.postDataJSON();if(body.name)rpcNames.push(body.name);}catch{}});
const login=async role=>{await page.locator('input[type=email]').fill(`${role}@example.invalid`);await page.locator('input[type=password]').fill('qa-password-123');await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).click();await page.getByRole('button',{name:'Pacientes',exact:true}).waitFor();};
const logout=async()=>{await page.locator('.profile-chip-button').click();await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).waitFor();};
const seed=()=>page.evaluate(async()=>{
 const session=JSON.parse(localStorage.getItem('linkare-isolated-qa-session'));const call=async(name,args)=>(await (await fetch('/__qa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:session.user.id,name,args})})).json()).data;
 const org=await call('linkare_bootstrap_v3',{}),changes=[];
 for(let index=0;index<25;index++){
  const id=`phase2-${String(index).padStart(2,'0')}`,name=index===0?'Ángela Núñez QA':'Paciente reciente QA '+String(index).padStart(2,'0');
  changes.push({kind:'patient_admin',id,expectedRevision:0,deleted:false,payload:{id,name,phone:`+5037000${String(index).padStart(4,'0')}`,email:`phase2-${index}@example.invalid`,insurance:{hasInsurance:true,provider:'Seguro QA'},archived:false}});
  changes.push({kind:'patient_clinical',id,expectedRevision:0,deleted:false,payload:{diagnosis:'DIAGNOSTICO_PRIVADO_QA',consultations:[{id:`note-${index}`,status:'signed',signedBy:session.user.id,startedAt:`2026-09-${String((index%25)+1).padStart(2,'0')}T16:00:00Z`,signedAt:`2026-09-${String((index%25)+1).padStart(2,'0')}T17:00:00Z`}]}});
 }
 return call('linkare_save_changes_v3',{org,changes});
});

try{
 await page.goto(base);await login('owner');await seed();const navigationRpcStart=rpcNames.length;await page.reload();await page.getByRole('button',{name:'Pacientes',exact:true}).click();
 await page.getByText('Directorio seguro',{exact:true}).waitFor();assert.equal(await page.locator('.patient-card').count(),20);assert.equal(await page.getByText('Página 1',{exact:true}).count(),1);
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();await page.getByText('Página 2',{exact:true}).waitFor();assert.ok(await page.locator('.patient-card').count()>=5);
 const search=page.locator('[data-tour="patients-search"]');await search.fill('nunez');await page.waitForTimeout(450);await page.getByText('Ángela Núñez QA',{exact:true}).waitFor();assert.equal(await page.locator('.patient-card').count(),1);
 await page.getByText('Ángela Núñez QA',{exact:true}).click();await page.locator('.patient-hero h1').getByText('Ángela Núñez QA',{exact:true}).waitFor();assert.match(await page.locator('body').innerText(),/DIAGNOSTICO_PRIVADO_QA/);
 await page.locator('.patient-hero').getByRole('button',{name:'Agendar',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Buscar paciente').fill('Paciente reciente QA 24');const patientSelect=dialog.locator('select:has(option[value="phase2-24"])');await patientSelect.waitFor();await patientSelect.selectOption('phase2-24');assert.equal(await patientSelect.inputValue(),'phase2-24');await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
 assert.equal(rpcNames.slice(navigationRpcStart).includes('linkare_save_changes_v3'),false);
 await logout();await login('secretary');await page.getByRole('button',{name:'Pacientes',exact:true}).click();await page.locator('[data-tour="patients-search"]').fill('nunez');await page.waitForTimeout(450);await page.getByText('Ángela Núñez QA',{exact:true}).click();await page.getByText('Ficha administrativa',{exact:true}).waitFor();assert.equal(await page.getByText('DIAGNOSTICO_PRIVADO_QA',{exact:true}).count(),0);
 assert.ok(rpcNames.includes('linkare_bootstrap_state_v4'));assert.equal(rpcNames.includes('linkare_load_state_v3'),false);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:10,checks:['v4 bootstrap used','v3 full state not used','first page capped at 20','keyset second page works','accent-insensitive server search works','patient opens by id','appointment selector searches remotely and resolves ID','navigation emits zero save RPCs','owner receives clinical detail','Secretary receives administrative detail only'],scope:'Playwright + isolated PostgreSQL; synthetic records only; no production writes'},null,2));
}finally{await browser.close();}
