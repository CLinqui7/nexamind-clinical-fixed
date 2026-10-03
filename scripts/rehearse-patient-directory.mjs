import fs from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

const value=name=>process.argv.find(arg=>arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const patientCount=Number(value('patients')||5347),eventCount=Number(value('events')||100000),output=value('output');
if(!Number.isInteger(patientCount)||patientCount<1||!Number.isInteger(eventCount)||eventCount<0)throw Error('Use integer --patients and --events values.');
const migrations=['supabase/00_BASE.sql','supabase/migrations/202609080001_linkare_v3.sql','supabase/migrations/20260921163356_enable_free_access.sql','supabase/migrations/20260921170106_free_access_and_team_permissions.sql','supabase/migrations/20260921170933_secretary_prescription_corrections.sql','supabase/migrations/20260921182203_archive_prescriptions.sql','supabase/migrations/20260921201729_operational_clinical_lifecycles.sql','supabase/migrations/20260921210315_daily_agenda_and_automation.sql','supabase/migrations/20260921211201_document_templates.sql','supabase/migrations/20260921213000_scoped_calendars_and_family_reminders.sql','supabase/migrations/20260921214500_legacy_migration_staging.sql','supabase/migrations/20260921223000_archive_medications.sql','supabase/migrations/20260921230047_archive_patient_with_audit.sql','supabase/migrations/20260921232000_fix_medication_identity_and_archive.sql','supabase/migrations/20260921233500_hide_reviewed_medications_from_secretary.sql','supabase/migrations/20260921235000_canonicalize_medication_identity.sql','supabase/migrations/20260922043809_clinic_phone_numbers.sql','supabase/migrations/20261002174319_secretary_multi_calendar.sql','supabase/migrations/20261003010000_historical_migration_v2.sql','supabase/migrations/20261003061842_patient_directory_performance.sql','supabase/migrations/20261003074514_lazy_profile_assets.sql'];
const owner='10000000-0000-4000-8000-000000000001',db=new PGlite({extensions:{pgcrypto}});
const percentile=(values,p)=>{const sorted=[...values].sort((a,b)=>a-b);return Number(sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))].toFixed(3));};
const stats=values=>({samples:values.length,p50Ms:percentile(values,.5),p95Ms:percentile(values,.95),p99Ms:percentile(values,.99),maxMs:Number(Math.max(...values).toFixed(3))});
const timed=async fn=>{const start=performance.now(),result=await fn();return {ms:performance.now()-start,result};};

