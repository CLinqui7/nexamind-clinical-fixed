const fs=require('node:fs');
const crypto=require('node:crypto');
const {Client}=require('pg');

const [backupPath,sourceOrg,destinationOrg,batchId]=process.argv.slice(2);
if(!backupPath||!sourceOrg||!destinationOrg||!batchId||!process.env.PGHOST)throw Error('BASELINE_ARGUMENTS_REQUIRED');
const normalize=value=>{
  if(value instanceof Date)return value.toISOString();
  if(Array.isArray(value))return value.map(normalize);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,normalize(value[key])]));
  return value;
};
const fingerprint=value=>crypto.createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex');
const key=row=>`${row.organization_id}:${row.kind}:${row.id}`;

(async()=>{
  const backup=JSON.parse(fs.readFileSync(backupPath,'utf8'));
  if(backup.projectRef!=='fvucylgrqgxjqabacnlt'||backup.format!=='linkare-logical-backup-v1')throw Error('BACKUP_PROJECT_MISMATCH');
  const baseline=(backup.tables['public.linkare_records']||[]).filter(row=>[sourceOrg,destinationOrg].includes(row.organization_id));
  const client=new Client({ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000,query_timeout:30000});
  await client.connect();
  try{
    await client.query('set role postgres');
    const current=(await client.query('select * from public.linkare_records where organization_id=any($1::uuid[])',[[sourceOrg,destinationOrg]])).rows;
    const currentByKey=new Map(current.map(row=>[key(row),row]));
    const changed=[],missing=[];
    for(const row of baseline){
      const live=currentByKey.get(key(row));
      if(!live)missing.push(key(row));
      else if(fingerprint(row)!==fingerprint(live))changed.push(key(row));
    }
    const pilot=(await client.query('select patient_id from linkare_private.legacy_patient_summary_v1 where organization_id=$1 and batch_id=$2',[destinationOrg,batchId])).rows;
    const baselineKeys=new Set(baseline.map(key));
    const pilotCollisions=pilot.filter(row=>baselineKeys.has(`${destinationOrg}:patient_admin:${row.patient_id}`)).length;
    const result={baselineCreatedAt:backup.createdAt,preexistingCompared:baseline.length,
      sourcePreexisting:baseline.filter(row=>row.organization_id===sourceOrg).length,
      destinationPreexisting:baseline.filter(row=>row.organization_id===destinationOrg).length,
      changed:changed.length,missing:missing.length,pilotPatients:pilot.length,pilotCollisions};
    process.stdout.write(JSON.stringify(result)+'\n');
    if(changed.length||missing.length||pilotCollisions||pilot.length!==50)process.exitCode=1;
  }finally{await client.end();}
})().catch(error=>{console.error(String(error?.code||error?.message||error).slice(0,150));process.exitCode=1;});
