begin;

-- FoxPro mentions remain immutable evidence. Only a clinician's explicit,
-- source-linked decision can create a modern medication; the original text
-- and every pre-existing medication remain untouched.
alter table linkare_private.legacy_medication_mentions_v1
  drop constraint if exists legacy_medication_mentions_v1_review_status_check;
alter table linkare_private.legacy_medication_mentions_v1
  add constraint legacy_medication_mentions_v1_review_status_check
  check (review_status in ('unreviewed','confirmed_current','not_current'));
alter table linkare_private.legacy_medication_mentions_v1
  add column reviewed_by uuid references auth.users(id),
  add column reviewed_at timestamptz,
  add column review_note text check (length(review_note)<=500),
  add column linked_medication_id text;

create function public.linkare_review_legacy_medication_v1(
  p_org uuid,p_patient_id text,p_mention_id uuid,p_decision text,p_medication jsonb default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  mention linkare_private.legacy_medication_mentions_v1;
  clinical public.linkare_records;
  medicines jsonb;
  medicine jsonb;
  medicine_id text;
  at_time timestamptz:=clock_timestamp();
  next_revision bigint;
  dose_value text;
  medicine_name text;
  dose_unit text;
  frequency_text text;
  route_text text;
  start_text text;
  start_on date;
  review_note_text text;
begin
  if auth.uid() is null or public.linkare_role_v3(p_org) not in ('owner','psychiatrist','doctor')
    or not public.linkare_permission_v3(p_org,'clinicalView')
    or not public.linkare_permission_v3(p_org,'medicationsManage') then
    raise exception 'ACCESS_DENIED' using errcode='42501';
  end if;
  if not public.linkare_entitled_v3(p_org) then raise exception 'SUBSCRIPTION_REQUIRED'; end if;
  if p_decision is null or p_decision not in ('activate','not_current') or p_mention_id is null or nullif(p_patient_id,'') is null then
    raise exception 'INVALID_REVIEW';
  end if;
  if not exists(select 1 from public.linkare_records
    where organization_id=p_org and kind='patient_admin' and id=p_patient_id and not deleted) then
    raise exception 'PATIENT_NOT_FOUND';
  end if;
  select * into mention from linkare_private.legacy_medication_mentions_v1
   where organization_id=p_org and patient_id=p_patient_id and id=p_mention_id for update;
  if not found then raise exception 'MENTION_NOT_FOUND'; end if;
  if mention.review_status<>'unreviewed' then
    if (mention.review_status='confirmed_current' and p_decision='activate')
      or (mention.review_status='not_current' and p_decision='not_current') then
      return jsonb_build_object('ok',true,'duplicate',true,'reviewStatus',mention.review_status,
        'medicationId',mention.linked_medication_id);
    end if;
    raise exception 'REVIEW_ALREADY_DECIDED';
  end if;

  review_note_text:=left(btrim(coalesce(p_medication->>'reviewNote','')),500);
  if p_decision='not_current' then
    update linkare_private.legacy_medication_mentions_v1
      set review_status='not_current',reviewed_by=auth.uid(),reviewed_at=at_time,
          review_note=nullif(review_note_text,'')
      where organization_id=p_org and id=p_mention_id;
    insert into public.linkare_audit_v3(organization_id,actor_id,action,kind,record_id,fingerprint)
      values(p_org,auth.uid(),'legacy_medication.not_current','patient_clinical',p_patient_id,
        encode(sha256(convert_to(p_mention_id::text,'UTF8')),'hex'));
    return jsonb_build_object('ok',true,'duplicate',false,'reviewStatus','not_current');
  end if;

  if jsonb_typeof(p_medication) is distinct from 'object' or octet_length(p_medication::text)>8000
    or p_medication->'confirmedCurrent' is distinct from 'true'::jsonb then
    raise exception 'CURRENT_USE_CONFIRMATION_REQUIRED';
  end if;
  medicine_name:=btrim(coalesce(p_medication->>'name',''));
  dose_value:=replace(regexp_replace(btrim(coalesce(p_medication->>'doseValue','')),'[[:space:]]+','','g'),',','.');
  dose_unit:=btrim(coalesce(p_medication->>'doseUnit',''));
  frequency_text:=btrim(coalesce(p_medication->>'frequency',''));
  route_text:=btrim(coalesce(p_medication->>'route',''));
  if length(medicine_name) not between 2 and 160 or length(dose_value) not between 1 and 40
    or dose_value !~ '^[0-9]+(\.[0-9]+)?(-[0-9]+(\.[0-9]+)?)*$'
    or not exists(select 1 from unnest(string_to_array(dose_value,'-')) part where part::numeric>0)
    or length(dose_unit) not between 1 and 30 or length(frequency_text) not between 3 and 120
    or length(route_text) not between 2 and 80
    or length(coalesce(p_medication->>'indication',''))>500
    or length(coalesce(p_medication->>'notes',''))>1000 then
    raise exception 'INVALID_CONFIRMED_MEDICATION';
  end if;
  start_text:=nullif(btrim(coalesce(p_medication->>'startDate','')),'');
  if start_text is not null then
    if start_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'INVALID_START_DATE'; end if;
    start_on:=start_text::date;
    if to_char(start_on,'YYYY-MM-DD')<>start_text
      or start_on>(at_time at time zone 'America/El_Salvador')::date then
      raise exception 'INVALID_START_DATE';
    end if;
  end if;

  -- Use the same record-level lock as linkare_save_changes_v3. A second
  -- reviewer cannot overwrite or duplicate the first review.
  perform pg_advisory_xact_lock(hashtextextended(p_org::text||':patient_clinical:'||p_patient_id,303));
  select * into clinical from public.linkare_records
    where organization_id=p_org and kind='patient_clinical' and id=p_patient_id for update;
  if found and clinical.deleted then raise exception 'PATIENT_CLINICAL_ARCHIVED'; end if;
  medicines:=coalesce(clinical.payload->'medications','[]'::jsonb);
  if jsonb_typeof(medicines)<>'array' then raise exception 'INVALID_CLINICAL_ARRAY'; end if;
  if exists(select 1 from jsonb_array_elements(medicines) as current_med(value)
      where nullif(current_med.value->>'archivedAt','') is null
        and lower(btrim(regexp_replace(current_med.value->>'name','[[:space:]]+',' ','g')))
          =lower(btrim(regexp_replace(medicine_name,'[[:space:]]+',' ','g')))) then
    raise exception 'MEDICATION_ALREADY_PRESENT';
  end if;

  medicine_id:='medication_'||gen_random_uuid()::text;
  medicine:=jsonb_build_object(
    'id',medicine_id,'name',medicine_name,'class','Otro','doseValue',dose_value,
    'doseUnit',dose_unit,'dose',dose_value||' '||dose_unit,
    'frequency',frequency_text,'frequencySlots','[]'::jsonb,'route',route_text,
    'indication',coalesce(nullif(btrim(p_medication->>'indication'),''),'Sin indicación registrada'),
    'startDate',start_on,'endDate',null,'status','active','isPrimary',false,
    'isPrn',coalesce((p_medication->>'isPrn')::boolean,false),
    'source','foxpro_verified','sourceMentionId',p_mention_id,
    'sourceHistoryId',mention.history_id,'sourceBatchId',mention.batch_id,
    'notes',left(btrim(coalesce(p_medication->>'notes','')),1000),
    'clinicalNotes',left(btrim(coalesce(p_medication->>'notes','')),1000),
    'reviewedBy',auth.uid(),'reviewedAt',at_time,
    'events',jsonb_build_array(jsonb_build_object('type','historical_reconciliation',
      'at',at_time,'by',auth.uid(),'sourceMentionId',p_mention_id)),
    'doseHistory',jsonb_build_array(jsonb_build_object('id','dose_'||gen_random_uuid()::text,
      'date',at_time,'doseValue',dose_value,'doseUnit',dose_unit,
      'dose',dose_value||' '||dose_unit,
      'reason','Dosis actual confirmada por el profesional; fecha de inicio solo si consta'))
  );
  next_revision:=coalesce(clinical.revision,0)+1;
  insert into public.linkare_records(organization_id,kind,id,payload,revision,deleted,updated_by)
    values(p_org,'patient_clinical',p_patient_id,
      coalesce(clinical.payload,'{}'::jsonb)||jsonb_build_object('medications',medicines||jsonb_build_array(medicine)),
      next_revision,false,auth.uid())
    on conflict(organization_id,kind,id) do update
      set payload=excluded.payload,revision=excluded.revision,deleted=false,
          updated_at=at_time,updated_by=auth.uid();
  update linkare_private.legacy_medication_mentions_v1
    set review_status='confirmed_current',reviewed_by=auth.uid(),reviewed_at=at_time,
        review_note=nullif(review_note_text,''),linked_medication_id=medicine_id
    where organization_id=p_org and id=p_mention_id;
  insert into public.linkare_audit_v3(organization_id,actor_id,action,kind,record_id,revision,fingerprint)
    values(p_org,auth.uid(),'legacy_medication.confirmed_current','patient_clinical',p_patient_id,
      next_revision,encode(sha256(convert_to(medicine::text,'UTF8')),'hex'));
  return jsonb_build_object('ok',true,'duplicate',false,'reviewStatus','confirmed_current',
    'medicationId',medicine_id,'revision',next_revision);
end $$;

revoke all on function public.linkare_review_legacy_medication_v1(uuid,text,uuid,text,jsonb)
  from public,anon;
grant execute on function public.linkare_review_legacy_medication_v1(uuid,text,uuid,text,jsonb)
  to authenticated;

create function public.linkare_legacy_medication_provenance_guard_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
declare prior jsonb; current_med jsonb;
begin
  if old.kind<>'patient_clinical' or new.kind<>'patient_clinical' then return new; end if;
  for prior in select value from jsonb_array_elements(coalesce(old.payload->'medications','[]'::jsonb))
    where value->>'source'='foxpro_verified' loop
    select value into current_med from jsonb_array_elements(coalesce(new.payload->'medications','[]'::jsonb))
      where value->>'id'=prior->>'id';
    if current_med is null or current_med->>'source' is distinct from 'foxpro_verified'
      or current_med->>'sourceMentionId' is distinct from prior->>'sourceMentionId'
      or current_med->>'sourceHistoryId' is distinct from prior->>'sourceHistoryId'
      or current_med->>'sourceBatchId' is distinct from prior->>'sourceBatchId' then
      raise exception 'HISTORICAL_MEDICATION_PROVENANCE_IMMUTABLE';
    end if;
  end loop;
  return new;
end $$;
create trigger linkare_legacy_medication_provenance_guard_v1
  before update on public.linkare_records for each row
  execute function public.linkare_legacy_medication_provenance_guard_v1();
revoke all on function public.linkare_legacy_medication_provenance_guard_v1() from public,anon,authenticated;

-- The grouped card points to the exact latest source mention being reviewed.
create or replace function public.linkare_legacy_medication_summary_v1(
  org uuid,p_patient_id text,p_cursor text default null,p_limit integer default 20
)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare items jsonb;has_more boolean;next_cursor text;
begin
 if auth.uid() is null or not public.linkare_permission_v3(org,'clinicalView') then
  raise exception 'ACCESS_DENIED' using errcode='42501';
 end if;
 if p_limit not between 1 and 20 or p_patient_id is null or length(coalesce(p_cursor,''))>100 then
  raise exception 'INVALID_PAGE';
 end if;
 if not exists(select 1 from public.linkare_records
   where organization_id=org and kind='patient_admin' and id=p_patient_id and not deleted) then
  raise exception 'PATIENT_NOT_FOUND';
 end if;
 with ranked as (
  select lower(btrim(regexp_replace(m.name,'[[:space:]]+',' ','g'))) as name_key,
   m.id,m.name,m.strength_text,m.instruction_text,m.source_excerpt,m.history_id,
   m.review_status,m.reviewed_at,m.linked_medication_id,h.occurred_on,
   row_number() over (
    partition by lower(btrim(regexp_replace(m.name,'[[:space:]]+',' ','g')))
    order by h.occurred_on desc nulls last,m.id desc
   ) as rank_in_group
  from linkare_private.legacy_medication_mentions_v1 m
  join linkare_private.legacy_history_v1 h
   on h.id=m.history_id and h.organization_id=m.organization_id and h.patient_id=m.patient_id
  where m.organization_id=org and m.patient_id=p_patient_id
 ), grouped as (
  select name_key,count(*) as mention_count,min(occurred_on) as first_seen_on,
   max(occurred_on) as last_seen_on,
   max(name) filter(where rank_in_group=1) as name,
   max(strength_text) filter(where rank_in_group=1) as strength_text,
   max(instruction_text) filter(where rank_in_group=1) as instruction_text,
   max(source_excerpt) filter(where rank_in_group=1) as source_excerpt,
   (max(history_id::text) filter(where rank_in_group=1))::uuid as history_id,
   (max(id::text) filter(where rank_in_group=1))::uuid as mention_id,
   max(review_status) filter(where rank_in_group=1) as review_status,
   max(reviewed_at) filter(where rank_in_group=1) as reviewed_at,
   max(linked_medication_id) filter(where rank_in_group=1) as linked_medication_id
  from ranked
  where p_cursor is null or name_key>p_cursor
  group by name_key
 ), candidates as (
  select *,row_number() over(order by name_key) as page_position
  from grouped order by name_key limit p_limit+1
 ), page as (select * from candidates where page_position<=p_limit)
 select coalesce(jsonb_agg(jsonb_build_object(
   'nameKey',name_key,'name',name,'strengthText',strength_text,
   'instructionText',instruction_text,'sourceExcerpt',source_excerpt,
   'historyId',history_id,'mentionId',mention_id,'mentionCount',mention_count,
   'firstSeenOn',first_seen_on,'lastSeenOn',last_seen_on,
   'reviewStatus',case review_status when 'confirmed_current' then 'confirmed_current'
     when 'not_current' then 'not_current' else 'historical_unverified' end,
   'reviewedAt',reviewed_at,'linkedMedicationId',linked_medication_id
  ) order by name_key),'[]'::jsonb),
  exists(select 1 from candidates where page_position>p_limit)
 into items,has_more from page;
 if has_more then next_cursor:=items->-1->>'nameKey'; end if;
 return jsonb_build_object('items',items,'hasMore',has_more,
  'nextCursor',next_cursor,'limit',p_limit,
  'semantics','source_mentions_not_current_treatment_without_review');
end $$;

notify pgrst,'reload schema';
commit;
