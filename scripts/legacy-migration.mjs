import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import {execFileSync} from 'node:child_process';
import {readZipEntries} from './lib/zip-reader.mjs';
import {readFoxProArchive} from './lib/foxpro-reader.mjs';
import {buildLegacyPlan,isStrictUuid} from './lib/legacy-plan.mjs';
import {buildLegacyCohort} from './lib/legacy-cohort.mjs';

const argv=process.argv.slice(2);
const value=flag=>{const index=argv.indexOf(flag);return index>=0?argv[index+1]:null;};
const sourceZip=value('--source-zip'),organizationId=value('--organization'),sourceSystem=value('--source')||'foxpro-linkare';
const mode=value('--mode')||'dry-run',output=path.resolve(value('--output')||'legacy-migration-public-report.json');
const approvalFile=value('--approval-file'),batchId=value('--batch');
const cohortSize=value('--cohort-size')===null?null:Number(value('--cohort-size'));
if(!['dry-run','apply','verify','rollback'].includes(mode))throw new Error('MODE_INVALID');
if(!organizationId||!isStrictUuid(organizationId))throw new Error('ORGANIZATION_UUID_INVALID');
if(!sourceZip&&['dry-run','apply'].includes(mode))throw new Error('Use --source-zip con el respaldo ZIP de solo lectura.');
if(cohortSize!==null&&(!Number.isSafeInteger(cohortSize)||cohortSize<1||cohortSize>500||sourceSystem!=='foxpro-linkare-pilot50'))throw new Error('COHORT_ARGUMENTS_INVALID');

