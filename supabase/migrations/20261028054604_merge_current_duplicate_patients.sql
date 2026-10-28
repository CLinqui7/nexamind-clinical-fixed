begin;

-- The newer chart keeps its active regimen. The full older chart is stored
-- privately and exposed only to clinical viewers as historical context.
create table linkare_private.patient_clinical_merge_log_v1 (
  organization_id uuid not null references public.organizations(id),
  source_patient_id text not null,
  target_patient_id text not null,
  source_admin_before jsonb not null,
  target_admin_before jsonb not null,
  source_clinical_before jsonb,
  target_clinical_before jsonb not null,
  source_summary_before jsonb not null,
  moved_history_ids uuid[] not null default '{}',
  moved_mention_ids uuid[] not null default '{}',
  merged_at timestamptz not null default now(),
  primary key(organization_id,source_patient_id),
  check(source_patient_id<>target_patient_id)
);
create index patient_clinical_merge_target_v1 on
  linkare_private.patient_clinical_merge_log_v1(organization_id,target_patient_id);
alter table linkare_private.patient_clinical_merge_log_v1 enable row level security;
revoke all on linkare_private.patient_clinical_merge_log_v1 from public,anon,authenticated;
grant select on linkare_private.patient_clinical_merge_log_v1 to service_role;

create function linkare_private.merge_current_duplicate_patient_v1(
  p_org uuid,p_source text,p_target text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  source_admin public.linkare_records;
  target_admin public.linkare_records;
  source_clinical public.linkare_records;
  target_clinical public.linkare_records;
  source_summary linkare_private.legacy_patient_summary_v1;
  source_rx jsonb;
  target_rx jsonb;
  source_timeline jsonb;
  target_timeline jsonb;
  new_timeline jsonb;
  history_ids uuid[];
  mention_ids uuid[];
  lock_id text;
  field_name text;
  at_time timestamptz:=clock_timestamp();
  dependency_count bigint;
begin
  if p_org is null or nullif(p_source,'') is null or nullif(p_target,'') is null
    or p_source=p_target then raise exception 'INVALID_MERGE_PAIR';end if;
  for lock_id in select unnest(array[p_source,p_target]) order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended(
      p_org::text||':patient_admin:'||lock_id,303));
    perform pg_advisory_xact_lock(hashtextextended(
      p_org::text||':patient_clinical:'||lock_id,303));
  end loop;
  select * into source_admin from public.linkare_records
    where organization_id=p_org and kind='patient_admin' and id=p_source for update;
  select * into target_admin from public.linkare_records
    where organization_id=p_org and kind='patient_admin' and id=p_target for update;
  if source_admin.organization_id is null or target_admin.organization_id is null
    or source_admin.deleted or target_admin.deleted
    or coalesce((source_admin.payload->>'archived')::boolean,false)
    or coalesce((target_admin.payload->>'archived')::boolean,false) then
    raise exception 'MERGE_PATIENT_NOT_ACTIVE';
  end if;
  if linkare_private.search_normalize_v1(source_admin.payload->>'name')
      is distinct from linkare_private.search_normalize_v1(target_admin.payload->>'name')
    or length(linkare_private.patient_phone_key_v1(source_admin.payload->>'phone'))<8
    or linkare_private.patient_phone_key_v1(source_admin.payload->>'phone')
      is distinct from linkare_private.patient_phone_key_v1(target_admin.payload->>'phone') then
    raise exception 'MERGE_IDENTITY_MISMATCH';
  end if;
  select * into source_clinical from public.linkare_records
    where organization_id=p_org and kind='patient_clinical' and id=p_source for update;
  select * into target_clinical from public.linkare_records
    where organization_id=p_org and kind='patient_clinical' and id=p_target
      and not deleted for update;
  if target_clinical.organization_id is null
    or (source_clinical.organization_id is not null and source_clinical.deleted)
    or greatest(target_admin.updated_at,target_clinical.updated_at)
      <=greatest(source_admin.updated_at,
        coalesce(source_clinical.updated_at,source_admin.updated_at)) then
    raise exception 'MERGE_NEWER_CHART_REQUIRED';
  end if;
  if source_clinical.organization_id is not null then
    for field_name in select unnest(array[
      'adverseEvents','assessments','consultationRetractions','consultations',
      'documents','followUps','labs','medicationEvents','notes','vitalsHistory'
    ]) loop
      if jsonb_typeof(coalesce(source_clinical.payload->field_name,'[]'::jsonb))<>'array'
        or jsonb_array_length(coalesce(source_clinical.payload->field_name,'[]'::jsonb))>0 then
        raise exception 'MERGE_CLINICAL_RESOURCE_REVIEW_REQUIRED:%',field_name;
      end if;
    end loop;
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
    +(select count(*) from linkare_private.legacy_medication_group_edits_v1
      where organization_id=p_org and patient_id in(p_source,p_target))
    into dependency_count;
  if dependency_count<>0 then raise exception 'MERGE_DEPENDENCY_REVIEW_REQUIRED';end if;
  select * into source_summary from linkare_private.legacy_patient_summary_v1
    where organization_id=p_org and patient_id=p_source for update;
  if source_summary.patient_id is null or exists(
    select 1 from linkare_private.legacy_patient_summary_v1
      where organization_id=p_org and patient_id=p_target
  ) then raise exception 'MERGE_HISTORICAL_SUMMARY_REVIEW_REQUIRED';end if;
  source_rx:=coalesce(source_clinical.payload->'prescriptions','[]'::jsonb);
  target_rx:=coalesce(target_clinical.payload->'prescriptions','[]'::jsonb);
  source_timeline:=coalesce(source_clinical.payload->'timeline','[]'::jsonb);
  target_timeline:=coalesce(target_clinical.payload->'timeline','[]'::jsonb);
  if jsonb_typeof(source_rx)<>'array' or jsonb_typeof(target_rx)<>'array'
    or jsonb_typeof(source_timeline)<>'array'
    or jsonb_typeof(target_timeline)<>'array' then
    raise exception 'MERGE_INVALID_CLINICAL_ARRAY';
  end if;
  if exists(select 1 from jsonb_array_elements(source_rx) s
    join jsonb_array_elements(target_rx) t
      on s.value->>'id'=t.value->>'id') then
    raise exception 'MERGE_PRESCRIPTION_ID_CONFLICT';
  end if;
  select coalesce(jsonb_agg(s.value order by s.ordinality),'[]'::jsonb)
    into new_timeline
  from jsonb_array_elements(source_timeline) with ordinality s(value,ordinality)
  where not exists(select 1 from jsonb_array_elements(target_timeline) t
    where t.value=s.value);
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into history_ids
    from linkare_private.legacy_history_v1
    where organization_id=p_org and patient_id=p_source;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into mention_ids
    from linkare_private.legacy_medication_mentions_v1
    where organization_id=p_org and patient_id=p_source;
  insert into linkare_private.patient_clinical_merge_log_v1(
    organization_id,source_patient_id,target_patient_id,source_admin_before,
    target_admin_before,source_clinical_before,target_clinical_before,
    source_summary_before,moved_history_ids,moved_mention_ids,merged_at
  ) values(
    p_org,p_source,p_target,to_jsonb(source_admin),to_jsonb(target_admin),
    case when source_clinical.organization_id is null then null
      else to_jsonb(source_clinical) end,
    to_jsonb(target_clinical),to_jsonb(source_summary),
    history_ids,mention_ids,at_time
  );
  if source_clinical.organization_id is not null then
    update public.linkare_records set
      payload=target_clinical.payload||jsonb_build_object(
        'prescriptions',target_rx||source_rx,
        'timeline',target_timeline||new_timeline
      ),
      revision=target_clinical.revision+1,updated_at=at_time,updated_by=null
    where organization_id=p_org and kind='patient_clinical' and id=p_target;
    insert into public.linkare_audit_v3(
      organization_id,actor_id,action,kind,record_id,revision
    ) values(
      p_org,null,'patient.clinical_history_merged','patient_clinical',
      p_target,target_clinical.revision+1
    );
  end if;
  update linkare_private.legacy_history_v1 set patient_id=p_target
    where organization_id=p_org and patient_id=p_source;
  update linkare_private.legacy_medication_mentions_v1 set patient_id=p_target
    where organization_id=p_org and patient_id=p_source;
  insert into linkare_private.legacy_patient_summary_v1(
    organization_id,patient_id,batch_id,data_quality,source_summary,
    historical_profile
  ) values(
    p_org,p_target,source_summary.batch_id,source_summary.data_quality,
    source_summary.source_summary,
    case when nullif(source_admin.payload->>'age','') is null then
      source_summary.historical_profile
    else jsonb_set(source_summary.historical_profile,'{mergedRecordAge}',
      to_jsonb(source_admin.payload->>'age'),true) end
  );
  update public.linkare_records set
    payload=source_admin.payload||jsonb_build_object(
      'archived',true,'archivedAt',at_time,'archiveReason',
      'Expediente duplicado fusionado con otro','mergedInto',p_target,'updatedAt',at_time),
    revision=source_admin.revision+1,updated_at=at_time,updated_by=null
  where organization_id=p_org and kind='patient_admin' and id=p_source;
  perform linkare_private.refresh_patient_v1(p_org,p_target);
  insert into public.linkare_audit_v3(
    organization_id,actor_id,action,kind,record_id,revision
  ) values(
    p_org,null,'patient.merged_current_duplicate','patient_admin',
    p_source,source_admin.revision+1
  );
  return jsonb_build_object(
    'source',p_source,'target',p_target,'currentMedicationsRetained',
    jsonb_array_length(coalesce(target_clinical.payload->'medications','[]'::jsonb)),
    'priorMedicationsPreserved',
    jsonb_array_length(coalesce(source_clinical.payload->'medications','[]'::jsonb)),
    'prescriptionsMoved',jsonb_array_length(source_rx),
    'historyMoved',cardinality(history_ids),
    'mentionsMoved',cardinality(mention_ids)
  );
