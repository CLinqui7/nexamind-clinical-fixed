begin;

-- Corrections affect the grouped display only. Imported words, dates, and
-- review decisions stay immutable in legacy_medication_mentions_v1.
create table linkare_private.legacy_medication_group_edits_v1 (
  organization_id uuid not null references public.organizations(id),
  patient_id text not null,
  name_key text not null,
  display_name text not null,
  strength_text text not null default '',
  instruction_text text not null default '',
  archived boolean not null default false,
  archive_reason text not null default '',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (organization_id,patient_id,name_key)
);
create table linkare_private.legacy_medication_group_edit_audit_v1 (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  patient_id text not null,
  name_key text not null,
  previous_value jsonb,
  next_value jsonb not null,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index legacy_medication_group_edit_audit_patient_v1
  on linkare_private.legacy_medication_group_edit_audit_v1(
    organization_id,patient_id,created_at desc
  );
alter table linkare_private.legacy_medication_group_edits_v1 enable row level security;
alter table linkare_private.legacy_medication_group_edit_audit_v1 enable row level security;
revoke all on linkare_private.legacy_medication_group_edits_v1,
  linkare_private.legacy_medication_group_edit_audit_v1
  from public,anon,authenticated;
grant select on linkare_private.legacy_medication_group_edits_v1,
  linkare_private.legacy_medication_group_edit_audit_v1 to service_role;

create function public.linkare_set_legacy_medication_group_v1(
  p_org uuid,p_patient_id text,p_name_key text,p_edit jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  prior linkare_private.legacy_medication_group_edits_v1;
  latest_name text;
  latest_strength text;
  latest_instruction text;
  next_name text;
  next_strength text;
  next_instruction text;
  next_archived boolean;
  next_reason text;
  at_time timestamptz:=clock_timestamp();
begin
  if auth.uid() is null
    or public.linkare_role_v3(p_org) not in('owner','psychiatrist','doctor')
    or not public.linkare_permission_v3(p_org,'clinicalView')
    or not public.linkare_permission_v3(p_org,'medicationsManage') then
    raise exception 'ACCESS_DENIED' using errcode='42501';
  end if;
  if not public.linkare_entitled_v3(p_org) then raise exception 'SUBSCRIPTION_REQUIRED';end if;
  if p_patient_id is null or p_name_key is null
    or length(p_name_key) not between 2 and 100
    or jsonb_typeof(p_edit)<>'object'
    or octet_length(p_edit::text)>3000 then
    raise exception 'INVALID_HISTORICAL_MEDICATION_EDIT';
  end if;
  if not exists(select 1 from public.linkare_records
    where organization_id=p_org and kind='patient_admin' and id=p_patient_id
      and not deleted and not coalesce((payload->>'archived')::boolean,false)) then
    raise exception 'PATIENT_NOT_FOUND';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_org::text||':legacy_medication_group:'||p_patient_id||':'||p_name_key,303));
  select m.name,m.strength_text,coalesce(m.instruction_text,'')
    into latest_name,latest_strength,latest_instruction
  from linkare_private.legacy_medication_mentions_v1 m
  join linkare_private.legacy_history_v1 h
    on h.id=m.history_id and h.organization_id=m.organization_id
      and h.patient_id=m.patient_id
  where m.organization_id=p_org and m.patient_id=p_patient_id
    and lower(btrim(regexp_replace(m.name,'[[:space:]]+',' ','g')))=p_name_key
  order by h.occurred_on desc nulls last,m.id desc limit 1;
  if latest_name is null then raise exception 'HISTORICAL_MEDICATION_GROUP_NOT_FOUND';end if;
  select * into prior from linkare_private.legacy_medication_group_edits_v1
    where organization_id=p_org and patient_id=p_patient_id and name_key=p_name_key
    for update;
  next_name:=btrim(coalesce(p_edit->>'name',prior.display_name,latest_name));
  next_strength:=btrim(coalesce(p_edit->>'strengthText',prior.strength_text,latest_strength));
  next_instruction:=btrim(coalesce(p_edit->>'instructionText',prior.instruction_text,latest_instruction));
  next_archived:=coalesce((p_edit->>'archived')::boolean,prior.archived,false);
  next_reason:=btrim(coalesce(p_edit->>'reason',prior.archive_reason,''));
  if length(next_name) not between 2 and 100
    or length(next_strength)>60 or length(next_instruction)>700
    or length(next_reason)>500
    or (next_archived and length(next_reason)<3) then
    raise exception 'INVALID_HISTORICAL_MEDICATION_EDIT';
  end if;
  insert into linkare_private.legacy_medication_group_edits_v1(
    organization_id,patient_id,name_key,display_name,strength_text,instruction_text,
    archived,archive_reason,updated_by,updated_at
  ) values(
    p_org,p_patient_id,p_name_key,next_name,next_strength,next_instruction,
    next_archived,case when next_archived then next_reason else '' end,auth.uid(),at_time
  ) on conflict(organization_id,patient_id,name_key) do update set
    display_name=excluded.display_name,strength_text=excluded.strength_text,
    instruction_text=excluded.instruction_text,archived=excluded.archived,
    archive_reason=excluded.archive_reason,updated_by=excluded.updated_by,
    updated_at=excluded.updated_at;
  insert into linkare_private.legacy_medication_group_edit_audit_v1(
    organization_id,patient_id,name_key,previous_value,next_value,actor_id
  ) values(
    p_org,p_patient_id,p_name_key,
    case when prior.organization_id is null then null else to_jsonb(prior) end,
    jsonb_build_object('name',next_name,'strengthText',next_strength,
      'instructionText',next_instruction,'archived',next_archived,
      'reason',case when next_archived then next_reason else '' end),
    auth.uid()
  );
  return jsonb_build_object('ok',true,'nameKey',p_name_key,'archived',next_archived);
end $$;
revoke all on function public.linkare_set_legacy_medication_group_v1(uuid,text,text,jsonb)
  from public,anon;
grant execute on function public.linkare_set_legacy_medication_group_v1(uuid,text,text,jsonb)
  to authenticated;

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
  select grouped.name_key,coalesce(edits.display_name,grouped.name) name,
   coalesce(edits.strength_text,grouped.strength_text) strength_text,
   coalesce(edits.instruction_text,grouped.instruction_text) instruction_text,
   grouped.source_excerpt,grouped.history_id,grouped.mention_id,
   grouped.review_status,grouped.reviewed_at,grouped.linked_medication_id,
   grouped.mention_count,
   grouped.first_seen_on,grouped.last_seen_on,
   coalesce(edits.archived,false) archived,
   coalesce(edits.archive_reason,'') archive_reason,
   row_number() over(order by grouped.name_key) as page_position
  from grouped
  left join linkare_private.legacy_medication_group_edits_v1 edits
    on edits.organization_id=org and edits.patient_id=p_patient_id
      and edits.name_key=grouped.name_key
  order by grouped.name_key limit p_limit+1
 ), page as (select * from candidates where page_position<=p_limit)
 select coalesce(jsonb_agg(jsonb_build_object(
   'nameKey',name_key,'name',name,'strengthText',strength_text,
   'instructionText',instruction_text,'sourceExcerpt',source_excerpt,
   'historyId',history_id,'mentionId',mention_id,'mentionCount',mention_count,
   'firstSeenOn',first_seen_on,'lastSeenOn',last_seen_on,
   'archived',archived,'archiveReason',archive_reason,
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
