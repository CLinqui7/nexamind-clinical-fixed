begin;

-- The source chart remains archived. This private row records the exact
-- before-state and every moved historical identifier for recovery and audit.
create table linkare_private.patient_merge_log_v1 (
  organization_id uuid not null references public.organizations(id),
  source_patient_id text not null,
  target_patient_id text not null,
  source_admin_before jsonb not null,
  target_admin_before jsonb not null,
  source_summary_before jsonb not null,
  target_summary_before jsonb not null,
  moved_history_ids uuid[] not null default '{}',
  moved_mention_ids uuid[] not null default '{}',
  merged_at timestamptz not null default now(),
  primary key (organization_id,source_patient_id),
  check (source_patient_id<>target_patient_id)
);
create index patient_merge_log_target_v1
  on linkare_private.patient_merge_log_v1(organization_id,target_patient_id);
revoke all on linkare_private.patient_merge_log_v1 from public,anon,authenticated;
grant select on linkare_private.patient_merge_log_v1 to service_role;

-- Restricted to the service role. Only a pair with no modern clinical record
-- or dependent resource can use this conservative path.
create function linkare_private.merge_historical_duplicate_patient_v1(
  p_org uuid,p_source text,p_target text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  source_row public.linkare_records;
  target_row public.linkare_records;
  source_summary linkare_private.legacy_patient_summary_v1;
  target_summary linkare_private.legacy_patient_summary_v1;
  history_ids uuid[];
  mention_ids uuid[];
  lock_id text;
  at_time timestamptz:=clock_timestamp();
  dependency_count bigint;
begin
  if p_org is null or nullif(p_source,'') is null or nullif(p_target,'') is null
     or p_source=p_target then raise exception 'INVALID_MERGE_PAIR';end if;

  for lock_id in select unnest(array[p_source,p_target]) order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended(p_org::text||':patient_admin:'||lock_id,303));
    perform pg_advisory_xact_lock(hashtextextended(p_org::text||':patient_clinical:'||lock_id,303));
  end loop;
  select * into source_row from public.linkare_records
   where organization_id=p_org and kind='patient_admin' and id=p_source for update;
  select * into target_row from public.linkare_records
   where organization_id=p_org and kind='patient_admin' and id=p_target for update;
  if source_row.organization_id is null or target_row.organization_id is null
     or source_row.deleted or target_row.deleted
     or coalesce((source_row.payload->>'archived')::boolean,false)
     or coalesce((target_row.payload->>'archived')::boolean,false) then
    raise exception 'MERGE_PATIENT_NOT_ACTIVE';
  end if;
  if linkare_private.search_normalize_v1(source_row.payload->>'name')
       is distinct from linkare_private.search_normalize_v1(target_row.payload->>'name')
     or length(linkare_private.patient_phone_key_v1(source_row.payload->>'phone'))<8
     or linkare_private.patient_phone_key_v1(source_row.payload->>'phone')
       is distinct from linkare_private.patient_phone_key_v1(target_row.payload->>'phone') then
    raise exception 'MERGE_IDENTITY_MISMATCH';
  end if;
  if (source_row.payload-array['id','name','phone','age','createdAt','updatedAt'])
       is distinct from
     (target_row.payload-array['id','name','phone','age','createdAt','updatedAt'])
     or (nullif(source_row.payload->>'age','') is not null
       and (nullif(target_row.payload->>'age','') is null
         or source_row.payload->>'age'<>target_row.payload->>'age')) then
    raise exception 'MERGE_ADMIN_REVIEW_REQUIRED';
  end if;
  if exists(select 1 from public.linkare_records where organization_id=p_org
       and kind='patient_clinical' and id in(p_source,p_target)) then
    raise exception 'MERGE_CLINICAL_REVIEW_REQUIRED';
  end if;
  select
    (select count(*) from public.linkare_records where organization_id=p_org
      and kind in('appointment','alert') and not deleted
      and payload->>'patientId' in(p_source,p_target))
    +(select count(*) from public.linkare_generated_documents_v1 where organization_id=p_org
      and patient_id in(p_source,p_target))
    +(select count(*) from public.patient_document_audit where organization_id=p_org
      and patient_id in(p_source,p_target))
    +(select count(*) from public.linkare_notification_deliveries where organization_id=p_org
      and patient_id in(p_source,p_target))
    +(select count(*) from public.calendar_feed_tokens where organization_id=p_org
      and patient_id in(p_source,p_target))
    +(select count(*) from linkare_private.patient_consultation_fee_v1 where organization_id=p_org
      and patient_id in(p_source,p_target))
    into dependency_count;
  if dependency_count<>0 then raise exception 'MERGE_DEPENDENCY_REVIEW_REQUIRED';end if;

  select * into source_summary from linkare_private.legacy_patient_summary_v1
   where organization_id=p_org and patient_id=p_source for update;
  select * into target_summary from linkare_private.legacy_patient_summary_v1
   where organization_id=p_org and patient_id=p_target for update;
  if source_summary.patient_id is null or target_summary.patient_id is null
     or source_summary.source_summary is distinct from target_summary.source_summary then
    raise exception 'MERGE_HISTORICAL_SUMMARY_REVIEW_REQUIRED';
  end if;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into history_ids
   from linkare_private.legacy_history_v1
   where organization_id=p_org and patient_id=p_source;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into mention_ids
   from linkare_private.legacy_medication_mentions_v1
   where organization_id=p_org and patient_id=p_source;
  insert into linkare_private.patient_merge_log_v1(
    organization_id,source_patient_id,target_patient_id,source_admin_before,
    target_admin_before,source_summary_before,target_summary_before,
    moved_history_ids,moved_mention_ids,merged_at
  ) values(
    p_org,p_source,p_target,to_jsonb(source_row),to_jsonb(target_row),
    to_jsonb(source_summary),to_jsonb(target_summary),history_ids,mention_ids,at_time
  );
  update linkare_private.legacy_history_v1 set patient_id=p_target
   where organization_id=p_org and patient_id=p_source;
  update linkare_private.legacy_medication_mentions_v1 set patient_id=p_target
   where organization_id=p_org and patient_id=p_source;
  if source_summary.historical_profile is distinct from target_summary.historical_profile then
    update linkare_private.legacy_patient_summary_v1
     set historical_profile=jsonb_set(
       target_summary.historical_profile,'{mergedProfiles}',
       coalesce(target_summary.historical_profile->'mergedProfiles','[]'::jsonb)
         ||jsonb_build_array(jsonb_build_object(
           'sourcePatientId',p_source,'profile',source_summary.historical_profile
         )),true)
     where organization_id=p_org and patient_id=p_target;
  end if;
  update public.linkare_records set
    payload=source_row.payload||jsonb_build_object(
      'archived',true,'archivedAt',at_time,'archiveReason',
      'Expediente duplicado fusionado con otro','mergedInto',p_target,'updatedAt',at_time),
    revision=source_row.revision+1,updated_at=at_time,updated_by=null
   where organization_id=p_org and kind='patient_admin' and id=p_source;
  perform linkare_private.refresh_patient_v1(p_org,p_target);
  insert into public.linkare_audit_v3(
    organization_id,actor_id,action,kind,record_id,revision
  ) values(
    p_org,null,'patient.merged_historical_duplicate','patient_admin',
    p_source,source_row.revision+1
  );
  return jsonb_build_object(
    'source',p_source,'target',p_target,
    'movedHistory',cardinality(history_ids),'movedMentions',cardinality(mention_ids)
  );
end $$;
revoke all on function linkare_private.merge_historical_duplicate_patient_v1(uuid,text,text)
 from public,anon,authenticated;
grant execute on function linkare_private.merge_historical_duplicate_patient_v1(uuid,text,text)
 to service_role;

commit;
