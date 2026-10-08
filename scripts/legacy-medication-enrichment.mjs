import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import {readZipEntries} from './lib/zip-reader.mjs';
import {readFoxProArchive} from './lib/foxpro-reader.mjs';
import {buildLegacyPlan,isStrictUuid} from './lib/legacy-plan.mjs';
import {buildHistoricalMedicationPlan} from './lib/legacy-medication-plan.mjs';

const argv=process.argv.slice(2),arg=flag=>{const at=argv.indexOf(flag);return at>=0?argv[at+1]:null;};
const mode=arg('--mode')||'dry-run',sourceZip=arg('--source-zip'),org=arg('--organization'),batch=arg('--batch'),backupSha=arg('--backup-sha'),planSha=arg('--plan-sha');
const reportPath=arg('--output'),restoreReportPath=arg('--restore-report');
if(!['dry-run','apply','verify'].includes(mode)||!sourceZip||!isStrictUuid(org)||!isStrictUuid(batch)||!reportPath)throw Error('ARGUMENTS_INVALID');
if(!/^[a-f0-9]{64}$/.test(String(backupSha||''))||!/^[a-f0-9]{64}$/.test(String(planSha||'')))throw Error('SOURCE_HASHES_REQUIRED');
const absoluteZip=path.resolve(sourceZip),output=path.resolve(reportPath),actualSha=crypto.createHash('sha256').update(fs.readFileSync(absoluteZip)).digest('hex');
if(actualSha!==backupSha)throw Error('BACKUP_SHA256_MISMATCH');
const {records,publicReport}=buildLegacyPlan({tables:readFoxProArchive(readZipEntries(absoluteZip)),organizationId:org,sourceSystem:'foxpro-linkare',backupSha});
if(publicReport.planSha!==planSha)throw Error('SOURCE_PLAN_SHA_MISMATCH');
const {items,summary}=buildHistoricalMedicationPlan(records,{organizationId:org,batchId:batch});
const report={schemaVersion:1,mode,organizationId:org,batchId:batch,backupSha,planSha,...summary,applied:0,verified:null,generatedAt:new Date().toISOString()};
const writeReport=()=>fs.writeFileSync(output,`${JSON.stringify(report,null,2)}\n`,{mode:0o600});
writeReport();
if(mode==='dry-run'){console.log(`HISTORICAL_MEDICATION_DRY_RUN_OK candidates=${items.length} unstructuredMemos=${summary.unstructuredMemos} report=${output}`);process.exit(0);}

if(mode==='apply'){
 if(!restoreReportPath)throw Error('CURRENT_RESTORE_REPORT_REQUIRED');
 const restored=JSON.parse(fs.readFileSync(path.resolve(restoreReportPath),'utf8'));
 const verifiedAt=Date.parse(restored.verifiedAt),backupAt=Date.parse(restored.backupCreatedAt);
 if(restored.status!=='BACKUP_RESTORE_VERIFIED'||restored.projectRef!=='fvucylgrqgxjqabacnlt'||restored.target?.ownerRole!=='owner'||
  !restored.target?.ownerPatientsView||!restored.target?.ownerClinicalView||!Number.isFinite(verifiedAt)||!Number.isFinite(backupAt)||
  Date.now()-verifiedAt>24*3600e3||Date.now()-backupAt>24*3600e3||verifiedAt<backupAt)throw Error('CURRENT_BACKUP_RESTORE_GATE_FAILED');
 if(restored.enrichment?.status!=='ISOLATED_ENRICHMENT_VERIFIED'||restored.enrichment.candidateMentions!==items.length||
  restored.enrichment.manifestSha!==summary.manifestSha||restored.enrichment.modernClinicalRowsUnchanged!==true)throw Error('ISOLATED_ENRICHMENT_GATE_FAILED');
}

// Connect using temporary PG* environment variables supplied by the operator;
// no connection string, key or patient text is written to the report or Git.
const client=new pg.Client({ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000,query_timeout:30000});
await client.connect();
await client.query('set role postgres');
try{
 const call=async(sql,params)=>{
  const result=await client.query(sql,params);return result.rows[0]?.result;
 };
 if(mode==='apply'){
  const started=await call('select public.linkare_legacy_medication_start_v1($1,$2,$3,$4,$5,$6) result',[org,batch,backupSha,planSha,summary.extractorVersion,items.length]);
  const chunkSize=Math.max(10,Math.min(100,Number(arg('--chunk-size')||50))),pauseMs=Math.max(100,Math.min(5000,Number(arg('--pause-ms')||250)));
  for(let offset=0;started.status!=='completed'&&offset<items.length;offset+=chunkSize){
   const chunk=items.slice(offset,offset+chunkSize);
   const result=await call('select public.linkare_legacy_medication_apply_v1($1,$2,$3,$4::jsonb) result',[org,batch,backupSha,JSON.stringify(chunk)]);
   report.applied+=result.accepted;
   if(offset%(chunkSize*25)===0||offset+chunkSize>=items.length){report.progress=Math.min(offset+chunkSize,items.length);writeReport();console.log(`HISTORICAL_MEDICATION_PROGRESS ${report.progress}/${items.length}`);}
   if(offset+chunkSize<items.length)await new Promise(resolve=>setTimeout(resolve,pauseMs));
  }
 }
 report.verified=await call('select public.linkare_legacy_medication_verify_v1($1,$2,$3) result',[org,batch,backupSha]);
 if(report.verified?.ok!==true)throw Error('ENRICHMENT_RECONCILIATION_FAILED');
 report.completedAt=new Date().toISOString();writeReport();
 console.log(`HISTORICAL_MEDICATION_${mode.toUpperCase()}_OK actual=${report.verified.actual} report=${output}`);
}catch(error){
 report.failure={code:String(error?.code||'ENRICHMENT_FAILED').slice(0,80),at:new Date().toISOString()};writeReport();
 console.error('HISTORICAL_MEDICATION_ENRICHMENT_FAILED; revise el reporte privado y el estado del mismo lote.');
 process.exitCode=1;
}finally{await client.end();}
