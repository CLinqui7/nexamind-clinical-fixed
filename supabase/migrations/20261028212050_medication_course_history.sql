begin;
create table linkare_private.medication_course_events_v1(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 patient_id text not null,medication_key text not null check(length(medication_key) between 2 and 160),
 medication_name text not null,event_type text not null check(event_type in('start','pause','resume','stop','dose','note')),
 effective_on date,dose_text text not null default '',frequency_text text not null default '',route_text text not null default '',
 note text not null check(length(note) between 3 and 3000),revision bigint not null default 1,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),
 archived_at timestamptz,archive_reason text
);
create index medication_course_patient_v1 on linkare_private.medication_course_events_v1(organization_id,patient_id,medication_key,effective_on,id);
create index medication_course_author_v1 on linkare_private.medication_course_events_v1(created_by);
create index medication_course_editor_v1 on linkare_private.medication_course_events_v1(updated_by);
create table linkare_private.medication_course_audit_v1(
 id bigint generated always as identity primary key,event_id uuid not null references linkare_private.medication_course_events_v1(id),
 organization_id uuid not null references public.organizations(id),actor_id uuid not null references auth.users(id),
 previous_value jsonb,next_value jsonb not null,created_at timestamptz not null default now()
);
create index medication_course_audit_event_v1 on linkare_private.medication_course_audit_v1(event_id);
create index medication_course_audit_org_v1 on linkare_private.medication_course_audit_v1(organization_id);
create index medication_course_audit_actor_v1 on linkare_private.medication_course_audit_v1(actor_id);
alter table linkare_private.medication_course_events_v1 enable row level security;
alter table linkare_private.medication_course_audit_v1 enable row level security;
revoke all on linkare_private.medication_course_events_v1,linkare_private.medication_course_audit_v1 from public,anon,authenticated;

