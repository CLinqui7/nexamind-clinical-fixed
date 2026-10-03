begin;

create schema if not exists linkare_private;

create table linkare_private.legacy_migration_batches_v2 (
 batch_id uuid primary key,
 organization_id uuid not null references public.organizations(id),
 source_system text not null check(length(source_system) between 2 and 80),
 backup_sha text not null check(backup_sha ~ '^[0-9a-f]{64}$'),
 plan_sha text not null check(plan_sha ~ '^[0-9a-f]{64}$'),
 approved_commit text not null check(approved_commit ~ '^[0-9a-f]{40}$'),
 source_summary jsonb not null check(jsonb_typeof(source_summary)='object'),
 status text not null default 'prepared' check(status in('prepared','running','completed','validation_failed','rolled_back')),
 applied_rows bigint not null default 0,
 imported_patients bigint not null default 0,
 imported_history bigint not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 completed_at timestamptz,
 rolled_back_at timestamptz
);
create unique index legacy_migration_active_backup_v2 on linkare_private.legacy_migration_batches_v2(organization_id,source_system,backup_sha) where status<>'rolled_back';

create table linkare_private.legacy_source_records_v2 (
 batch_id uuid not null references linkare_private.legacy_migration_batches_v2(batch_id) on delete restrict,
 organization_id uuid not null references public.organizations(id),
 source_system text not null,
 source_table text not null check(length(source_table) between 1 and 80),
 source_row bigint not null check(source_row>0),
 source_key_hash text not null check(source_key_hash ~ '^[0-9a-f]{64}$'),
 source_fingerprint text not null check(source_fingerprint ~ '^[0-9a-f]{64}$'),
 disposition text not null check(length(disposition) between 1 and 100),
 destination_kind text,
 destination_id text,
 destination_fingerprint text,
 rolled_back boolean not null default false,
 created_at timestamptz not null default now(),
 primary key(batch_id,source_table,source_key_hash)
);
create unique index legacy_source_active_identity_v2 on linkare_private.legacy_source_records_v2(organization_id,source_system,source_table,source_key_hash) where not rolled_back;
create index legacy_source_batch_v2 on linkare_private.legacy_source_records_v2(batch_id,disposition);

create table linkare_private.legacy_patient_summary_v1 (
 organization_id uuid not null references public.organizations(id),
 patient_id text not null,
 batch_id uuid not null references linkare_private.legacy_migration_batches_v2(batch_id),
 data_quality text not null default 'historical' check(data_quality='historical'),
 source_summary jsonb not null default '{}' check(jsonb_typeof(source_summary)='object'),
 historical_profile jsonb not null default '{}' check(jsonb_typeof(historical_profile)='object'),
 created_at timestamptz not null default now(),
 primary key(organization_id,patient_id)
);

create table linkare_private.legacy_history_v1 (
 id uuid primary key,
 organization_id uuid not null references public.organizations(id),
 patient_id text not null,
 batch_id uuid not null references linkare_private.legacy_migration_batches_v2(batch_id),
 scope text not null check(scope in('administrative','clinical')),
 occurred_on date,
 title text not null check(length(title) between 1 and 180),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=1000000),
 source_table text not null,
 source_key_hash text not null check(source_key_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 unique(organization_id,id)
);
create index legacy_history_patient_v1 on linkare_private.legacy_history_v1(organization_id,patient_id,occurred_on desc,id);

revoke all on all tables in schema linkare_private from public,anon,authenticated;
grant usage on schema linkare_private to service_role;
grant all on linkare_private.legacy_migration_batches_v2,linkare_private.legacy_source_records_v2,linkare_private.legacy_patient_summary_v1,linkare_private.legacy_history_v1 to service_role;