end $$;
revoke all on function linkare_private.merge_current_duplicate_patient_v1(uuid,text,text)
  from public,anon,authenticated;
grant execute on function linkare_private.merge_current_duplicate_patient_v1(uuid,text,text)
  to service_role;

create function public.linkare_merged_clinical_history_v1(
  org uuid,p_patient_id text
)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare items jsonb;
begin
  if auth.uid() is null
    or not public.linkare_permission_v3(org,'patientsView')
    or not public.linkare_permission_v3(org,'clinicalView') then
    raise exception 'ACCESS_DENIED' using errcode='42501';
  end if;
  if not exists(select 1 from public.linkare_records
    where organization_id=org and kind='patient_admin' and id=p_patient_id
      and not deleted) then raise exception 'PATIENT_NOT_FOUND';end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'sourcePatientId',source_patient_id,'mergedAt',merged_at,
    'previousAge',source_admin_before#>>'{payload,age}',
    'clinical',source_clinical_before->'payload'
  ) order by merged_at),'[]'::jsonb)
  into items from linkare_private.patient_clinical_merge_log_v1
  where organization_id=org and target_patient_id=p_patient_id;
  return items;
end $$;
revoke all on function public.linkare_merged_clinical_history_v1(uuid,text)
  from public,anon;
grant execute on function public.linkare_merged_clinical_history_v1(uuid,text)
  to authenticated;
notify pgrst,'reload schema';
commit;
