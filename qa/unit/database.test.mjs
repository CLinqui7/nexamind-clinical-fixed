import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
const db=new PGlite({extensions:{pgcrypto}});
const ids={owner:'10000000-0000-4000-8000-000000000001',doctor:'10000000-0000-4000-8000-000000000002',nurse:'10000000-0000-4000-8000-000000000003',secretary:'10000000-0000-4000-8000-000000000004',other:'10000000-0000-4000-8000-000000000005'};
let org,otherOrg,calendarIds;
const actor=async name=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[name]]);await db.exec('set role authenticated');};
const permissions=async(name,value)=>{await db.exec('reset role');await db.query('update public.organization_members set permissions=$1 where user_id=$2',[JSON.stringify(value),ids[name]]);await actor(name);};
const load=async(o=org)=>(await db.query('select public.linkare_load_state_v3($1) data',[o])).rows[0].data;
const save=changes=>db.query('select public.linkare_save_changes_v3($1,$2::jsonb)',[org,JSON.stringify(changes)]);
const allowed=async p=>(await db.query('select public.linkare_permission_v3($1,$2) ok',[org,p])).rows[0].ok;
const denied=async f=>assert.rejects(f,e=>e.code==='42501');
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
 for(const file of ['supabase/00_BASE.sql','supabase/migrations/202609080001_linkare_v3.sql','supabase/migrations/20260921163356_enable_free_access.sql','supabase/migrations/20260921170106_free_access_and_team_permissions.sql','supabase/migrations/20260921170933_secretary_prescription_corrections.sql','supabase/migrations/20260921182203_archive_prescriptions.sql','supabase/migrations/20260921201729_operational_clinical_lifecycles.sql','supabase/migrations/20260921210315_daily_agenda_and_automation.sql','supabase/migrations/20260921211201_document_templates.sql','supabase/migrations/20260921213000_scoped_calendars_and_family_reminders.sql','supabase/migrations/20260921214500_legacy_migration_staging.sql','supabase/migrations/20260921223000_archive_medications.sql','supabase/migrations/20260921230047_archive_patient_with_audit.sql','supabase/migrations/20260921232000_fix_medication_identity_and_archive.sql','supabase/migrations/20260921233500_hide_reviewed_medications_from_secretary.sql','supabase/migrations/20260921235000_canonicalize_medication_identity.sql','supabase/migrations/20260922043809_clinic_phone_numbers.sql','supabase/migrations/20261002174319_secretary_multi_calendar.sql','supabase/migrations/20261003010000_historical_migration_v2.sql','supabase/migrations/20261003061842_patient_directory_performance.sql','supabase/migrations/20261003074514_lazy_profile_assets.sql','supabase/migrations/20261003180559_deferred_directory_version_bump.sql','supabase/migrations/20261003183511_optimize_appointment_save.sql','supabase/migrations/20261003195000_controlled_revision_conflicts.sql','supabase/migrations/20261003200901_optimize_rls_and_rpc_surface.sql','supabase/migrations/20261005205302_patient_consultation_fee_permissions.sql'])await db.exec(fs.readFileSync(file,'utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261007052123_printable_daily_agenda.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261008174640_appointment_status_for_visible_calendars.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261008180600_scoped_appointment_delete.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261008182418_merge_concurrent_appointment_edits.sql','utf8'));
 for(const [name,id] of Object.entries(ids))await db.query('insert into auth.users values($1,$2,now(),$3)',[id,name+'@example.invalid',JSON.stringify({clinic_name:'QA '+name,full_name:name})]);
 await actor('owner');org=(await db.query('select public.linkare_bootstrap_v3(null) id')).rows[0].id;
 calendarIds=Object.fromEntries((await db.query('select code,id from public.linkare_calendars_v1 where organization_id=$1',[org])).rows.map(row=>[row.code,row.id]));
 await actor('other');otherOrg=(await db.query('select public.linkare_bootstrap_v3(null) id')).rows[0].id;
 await db.exec('reset role');for(const [name,role] of Object.entries({doctor:'psychiatrist',nurse:'clinical_assistant',secretary:'secretary'}))await db.query('insert into public.organization_members(organization_id,user_id,role,active,display_name) values($1,$2,$3,true,$4)',[org,ids[name],role,name]);
 await actor('owner');
});
after(()=>db.close());
test('DB: a new clinic is free, empty and has no paid period or order',async()=>{const d=await load();assert.equal(d.complimentaryAccess,true);assert.equal(d.entitled,true);assert.equal(d.memberRole,'owner');assert.equal(d.payload.patients.length,0);const s=(await db.query('select * from public.linkare_subscriptions_v3')).rows[0];assert.equal(s.current_period_end,null);assert.equal(s.last_order_id,null);assert.equal((await db.query('select * from public.linkare_orders_v3')).rows.length,0);});
test('DB: owner can save patients, consultations, appointments and alerts for free',async()=>{await save([{kind:'patient_admin',id:'patient',payload:{name:'Synthetic QA'},expectedRevision:0},{kind:'patient_clinical',id:'patient',payload:{diagnosis:'PRIVATE_DIAGNOSIS',medications:[{name:'PRIVATE_MED'}],documents:[{id:'doc',name:'PRIVATE_DOC'}],consultations:[{id:'signed',status:'signed',signedBy:ids.owner,signedAt:'2026-09-01',freeNotes:'IMMUTABLE'}],notes:[]},expectedRevision:0},{kind:'appointment',id:'appointment',expectedRevision:0,payload:{calendarId:calendarIds.doctor,eventType:'appointment',patientId:'patient',start:'2026-10-01T12:00:00Z',end:'2026-10-01T12:30:00Z'}},{kind:'appointment_clinical',id:'appointment',expectedRevision:0,payload:{notes:'PRIVATE_APPOINTMENT'}},{kind:'alert',id:'alert',expectedRevision:0,payload:{id:'alert',detail:'PRIVATE_ALERT'}}]);const d=await load();assert.equal(d.payload.patients.length,1);assert.equal(d.payload.appointments.length,1);assert.equal(d.payload.alerts.length,1);});
test('DB: stale revisions return a typed conflict without overwriting or logging a PostgreSQL error',async()=>{const result=(await save([{kind:'patient_admin',id:'patient',expectedRevision:0,payload:{name:'Stale overwrite'}}])).rows[0].linkare_save_changes_v3;assert.equal(result[0].conflict,true);assert.equal(result[0].code,'REVISION_CONFLICT');assert.equal((await load()).payload.patients[0].name,'Synthetic QA');});
test('DB: owner has every recognized permission but arbitrary keys are rejected',async()=>{for(const p of ['usersManage','settingsManage','clinicalEdit','documentsManage','billingManage'])assert.equal(await allowed(p),true);assert.equal(await allowed('arbitraryRoot'),false);});
test('DB: another organization cannot read or write these patients',async()=>{await actor('other');await denied(()=>load());await denied(()=>save([{kind:'patient_admin',id:'patient',expectedRevision:1,payload:{name:'Intruder'}}]));assert.equal((await db.query("select * from public.linkare_records where kind='patient_admin'")).rows.length,0);});
test('DB: secondary doctor gets no implicit clinical or owner permissions',async()=>{await permissions('doctor',{patientsView:true,clinicalView:false,usersManage:true,settingsManage:true});for(const p of ['clinicalView','usersManage','settingsManage'])assert.equal(await allowed(p),false);const d=await load();assert.equal(d.memberRole,'doctor');assert.ok(!JSON.stringify(d).includes('PRIVATE_'));assert.equal(d.payload.users.length,1);});
test('DB: doctor with clinicalView receives clinical data but not hidden documents',async()=>{await permissions('doctor',{patientsView:true,clinicalView:true});const d=await load();assert.equal(d.payload.patients[0].diagnosis,'PRIVATE_DIAGNOSIS');assert.equal(d.payload.patients[0].documents,undefined);assert.equal(d.payload.alerts.length,0);assert.equal((await db.query("select * from public.linkare_records where kind='patient_clinical'")).rows.length,0);});
test('DB: doctor without clinicalEdit cannot write clinical data',async()=>{await denied(()=>save([{kind:'patient_clinical',id:'patient',expectedRevision:1,payload:{diagnosis:'INTRUSION'}}]));});
test('DB: nurse clinicalView=false excludes all private clinical data',async()=>{await permissions('nurse',{patientsView:true,clinicalView:false,appointmentsManage:true});assert.ok(!JSON.stringify(await load()).includes('PRIVATE_'));});
test('DB: nurse clinicalView=true receives clinical data',async()=>{await permissions('nurse',{patientsView:true,clinicalView:true});assert.equal((await load()).payload.patients[0].diagnosis,'PRIVATE_DIAGNOSIS');});
test('DB: nurse without clinicalEdit receives insufficient_privilege',async()=>{await denied(()=>save([{kind:'patient_clinical',id:'patient',expectedRevision:1,payload:{notes:[{text:'blocked'}]}}]));});
test('DB: nurse can save an allowed evolution without overwriting hidden fields',async()=>{await permissions('nurse',{patientsView:true,clinicalView:true,clinicalEdit:true});await save([{kind:'patient_clinical',id:'patient',expectedRevision:1,payload:{notes:[{text:'Nursing observation'}]}}]);assert.equal((await load()).payload.patients[0].notes[0].text,'Nursing observation');await actor('owner');assert.equal((await load()).payload.patients[0].documents[0].id,'doc');});
test('DB: clinicalEdit cannot bypass medicationsManage',async()=>{await actor('nurse');await denied(()=>save([{kind:'patient_clinical',id:'patient',expectedRevision:2,payload:{medications:[]}}]));});
test('DB: nursing cannot change or remove a signed note',async()=>{await permissions('nurse',{patientsView:true,clinicalView:true,clinicalEdit:true,consultationsManage:true});await assert.rejects(()=>save([{kind:'patient_clinical',id:'patient',expectedRevision:2,payload:{consultations:[]}}]),/SIGNED_NOTE_IMMUTABLE/);});
test('DB: nurse cannot sign a medical note',async()=>{const notes=(await load()).payload.patients[0].consultations;await assert.rejects(()=>save([{kind:'patient_clinical',id:'patient',expectedRevision:2,payload:{consultations:[...notes,{id:'new',status:'signed',signedBy:ids.nurse,signedAt:'2026-09-21'}]}}]),/INVALID_SIGNER/);});
test('DB: another doctor cannot alter an existing signed note',async()=>{await permissions('doctor',{patientsView:true,clinicalView:true,consultationsManage:true});await assert.rejects(()=>save([{kind:'patient_clinical',id:'patient',expectedRevision:2,payload:{consultations:[]}}]),/SIGNED_NOTE_IMMUTABLE/);});
test('DB: secretary defaults exclude clinical information even with forged flags',async()=>{await permissions('secretary',{patientsView:true,patientsCreate:true,patientsEdit:true,appointmentsManage:true,clinicalView:true,clinicalEdit:true,usersManage:true});assert.ok(!JSON.stringify(await load()).includes('PRIVATE_'));await denied(()=>save([{kind:'patient_clinical',id:'patient',expectedRevision:2,payload:{diagnosis:'forged'}}]));});
test('DB: secretary can create and edit administrative patient data for free',async()=>{await save([{kind:'patient_admin',id:'secretary-patient',expectedRevision:0,payload:{name:'Created by secretary',diagnosis:'STRIP_ME'}}]);await save([{kind:'patient_admin',id:'secretary-patient',expectedRevision:1,payload:{name:'Edited by secretary'}}]);const p=(await load()).payload.patients.find(p=>p.id==='secretary-patient');assert.equal(p.name,'Edited by secretary');assert.equal(p.diagnosis,undefined);});
test('DB: browser cannot elevate membership or change free access',async()=>{await denied(()=>db.query("update public.organization_members set role='owner' where user_id=$1",[ids.secretary]));await denied(()=>db.query('update public.linkare_subscriptions_v3 set complimentary_access=false'));});
test('DB: nurse document permissions independently gate metadata and Storage',async()=>{await permissions('nurse',{patientsView:true,documentsView:true});const d=await load();assert.equal(d.payload.patients[0].documents[0].id,'doc');assert.equal(d.payload.patients[0].diagnosis,undefined);await denied(()=>db.query("insert into storage.objects(bucket_id,name) values('patient-documents',$1)",[org+'/patient/qa.pdf']));await permissions('nurse',{patientsView:true,documentsView:true,documentsManage:true});await db.query("insert into storage.objects(bucket_id,name) values('patient-documents',$1)",[org+'/patient/qa.pdf']);assert.equal((await db.query("select * from storage.objects")).rows.length,1);await db.exec("delete from storage.objects");assert.equal((await db.query('select * from storage.objects')).rows.length,1);});
test('DB: disabling membership blocks the next RPC and direct reads',async()=>{await db.exec('reset role');await db.query('update public.organization_members set active=false where user_id=$1',[ids.nurse]);await actor('nurse');await denied(()=>load());assert.equal((await db.query('select * from public.linkare_records')).rows.length,0);await assert.rejects(()=>db.query('select public.linkare_bootstrap_v3(null)'),/ACCOUNT_DISABLED/);});
for(const role of ['psychiatrist','clinical_assistant','secretary'])test('DB: invitation accepts '+role+' with exact assigned permissions',async()=>{await db.exec('reset role');const id=crypto.randomUUID();const email='qa-'+id+'@example.invalid';await db.query('insert into auth.users values($1,$2,now(),$3)',[id,email,'{}']);await db.query('insert into public.linkare_invites_v3(organization_id,email,display_name,requested_role,permissions,invited_by) values($1,$2,$3,$4,$5,$6)',[org,email,'Invited QA',role,'{"patientsView":true,"clinicalView":false}',ids.owner]);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');assert.equal((await db.query('select public.linkare_bootstrap_v3(null) id')).rows[0].id,org);const m=(await db.query('select role,permissions from public.organization_members where user_id=$1',[id])).rows[0];assert.equal(m.role,role);assert.equal(m.permissions.clinicalView,false);});
test('DB: invitation cannot request owner',async()=>{await db.exec('reset role');await assert.rejects(()=>db.query("insert into public.linkare_invites_v3(organization_id,email,display_name,requested_role,invited_by) values($1,'forged@example.invalid','Forged','owner',$2)",[org,ids.owner]),e=>e.code==='23514');});
test('DB: saved patient survives session changes and no free write creates an order',async()=>{await actor('owner');assert.equal((await load()).payload.patients[0].name,'Synthetic QA');assert.equal((await db.query('select * from public.linkare_orders_v3')).rows.length,0);});
test('DB: access check reflects revocation without reloading the whole clinic',async()=>{await actor('doctor');const a=(await db.query('select public.linkare_access_v3($1) data',[org])).rows[0].data;assert.equal(a.role,'doctor');assert.equal(a.permissions.clinicalView,true);await actor('nurse');await assert.rejects(()=>db.query('select public.linkare_access_v3($1)',[org]),/ACCOUNT_DISABLED/);});
test('DB: administrative provisioning creates an empty free clinic atomically and cannot be called by clients',async()=>{
 const id=crypto.randomUUID();await actor('owner');await denied(()=>db.query("select public.linkare_provision_free_account_v3($1,'New owner','New clinic')",[id]));
 await db.exec('reset role');await db.query("insert into auth.users values($1,'new-account@example.invalid',now(),'{}')",[id]);
 await db.exec('set role service_role');const o=(await db.query("select public.linkare_provision_free_account_v3($1,'New owner','New clinic') id",[id])).rows[0].id;
 await db.exec('reset role');assert.deepEqual((await db.query('select kind from public.linkare_records where organization_id=$1 order by kind',[o])).rows.map(r=>r.kind),['profile','settings']);
 const sub=(await db.query('select * from public.linkare_subscriptions_v3 where organization_id=$1',[o])).rows[0];assert.equal(sub.complimentary_access,true);assert.equal(sub.current_period_end,null);assert.equal(sub.last_order_id,null);
 assert.equal((await db.query('select count(*)::int n from public.linkare_orders_v3 where organization_id=$1',[o])).rows[0].n,0);
 assert.equal((await db.query('select role from public.organization_members where user_id=$1',[id])).rows[0].role,'owner');
 assert.equal((await db.query('select action from public.linkare_audit_v3 where organization_id=$1',[o])).rows[0].action,'clinic.free_account_created');
 await assert.rejects(()=>db.query("select public.linkare_provision_free_account_v3($1,'New owner','Changed clinic')",[id]),/MEMBERSHIP_ALREADY_EXISTS/);
});
test('DB: secondary doctor cannot reserve a payment even through the service RPC',async()=>{await db.exec('reset role;set role service_role');await assert.rejects(()=>db.query("select public.linkare_reserve_order_v3($1,$2,'monthly')",[org,ids.doctor]),/ACCESS_DENIED/);});
test('DB: owner profile edit persists clinic identity, multiple phones and displayed name',async()=>{await actor('owner');await save([{kind:'profile',id:'clinic',expectedRevision:1,payload:{name:'Updated QA clinic',clinician:'Updated QA owner',specialty:'QA specialty',phone:'2519-3396',phones:[{id:'clinic',label:'Teléfono clínica',number:'2519-3396'},{id:'mobile',label:'Celular clínica',number:'7920-2034'},{id:'doctor',label:'Teléfono doctor',number:'7600-7989'}]}}]);const d=await load();assert.equal(d.payload.organization.name,'Updated QA clinic');assert.equal(d.payload.organization.phones.length,3);assert.equal(d.payload.organization.phones[2].number,'7600-7989');assert.equal(d.payload.users.find(u=>u.id===ids.owner).name,'Updated QA owner');});
test('DB: secretary sees and corrects prescriptions without receiving the private clinical chart',async()=>{
 await actor('owner');await save([{kind:'patient_clinical',id:'patient',expectedRevision:2,payload:{prescriptions:[{id:'rx',number:'RX-2026-0001',createdAt:'2026-09-21',items:[{medication:'Synthetic',directions:'Original'}]}]}}]);
 await permissions('secretary',{patientsView:true,prescriptionsEdit:true});let d=await load();const p=d.payload.patients.find(p=>p.id==='patient');assert.equal(p.diagnosis,undefined);assert.equal(p.consultations,undefined);assert.equal(p.medications,undefined);assert.equal(p.documents,undefined);assert.equal(p.prescriptions.length,1);
 const original=p.prescriptions[0];await save([{kind:'patient_clinical',id:'patient',expectedRevision:3,payload:{prescriptions:[{...original,items:[{medication:'Synthetic',directions:'Corrected'}],history:[]}]}}]);d=await load();const rx=d.payload.patients.find(p=>p.id==='patient').prescriptions[0];assert.equal(rx.number,original.number);assert.equal(rx.createdBy,ids.owner);assert.equal(rx.updatedBy,ids.secretary);assert.equal(rx.revision,2);assert.equal(rx.history.length,1);assert.equal(rx.history[0].previous.items[0].directions,'Original');
 await denied(()=>save([{kind:'patient_clinical',id:'patient',expectedRevision:4,payload:{diagnosis:'forged'}}]));
 await denied(()=>save([{kind:'patient_clinical',id:'patient',expectedRevision:4,payload:{prescriptions:[rx,{id:'forged',items:[]}]}}]));
 await assert.rejects(()=>save([{kind:'patient_clinical',id:'patient',expectedRevision:4,payload:{prescriptions:[]}}]),/PRESCRIPTION_DELETE_DISABLED/);
 await assert.rejects(()=>save([{kind:'patient_clinical',id:'patient',expectedRevision:4,payload:{prescriptions:[{...rx,number:'forged'}]}}]),/PRESCRIPTION_IDENTITY_IMMUTABLE/);
 await actor('owner');assert.equal((await load()).payload.patients.find(p=>p.id==='patient').consultations[0].freeNotes,'IMMUTABLE');
});
test('DB: doctor correction preserves prior history and revocation removes secretary access',async()=>{
 await permissions('doctor',{patientsView:true,clinicalView:true,prescriptionsEdit:true});const rx=(await load()).payload.patients.find(p=>p.id==='patient').prescriptions[0];await save([{kind:'patient_clinical',id:'patient',expectedRevision:4,payload:{prescriptions:[{...rx,observations:'Doctor correction',history:[]}]}}]);const saved=(await load()).payload.patients.find(p=>p.id==='patient').prescriptions[0];assert.equal(saved.history.length,2);assert.equal(saved.updatedBy,ids.doctor);
 await permissions('secretary',{patientsView:true,prescriptionsEdit:false});assert.equal((await load()).payload.patients.find(p=>p.id==='patient').prescriptions,undefined);await denied(()=>save([{kind:'patient_clinical',id:'patient',expectedRevision:5,payload:{prescriptions:[{...saved,observations:'Blocked'}]}}]));
});
test('DB: secretary voids a prescription with server-owned audit metadata and cannot restore it',async()=>{
 await permissions('secretary',{patientsView:true,prescriptionsEdit:true});const rx=(await load()).payload.patients.find(p=>p.id==='patient').prescriptions[0];
 await save([{kind:'patient_clinical',id:'patient',expectedRevision:5,payload:{prescriptions:[{...rx,status:'voided',voidReason:'Error en la dosis',voidedAt:'2000-01-01T00:00:00Z',voidedBy:ids.other}]}}]);
 const archived=(await load()).payload.patients.find(p=>p.id==='patient').prescriptions[0];assert.notEqual(archived.voidedAt,'2000-01-01T00:00:00Z');assert.equal(archived.voidedBy,ids.secretary);assert.equal(archived.status,'voided');assert.equal(archived.history.length,3);
 const restored={...archived,status:'active'};delete restored.voidedAt;delete restored.voidedBy;delete restored.voidReason;await assert.rejects(()=>save([{kind:'patient_clinical',id:'patient',expectedRevision:6,payload:{prescriptions:[restored]}}]),/PRESCRIPTION_VOIDED/);
 await assert.rejects(()=>save([{kind:'patient_clinical',id:'patient',expectedRevision:6,payload:{prescriptions:[{...archived,observations:'forged'}]}}]),/PRESCRIPTION_VOIDED/);
 await assert.rejects(()=>save([{kind:'patient_clinical',id:'patient',expectedRevision:6,payload:{prescriptions:[]}}]),/PRESCRIPTION_DELETE_DISABLED/);
 await actor('owner');assert.equal((await load()).payload.patients.find(p=>p.id==='patient').consultations[0].freeNotes,'IMMUTABLE');
});
test('DB: secretary captures only a safe pending medication and doctor approves it',async()=>{
 await permissions('secretary',{patientsView:true,medicationsCapture:true});
 const capture=(await db.query('select public.linkare_capture_medication_v1($1,$2,$3::jsonb) data',[org,'patient',JSON.stringify({name:'Medicamento informado',doseValue:'10',doseUnit:'mg',frequency:'cada mañana',frequencySlots:['morning'],route:'oral',notes:'Paciente lo refiere'})])).rows[0].data;
 assert.ok(capture.id);let d=await load();const projected=d.payload.patients.find(p=>p.id==='patient');assert.equal(projected.diagnosis,undefined);assert.equal(projected.medications.length,1);assert.equal(projected.medications[0].status,'pending_review');assert.equal(projected.medications[0].clinicalNotes,undefined);
 await permissions('doctor',{patientsView:true,clinicalView:true,medicationsManage:true});d=await load();const patient=d.payload.patients.find(p=>p.id==='patient');const pending=patient.medications.find(m=>m.id===capture.id);const medications=patient.medications.map(m=>m.id===capture.id?{...m,status:'active'}:m);await save([{kind:'patient_clinical',id:'patient',expectedRevision:capture.revision,payload:{medications}}]);d=await load();const approved=d.payload.patients.find(p=>p.id==='patient').medications.find(m=>m.id===capture.id);assert.equal(approved.status,'active');assert.equal(approved.reviewedBy,ids.doctor);assert.ok(approved.reviewedAt);assert.equal(approved.events.at(-1).type,'approved');assert.equal(pending.reviewedAt,null);
 await permissions('secretary',{patientsView:true,medicationsCapture:true});d=await load();assert.equal(d.payload.patients.find(p=>p.id==='patient').medications.length,0);
});
test('DB: appointment confirmation and administrative review metadata are server-owned',async()=>{
 await permissions('secretary',{patientsView:true,calendarDoctorView:true,calendarDoctorEdit:true});
 await save([{kind:'appointment',id:'appointment',expectedRevision:1,payload:{calendarId:calendarIds.doctor,eventType:'appointment',patientId:'patient',start:'2026-10-01T12:00:00Z',end:'2026-10-01T12:30:00Z',status:'confirmed',adminReviewStatus:'reviewed',confirmedAt:'2000-01-01',confirmedBy:ids.other,reviewedAt:'2000-01-01',reviewedBy:ids.other}}]);
 const appointment=(await load()).payload.appointments.find(a=>a.id==='appointment');assert.equal(appointment.status,'confirmed');assert.equal(appointment.adminReviewStatus,'reviewed');assert.equal(appointment.confirmedBy,ids.secretary);assert.equal(appointment.reviewedBy,ids.secretary);assert.notEqual(appointment.confirmedAt,'2000-01-01');assert.notEqual(appointment.reviewedAt,'2000-01-01');assert.equal(appointment.notes,undefined);
});

test('DB: secretary with all allowed grants sees Doctor, Esposa and General but no clinical chart',async()=>{
 const all={patientsView:true,calendarDoctorView:true,calendarDoctorCreate:true,calendarDoctorEdit:true,calendarDoctorCancel:true,calendarDoctorDelete:true,calendarWifeView:true,calendarWifeCreate:true,calendarWifeEdit:true,calendarWifeCancel:true,calendarWifeDelete:true,calendarGeneralView:true,calendarGeneralCreate:true,calendarGeneralEdit:true,calendarGeneralCancel:true,calendarGeneralDelete:true,clinicalView:true,usersManage:true,billingManage:true};
 await permissions('secretary',all);const d=await load();assert.deepEqual(d.payload.calendars.map(calendar=>calendar.code),['doctor','wife','general']);assert.equal(d.payload.patients[0].diagnosis,undefined);assert.equal(await allowed('clinicalView'),false);assert.equal(await allowed('usersManage'),false);assert.equal(await allowed('billingManage'),false);
});
test('DB: custom Secretary calendar grants expose only the authorized calendar',async()=>{
 await permissions('secretary',{calendarWifeView:true});const d=await load();assert.deepEqual(d.payload.calendars.map(calendar=>calendar.code),['wife']);assert.equal(d.payload.appointments.length,0);assert.equal(await allowed('appointmentsManage'),true);
});
test('DB: view-only calendar permission cannot modify an appointment',async()=>{
 await permissions('secretary',{patientsView:true,calendarDoctorView:true});const record=(await db.query("select payload,revision from public.linkare_records where organization_id=$1 and kind='appointment' and id='appointment'",[org])).rows[0];await denied(()=>save([{kind:'appointment',id:'appointment',expectedRevision:record.revision,payload:{...record.payload,status:'pending'}}]));
});
test('DB: Secretary creates a patient appointment only in an authorized calendar',async()=>{
 await permissions('secretary',{patientsView:true,calendarDoctorView:true,calendarDoctorCreate:true});await save([{kind:'appointment',id:'secretary-doctor-appointment',expectedRevision:0,payload:{calendarId:calendarIds.doctor,eventType:'appointment',patientId:'patient',title:'FORGED TITLE',start:'2026-11-01T12:00:00Z',end:'2026-11-01T12:30:00Z',status:'pending'}}]);const saved=(await load()).payload.appointments.find(item=>item.id==='secretary-doctor-appointment');assert.equal(saved.calendarId,calendarIds.doctor);assert.equal(saved.eventType,'appointment');assert.equal(saved.patientId,'patient');
});
test('DB: General accepts a non-patient event and does not convert it into a medical appointment',async()=>{
 await permissions('secretary',{calendarGeneralView:true,calendarGeneralCreate:true});await save([{kind:'appointment',id:'general-event',expectedRevision:0,payload:{calendarId:calendarIds.general,eventType:'general',title:'Compromiso familiar',start:'2026-11-02T12:00:00Z',end:'2026-11-02T13:00:00Z',status:'confirmed'}}]);const saved=(await load()).payload.appointments.find(item=>item.id==='general-event');assert.equal(saved.eventType,'general');assert.equal(saved.title,'Compromiso familiar');assert.equal(saved.patientId,undefined);
});
test('DB: unauthorized calendar writes are rejected by the RPC and direct table access',async()=>{
 await permissions('secretary',{calendarGeneralView:true,calendarGeneralCreate:true});await denied(()=>save([{kind:'appointment',id:'forged-wife-event',expectedRevision:0,payload:{calendarId:calendarIds.wife,eventType:'appointment',patientId:'patient',title:'Intrusión',start:'2026-11-03T12:00:00Z',end:'2026-11-03T13:00:00Z'}}]));await denied(()=>db.query("insert into public.linkare_records(organization_id,kind,id,payload) values($1,'appointment','direct-forgery',$2::jsonb)",[org,JSON.stringify({calendarId:calendarIds.general,eventType:'general',title:'Directo'})]));
});
test('DB: revoking a calendar grant is effective after refresh and a new authenticated session',async()=>{
 await permissions('secretary',{calendarWifeView:true});assert.deepEqual((await load()).payload.calendars.map(calendar=>calendar.code),['wife']);await db.exec('reset role');await db.query('update public.organization_members set permissions=$1 where user_id=$2',[JSON.stringify({}),ids.secretary]);await actor('secretary');assert.deepEqual((await load()).payload.calendars,[]);assert.equal(await allowed('appointmentsManage'),false);
});

test('DB: daily agenda uses the requested date, current medication, tenant and clinical permission',async()=>{
 await permissions('doctor',{patientsView:true,clinicalView:true,appointmentsManage:true});let agenda=(await db.query('select public.linkare_daily_agenda_v1($1,$2::date) data',[org,'2026-10-01'])).rows[0].data;assert.equal(agenda.date,'2026-10-01');assert.equal(agenda.items.length,1);assert.equal(agenda.items[0].patientName,'Synthetic QA');assert.equal(agenda.items[0].currentMedication.name,'Medicamento informado');
 agenda=(await db.query('select public.linkare_daily_agenda_v1($1,$2::date) data',[org,'2026-10-02'])).rows[0].data;assert.equal(agenda.items.length,0);
 await permissions('secretary',{patientsView:true,appointmentsManage:true});await denied(()=>db.query('select public.linkare_daily_agenda_v1($1,$2::date)',[org,'2026-10-01']));
 await actor('other');await denied(()=>db.query('select public.linkare_daily_agenda_v1($1,$2::date)',[org,'2026-10-01']));
});
test('DB: reminder and daily agenda delivery keys are idempotent',async()=>{
 await db.exec('reset role');const key=`${org}:appointment:+50370000000:whatsapp:24:2026-10-01T12:00:00Z`;await db.query("insert into public.linkare_notification_deliveries(organization_id,appointment_id,channel,destination,dedupe_key,status) values($1,'appointment','whatsapp','+50370000000',$2,'queued')",[org,key]);await assert.rejects(()=>db.query("insert into public.linkare_notification_deliveries(organization_id,appointment_id,channel,destination,dedupe_key,status) values($1,'appointment','whatsapp','+50370000000',$2,'queued')",[org,key]),e=>e.code==='23505');
});
test('DB: generated documents preserve template snapshots and secretary cannot generate clinical content',async()=>{
 await permissions('secretary',{patientsView:true,documentsGenerateAdministrative:true,documentsGenerateClinical:true});
 await db.exec('reset role');const revision=(await db.query("select revision from public.linkare_records where organization_id=$1 and kind='patient_clinical' and id='patient'",[org])).rows[0].revision;await actor('secretary');
 const generated=crypto.randomUUID();const administrative='10000000-0000-4000-9000-000000000001';const snapshot=(await db.query("select replace(replace(body,'{nombre_paciente}','Synthetic QA'),'{fecha}',current_date::text) value from public.linkare_document_templates_v1 where id=$1",[administrative])).rows[0].value;
 await db.query("select public.linkare_attach_generated_document_v1($1,'patient',$2,$3,$4,'Constancia QA',$5::jsonb,$6,$7,900)",[org,revision,generated,administrative,JSON.stringify({nombre_paciente:'FORGED'}),snapshot,`${org}/patient/${generated}.pdf`]);
 const saved=(await db.query('select template_version,content_snapshot,classification from public.linkare_generated_documents_v1 where id=$1',[generated])).rows[0];assert.equal(saved.template_version,1);assert.equal(saved.content_snapshot,snapshot);assert.equal(saved.classification,'administrative');
 await assert.rejects(()=>db.query("select public.linkare_attach_generated_document_v1($1,'patient',$2,$3,$4,'Forjada','{}','CONTENIDO FORJADO',$5,900)",[org,revision+1,crypto.randomUUID(),administrative,`${org}/patient/forged.pdf`]),/DOCUMENT_CONTENT_MISMATCH/);
 const nextRevision=revision+1;await assert.rejects(()=>db.query("select public.linkare_attach_generated_document_v1($1,'patient',$2,$3,'10000000-0000-4000-9000-000000000003','Carta',$4::jsonb,'DIAGNOSTICO','x',900)",[org,nextRevision,crypto.randomUUID(),'{}']),/ACCESS_DENIED/);
 await db.exec('reset role');await db.query("insert into public.linkare_document_templates_v1(organization_id,template_key,version,name,classification,body) values(null,'medical_certificate',2,'Constancia médica','administrative','CAMBIO FUTURO')");assert.equal((await db.query('select content_snapshot from public.linkare_generated_documents_v1 where id=$1',[generated])).rows[0].content_snapshot,snapshot);
});
test('DB: calendar scopes require patient binding and tokens can be revoked without crossing tenants',async()=>{
 await db.exec('reset role');const token=crypto.randomUUID();await db.query("insert into public.calendar_feed_tokens(id,organization_id,scope,patient_id,created_by,expires_at) values($1,$2,'patient_own','patient',$3,now()+interval '1 day')",[token,org,ids.owner]);await assert.rejects(()=>db.query("insert into public.calendar_feed_tokens(organization_id,scope,created_by) values($1,'patient_own',$2)",[org,ids.owner]),e=>e.code==='23514');await db.query('update public.calendar_feed_tokens set active=false,revoked_at=now() where id=$1 and organization_id=$2',[token,org]);assert.equal((await db.query('select active,revoked_at is not null revoked from public.calendar_feed_tokens where id=$1',[token])).rows[0].active,false);const otherOrg=(await db.query("select organization_id from public.organization_members where user_id=$1",[ids.other])).rows[0].organization_id;assert.equal((await db.query('select count(*)::int n from public.calendar_feed_tokens where id=$1 and organization_id=$2',[token,otherOrg])).rows[0].n,0);
});
test('DB: legacy medication metadata no longer blocks additions and legacy rows can be archived',async()=>{
 await db.exec('reset role;alter table public.linkare_records disable trigger user');await db.query("insert into public.linkare_records(organization_id,kind,id,payload,revision) values($1,'patient_admin','legacy-save','{\"name\":\"Legacy save\"}',1),($1,'patient_clinical','legacy-save',$2::jsonb,1),($1,'patient_admin','legacy-archive','{\"name\":\"Legacy archive\"}',1),($1,'patient_clinical','legacy-archive',$3::jsonb,1)",[org,JSON.stringify({medications:[{id:'legacy-existing',name:'Eutebrol',startDate:'2026-01-01',status:'active'}]}),JSON.stringify({medications:[{name:'Registro antiguo',startDate:'2026-01-01',status:'active'}]})]);await db.exec('alter table public.linkare_records enable trigger user');
 await actor('owner');await save([{kind:'patient_clinical',id:'legacy-save',expectedRevision:1,payload:{medications:[{id:'legacy-existing',name:'Eutebrol',startDate:'2026-01-01',createdAt:'2026-01-01',createdBy:null,status:'active',isPrimary:false},{id:'new-medication',name:'Coenzima Q10',dose:'100 mg',status:'active',source:'clinical',isPrimary:true}]}}]);const stored=(await db.query("select payload from public.linkare_records where organization_id=$1 and kind='patient_clinical' and id='legacy-save'",[org])).rows[0].payload;assert.equal(stored.medications.length,2);assert.equal(stored.medications[0].createdAt,undefined);assert.ok(stored.medications[1].createdAt);
 const archived=(await db.query("select public.linkare_archive_medication_v1($1,'legacy-archive','med_legacy-archive_0','Registro duplicado') data",[org])).rows[0].data;assert.equal(archived.ok,true);const old=(await db.query("select payload->'medications'->0 med from public.linkare_records where organization_id=$1 and kind='patient_clinical' and id='legacy-archive'",[org])).rows[0].med;assert.equal(old.id,'med_legacy-archive_0');assert.ok(old.archivedAt);assert.equal(old.archiveReason,'Registro duplicado');assert.equal(old.status,'discontinued');
});
test('DB: 3, 4 and 5 sequential medications save with stale client identity metadata',async()=>{
 await actor('owner');
 const drafts=[
  {id:'medication-1',name:'Vessone (Vilazodona)',doseValue:10,frequency:'una vez al día'},
  {id:'medication-2',name:'Ansiogen (Bromazepam)',doseValue:3,frequency:'según necesidad (PRN)'},
  {id:'medication-3',name:'Calcigam',doseValue:1,frequency:'una vez al día'},
  {id:'medication-4',name:'Coenzima Q10',doseValue:100,frequency:'una vez al día'},
  {id:'medication-5',name:'Medicamento QA (5)',doseValue:5,frequency:'una vez al día'},
 ];
 let staleClientMedications=[];
 for(let index=0;index<drafts.length;index+=1){
  staleClientMedications=staleClientMedications.map(medication=>({...medication,isPrimary:false}));
  const draft=drafts[index];
  const clientTimestamp=`2026-09-21T22:${String(36+index).padStart(2,'0')}:00.000Z`;
  const medication={...draft,dose:`${draft.doseValue} mg`,doseUnit:'mg',route:'oral',startDate:'2026-09-21',status:'active',source:'clinical',isPrimary:true,createdBy:ids.owner,createdAt:clientTimestamp,reviewedBy:ids.owner,reviewedAt:clientTimestamp};
  staleClientMedications.push(medication);
  const records=[{kind:'patient_clinical',id:'sequential-medications',expectedRevision:index,payload:{medications:staleClientMedications}}];
  if(index===0)records.unshift({kind:'patient_admin',id:'sequential-medications',expectedRevision:0,payload:{name:'Sequential medications'}});
  await save(records);
  const stored=(await db.query("select payload->'medications' medications from public.linkare_records where organization_id=$1 and kind='patient_clinical' and id='sequential-medications'",[org])).rows[0].medications;
  assert.equal(stored.length,index+1);
  assert.deepEqual(stored.map(item=>item.name),drafts.slice(0,index+1).map(item=>item.name));
 }
 const stored=(await db.query("select payload->'medications' medications from public.linkare_records where organization_id=$1 and kind='patient_clinical' and id='sequential-medications'",[org])).rows[0].medications;
 assert.notEqual(stored[0].createdAt,staleClientMedications[0].createdAt);assert.equal(stored[0].reviewedAt,undefined);
});
test('DB: patient archival is audited, cancels future appointments and respects permissions',async()=>{
 await actor('owner');
 await save([{kind:'patient_admin',id:'archive-target',expectedRevision:0,payload:{name:'Archive target'}},{kind:'patient_clinical',id:'archive-target',expectedRevision:0,payload:{diagnosis:'QA'}},{kind:'appointment',id:'archive-appointment',expectedRevision:0,payload:{calendarId:calendarIds.doctor,eventType:'appointment',patientId:'archive-target',start:'2026-12-01T12:00:00Z',end:'2026-12-01T12:30:00Z',status:'confirmed'}},{kind:'appointment',id:'archive-past-appointment',expectedRevision:0,payload:{calendarId:calendarIds.doctor,eventType:'appointment',patientId:'archive-target',start:'2026-01-01T12:00:00Z',end:'2026-01-01T12:30:00Z',status:'confirmed'}}]);
 await permissions('secretary',{patientsView:true,patientsEdit:false});
 await denied(()=>db.query("select public.linkare_archive_patient_v1($1,'archive-target','Duplicado')",[org]));
 await actor('owner');
 const result=(await db.query("select public.linkare_archive_patient_v1($1,'archive-target','Expediente creado por error') data",[org])).rows[0].data;
 assert.equal(result.ok,true);
 const admin=(await db.query("select payload from public.linkare_records where organization_id=$1 and kind='patient_admin' and id='archive-target'",[org])).rows[0].payload;
 assert.equal(admin.archived,true);assert.equal(admin.archiveReason,'Expediente creado por error');assert.equal(admin.archivedBy,ids.owner);
 const appointment=(await db.query("select payload from public.linkare_records where organization_id=$1 and kind='appointment' and id='archive-appointment'",[org])).rows[0].payload;
 assert.equal(appointment.status,'cancelled');
 const pastAppointment=(await db.query("select payload from public.linkare_records where organization_id=$1 and kind='appointment' and id='archive-past-appointment'",[org])).rows[0].payload;
 assert.equal(pastAppointment.status,'confirmed');
 const actions=(await db.query("select action from public.linkare_audit_v3 where organization_id=$1 and record_id in('archive-target','archive-appointment') order by id",[org])).rows.map(row=>row.action);
 assert.ok(actions.includes('patient.archived'));assert.ok(actions.includes('appointment.cancelled.patient_archived'));
});
test('DB: printable Doctor agenda is chronological, complete, scoped and separately permissioned',async()=>{
 await actor('owner');
 await save([{kind:'patient_admin',id:'sheet-patient',expectedRevision:0,payload:{name:'Paciente Agenda QA'}},{kind:'patient_clinical',id:'sheet-patient',expectedRevision:0,payload:{diagnosis:'PRIVATE_DIAGNOSIS_DO_NOT_PRINT',medications:[{id:'med-a',name:'Sertralina',dose:'50 mg',frequency:'cada mañana',route:'oral',status:'active'},{id:'med-b',name:'Clonazepam',dose:'1/2 tableta',frequency:'cada noche',status:'active'},{id:'med-c',name:'Suspendido',dose:'5 mg',status:'suspended'}]}},{kind:'appointment',id:'sheet-late',expectedRevision:0,payload:{calendarId:calendarIds.doctor,eventType:'appointment',patientId:'sheet-patient',title:'Tarde',start:'2026-10-06T16:00:00Z',end:'2026-10-06T16:45:00Z',status:'confirmed'}},{kind:'appointment',id:'sheet-early',expectedRevision:0,payload:{calendarId:calendarIds.doctor,eventType:'appointment',patientId:'sheet-patient',title:'Temprano',start:'2026-10-06T14:00:00Z',end:'2026-10-06T14:30:00Z',status:'pending'}},{kind:'appointment',id:'sheet-wife',expectedRevision:0,payload:{calendarId:calendarIds.wife,eventType:'appointment',patientId:'sheet-patient',title:'Privado',start:'2026-10-06T15:00:00Z',end:'2026-10-06T15:30:00Z',status:'confirmed'}},{kind:'appointment_clinical',id:'sheet-early',expectedRevision:0,payload:{notes:'PRIVATE_PREPARATION_DO_NOT_PRINT'}}]);
 await permissions('secretary',{patientsView:true,agendaSheetView:true,agendaSheetEdit:false,calendarDoctorView:true});
 let sheet=(await db.query('select public.linkare_printable_agenda_v1($1,$2::date) data',[org,'2026-10-06'])).rows[0].data;
 assert.deepEqual(sheet.items.map(item=>item.appointmentId),['sheet-early','sheet-late']);
 assert.deepEqual(sheet.items[0].medications.map(item=>item.name),['Clonazepam','Sertralina']);
 assert.equal(sheet.items[0].medications[0].dose,'1/2 tableta');
 assert.doesNotMatch(JSON.stringify(sheet),/PRIVATE_DIAGNOSIS_DO_NOT_PRINT|PRIVATE_PREPARATION_DO_NOT_PRINT|Suspendido|sheet-wife/);
 await denied(()=>db.query('select public.linkare_save_agenda_note_v1($1,$2,$3,$4)',[org,'sheet-early','Preparar expediente',0]));
 await permissions('secretary',{patientsView:true,agendaSheetView:true,agendaSheetEdit:true,calendarDoctorView:true,calendarDoctorEdit:true});
 const saved=(await db.query('select public.linkare_save_agenda_note_v1($1,$2,$3,$4) data',[org,'sheet-early','Preparar expediente',0])).rows[0].data;
 assert.equal(saved.note,'Preparar expediente');
 assert.equal(saved.revision,1);
 sheet=(await db.query('select public.linkare_printable_agenda_v1($1,$2::date) data',[org,'2026-10-06'])).rows[0].data;
 assert.equal(sheet.items[0].agendaNote,'Preparar expediente');assert.equal(sheet.items[0].noteRevision,saved.revision);
 await assert.rejects(()=>db.query('select public.linkare_save_agenda_note_v1($1,$2,$3,$4)',[org,'sheet-early','Cambio obsoleto',0]),error=>error.code==='40001');
 assert.equal((await db.query('select public.linkare_printable_agenda_v1($1,$2::date) data',[org,'2026-10-07'])).rows[0].data.items.length,0);
 await permissions('secretary',{patientsView:true,agendaSheetView:true,agendaSheetEdit:true,calendarWifeView:true});
 await denied(()=>db.query('select public.linkare_printable_agenda_v1($1,$2::date)',[org,'2026-10-06']));
 await denied(()=>db.query('select * from linkare_private.appointment_agenda_note_v1'));
 await actor('other');await denied(()=>db.query('select public.linkare_printable_agenda_v1($1,$2::date)',[org,'2026-10-06']));
});
test('DB: Cancel without Edit cannot smuggle appointment changes and cancellation metadata is server-owned',async()=>{
 await actor('owner');await save([{kind:'appointment',id:'cancel-guard',expectedRevision:0,payload:{calendarId:calendarIds.doctor,eventType:'appointment',patientId:'patient',title:'Original title',start:'2026-12-12T12:00:00Z',end:'2026-12-12T12:30:00Z',status:'confirmed'}}]);
 await permissions('secretary',{calendarDoctorView:true,calendarDoctorCancel:true});const original=(await load()).payload.appointments.find(item=>item.id==='cancel-guard');
 await denied(()=>save([{kind:'appointment',id:'cancel-guard',expectedRevision:1,payload:{...original,title:'Smuggled title',status:'cancelled'}}]));
 await save([{kind:'appointment',id:'cancel-guard',expectedRevision:1,payload:{...original,status:'cancelled',cancelledBy:ids.owner,cancelledAt:'2000-01-01T00:00:00Z'}}]);
 await db.exec('reset role');const stored=(await db.query("select payload from public.linkare_records where organization_id=$1 and kind='appointment' and id='cancel-guard'",[org])).rows[0].payload;assert.equal(stored.title,'Original title');assert.equal(stored.cancelledBy,ids.secretary);assert.notEqual(stored.cancelledAt,'2000-01-01T00:00:00Z');
});
test('DB: historical migration is resumable, permission-scoped, reconciled and reversable',async()=>{
 const batch='50000000-0000-5000-8000-000000000010',patient='50000000-0000-5000-8000-000000000011',backup='a'.repeat(64),plan='b'.repeat(64),commit='c'.repeat(40),hash1='1'.repeat(64),hash2='2'.repeat(64),historyAdmin='50000000-0000-5000-8000-000000000012',historyClinical='50000000-0000-5000-8000-000000000013';
 const report={sourceRows:2,backupSha:backup,planSha:plan};
 const records=[{organizationId:org,sourceTable:'t_clientes',sourceRow:1,sourceKeyHash:hash1,sourceFingerprint:'3'.repeat(64),disposition:'import_patient',destinationKind:'patient_admin',destinationId:patient,payload:{id:patient,name:'Historical QA',age:null,dataQuality:'historical',sourceSummary:{system:'FoxPro'},historicalProfile:{nameMissing:false},notificationPreferences:{enabled:false,channels:[],reminderHours:[],consentStatus:'not_recorded'}},historyEntries:[{id:historyAdmin,patientId:patient,scope:'administrative',occurredOn:'2020-01-01',title:'Administrative history',payload:{passedConsultation:null}},{id:historyClinical,patientId:patient,scope:'clinical',occurredOn:null,title:'Clinical history',payload:{text:'SYNTHETIC_PRIVATE_HISTORY',treatmentStatus:'unknown'}}]},{organizationId:org,sourceTable:'t_mov_diarios',sourceRow:2,sourceKeyHash:hash2,sourceFingerprint:'4'.repeat(64),disposition:'quarantine_patient_unmatched',destinationKind:null,destinationId:null,payload:null,historyEntries:[]}];
 await db.exec('reset role;set role service_role');await db.query('select public.linkare_legacy_start_v2($1,$2,$3,$4,$5,$6,$7::jsonb)',[org,batch,'qa-foxpro',backup,plan,commit,JSON.stringify(report)]);await db.query('select public.linkare_legacy_apply_v2($1,$2,$3,$4::jsonb)',[org,batch,backup,JSON.stringify(records)]);await db.query('select public.linkare_legacy_apply_v2($1,$2,$3,$4::jsonb)',[org,batch,backup,JSON.stringify(records)]);
 const verified=(await db.query('select public.linkare_legacy_verify_v2($1,$2,$3) data',[org,batch,backup])).rows[0].data;assert.equal(verified.ok,true);assert.equal(verified.sourceRows,2);assert.equal(verified.patients,1);assert.equal(verified.historyEntries,2);assert.equal(verified.appointmentsCreated,0);assert.equal(verified.notificationsCreated,0);assert.equal((await db.query("select count(*)::int n from public.linkare_records where organization_id=$1 and kind='appointment' and id like '50000000%'",[org])).rows[0].n,0);
 await actor('owner');let loaded=await load();const historical=loaded.payload.patients.find(item=>item.id===patient);assert.equal(historical.dataQuality,'historical');assert.equal(historical.sourceSummary.system,'FoxPro');let history=(await db.query('select public.linkare_legacy_patient_history_v1($1,$2,0,100) data',[org,patient])).rows[0].data;assert.equal(history.items.length,2);assert.equal(history.clinicalIncluded,true);assert.match(JSON.stringify(history),/SYNTHETIC_PRIVATE_HISTORY/);
 await permissions('secretary',{patientsView:true});history=(await db.query('select public.linkare_legacy_patient_history_v1($1,$2,0,100) data',[org,patient])).rows[0].data;assert.equal(history.items.length,1);assert.equal(history.items[0].scope,'administrative');assert.doesNotMatch(JSON.stringify(history),/SYNTHETIC_PRIVATE_HISTORY/);await assert.rejects(()=>db.query('select * from linkare_private.legacy_history_v1'),e=>e.code==='42501');
 await db.exec('reset role;set role service_role');const rolled=(await db.query('select public.linkare_legacy_rollback_v2($1,$2,$3) data',[org,batch,backup])).rows[0].data;assert.equal(rolled.ok,true);assert.equal(rolled.patientsRemoved,1);assert.equal(rolled.historyRemoved,2);assert.equal((await db.query("select count(*)::int n from public.linkare_records where organization_id=$1 and kind='patient_admin' and id=$2",[org,patient])).rows[0].n,0);
});

test('DB: v4 bootstrap is small and the directory returns distinct recent patients in pages of 20',async()=>{
 await actor('owner');
 const profile=(await db.query("select revision,payload from public.linkare_records where organization_id=$1 and kind='profile' and id='clinic'",[org])).rows[0];
 const largeLogo=`data:image/png;base64,${'A'.repeat(120000)}`,largePhoto=`data:image/jpeg;base64,${'B'.repeat(90000)}`;
 await save([{kind:'profile',id:'clinic',expectedRevision:profile.revision,payload:{...profile.payload,clinicLogo:largeLogo,doctorPhoto:largePhoto}}]);
 const changes=[];
 for(let index=0;index<24;index+=1){
  const id=`directory-${String(index).padStart(2,'0')}`,day=String((index%24)+1).padStart(2,'0');
  changes.push({kind:'patient_admin',id,expectedRevision:0,payload:{id,name:index===0?'Álvarez Ñuñez QA':`Directory Patient ${String(index).padStart(2,'0')}`,phone:`7000${String(index).padStart(4,'0')}`}});
  changes.push({kind:'patient_clinical',id,expectedRevision:0,payload:{diagnosis:`PRIVATE-${index}`,consultations:[{id:`visit-${index}-a`,status:'signed',signedBy:ids.owner,signedAt:`2026-09-${day}T16:00:00Z`,startedAt:`2026-09-${day}T15:00:00Z`},{id:`visit-${index}-b`,status:'signed',signedBy:ids.owner,signedAt:`2026-09-${day}T18:00:00Z`,startedAt:`2026-09-${day}T17:00:00Z`}]}});
 }
 changes.push({kind:'patient_admin',id:'directory-boundary',expectedRevision:0,payload:{id:'directory-boundary',name:'Exact Calendar Boundary'}});
 changes.push({kind:'patient_clinical',id:'directory-boundary',expectedRevision:0,payload:{consultations:[{id:'boundary-visit',status:'signed',signedBy:ids.owner,signedAt:'2026-04-03T18:00:00Z',startedAt:'2026-04-03T17:00:00Z'}]}});
 changes.push({kind:'patient_admin',id:'directory-before',expectedRevision:0,payload:{id:'directory-before',name:'Before Calendar Boundary'}});
 changes.push({kind:'patient_clinical',id:'directory-before',expectedRevision:0,payload:{consultations:[{id:'before-visit',status:'signed',signedBy:ids.owner,signedAt:'2026-04-02T18:00:00Z',startedAt:'2026-04-02T17:00:00Z'}]}});
 changes.push({kind:'patient_admin',id:'directory-future',expectedRevision:0,payload:{id:'directory-future',name:'Future Only'}});
 changes.push({kind:'patient_clinical',id:'directory-future',expectedRevision:0,payload:{consultations:[{id:'future-visit',status:'signed',signedBy:ids.owner,signedAt:'2026-10-04T18:00:00Z',startedAt:'2026-10-04T17:00:00Z'}]}});
 changes.push({kind:'patient_admin',id:'directory-no-activity',expectedRevision:0,payload:{id:'directory-no-activity',name:'No Movement QA'}});
 await save(changes);
 const boot=(await db.query('select public.linkare_bootstrap_state_v4($1) data',[org])).rows[0].data;
 assert.equal(boot.projection.ready,true);assert.deepEqual(boot.payload.patients,[]);assert.deepEqual(boot.payload.appointments,[]);assert.ok(boot.revisions.every(item=>['profile','settings'].includes(item.kind)));assert.equal(boot.payload.organization.clinicLogo,undefined);assert.equal(boot.payload.organization.doctorPhoto,undefined);assert.ok(Buffer.byteLength(JSON.stringify(boot))<20000);
 const assets=(await db.query('select public.linkare_profile_assets_v1($1) data',[org])).rows[0].data;assert.equal(assets.organization.clinicLogo,largeLogo);assert.equal(assets.organization.doctorPhoto,largePhoto);assert.equal(assets.revision,profile.revision+1);
 const asOf='2026-10-03T18:00:00Z';
 const first=(await db.query("select public.linkare_patient_directory_v1($1,'recent',null,null,$2,20) data",[org,asOf])).rows[0].data;
 assert.equal(first.items.length,20);assert.equal(new Set(first.items.map(item=>item.id)).size,20);assert.equal(first.hasMore,true);assert.equal(first.cutoffDate,'2026-04-03');
 const second=(await db.query("select public.linkare_patient_directory_v1($1,'recent',null,$2::jsonb,$3,20) data",[org,JSON.stringify(first.nextCursor),asOf])).rows[0].data;
 assert.equal(first.items.some(item=>second.items.some(other=>other.id===item.id)),false);
 const accent=(await db.query("select public.linkare_patient_directory_v1($1,'recent','alvarez nunez',null,$2,20) data",[org,asOf])).rows[0].data;
 assert.deepEqual(accent.items.map(item=>item.id),['directory-00']);
 const boundary=(await db.query("select public.linkare_patient_directory_v1($1,'recent','exact calendar',null,$2,20) data",[org,asOf])).rows[0].data;
 assert.deepEqual(boundary.items.map(item=>item.id),['directory-boundary']);
 const before=(await db.query("select public.linkare_patient_directory_v1($1,'recent','before calendar',null,$2,20) data",[org,asOf])).rows[0].data;
 assert.equal(before.items.length,0);
 const future=(await db.query("select public.linkare_patient_directory_v1($1,'recent','future only',null,$2,20) data",[org,asOf])).rows[0].data;
 assert.equal(future.items.length,0);
 const withoutActivity=(await db.query("select public.linkare_patient_directory_v1($1,'no_activity','no movement',null,$2,20) data",[org,asOf])).rows[0].data;
 assert.deepEqual(withoutActivity.items.map(item=>item.id),['directory-no-activity']);
 const revision=(await db.query("select revision,payload from public.linkare_records where organization_id=$1 and kind='patient_admin' and id='directory-01'",[org])).rows[0];
 await save([{kind:'patient_admin',id:'directory-01',expectedRevision:revision.revision,payload:{...revision.payload,phone:'79990000'}}]);
 await assert.rejects(()=>db.query("select public.linkare_patient_directory_v1($1,'recent',null,$2::jsonb,$3,20)",[org,JSON.stringify(first.nextCursor),asOf]),/CURSOR_STALE/);
});

test('DB: patient detail and range agenda keep tenant and clinical permissions server-side',async()=>{
 await actor('owner');
 const ownerDetail=(await db.query("select public.linkare_patient_detail_v1($1,'directory-00') data",[org])).rows[0].data;
 assert.equal(ownerDetail.patient.diagnosis,'PRIVATE-0');assert.equal(ownerDetail.revisions.length,2);
 await save([{kind:'appointment',id:'directory-agenda',expectedRevision:0,payload:{calendarId:calendarIds.doctor,eventType:'appointment',patientId:'directory-00',title:'Directory appointment',start:'2026-10-10T14:00:00Z',end:'2026-10-10T14:30:00Z',status:'confirmed'}},{kind:'appointment_clinical',id:'directory-agenda',expectedRevision:0,payload:{notes:'PRIVATE_APPOINTMENT_DIRECTORY'}}]);
 let agenda=(await db.query("select public.linkare_agenda_range_v1($1,'2026-10-10T00:00:00Z','2026-10-11T00:00:00Z',array[$2]::uuid[],null,20) data",[org,calendarIds.doctor])).rows[0].data;
 assert.equal(agenda.items.length,1);assert.equal(agenda.items[0].patientSummary.name,'Álvarez Ñuñez QA');assert.equal(agenda.items[0].notes,'PRIVATE_APPOINTMENT_DIRECTORY');
 await permissions('secretary',{patientsView:true,calendarDoctorView:true});
 const secretaryDetail=(await db.query("select public.linkare_patient_detail_v1($1,'directory-00') data",[org])).rows[0].data;
 assert.equal(secretaryDetail.patient.diagnosis,undefined);assert.equal(secretaryDetail.revisions.length,1);
 agenda=(await db.query("select public.linkare_agenda_range_v1($1,'2026-10-10T00:00:00Z','2026-10-11T00:00:00Z',array[$2]::uuid[],null,20) data",[org,calendarIds.doctor])).rows[0].data;
 assert.equal(agenda.items[0].notes,undefined);assert.equal(agenda.items[0].patientSummary.phone,'70000000');
 await assert.rejects(()=>db.query('select * from linkare_private.patient_directory_v1'),e=>e.code==='42501');
 await actor('other');await denied(()=>db.query("select public.linkare_patient_detail_v1($1,'directory-00')",[org]));
});

test('DB: appointment save updates next visit without rewriting patient records',async()=>{
 await actor('owner');
 const before=(await db.query("select revision from public.linkare_records where organization_id=$1 and kind='patient_admin' and id='directory-no-activity'",[org])).rows[0].revision;
 const payload={calendarId:calendarIds.doctor,eventType:'appointment',patientId:'directory-no-activity',title:'Fast appointment',start:'2099-01-10T14:00:00Z',end:'2099-01-10T14:30:00Z',status:'confirmed'};
 await save([{kind:'appointment',id:'appointment-fast-path',expectedRevision:0,payload}]);
 let detail=(await db.query("select public.linkare_patient_detail_v1($1,'directory-no-activity') data",[org])).rows[0].data;
 assert.equal(new Date(detail.patient.nextVisit).toISOString(),'2099-01-10T14:00:00.000Z');
 assert.equal((await db.query("select revision from public.linkare_records where organization_id=$1 and kind='patient_admin' and id='directory-no-activity'",[org])).rows[0].revision,before);
 await save([{kind:'appointment',id:'appointment-fast-path',expectedRevision:1,payload:{...payload,status:'cancelled'}}]);
 detail=(await db.query("select public.linkare_patient_detail_v1($1,'directory-no-activity') data",[org])).rows[0].data;
 assert.equal(detail.patient.nextVisit,null);
});

test('DB: dashboard counts the full directory rather than the visible page',async()=>{
 await actor('owner');const summary=(await db.query("select public.linkare_dashboard_summary_v1($1,'2026-10-03T18:00:00Z') data",[org])).rows[0].data;
 assert.ok(summary.patients.total>20);assert.ok(summary.patients.recent>20);assert.ok(summary.patients.withoutActivity>=1);assert.equal(summary.activityPolicyVersion,1);
});

test('DB: calendar cutoffs handle month ends and retracting the latest visit recalculates activity',async()=>{
 await actor('owner');
 const march=(await db.query("select public.linkare_patient_directory_v1($1,'recent',null,null,'2024-03-31T18:00:00Z',1) data",[org])).rows[0].data;
 const leap=(await db.query("select public.linkare_patient_directory_v1($1,'recent',null,null,'2024-08-31T18:00:00Z',1) data",[org])).rows[0].data;
 assert.equal(march.cutoffDate,'2023-09-30');assert.equal(leap.cutoffDate,'2024-02-29');
 const consultations=[{id:'early-valid',status:'signed',signedBy:ids.owner,startedAt:'2026-08-01T16:00:00Z',signedAt:'2026-08-01T17:00:00Z'},{id:'latest-retracted',status:'signed',signedBy:ids.owner,startedAt:'2026-09-20T16:00:00Z',signedAt:'2026-09-20T17:00:00Z'}];
 await save([{kind:'patient_admin',id:'directory-retraction',expectedRevision:0,payload:{id:'directory-retraction',name:'Retraction QA'}},{kind:'patient_clinical',id:'directory-retraction',expectedRevision:0,payload:{consultations}}]);
 let listed=(await db.query("select public.linkare_patient_directory_v1($1,'recent','retraction qa',null,'2026-10-03T18:00:00Z',20) data",[org])).rows[0].data;assert.equal(listed.items[0].lastActivityOn,'2026-09-20');
 await save([{kind:'patient_clinical',id:'directory-retraction',expectedRevision:1,payload:{consultations,consultationRetractions:[{resourceId:'latest-retracted',reason:'Synthetic correction'}]}}]);
 listed=(await db.query("select public.linkare_patient_directory_v1($1,'recent','retraction qa',null,'2026-10-03T18:00:00Z',20) data",[org])).rows[0].data;assert.equal(listed.items[0].lastActivityOn,'2026-08-01');
});

test('DB: recent cohorts of 0, 1, 19, 20, 21 and 45 retain exact keyset semantics',async()=>{
 await actor('owner');const changes=[];
 for(let index=1;index<=45;index++){
  const id=`cohort-${String(index).padStart(2,'0')}`,tags=['c45x'];if(index<=21)tags.push('c21x');if(index<=20)tags.push('c20x');if(index<=19)tags.push('c19x');if(index===1)tags.push('c1x');
  changes.push({kind:'patient_admin',id,expectedRevision:0,payload:{id,name:`Synthetic ${tags.join(' ')} ${index}`}});
  changes.push({kind:'patient_clinical',id,expectedRevision:0,payload:{consultations:[{id:`cohort-note-${index}`,status:'signed',signedBy:ids.owner,startedAt:'2026-09-01T16:00:00Z',signedAt:'2026-09-01T17:00:00Z'}]}});
 }
 await save(changes);const asOf='2026-10-03T18:00:00Z';
 const page=async(query,cursor=null)=>(await db.query("select public.linkare_patient_directory_v1($1,'recent',$2,$3::jsonb,$4,20) data",[org,query,cursor?JSON.stringify(cursor):null,asOf])).rows[0].data;
 assert.equal((await page('c0x')).items.length,0);assert.equal((await page('c1x')).items.length,1);assert.equal((await page('c19x')).items.length,19);
 const twenty=await page('c20x');assert.equal(twenty.items.length,20);assert.equal(twenty.hasMore,false);
 const twentyOne=await page('c21x');assert.equal(twentyOne.items.length,20);assert.equal(twentyOne.hasMore,true);assert.equal((await page('c21x',twentyOne.nextCursor)).items.length,1);
 const first=await page('c45x'),second=await page('c45x',first.nextCursor),third=await page('c45x',second.nextCursor);assert.deepEqual([first.items.length,second.items.length,third.items.length],[20,20,5]);
 assert.equal(new Set([...first.items,...second.items,...third.items].map(item=>item.id)).size,45);
});

test('DB: projection backfill resumes by key, becomes ready and is idempotent',async()=>{
 await db.exec('reset role;set role service_role');
 await db.query('delete from linkare_private.appointment_directory_v1 where organization_id=$1',[org]);
 await db.query('delete from linkare_private.patient_directory_v1 where organization_id=$1',[org]);
 await db.query('update linkare_private.patient_directory_state_v1 set appointments_ready=false,patients_ready=false where organization_id=$1',[org]);
 for(const phase of ['appointments','patients']){
  let cursor=null,more=true,guard=0;
  while(more){const result=(await db.query('select public.linkare_projection_backfill_v1($1,$2,$3,2) data',[org,phase,cursor])).rows[0].data;cursor=result.nextId;more=result.hasMore;assert.ok(++guard<100);}
 }
 const ready=(await db.query('select appointments_ready,patients_ready,listing_version from linkare_private.patient_directory_state_v1 where organization_id=$1',[org])).rows[0];assert.equal(ready.appointments_ready,true);assert.equal(ready.patients_ready,true);
 await db.query("select public.linkare_projection_backfill_v1($1,'patients',null,1000)",[org]);
 const after=(await db.query('select listing_version from linkare_private.patient_directory_state_v1 where organization_id=$1',[org])).rows[0];assert.equal(after.listing_version,ready.listing_version);
 await actor('owner');
});

test('DB: directory cursor bumps are coalesced and deferred until commit',async()=>{
 await db.exec('reset role');
 const before=BigInt((await db.query('select listing_version from linkare_private.patient_directory_state_v1 where organization_id=$1',[org])).rows[0].listing_version);
 await db.exec('begin');
 await db.query('select linkare_private.bump_directory_version_v1($1)',[org]);
 await db.query('select linkare_private.bump_directory_version_v1($1)',[org]);
 const inside=BigInt((await db.query('select listing_version from linkare_private.patient_directory_state_v1 where organization_id=$1',[org])).rows[0].listing_version);
 const queued=Number((await db.query('select count(*) n from linkare_private.patient_directory_version_queue_v2 where organization_id=$1',[org])).rows[0].n);
 assert.equal(inside,before);assert.equal(queued,1);
 await db.exec('commit');
 const after=BigInt((await db.query('select listing_version from linkare_private.patient_directory_state_v1 where organization_id=$1',[org])).rows[0].listing_version);
 const remaining=Number((await db.query('select count(*) n from linkare_private.patient_directory_version_queue_v2 where organization_id=$1',[org])).rows[0].n);
 assert.equal(after,before+1n);assert.equal(remaining,0);
 await db.exec('begin');await db.query('select linkare_private.bump_directory_version_v1($1)',[org]);await db.exec('rollback');
 const rolledBack=BigInt((await db.query('select listing_version from linkare_private.patient_directory_state_v1 where organization_id=$1',[org])).rows[0].listing_version);
 assert.equal(rolledBack,after);
 await actor('owner');
});

test('DB: consultation fee is projected, permission-scoped and cannot be changed without its explicit grant',async()=>{
 await actor('owner');
 await save([{kind:'patient_admin',id:'fee-patient',expectedRevision:0,payload:{id:'fee-patient',name:'Paciente Tarifa QA',phone:'70000000',consultationFeeCents:12000}}]);
 let detail=(await db.query("select public.linkare_patient_detail_v1($1,'fee-patient') data",[org])).rows[0].data;
 assert.equal(detail.patient.consultationFeeCents,12000);
 let directory=(await db.query("select public.linkare_patient_directory_v1($1,'all','Paciente Tarifa',null,null,20) data",[org])).rows[0].data;
 assert.equal(directory.items[0].consultationFeeCents,12000);

 await permissions('secretary',{patientsView:true,patientsEdit:true,consultationFeeView:false,consultationFeeEdit:false});
 detail=(await db.query("select public.linkare_patient_detail_v1($1,'fee-patient') data",[org])).rows[0].data;
 assert.equal(detail.patient.consultationFeeCents,undefined);
 directory=(await db.query("select public.linkare_patient_directory_v1($1,'all','Paciente Tarifa',null,null,20) data",[org])).rows[0].data;
 assert.equal(directory.items[0].consultationFeeCents,undefined);
 await assert.rejects(()=>save([{kind:'patient_admin',id:'fee-patient',expectedRevision:1,payload:{name:'Paciente Tarifa QA',consultationFeeCents:9000}}]),error=>error.code==='42501');
 await save([{kind:'patient_admin',id:'fee-patient',expectedRevision:1,payload:{name:'Paciente Tarifa QA',phone:'71111111'}}]);

 await actor('owner');
 detail=(await db.query("select public.linkare_patient_detail_v1($1,'fee-patient') data",[org])).rows[0].data;
 assert.equal(detail.patient.consultationFeeCents,12000);
 const revision=detail.revisions.find(item=>item.kind==='patient_admin').revision;
 await permissions('secretary',{patientsView:true,patientsEdit:true,consultationFeeView:true,consultationFeeEdit:true});
 await save([{kind:'patient_admin',id:'fee-patient',expectedRevision:revision,payload:{name:'Paciente Tarifa QA',phone:'71111111',consultationFeeCents:9000}}]);
 detail=(await db.query("select public.linkare_patient_detail_v1($1,'fee-patient') data",[org])).rows[0].data;
 assert.equal(detail.patient.consultationFeeCents,9000);
});

test('DB: changing only appointment status works for owner and authorized Secretary without rewriting the appointment',async()=>{
 await actor('owner');
 await save([{kind:'appointment',id:'status-only-qa',expectedRevision:0,payload:{calendarId:calendarIds.doctor,eventType:'appointment',patientId:'patient',title:'Cita sintética',start:'2026-12-08T16:00:00Z',end:'2026-12-08T16:45:00Z',status:'pending'}}]);
 const change=async(status,targetOrg=org)=>(await db.query('select public.linkare_set_appointment_status_v1($1,$2,$3) data',[targetOrg,'status-only-qa',status])).rows[0].data;
 const confirmed=await change('confirmed');
 assert.equal(confirmed.status,'confirmed');assert.equal(confirmed.title,'Cita sintética');assert.equal(confirmed.__revision,2);
 assert.equal(confirmed.confirmedBy,ids.owner);
 assert.equal((await change('confirmed')).__revision,2,'repeating the same status is idempotent');

 await permissions('secretary',{patientsView:true,calendarDoctorView:true,calendarDoctorEdit:true,calendarDoctorCancel:true});
 const completed=await change('completed');assert.equal(completed.status,'completed');assert.equal(completed.__revision,3);
 const cancelled=await change('cancelled');assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.cancelledBy,ids.secretary);
 const row=(await db.query("select payload,revision from public.linkare_records where organization_id=$1 and kind='appointment' and id='status-only-qa'",[org])).rows[0];
 assert.equal(row.payload.title,'Cita sintética');assert.equal(row.payload.patientId,'patient');assert.equal(row.revision,4);
 await actor('owner');
 const audit=(await db.query("select action,actor_id from public.linkare_audit_v3 where organization_id=$1 and record_id='status-only-qa' and action='appointment.status_changed' order by id",[org])).rows;
 assert.equal(audit.length,3);assert.equal(audit.at(-1).actor_id,ids.secretary);

 await permissions('secretary',{patientsView:true,calendarDoctorView:true});
 await denied(()=>change('pending'));
 await actor('other');await denied(()=>change('pending'));
 await actor('owner');
 await assert.rejects(()=>change('arbitrary'),error=>error.code==='22023');
});

test('DB: scoped appointment deletion is recoverable, revision-safe and permission-scoped',async()=>{
 await actor('owner');
 assert.equal((await db.query("select has_function_privilege('anon','public.linkare_delete_appointment_v1(uuid,text,bigint)','EXECUTE') allowed")).rows[0].allowed,false);
 const id='delete-appointment-qa';
 const patientId='directory-no-activity';
 const payload={id,calendarId:calendarIds.doctor,eventType:'appointment',patientId,title:'Recoverable QA event',start:'2099-02-10T14:00:00Z',end:'2099-02-10T14:45:00Z',status:'pending'};
 await save([{kind:'appointment',id,expectedRevision:0,payload},{kind:'appointment_clinical',id,expectedRevision:0,payload:{notes:'Private QA note'}}]);
 const remove=async(targetOrg=org,revision=1)=>(await db.query('select public.linkare_delete_appointment_v1($1,$2,$3) data',[targetOrg,id,revision])).rows[0].data;
 const patientBefore=(await db.query("select revision from public.linkare_records where organization_id=$1 and kind='patient_admin' and id=$2",[org,patientId])).rows[0].revision;
 await permissions('secretary',{patientsView:true,calendarDoctorView:true,calendarDoctorEdit:true,calendarDoctorDelete:false});
 await denied(()=>remove());
 await permissions('secretary',{patientsView:true,calendarDoctorView:true,calendarDoctorDelete:true});
 const conflict=await remove(org,99);assert.equal(conflict.code,'REVISION_CONFLICT');assert.equal(conflict.revision,1);
 let row=(await db.query("select deleted,payload,revision from public.linkare_records where organization_id=$1 and kind='appointment' and id=$2",[org,id])).rows[0];
 assert.equal(row.deleted,false);assert.equal(row.revision,1);
 const result=await remove();assert.equal(result.deleted,true);assert.equal(result.revision,2);
 row=(await db.query("select deleted,payload,revision,updated_by from public.linkare_records where organization_id=$1 and kind='appointment' and id=$2",[org,id])).rows[0];
 assert.equal(row.deleted,true);assert.equal(row.payload.title,payload.title);assert.equal(row.payload.start,payload.start);assert.equal(row.payload.deletedBy,ids.secretary);assert.equal(row.updated_by,ids.secretary);
 assert.equal((await remove()).revision,2,'retry does not write or audit again');
 await db.exec('reset role');
 assert.equal((await db.query("select count(*)::int n from public.linkare_audit_v3 where organization_id=$1 and record_id=$2 and action='appointment.deleted'",[org,id])).rows[0].n,1);
 assert.equal((await db.query("select count(*)::int n from linkare_private.appointment_directory_v1 where organization_id=$1 and appointment_id=$2",[org,id])).rows[0].n,0);
 assert.equal((await db.query("select count(*)::int n from public.linkare_records where organization_id=$1 and kind='appointment_clinical' and id=$2 and not deleted",[org,id])).rows[0].n,1,'private history remains recoverable');
 assert.equal((await db.query("select revision from public.linkare_records where organization_id=$1 and kind='patient_admin' and id=$2",[org,patientId])).rows[0].revision,patientBefore);
 await actor('other');await denied(()=>remove(org,1));
 await actor('owner');await assert.rejects(()=>remove(otherOrg,1),error=>error.code==='P0002'||error.code==='42501');
});

test('DB: simultaneous appointment edits merge separate fields and require a choice for the same field',async()=>{
 await actor('owner');
 const id='concurrent-appointment-qa';
 await save([{kind:'appointment',id,expectedRevision:0,payload:{id,calendarId:calendarIds.doctor,eventType:'appointment',patientId:'patient',title:'Synthetic QA',start:'2099-03-10T14:00:00Z',end:'2099-03-10T14:45:00Z',type:'Seguimiento',modality:'Presencial',status:'pending',adminReviewStatus:'none',reminderLog:[{id:'existing'}]}}]);
 const patch=async(base,changes,revision=1,targetOrg=org)=>(await db.query('select public.linkare_patch_appointment_v1($1,$2,$3,$4::jsonb,$5::jsonb) data',[targetOrg,id,revision,JSON.stringify(base),JSON.stringify(changes)])).rows[0].data;
 const initial=(await load()).payload.appointments.find(item=>item.id===id);
 assert.equal((await db.query("select has_function_privilege('anon','public.linkare_patch_appointment_v1(uuid,text,bigint,jsonb,jsonb)','EXECUTE') allowed")).rows[0].allowed,false);
 await permissions('secretary',{patientsView:true,calendarDoctorView:true,calendarDoctorEdit:true});
 const first=await patch({type:'Seguimiento'},{type:'Prioritaria'});
 assert.equal(first.appointment.type,'Prioritaria');assert.equal(first.appointment.__revision,2);
 await actor('owner');
 const merged=await patch({start:initial.start,end:initial.end},{start:'2099-03-10T15:00:00Z',end:'2099-03-10T15:45:00Z'});
 assert.equal(merged.merged,true);assert.equal(merged.appointment.type,'Prioritaria');assert.equal(merged.appointment.start,'2099-03-10T15:00:00Z');
 assert.deepEqual(merged.appointment.reminderLog,[{id:'existing'}]);
 const status=await patch({status:'pending'},{status:'confirmed'},3);assert.equal(status.appointment.__revision,4);assert.equal(status.appointment.confirmedBy,ids.owner);
 await actor('secretary');
 const conflict=await patch({status:'pending'},{status:'completed'},3);
 assert.equal(conflict.code,'FIELD_CONFLICT');assert.deepEqual(conflict.fields,['status']);assert.equal(conflict.current.status,'confirmed');
 const resolved=await patch({status:'confirmed'},{status:'completed'},4);
 assert.equal(resolved.appointment.status,'completed');assert.equal(resolved.appointment.type,'Prioritaria');
 await denied(()=>patch({notes:''},{notes:'private'},5));
 await actor('other');await denied(()=>patch({status:'completed'},{status:'pending'},5));
 await actor('owner');
 const note=await patch({notes:''},{notes:'Private note A'},5);assert.equal(note.appointment.notes,'Private note A');
 const noteConflict=await patch({notes:''},{notes:'Private note B'},5);assert.equal(noteConflict.code,'FIELD_CONFLICT');assert.deepEqual(noteConflict.fields,['notes']);
 assert.equal((await load()).payload.appointments.find(item=>item.id===id).notes,'Private note A');
 await permissions('secretary',{patientsView:true,calendarDoctorView:true,calendarDoctorCancel:true});
 const cancelled=await patch({status:'completed'},{status:'cancelled'},5);
 assert.equal(cancelled.appointment.status,'cancelled');assert.equal(cancelled.appointment.cancelledBy,ids.secretary);
 await denied(()=>patch({type:'Prioritaria'},{type:'Seguimiento'},6));
});

test('DB: concurrent patient reassignment blocks stale notes or status from attaching to another patient',async()=>{
 await actor('owner');
 const id='identity-guard-appointment-qa';
 await save([
  {kind:'patient_admin',id:'identity-guard-patient-qa',expectedRevision:0,payload:{name:'Other synthetic patient'}},
  {kind:'appointment',id,expectedRevision:0,payload:{id,calendarId:calendarIds.doctor,eventType:'appointment',patientId:'patient',title:'Original synthetic patient',start:'2099-04-10T14:00:00Z',end:'2099-04-10T14:45:00Z',status:'pending'}},
 ]);
 const patch=async(base,changes,revision=1)=>(await db.query('select public.linkare_patch_appointment_v1($1,$2,$3,$4::jsonb,$5::jsonb) data',[org,id,revision,JSON.stringify(base),JSON.stringify(changes)])).rows[0].data;
 const moved=await patch({patientId:'patient',title:'Original synthetic patient'},{patientId:'identity-guard-patient-qa',title:'Other synthetic patient'});
 assert.equal(moved.saved,true);
 const stale=await patch({patientId:'patient',status:'pending'},{status:'confirmed'});
 assert.equal(stale.code,'FIELD_CONFLICT');assert.deepEqual(stale.fields,['patientId']);
 const note=await patch({patientId:'patient',notes:''},{notes:'Do not misattribute'});
 assert.equal(note.code,'FIELD_CONFLICT');assert.deepEqual(note.fields,['patientId']);
 const row=(await load()).payload.appointments.find(item=>item.id===id);
 assert.equal(row.patientId,'identity-guard-patient-qa');assert.equal(row.status,'pending');assert.equal(row.notes||'','');
});