create function public.linkare_legacy_start_v2(org uuid,p_batch_id uuid,p_source_system text,p_backup_sha text,p_plan_sha text,p_approved_commit text,p_source_summary jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing linkare_private.legacy_migration_batches_v2;
begin
 if org is null or not exists(select 1 from public.organizations where id=org) then raise exception 'ORGANIZATION_NOT_FOUND';end if;
 if p_batch_id is null or p_source_system !~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$' or p_backup_sha !~ '^[0-9a-f]{64}$' or p_plan_sha !~ '^[0-9a-f]{64}$' or p_approved_commit !~ '^[0-9a-f]{40}$' or jsonb_typeof(p_source_summary)<>'object' then raise exception 'INVALID_MIGRATION_MANIFEST';end if;
 if coalesce((p_source_summary->>'sourceRows')::bigint,0)<1 or p_source_summary->>'backupSha'<>p_backup_sha or p_source_summary->>'planSha'<>p_plan_sha then raise exception 'MANIFEST_MISMATCH';end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text||':'||p_source_system||':'||p_backup_sha,947));
 select * into existing from linkare_private.legacy_migration_batches_v2 where batch_id=p_batch_id;
 if found then
  if existing.organization_id<>org or existing.source_system<>p_source_system or existing.backup_sha<>p_backup_sha or existing.plan_sha<>p_plan_sha or existing.approved_commit<>p_approved_commit then raise exception 'BATCH_IDENTITY_MISMATCH';end if;
  if existing.status in('completed','rolled_back') then raise exception 'BATCH_NOT_RESUMABLE';end if;
  return jsonb_build_object('batchId',p_batch_id,'resumed',true,'status',existing.status,'appliedRows',existing.applied_rows);
 end if;
 insert into linkare_private.legacy_migration_batches_v2(batch_id,organization_id,source_system,backup_sha,plan_sha,approved_commit,source_summary) values(p_batch_id,org,p_source_system,p_backup_sha,p_plan_sha,p_approved_commit,p_source_summary);
 return jsonb_build_object('batchId',p_batch_id,'resumed',false,'status','prepared','appliedRows',0);
end $$;

