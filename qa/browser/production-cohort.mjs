import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {readZipEntries} from '../../scripts/lib/zip-reader.mjs';
import {readFoxProArchive} from '../../scripts/lib/foxpro-reader.mjs';
import {buildLegacyPlan} from '../../scripts/lib/legacy-plan.mjs';
import {buildLegacyCohort} from '../../scripts/lib/legacy-cohort.mjs';

const email=process.env.LINKARE_QA_EMAIL,password=process.env.LINKARE_QA_PASSWORD;
const sourceZip=process.env.LINKARE_SOURCE_ZIP,shotDir=process.env.LINKARE_PRIVATE_SCREENSHOTS;
if(!email||!password||!sourceZip||!shotDir)throw Error('PRIVATE_QA_INPUTS_REQUIRED');
const org='f5cf65b6-284d-4454-9285-4035b90f7db7';
const backupSha='f0054f84d8ade9bfb0c7e5551d99818cf14b9131f75dca06d0b70769b6197de9';
const full=buildLegacyPlan({tables:readFoxProArchive(readZipEntries(sourceZip)),organizationId:org,sourceSystem:'foxpro-linkare-pilot50',backupSha});
const cohort=buildLegacyCohort(full,50);
const patients=new Map(cohort.records.filter(record=>record.destinationKind==='patient_admin').map(record=>[record.destinationId,{
  name:record.payload.name,
  displayName:record.payload.name.replace(/\s*\(\$[^)]+\)/g,'').replace(/\s+/g,' ').trim(),
  lastDate:'',historyCount:0
}]));
for(const record of cohort.records)for(const entry of record.historyEntries||[]){
  const patient=patients.get(entry.patientId);
  if(patient)patient.historyCount++;
  if(patient&&typeof entry.occurredOn==='string'&&entry.occurredOn>patient.lastDate)patient.lastDate=entry.occurredOn;
}
const ordered=[...patients.values()].sort((a,b)=>b.lastDate.localeCompare(a.lastDate));
const samples=[{label:'recent',patient:ordered[0]},{label:'old',patient:ordered.at(-1)}];
fs.mkdirSync(shotDir,{recursive:true});
const browser=await chromium.launch({channel:process.env.LINKARE_BROWSER||'msedge',headless:true});
const base=process.env.LINKARE_PRODUCTION_URL||'https://nexamind-clinical.vercel.app';
const context=await browser.newContext({viewport:{width:1440,height:1000}});
if(process.env.VERCEL_OIDC_TOKEN){
  await context.route(`${new URL(base).origin}/**`,route=>route.continue({headers:{
    ...route.request().headers(),'x-vercel-trusted-oidc-idp-token':process.env.VERCEL_OIDC_TOKEN
  }}));
}
const page=await context.newPage();
page.setDefaultTimeout(20000);
const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.name));
let stage='open';
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
  stage='login';
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).click();
  await page.getByRole('button',{name:'Pacientes',exact:true}).waitFor({timeout:30000});
  for(const sample of samples){
    stage=`directory-${sample.label}`;
    await page.getByRole('button',{name:'Pacientes',exact:true}).click();
    await page.getByRole('button',{name:'Todos',exact:true}).click();
    await page.locator('[data-tour="patients-search"]').fill(sample.patient.name);
    await page.getByText('1 en esta página',{exact:true}).waitFor({timeout:30000});
    await page.getByText(sample.patient.displayName,{exact:true}).first().waitFor({timeout:30000});
    await page.screenshot({path:path.join(shotDir,`${sample.label}-directory.png`)});
    stage=`detail-${sample.label}`;
    await page.getByText('Ver detalle',{exact:true}).first().click();
    await page.getByRole('tab',{name:'Sistema anterior',exact:true}).waitFor();
    await page.screenshot({path:path.join(shotDir,`${sample.label}-detail.png`)});
    stage=`medications-${sample.label}`;
    await page.getByRole('tab',{name:'Medicamentos',exact:true}).click();
    const medicationHeading=page.getByText('Menciones de medicamentos en FoxPro',{exact:true});
    await medicationHeading.waitFor();
    await page.getByText('Sin verificar',{exact:true}).first().waitFor({timeout:30000});
    await medicationHeading.scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(shotDir,`${sample.label}-medications.png`)});
    stage=`history-${sample.label}`;
    await page.getByRole('tab',{name:'Sistema anterior',exact:true}).click();
    const firstEvent=page.locator('.legacy-event').first();
    await firstEvent.waitFor({timeout:30000});
    await page.getByText(`${Math.min(20,sample.patient.historyCount)}${sample.patient.historyCount>20?'+':''} registro(s) visibles`,{exact:true}).waitFor();
    await firstEvent.scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(shotDir,`${sample.label}-history.png`)});
  }
  assert.deepEqual(pageErrors,[]);
  console.log(JSON.stringify({status:'PASS',samples:2,checks:['production sign-in','recent and old patient directory search','detail opens','historical medication review visible','historical clinical history visible','browser runtime errors absent'],privateScreenshots:shotDir}));
}catch(error){
  await page.screenshot({path:path.join(shotDir,'failed-stage.png')}).catch(()=>{});
  console.error(JSON.stringify({status:'FAIL',stage,code:error?.name||'UNKNOWN'}));
  process.exitCode=1;
}finally{await browser.close();}