create function public.linkare_medication_course_v1(org uuid,p_patient_id text,p_name text,p_cursor jsonb default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare k text:=linkare_private.legacy_medication_name_key_v2(p_name);items jsonb;more boolean;first_on date;last_on date;start_on date;stop_on date;
begin
 if auth.uid() is null or not public.linkare_permission_v3(org,'patientsView') or not public.linkare_permission_v3(org,'clinicalView') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 if length(k) not between 2 and 160 then raise exception 'INVALID_MEDICATION_NAME';end if;
 if not exists(select 1 from public.linkare_records where organization_id=org and kind='patient_admin' and id=p_patient_id and not deleted) then raise exception 'PATIENT_NOT_FOUND';end if;
 select min(h.occurred_on),max(h.occurred_on) into first_on,last_on
 from linkare_private.legacy_medication_mentions_v1 m join linkare_private.legacy_history_v1 h on h.id=m.history_id and h.organization_id=m.organization_id and h.patient_id=m.patient_id
 where m.organization_id=org and m.patient_id=p_patient_id and linkare_private.legacy_medication_name_key_v2(m.name)=k;
 select min(effective_on) filter(where event_type='start'),max(effective_on) filter(where event_type='stop') into start_on,stop_on
 from linkare_private.medication_course_events_v1 where organization_id=org and patient_id=p_patient_id and medication_key=k and archived_at is null;
 with entries as (
  select 'foxpro:'||h.id id,h.occurred_on date,jsonb_build_object('kind','foxpro','id','foxpro:'||h.id,'date',h.occurred_on,'title','Anotación original FoxPro',
   'text',left(h.payload->>'text',30000),'textTruncated',length(h.payload->>'text')>30000,'sourceTable',h.source_table,
   'mentions',coalesce((select jsonb_agg(jsonb_build_object('name',m.name,'strength',m.strength_text,'instruction',m.instruction_text,'excerpt',m.source_excerpt))
     from linkare_private.legacy_medication_mentions_v1 m where m.organization_id=org and m.patient_id=p_patient_id and m.history_id=h.id and linkare_private.legacy_medication_name_key_v2(m.name)=k),'[]'::jsonb)) payload
  from linkare_private.legacy_history_v1 h where h.organization_id=org and h.patient_id=p_patient_id and h.scope='clinical'
   and (exists(select 1 from linkare_private.legacy_medication_mentions_v1 m where m.organization_id=org and m.patient_id=p_patient_id and m.history_id=h.id and linkare_private.legacy_medication_name_key_v2(m.name)=k)
     or position(' '||k||' ' in ' '||linkare_private.search_normalize_v1(h.payload->>'text')||' ')>0)
  union all
  select 'linkare:'||e.id,e.effective_on,jsonb_build_object('kind','linkare','id','linkare:'||e.id,'eventId',e.id,'date',e.effective_on,'eventType',e.event_type,'dose',e.dose_text,'frequency',e.frequency_text,'route',e.route_text,'note',e.note,'revision',e.revision,'recordedAt',e.created_at)
  from linkare_private.medication_course_events_v1 e where e.organization_id=org and e.patient_id=p_patient_id and e.medication_key=k and e.archived_at is null
 ), candidates as (
  select *,row_number() over(order by date desc nulls last,id desc) rn from entries
  where p_cursor is null or (nullif(p_cursor->>'date','') is not null and (date<(p_cursor->>'date')::date or (date=(p_cursor->>'date')::date and id<p_cursor->>'id') or date is null))
   or (nullif(p_cursor->>'date','') is null and date is null and id<p_cursor->>'id')
  order by date desc nulls last,id desc limit 21
 ) select coalesce(jsonb_agg(payload order by date desc nulls last,id desc) filter(where rn<=20),'[]'::jsonb),coalesce(bool_or(rn>20),false) into items,more from candidates;
 return jsonb_build_object('items',items,'hasMore',more,'nextCursor',case when more then jsonb_build_object('date',items->-1->'date','id',items->-1->>'id') else null end,
 'firstDocumentedOn',first_on,'lastDocumentedOn',last_on,'earliestKnownStart',start_on,'latestKnownStop',stop_on);
end $$;
revoke all on function public.linkare_medication_course_v1(uuid,text,text,jsonb) from public,anon;
grant execute on function public.linkare_medication_course_v1(uuid,text,text,jsonb) to authenticated;

create function public.linkare_save_medication_course_v1(org uuid,p_patient_id text,p_name text,p_event jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare k text:=linkare_private.legacy_medication_name_key_v2(p_name);event_id uuid;prior linkare_private.medication_course_events_v1;next_row linkare_private.medication_course_events_v1;effective date;at_time timestamptz:=clock_timestamp();
begin
 if auth.uid() is null or public.linkare_role_v3(org) not in('owner','psychiatrist','doctor') or not public.linkare_permission_v3(org,'patientsView')
 or not public.linkare_permission_v3(org,'clinicalView') or not public.linkare_permission_v3(org,'clinicalEdit') or not public.linkare_permission_v3(org,'medicationsManage') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 if length(k) not between 2 and 160 or jsonb_typeof(p_event) is distinct from 'object' or octet_length(p_event::text)>10000 then raise exception 'INVALID_COURSE_EVENT';end if;
 if not exists(select 1 from public.linkare_records where organization_id=org and kind='patient_admin' and id=p_patient_id and not deleted and not coalesce((payload->>'archived')::boolean,false)) then raise exception 'PATIENT_NOT_FOUND';end if;
 event_id:=coalesce(nullif(p_event->>'id','')::uuid,gen_random_uuid());
 perform pg_advisory_xact_lock(hashtextextended(org::text||':medication-course:'||event_id::text,303));
 select * into prior from linkare_private.medication_course_events_v1 where id=event_id and organization_id=org and patient_id=p_patient_id and medication_key=k for update;
 if prior.id is not null and prior.archived_at is null and coalesce((p_event->>'expectedRevision')::bigint,0)=0
  and prior.event_type=p_event->>'type' and prior.effective_on is not distinct from nullif(p_event->>'date','')::date
  and prior.note=btrim(p_event->>'note') and prior.dose_text=coalesce(p_event->>'dose','') and prior.frequency_text=coalesce(p_event->>'frequency','') and prior.route_text=coalesce(p_event->>'route','') then
   return jsonb_build_object('ok',true,'id',prior.id,'revision',prior.revision,'duplicate',true);
 end if;
 if (prior.id is null and coalesce((p_event->>'expectedRevision')::bigint,0)<>0) or (prior.id is not null and prior.revision is distinct from (p_event->>'expectedRevision')::bigint) then raise exception 'COURSE_REVISION_CONFLICT';end if;
 if coalesce((p_event->>'archived')::boolean,false) then
  if prior.id is null or length(btrim(coalesce(p_event->>'reason',''))) not between 3 and 500 then raise exception 'ARCHIVE_REASON_REQUIRED';end if;
  update linkare_private.medication_course_events_v1 set archived_at=at_time,archive_reason=btrim(p_event->>'reason'),revision=revision+1,updated_by=auth.uid(),updated_at=at_time where id=event_id returning * into next_row;
 else
  if prior.archived_at is not null then raise exception 'COURSE_EVENT_ARCHIVED';end if;
  effective:=nullif(p_event->>'date','')::date;
  if effective>(at_time at time zone 'America/El_Salvador')::date or p_event->>'type' is null or p_event->>'type' not in('start','pause','resume','stop','dose','note')
   or length(btrim(coalesce(p_event->>'note',''))) not between 3 and 3000 or length(coalesce(p_event->>'dose',''))>300 or length(coalesce(p_event->>'frequency',''))>700 or length(coalesce(p_event->>'route',''))>100 then raise exception 'INVALID_COURSE_EVENT';end if;
  insert into linkare_private.medication_course_events_v1(id,organization_id,patient_id,medication_key,medication_name,event_type,effective_on,dose_text,frequency_text,route_text,note,created_by,updated_by)
   values(event_id,org,p_patient_id,k,p_name,p_event->>'type',effective,coalesce(p_event->>'dose',''),coalesce(p_event->>'frequency',''),coalesce(p_event->>'route',''),btrim(p_event->>'note'),auth.uid(),auth.uid())
   on conflict(id) do update set event_type=excluded.event_type,effective_on=excluded.effective_on,dose_text=excluded.dose_text,frequency_text=excluded.frequency_text,route_text=excluded.route_text,note=excluded.note,revision=prior.revision+1,updated_by=auth.uid(),updated_at=at_time
   where linkare_private.medication_course_events_v1.organization_id=org and linkare_private.medication_course_events_v1.patient_id=p_patient_id and linkare_private.medication_course_events_v1.medication_key=k returning * into next_row;
 end if;
 if next_row.id is null then raise exception 'COURSE_EVENT_NOT_FOUND';end if;
 insert into linkare_private.medication_course_audit_v1(event_id,organization_id,actor_id,previous_value,next_value) values(event_id,org,auth.uid(),case when prior.id is null then null else to_jsonb(prior) end,to_jsonb(next_row));
 return jsonb_build_object('ok',true,'id',next_row.id,'revision',next_row.revision);
end $$;
revoke all on function public.linkare_save_medication_course_v1(uuid,text,text,jsonb) from public,anon;
grant execute on function public.linkare_save_medication_course_v1(uuid,text,text,jsonb) to authenticated;
create function public.linkare_medication_course_groups_v1(org uuid,p_patient_id text,p_cursor text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare items jsonb;more boolean;
begin
 if auth.uid() is null or not public.linkare_permission_v3(org,'patientsView') or not public.linkare_permission_v3(org,'clinicalView') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 if not exists(select 1 from public.linkare_records where organization_id=org and kind='patient_admin' and id=p_patient_id and not deleted) then raise exception 'PATIENT_NOT_FOUND';end if;
 with grouped as(select medication_key,(array_agg(medication_name order by updated_at desc,id desc))[1] name,count(*) events,
 min(effective_on) filter(where event_type='start') first_start,max(effective_on) filter(where event_type='stop') last_stop
 from linkare_private.medication_course_events_v1 where organization_id=org and patient_id=p_patient_id and archived_at is null and (p_cursor is null or medication_key>p_cursor) group by medication_key),
 candidates as(select *,row_number() over(order by medication_key) rn from grouped order by medication_key limit 21)
 select coalesce(jsonb_agg(jsonb_build_object('nameKey',medication_key,'name',name,'events',events,'firstStart',first_start,'lastStop',last_stop) order by medication_key) filter(where rn<=20),'[]'::jsonb),coalesce(bool_or(rn>20),false) into items,more from candidates;
 return jsonb_build_object('items',items,'hasMore',more,'nextCursor',case when more then items->-1->>'nameKey' else null end);
end $$;
revoke all on function public.linkare_medication_course_groups_v1(uuid,text,text) from public,anon;
grant execute on function public.linkare_medication_course_groups_v1(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