try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);`);
 for(const file of migrations)await db.exec(fs.readFileSync(file,'utf8'));
 await db.query('insert into auth.users values($1,$2,now(),$3)',[owner,'load@example.invalid',JSON.stringify({clinic_name:'Synthetic load clinic',full_name:'Load owner'})]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);await db.exec('set role authenticated');
 const org=(await db.query('select public.linkare_bootstrap_v3(null) id')).rows[0].id;
 await db.exec('reset role;set role service_role');
 const calendar=(await db.query("select id from public.linkare_calendars_v1 where organization_id=$1 and code='doctor'",[org])).rows[0].id;
 const seedPatients=await timed(()=>db.query(`insert into linkare_private.patient_directory_v1(organization_id,patient_id,name,name_sort,phone,email,insurance_provider,archived,data_quality,has_legacy_record,last_activity_on,last_activity_at,last_activity_precision,last_activity_origin,last_activity_event_id,next_appointment_at,source_revision,projection_revision,search_text,search_vector)
  select $1,'synthetic-'||lpad(n::text,7,'0'),case when n%997=0 then 'Ángela Núñez ' else 'Paciente sintético ' end||lpad(n::text,7,'0'),
   case when n%997=0 then 'angela nunez ' else 'paciente sintetico ' end||lpad(n::text,7,'0'),'+503'||lpad(n::text,8,'0'),'synthetic-'||n||'@example.invalid','Seguro sintético',n%37=0,
   case when n%3=0 then 'historical' else null end,n%3=0,case when n%11=0 then null else date '2026-10-03'-(n%180) end,
   case when n%11=0 then null else timestamptz '2026-10-03 12:00:00-06'-(n%180)*interval '1 day' end,case when n%3=0 then 'date' else 'timestamp' end,
   case when n%3=0 then 'foxpro_passed_consultation' else 'modern_signed_consultation' end,'activity-'||n,null,1,1,
   (case when n%997=0 then 'angela nunez ' else 'paciente sintetico ' end||lpad(n::text,7,'0')||' +503'||lpad(n::text,8,'0')),
   to_tsvector('simple',(case when n%997=0 then 'angela nunez ' else 'paciente sintetico ' end||lpad(n::text,7,'0')||' +503'||lpad(n::text,8,'0')))
  from generate_series(1,$2) n`,[org,patientCount]));
 const seedEvents=await timed(()=>db.query(`insert into linkare_private.appointment_directory_v1(organization_id,appointment_id,source_revision,calendar_id,patient_id,event_type,title,start_at,end_at,status,admin_review_status)
  select $1,'event-'||n,1,$2,'synthetic-'||lpad(((n-1)%$3+1)::text,7,'0'),'appointment','Cita sintética',
   timestamptz '2026-01-01 08:00:00-06'+(n%365)*interval '1 day'+(n%10)*interval '1 hour',
   timestamptz '2026-01-01 08:30:00-06'+(n%365)*interval '1 day'+(n%10)*interval '1 hour','confirmed','none' from generate_series(1,$4) n`,[org,calendar,patientCount,eventCount]));
 await db.query('update linkare_private.patient_directory_state_v1 set patients_ready=true,appointments_ready=true,listing_version=2 where organization_id=$1',[org]);await db.exec('analyze linkare_private.patient_directory_v1;analyze linkare_private.appointment_directory_v1;reset role');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);await db.exec('set role authenticated');
 const directory=()=>db.query("select public.linkare_patient_directory_v1($1,'recent',null,null,'2026-10-03T18:00:00Z',20) data",[org]);
 for(let i=0;i<5;i++)await directory();const sequential=[];for(let i=0;i<40;i++)sequential.push((await timed(directory)).ms);
 const searches=[];for(let i=0;i<20;i++)searches.push((await timed(()=>db.query("select public.linkare_patient_directory_v1($1,'all','nunez',null,'2026-10-03T18:00:00Z',20) data",[org]))).ms);
 const agenda=[];for(let i=0;i<20;i++)agenda.push((await timed(()=>db.query("select public.linkare_agenda_range_v1($1,'2026-09-01T06:00:00Z','2026-10-13T06:00:00Z',null,null,200) data",[org]))).ms);
 const concurrency={};for(const count of [1,5,20]){const values=[];for(let round=0;round<5;round++){const start=performance.now();await Promise.all(Array.from({length:count},directory));values.push(performance.now()-start);}concurrency[count]=stats(values);}
 const concurrentWrites={};for(const count of [1,5,20]){const values=[];for(let round=0;round<3;round++){const start=performance.now();await Promise.all(Array.from({length:count},(_,index)=>{const id=`write-${count}-${round}-${index}`;return db.query('select public.linkare_save_changes_v3($1,$2::jsonb)',[org,JSON.stringify([{kind:'patient_admin',id,expectedRevision:0,deleted:false,payload:{id,name:`Synthetic concurrent ${id}`,phone:'+50300000000'}}])]);}));values.push(performance.now()-start);}concurrentWrites[count]=stats(values);}
 const sample=(await directory()).rows[0].data,bootstrap=(await db.query('select public.linkare_bootstrap_state_v4($1) data',[org])).rows[0].data;
 const explain=(await db.query("explain (analyze,buffers,format json) select public.linkare_patient_directory_v1($1,'recent',null,null,'2026-10-03T18:00:00Z',20)",[org])).rows[0]['QUERY PLAN'];
 const report={status:'ISOLATED_SYNTHETIC_REHEARSAL',engine:'PGlite embedded PostgreSQL (not production Supabase)',generatedAt:new Date().toISOString(),patients:patientCount,appointments:eventCount,seed:{patientsMs:Number(seedPatients.ms.toFixed(3)),appointmentsMs:Number(seedEvents.ms.toFixed(3))},directory:stats(sequential),accentSearch:stats(searches),agendaRange200:stats(agenda),concurrentReads:concurrency,concurrentWrites,bytes:{bootstrap:Buffer.byteLength(JSON.stringify(bootstrap)),directoryPage20:Buffer.byteLength(JSON.stringify(sample))},contracts:{pageItems:sample.items.length,pageLimit:sample.limit,hasMore:sample.hasMore},explain};
 const json=JSON.stringify(report,null,2);if(output){fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,json+'\n');}console.log(json);
}finally{await db.close();}
