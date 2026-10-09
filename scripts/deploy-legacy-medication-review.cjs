const fs=require('node:fs');
const {Client}=require('pg');

const [mode,preflightPath,restorePath]=process.argv.slice(2);
const project='fvucylgrqgxjqabacnlt';
const version='20261009054502';
const migration='supabase/migrations/20261009054502_historical_medication_clinician_review.sql';
if(!['apply','verify'].includes(mode)||!preflightPath)throw new Error('USAGE: apply|verify PREFLIGHT_JSON [RESTORE_JSON]');
const preflight=JSON.parse(fs.readFileSync(preflightPath,'utf8'));
if(preflight.status!=='TARGET_VERIFIED'||preflight.projectRef!==project||preflight.targetEmail!=='clinicafortinmagana@gmail.com'||preflight.targets?.length!==1||preflight.targets[0].membership_role!=='owner'||!preflight.targets[0].active||preflight.targets[0].organization_id!==preflight.organizationId)throw new Error('TARGET_NOT_VERIFIED');
if(preflight.organizationId!=='2ca5b8d4-d711-4ec7-833a-9d018ef067ca'||preflight.matchingBatches?.length!==1||preflight.matchingBatches[0].status!=='completed')throw new Error('SOURCE_BATCH_NOT_VERIFIED');
if(mode==='apply'){
  if(!restorePath)throw new Error('RESTORE_REPORT_REQUIRED');
  const restore=JSON.parse(fs.readFileSync(restorePath,'utf8'));
  if(restore.status!=='BACKUP_RESTORE_VERIFIED'||restore.projectRef!==project||restore.countMismatches?.length||restore.target?.patients!==preflight.counts.patients||restore.target?.ownerRole!=='owner'||Date.now()-Date.parse(restore.verifiedAt)>6*60*60*1000)throw new Error('CURRENT_RESTORE_NOT_VERIFIED');
}
const connection={host:process.env.PGHOST,port:Number(process.env.PGPORT||5432),user:process.env.PGUSER,password:process.env.PGPASSWORD,database:process.env.PGDATABASE||'postgres',ssl:{rejectUnauthorized:false}};
async function state(client){
  const org=preflight.organizationId;
  const row=(await client.query(`select
    (select count(*)::integer from public.linkare_records where organization_id=$1 and kind='patient_admin' and not deleted) patients,
    (select count(*)::integer from public.linkare_records where organization_id=$1 and kind='patient_clinical' and not deleted) clinical_records,
    (select count(*)::integer from linkare_private.legacy_history_v1 where organization_id=$1) history_entries,
    (select count(*)::integer from linkare_private.legacy_medication_mentions_v1 where organization_id=$1) mentions,
    (select coalesce(sum(jsonb_array_length(coalesce(payload->'medications','[]'::jsonb))),0)::integer from public.linkare_records where organization_id=$1 and kind='patient_clinical' and not deleted) medicines,
    (select md5(coalesce(string_agg(id||':'||revision::text||':'||coalesce(payload->'medications','[]'::jsonb)::text,E'\\n' order by id),'') ) from public.linkare_records where organization_id=$1 and kind='patient_clinical' and not deleted) medicine_fingerprint`,[org])).rows[0];
  return row;
}
async function verifyAccess(client){
  const org=preflight.organizationId;
  const sample=(await client.query('select patient_id from linkare_private.legacy_medication_mentions_v1 where organization_id=$1 limit 1',[org])).rows[0];
  if(!sample)throw new Error('NO_HISTORICAL_MENTIONS');
  const owner=preflight.targets[0].user_id;
  await client.query('begin');
  try{
    await client.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
    await client.query('set local role authenticated');
    const grouped=(await client.query('select public.linkare_legacy_medication_summary_v1($1,$2,null,1) data',[org,sample.patient_id])).rows[0].data;
    if(!grouped?.items?.[0]?.mentionId)throw new Error('REVIEW_TARGET_NOT_VISIBLE');
  }finally{await client.query('rollback');}
  const secretary=(await client.query("select user_id from public.organization_members where organization_id=$1 and active and role='secretary' limit 1",[org])).rows[0];
  if(secretary){
    await client.query('begin');
    try{
      await client.query("select set_config('request.jwt.claim.sub',$1,true)",[secretary.user_id]);
      await client.query('set local role authenticated');
      try{await client.query('select public.linkare_legacy_medication_summary_v1($1,$2,null,1)',[org,sample.patient_id]);throw new Error('SECRETARY_REACHED_PRIVATE_MENTIONS');}
      catch(error){if(error.code!=='42501')throw error;}
    }finally{await client.query('rollback');}
  }
  return {ownerSummary:true,secretaryDenied:Boolean(secretary)};
}
(async()=>{
  const client=new Client(connection);await client.connect();
  try{
    // Supabase's temporary CLI login can assume postgres, but has no direct
    // privilege on auth.users or DDL references to it.
    await client.query('set role postgres');
    const target=(await client.query('select u.id::text user_id,m.organization_id::text org_id,o.name,m.role::text role,m.active from auth.users u join public.organization_members m on m.user_id=u.id join public.organizations o on o.id=m.organization_id where lower(u.email)=lower($1)',[preflight.targetEmail])).rows;
    if(target.length!==1||target[0].user_id!==preflight.targets[0].user_id||target[0].org_id!==preflight.organizationId||target[0].role!=='owner'||!target[0].active)throw new Error('LIVE_TARGET_CHANGED');
    const before=await state(client);
    if(before.patients!==preflight.counts.patients||before.clinical_records!==preflight.counts.patient_clinical||before.history_entries!==preflight.counts.legacy_history||before.medicines!==preflight.externalEffects.medications)throw new Error('LIVE_BASELINE_CHANGED');
    const registered=(await client.query('select version from supabase_migrations.schema_migrations where version=$1',[version])).rows.length===1;
    if(mode==='apply'&&!registered){
      const sql=fs.readFileSync(migration,'utf8');
      if(!/^begin;/i.test(sql.trimStart())||!/commit;\s*$/i.test(sql))throw new Error('MIGRATION_NOT_ATOMIC');
      const exact=sql.replace(/commit;\s*$/i,`insert into supabase_migrations.schema_migrations(version,name) values ('${version}','historical_medication_clinician_review');\ncommit;`);
      try{await client.query(exact);}catch(error){await client.query('rollback').catch(()=>{});throw error;}
    }
    const applied=(await client.query('select version from supabase_migrations.schema_migrations where version=$1',[version])).rows.length===1;
    if(!applied)throw new Error('REVIEW_MIGRATION_NOT_APPLIED');
    const after=await state(client);
    if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('CLINICAL_BASELINE_CHANGED_BY_MIGRATION');
    const access=await verifyAccess(client);
    const reviewCount=(await client.query("select review_status,count(*)::integer n from linkare_private.legacy_medication_mentions_v1 where organization_id=$1 group by review_status order by review_status",[preflight.organizationId])).rows;
    console.log(JSON.stringify({status:mode==='apply'?'REVIEW_MIGRATION_APPLIED':'REVIEW_MIGRATION_VERIFIED',version,organizationId:preflight.organizationId,patients:after.patients,historyEntries:after.history_entries,clinicalRecords:after.clinical_records,medicines:after.medicines,mentions:after.mentions,medicineFingerprintUnchanged:true,reviewCount,access}));
  }finally{await client.end();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