const fileSha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const writeReport=report=>fs.writeFileSync(output,`${JSON.stringify(report,null,2)}\n`,{encoding:'utf8',flag:'w',mode:0o600});
const safeError=error=>String(error?.message||error).replace(/https?:\/\/\S+/g,'[url]').slice(0,400);
let directClient;
async function rpc(name,args){
  if(process.env.PGHOST){
    const signatures={linkare_legacy_start_v2:['uuid','uuid','text','text','text','text','jsonb'],linkare_legacy_apply_v2:['uuid','uuid','text','jsonb'],linkare_legacy_verify_v2:['uuid','uuid','text'],linkare_legacy_rollback_v2:['uuid','uuid','text']};
    const types=signatures[name];
    if(!types||types.length!==Object.keys(args).length)throw new Error('DIRECT_RPC_INVALID');
    if(!directClient){directClient=new pg.Client({ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000,query_timeout:60000});await directClient.connect();await directClient.query('set role postgres');}
    const params=Object.values(args).map((item,index)=>types[index]==='jsonb'?JSON.stringify(item):item);
    const result=await directClient.query(`select public.${name}(${types.map((type,index)=>`$${index+1}::${type}`).join(',')}) result`,params);
    return result.rows[0]?.result;
  }
  const base=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!base||!key)throw new Error('SUPABASE_SERVICE_CREDENTIALS_REQUIRED');
  const response=await fetch(`${base}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(args)});
  if(!response.ok)throw new Error(`RPC_FAILED:${name}:${response.status}`);
  return response.status===204?null:response.json();
}
function approval(expected){
  if(!approvalFile)throw new Error('APPROVAL_FILE_REQUIRED');
  const parsed=JSON.parse(fs.readFileSync(path.resolve(approvalFile),'utf8'));
  const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  if(parsed.approvedForProduction!==true||parsed.organizationId!==organizationId||parsed.backupSha!==expected.backupSha||parsed.planSha!==expected.planSha||parsed.commitSha!==commit)throw new Error('APPROVAL_GATE_MISMATCH');
  return {commit,approvedAt:parsed.approvedAt||null,approvedBy:parsed.approvedBy||null};
}

if(mode==='verify'||mode==='rollback'){
  if(!batchId||!isStrictUuid(batchId))throw new Error('BATCH_UUID_REQUIRED');
  const requestedBackup=value('--backup-sha'),requestedPlan=value('--plan-sha');
  if(!/^[a-f0-9]{64}$/i.test(String(requestedBackup||''))||!/^[a-f0-9]{64}$/i.test(String(requestedPlan||'')))throw new Error('BACKUP_AND_PLAN_SHA_REQUIRED');
  const approvalData=approval({backupSha:requestedBackup,planSha:requestedPlan});
  const result=await rpc(mode==='verify'?'linkare_legacy_verify_v2':'linkare_legacy_rollback_v2',{org:organizationId,p_batch_id:batchId,p_backup_sha:requestedBackup});
  if(result?.ok!==true)throw new Error(`${mode.toUpperCase()}_RECONCILIATION_FAILED`);
  writeReport({schemaVersion:2,mode,organizationId,batchId,approval:{commit:approvalData.commit,approvedAt:approvalData.approvedAt},result,generatedAt:new Date().toISOString()});
  if(directClient)await directClient.end();
  console.log(`LEGACY_${mode.toUpperCase()}_OK batch=${batchId} report=${output}`);
  process.exit(0);
}

const absoluteZip=path.resolve(sourceZip),backupSha=fileSha(absoluteZip);
const expectedSha=value('--backup-sha');
if(expectedSha&&expectedSha.toLowerCase()!==backupSha)throw new Error('BACKUP_SHA256_MISMATCH');
const tables=readFoxProArchive(readZipEntries(absoluteZip));
const fullPlan=buildLegacyPlan({tables,organizationId,sourceSystem,backupSha});
const {records,publicReport}=cohortSize===null?fullPlan:buildLegacyCohort(fullPlan,cohortSize);
writeReport(publicReport);
if(mode==='dry-run'){
  console.log(`LEGACY_DRY_RUN_OK rows=${publicReport.sourceRows} patients=${publicReport.destination.patients} quarantined=${Object.values(publicReport.tables).reduce((sum,item)=>sum+item.quarantined,0)} report=${output}`);
  process.exit(0);
}

const approvalData=approval(publicReport),runBatch=batchId||crypto.randomUUID();
if(!isStrictUuid(runBatch))throw new Error('BATCH_UUID_INVALID');
const finalReport={...publicReport,mode:'apply',batchId:runBatch,approval:{commit:approvalData.commit,approvedAt:approvalData.approvedAt},appliedBatches:0,server:null};
try{
  await rpc('linkare_legacy_start_v2',{org:organizationId,p_batch_id:runBatch,p_source_system:sourceSystem,p_backup_sha:backupSha,p_plan_sha:publicReport.planSha,p_approved_commit:approvalData.commit,p_source_summary:publicReport});
  const size=Math.max(1,Math.min(100,Number(value('--chunk-size')||100)));
  const pauseMs=Math.max(0,Math.min(5000,Number(value('--pause-ms')||0)));
  if(!Number.isSafeInteger(size)||!Number.isSafeInteger(pauseMs))throw new Error('CHUNK_ARGUMENTS_INVALID');
  for(let offset=0;offset<records.length;offset+=size){
    await rpc('linkare_legacy_apply_v2',{org:organizationId,p_batch_id:runBatch,p_backup_sha:backupSha,p_records:records.slice(offset,offset+size)});
    finalReport.appliedBatches+=1;
    if((finalReport.appliedBatches%25)===0)console.log(`LEGACY_APPLY_PROGRESS batches=${finalReport.appliedBatches} rows=${Math.min(offset+size,records.length)}/${records.length}`);
    if(pauseMs&&offset+size<records.length)await new Promise(resolve=>setTimeout(resolve,pauseMs));
  }
  finalReport.server=await rpc('linkare_legacy_verify_v2',{org:organizationId,p_batch_id:runBatch,p_backup_sha:backupSha});
  if(finalReport.server?.ok!==true)throw new Error('APPLY_RECONCILIATION_FAILED');
  finalReport.completedAt=new Date().toISOString();writeReport(finalReport);
  console.log(`LEGACY_APPLY_OK batch=${runBatch} report=${output}`);
}catch(error){
  finalReport.failure={code:safeError(error),at:new Date().toISOString()};writeReport(finalReport);throw error;
}finally{
  if(directClient)await directClient.end();
}