create function public.linkare_legacy_apply_v2(org uuid,p_batch_id uuid,p_backup_sha text,p_records jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare batch linkare_private.legacy_migration_batches_v2;item jsonb;entry jsonb;existing linkare_private.legacy_source_records_v2;inserted boolean;v_source_table text;v_source_hash text;v_source_fingerprint text;v_disposition text;v_destination_kind text;v_destination_id text;patient_payload jsonb;public_payload jsonb;summary_payload jsonb;history_count integer:=0;patient_count integer:=0;row_count integer:=0;
begin
 select * into batch from linkare_private.legacy_migration_batches_v2 where batch_id=p_batch_id and organization_id=org for update;
 if not found or batch.backup_sha<>p_backup_sha then raise exception 'BATCH_NOT_FOUND';end if;
 if batch.status not in('prepared','running') then raise exception 'BATCH_NOT_WRITABLE';end if;
 if p_records is null or jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records) not between 1 and 100 or octet_length(p_records::text)>12000000 then raise exception 'INVALID_IMPORT_CHUNK';end if;
 update linkare_private.legacy_migration_batches_v2 set status='running',updated_at=now() where batch_id=p_batch_id;
 for item in select value from jsonb_array_elements(p_records) loop
  if jsonb_typeof(item)<>'object' or item->>'organizationId'<>org::text or octet_length(item::text)>1500000 then raise exception 'INVALID_SOURCE_RECORD';end if;
  v_source_table:=item->>'sourceTable';v_source_hash:=item->>'sourceKeyHash';v_source_fingerprint:=item->>'sourceFingerprint';v_disposition:=item->>'disposition';v_destination_kind:=nullif(item->>'destinationKind','');v_destination_id:=nullif(item->>'destinationId','');
  if v_source_table is null or length(v_source_table) not between 1 and 80 or v_source_hash !~ '^[0-9a-f]{64}$' or v_source_fingerprint !~ '^[0-9a-f]{64}$' or v_disposition is null or length(v_disposition)>100 or coalesce((item->>'sourceRow')::bigint,0)<1 then raise exception 'INVALID_SOURCE_IDENTITY';end if;
  select * into existing from linkare_private.legacy_source_records_v2 source where source.organization_id=org and source.source_system=batch.source_system and source.source_table=v_source_table and source.source_key_hash=v_source_hash and not source.rolled_back;
  if found then
   if existing.batch_id<>p_batch_id or existing.source_fingerprint<>v_source_fingerprint or existing.disposition<>v_disposition then raise exception 'SOURCE_IDENTITY_CONFLICT';end if;
   continue;
  end if;
  inserted:=false;
  insert into linkare_private.legacy_source_records_v2(batch_id,organization_id,source_system,source_table,source_row,source_key_hash,source_fingerprint,disposition,destination_kind,destination_id)
   values(p_batch_id,org,batch.source_system,v_source_table,(item->>'sourceRow')::bigint,v_source_hash,v_source_fingerprint,v_disposition,v_destination_kind,v_destination_id) returning true into inserted;
  if not inserted then raise exception 'SOURCE_LEDGER_WRITE_FAILED';end if;
  row_count:=row_count+1;
  if v_destination_kind='patient_admin' then
   if v_destination_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'INVALID_PATIENT_DESTINATION';end if;
   patient_payload:=item->'payload';
   if jsonb_typeof(patient_payload)<>'object' or patient_payload->>'id'<>v_destination_id or nullif(trim(patient_payload->>'name'),'') is null or patient_payload->>'dataQuality'<>'historical' or coalesce((patient_payload#>>'{notificationPreferences,enabled}')::boolean,false) then raise exception 'INVALID_HISTORICAL_PATIENT';end if;
   if exists(select 1 from public.linkare_records where organization_id=org and kind='patient_admin' and id=v_destination_id) then raise exception 'DESTINATION_COLLISION';end if;
   public_payload:=public.linkare_pick_v3(patient_payload,array['id','name','initials','age','phone','email','photo','insurance','nextVisit','archived','archivedAt','archivedBy','archiveReason','createdAt','updatedAt','notificationPreferences'])||jsonb_build_object('id',v_destination_id);
   insert into public.linkare_records(organization_id,kind,id,payload,revision,deleted,updated_by) values(org,'patient_admin',v_destination_id,public_payload,1,false,null);
   summary_payload:=jsonb_build_object('dataQuality','historical','sourceSummary',coalesce(patient_payload->'sourceSummary','{}'),'historicalProfile',coalesce(patient_payload->'historicalProfile','{}'));
   insert into linkare_private.legacy_patient_summary_v1(organization_id,patient_id,batch_id,data_quality,source_summary,historical_profile) values(org,v_destination_id,p_batch_id,'historical',summary_payload->'sourceSummary',summary_payload->'historicalProfile');
   update linkare_private.legacy_source_records_v2 source set destination_fingerprint=encode(sha256(convert_to(public_payload::text,'UTF8')),'hex') where source.batch_id=p_batch_id and source.source_table=v_source_table and source.source_key_hash=v_source_hash;
   insert into public.linkare_audit_v3(organization_id,actor_id,action,kind,record_id,revision,fingerprint) values(org,null,'legacy.patient_imported','patient_admin',v_destination_id,1,encode(sha256(convert_to(public_payload::text,'UTF8')),'hex'));
   patient_count:=patient_count+1;
  elsif v_destination_kind is not null and v_destination_kind<>'legacy_history' then raise exception 'DESTINATION_KIND_NOT_ALLOWED';
  end if;
  if jsonb_typeof(coalesce(item->'historyEntries','[]'))<>'array' then raise exception 'INVALID_HISTORY_ENTRIES';end if;
  for entry in select value from jsonb_array_elements(coalesce(item->'historyEntries','[]')) loop
   if entry->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or entry->>'patientId' !~ '^[0-9a-f-]{36}$' or entry->>'scope' not in('administrative','clinical') or nullif(trim(entry->>'title'),'') is null or jsonb_typeof(entry->'payload')<>'object' then raise exception 'INVALID_HISTORY_ENTRY';end if;
   if not exists(select 1 from public.linkare_records where organization_id=org and kind='patient_admin' and id=entry->>'patientId' and not deleted) then raise exception 'HISTORY_PATIENT_NOT_FOUND';end if;
   insert into linkare_private.legacy_history_v1(id,organization_id,patient_id,batch_id,scope,occurred_on,title,payload,source_table,source_key_hash)
    values((entry->>'id')::uuid,org,entry->>'patientId',p_batch_id,entry->>'scope',nullif(entry->>'occurredOn','')::date,entry->>'title',entry->'payload',v_source_table,v_source_hash)
    on conflict(organization_id,id) do nothing;
   history_count:=history_count+1;
  end loop;
 end loop;
 update linkare_private.legacy_migration_batches_v2 set applied_rows=applied_rows+row_count,imported_patients=imported_patients+patient_count,imported_history=imported_history+history_count,updated_at=now() where batch_id=p_batch_id;
 return jsonb_build_object('acceptedRows',row_count,'importedPatients',patient_count,'importedHistory',history_count,'batchId',p_batch_id);
end $$;

create function public.linkare_legacy_verify_v2(org uuid,p_batch_id uuid,p_backup_sha text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare batch linkare_private.legacy_migration_batches_v2;ledger bigint;patients bigint;histories bigint;orphans bigint;expected bigint;dispositions jsonb;ok boolean;
begin
 select * into batch from linkare_private.legacy_migration_batches_v2 where batch_id=p_batch_id and organization_id=org for update;
 if not found or batch.backup_sha<>p_backup_sha then raise exception 'BATCH_NOT_FOUND';end if;
 select count(*) into ledger from linkare_private.legacy_source_records_v2 where batch_id=p_batch_id and not rolled_back;
 select count(*) into patients from linkare_private.legacy_patient_summary_v1 s join public.linkare_records r on r.organization_id=s.organization_id and r.kind='patient_admin' and r.id=s.patient_id and not r.deleted where s.batch_id=p_batch_id;
 select count(*) into histories from linkare_private.legacy_history_v1 where batch_id=p_batch_id;
 select count(*) into orphans from linkare_private.legacy_history_v1 h where h.batch_id=p_batch_id and not exists(select 1 from public.linkare_records r where r.organization_id=h.organization_id and r.kind='patient_admin' and r.id=h.patient_id and not r.deleted);
 select coalesce(jsonb_object_agg(disposition,total),'{}') into dispositions from(select disposition,count(*) total from linkare_private.legacy_source_records_v2 where batch_id=p_batch_id and not rolled_back group by disposition) grouped;
 expected:=(batch.source_summary->>'sourceRows')::bigint;ok:=ledger=expected and patients=batch.imported_patients and histories=batch.imported_history and orphans=0;
 update linkare_private.legacy_migration_batches_v2 set status=case when ok then 'completed' else 'validation_failed' end,completed_at=case when ok then now() else null end,updated_at=now() where batch_id=p_batch_id;
 return jsonb_build_object('ok',ok,'sourceRows',ledger,'expectedSourceRows',expected,'patients',patients,'historyEntries',histories,'orphanHistory',orphans,'dispositions',dispositions,'appointmentsCreated',0,'notificationsCreated',0,'activeMedicationsCreated',0);
end $$;

create function public.linkare_legacy_rollback_v2(org uuid,p_batch_id uuid,p_backup_sha text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare batch linkare_private.legacy_migration_batches_v2;conflicts bigint;patients bigint;histories bigint;
begin
 select * into batch from linkare_private.legacy_migration_batches_v2 where batch_id=p_batch_id and organization_id=org for update;
 if not found or batch.backup_sha<>p_backup_sha then raise exception 'BATCH_NOT_FOUND';end if;
 if batch.status='rolled_back' then return jsonb_build_object('ok',true,'alreadyRolledBack',true);end if;
 select count(*) into conflicts from linkare_private.legacy_source_records_v2 source join public.linkare_records record on record.organization_id=source.organization_id and record.kind='patient_admin' and record.id=source.destination_id where source.batch_id=p_batch_id and source.destination_kind='patient_admin' and (record.revision<>1 or source.destination_fingerprint is distinct from encode(sha256(convert_to(record.payload::text,'UTF8')),'hex') or exists(select 1 from public.linkare_records dependent where dependent.organization_id=org and dependent.id=record.id and dependent.kind='patient_clinical') or exists(select 1 from public.linkare_records appointment where appointment.organization_id=org and appointment.kind='appointment' and not appointment.deleted and appointment.payload->>'patientId'=record.id));
 if conflicts>0 then raise exception 'ROLLBACK_CONFLICT:%',conflicts;end if;
 select count(*) into histories from linkare_private.legacy_history_v1 where batch_id=p_batch_id;delete from linkare_private.legacy_history_v1 where batch_id=p_batch_id;
 delete from linkare_private.legacy_patient_summary_v1 where batch_id=p_batch_id;
 with removed as(delete from public.linkare_records record using linkare_private.legacy_source_records_v2 source where source.batch_id=p_batch_id and source.destination_kind='patient_admin' and record.organization_id=source.organization_id and record.kind='patient_admin' and record.id=source.destination_id returning record.id) select count(*) into patients from removed;
 update linkare_private.legacy_source_records_v2 set rolled_back=true where batch_id=p_batch_id;
 update linkare_private.legacy_migration_batches_v2 set status='rolled_back',rolled_back_at=now(),updated_at=now() where batch_id=p_batch_id;
 insert into public.linkare_audit_v3(organization_id,actor_id,action,kind,record_id,revision,fingerprint) values(org,null,'legacy.batch_rolled_back','legacy_batch',p_batch_id::text,null,p_backup_sha);
 return jsonb_build_object('ok',true,'patientsRemoved',patients,'historyRemoved',histories,'conflicts',0);
end $$;

revoke all on function public.linkare_legacy_start_v2(uuid,uuid,text,text,text,text,jsonb),public.linkare_legacy_apply_v2(uuid,uuid,text,jsonb),public.linkare_legacy_verify_v2(uuid,uuid,text),public.linkare_legacy_rollback_v2(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.linkare_legacy_start_v2(uuid,uuid,text,text,text,text,jsonb),public.linkare_legacy_apply_v2(uuid,uuid,text,jsonb),public.linkare_legacy_verify_v2(uuid,uuid,text),public.linkare_legacy_rollback_v2(uuid,uuid,text) to service_role;

create function public.linkare_legacy_patient_history_v1(org uuid,p_patient_id text,p_offset integer default 0,p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare can_admin boolean:=public.linkare_permission_v3(org,'patientsView');can_clinical boolean:=public.linkare_permission_v3(org,'clinicalView');total bigint;items jsonb;
begin
 if not can_admin then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 if p_patient_id is null or p_offset<0 or p_limit not between 1 and 200 or not exists(select 1 from public.linkare_records where organization_id=org and kind='patient_admin' and id=p_patient_id and not deleted) then raise exception 'PATIENT_NOT_FOUND';end if;
 select count(*) into total from linkare_private.legacy_history_v1 where organization_id=org and patient_id=p_patient_id and (scope='administrative' or can_clinical);
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'scope',scope,'occurredOn',occurred_on,'title',title,'payload',payload) order by occurred_on desc nulls last,id desc),'[]') into items from(select * from linkare_private.legacy_history_v1 where organization_id=org and patient_id=p_patient_id and (scope='administrative' or can_clinical) order by occurred_on desc nulls last,id desc offset p_offset limit p_limit) page;
 return jsonb_build_object('items',items,'total',total,'offset',p_offset,'limit',p_limit,'hasMore',p_offset+jsonb_array_length(items)<total,'clinicalIncluded',can_clinical);
end $$;
revoke all on function public.linkare_legacy_patient_history_v1(uuid,text,integer,integer) from public,anon;
grant execute on function public.linkare_legacy_patient_history_v1(uuid,text,integer,integer) to authenticated,service_role;

-- Add immutable source metadata to loaded patients without exposing private history in the bulk state response.
alter function public.linkare_load_state_v3(uuid) rename to linkare_load_state_pre_history_v3;
revoke all on function public.linkare_load_state_pre_history_v3(uuid) from public,anon,authenticated;
create function public.linkare_load_state_v3(org uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;patients jsonb;
begin
 result:=public.linkare_load_state_pre_history_v3(org);
 select coalesce(jsonb_agg(patient.value||case when summary.patient_id is null then '{}'::jsonb else jsonb_build_object('dataQuality',summary.data_quality,'sourceSummary',summary.source_summary,'historicalProfile',summary.historical_profile) end order by patient.ordinality),'[]'::jsonb) into patients
 from jsonb_array_elements(coalesce(result#>'{payload,patients}','[]')) with ordinality patient(value,ordinality)
 left join linkare_private.legacy_patient_summary_v1 summary on summary.organization_id=org and summary.patient_id=patient.value->>'id';
 return jsonb_set(result,'{payload,patients}',patients,true);
end $$;
revoke all on function public.linkare_load_state_v3(uuid) from public,anon;
grant execute on function public.linkare_load_state_v3(uuid) to authenticated,service_role;

-- A user with Cancel but without Edit may change only cancellation metadata.
alter function public.linkare_save_changes_v3(uuid,jsonb) rename to linkare_save_changes_pre_cancel_guard_v3;
revoke all on function public.linkare_save_changes_pre_cancel_guard_v3(uuid,jsonb) from public,anon,authenticated;
create function public.linkare_save_changes_v3(org uuid,changes jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb;sanitized jsonb:='[]';old public.linkare_records;incoming jsonb;calendar_id uuid;
begin
 if changes is null or jsonb_typeof(changes)<>'array' then raise exception 'INVALID_BATCH';end if;
 for item in select value from jsonb_array_elements(changes) loop
  if item->>'kind'='appointment' and coalesce((item->>'deleted')::boolean,false)=false then
   select * into old from public.linkare_records where organization_id=org and kind='appointment' and id=item->>'id' and not deleted;
   incoming:=coalesce(item->'payload','{}');
   if found and incoming->>'status'='cancelled' and old.payload->>'status' is distinct from 'cancelled' then
    begin calendar_id:=(old.payload->>'calendarId')::uuid;exception when others then raise exception 'CALENDAR_REQUIRED';end;
    if (incoming-array['status','cancelledAt','cancelledBy','updatedAt']) is distinct from (old.payload-array['status','cancelledAt','cancelledBy','updatedAt']) and not public.linkare_calendar_permission_v1(org,calendar_id,'Edit') then raise exception 'CANCEL_CANNOT_EDIT_APPOINTMENT' using errcode='42501';end if;
    incoming:=incoming||jsonb_build_object('status','cancelled','cancelledAt',now(),'cancelledBy',(select auth.uid()),'updatedAt',now());
    item:=jsonb_set(item,'{payload}',incoming,true);
   end if;
  end if;
  sanitized:=sanitized||jsonb_build_array(item);
 end loop;
 return public.linkare_save_changes_pre_cancel_guard_v3(org,sanitized);
end $$;
revoke all on function public.linkare_save_changes_v3(uuid,jsonb) from public,anon;
grant execute on function public.linkare_save_changes_v3(uuid,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
