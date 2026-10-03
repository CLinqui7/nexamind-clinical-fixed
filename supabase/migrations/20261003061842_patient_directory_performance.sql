begin;

-- Phase 2 is additive. Existing v3 RPCs remain available to old clients until
-- the projection backfill and coordinated frontend release have been approved.

create table linkare_private.patient_directory_state_v1 (
 organization_id uuid primary key references public.organizations(id),
 listing_version bigint not null default 1,
 appointments_ready boolean not null default false,
 patients_ready boolean not null default false,
 policy_version integer not null default 1 check(policy_version=1),
 updated_at timestamptz not null default now()
);

create table linkare_private.appointment_directory_v1 (
 organization_id uuid not null references public.organizations(id),
 appointment_id text not null,
 source_revision bigint not null,
 calendar_id uuid not null references public.linkare_calendars_v1(id),
 patient_id text,
 event_type text not null check(event_type in('appointment','general')),
 title text not null,
 start_at timestamptz not null,
 end_at timestamptz not null,
 status text not null,
 admin_review_status text,
 refreshed_at timestamptz not null default now(),
 primary key(organization_id,appointment_id),
 check(end_at>start_at)
);

create index appointment_directory_interval_v1
 on linkare_private.appointment_directory_v1(organization_id,calendar_id,start_at,appointment_id)
 include(end_at,status,patient_id,event_type);
create index appointment_directory_patient_v1
 on linkare_private.appointment_directory_v1(organization_id,patient_id,start_at desc,appointment_id)
 where patient_id is not null;

create table linkare_private.patient_directory_v1 (
 organization_id uuid not null references public.organizations(id),
 patient_id text not null,
 name text not null,
 name_sort text not null,
 phone text,
 email text,
 insurance_provider text,
 archived boolean not null default false,
 data_quality text,
 has_legacy_record boolean not null default false,
 last_activity_on date,
 last_activity_at timestamptz,
 last_activity_precision text check(last_activity_precision in('date','timestamp')),
 last_activity_origin text,
 last_activity_event_id text,
 next_appointment_at timestamptz,
 source_revision bigint not null,
 projection_revision bigint not null default 1,
 search_text text not null,
 search_vector tsvector not null,
 refreshed_at timestamptz not null default now(),
 primary key(organization_id,patient_id)
);

create index patient_directory_recent_v1
 on linkare_private.patient_directory_v1(organization_id,last_activity_on desc,patient_id)
 include(name,phone,next_appointment_at,data_quality)
 where not archived and last_activity_on is not null;
create index patient_directory_all_v1
 on linkare_private.patient_directory_v1(organization_id,archived,name_sort,patient_id)
 include(name,phone,last_activity_on,next_appointment_at,data_quality);
create index patient_directory_no_activity_v1
 on linkare_private.patient_directory_v1(organization_id,name_sort,patient_id)
 where not archived and last_activity_on is null;
create index patient_directory_search_v1
 on linkare_private.patient_directory_v1 using gin(search_vector);

alter table linkare_private.patient_directory_state_v1 enable row level security;
alter table linkare_private.appointment_directory_v1 enable row level security;
alter table linkare_private.patient_directory_v1 enable row level security;
revoke all on linkare_private.patient_directory_state_v1,linkare_private.appointment_directory_v1,linkare_private.patient_directory_v1 from public,anon,authenticated;
grant all on linkare_private.patient_directory_state_v1,linkare_private.appointment_directory_v1,linkare_private.patient_directory_v1 to service_role;

create function linkare_private.search_normalize_v1(value text)
returns text language sql immutable set search_path='' as $$
 select trim(regexp_replace(lower(translate(coalesce(value,''),'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun')),'[^a-z0-9]+',' ','g'))
$$;

create function linkare_private.search_query_v1(value text)
returns tsquery language sql immutable set search_path='' as $$
 select case when normalized='' then null::tsquery else
  to_tsquery('simple',(
   select string_agg(token||':*',' & ' order by ordinality)
   from unnest(regexp_split_to_array(normalized,' +')) with ordinality part(token,ordinality)
   where token<>''
  )) end
 from (select linkare_private.search_normalize_v1(value) normalized) input
$$;

create function linkare_private.try_timestamptz_v1(value text)
returns timestamptz language plpgsql stable set search_path='' as $$
begin
 if nullif(trim(value),'') is null then return null;end if;
 return value::timestamptz;
exception when others then return null;
end $$;

create function linkare_private.bump_directory_version_v1(org uuid)
returns void language sql volatile set search_path='' as $$
 insert into linkare_private.patient_directory_state_v1(organization_id,listing_version,updated_at)
 values(org,1,clock_timestamp())
 on conflict(organization_id) do update set
  listing_version=linkare_private.patient_directory_state_v1.listing_version+1,
  updated_at=excluded.updated_at
$$;

create function linkare_private.initialize_directory_state_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into linkare_private.patient_directory_state_v1(organization_id,appointments_ready,patients_ready)
 values(new.id,true,true) on conflict do nothing;
 return new;
end $$;
create trigger linkare_initialize_directory_state_v1 after insert on public.organizations
 for each row execute function linkare_private.initialize_directory_state_v1();

create function linkare_private.refresh_appointment_v1(org uuid,record_id text)
returns void language plpgsql security definer set search_path='' as $$
declare record public.linkare_records;calendar uuid;starts timestamptz;ends timestamptz;changed integer;
begin
 select * into record from public.linkare_records
 where organization_id=org and kind='appointment' and id=record_id;
 if not found or record.deleted then
  delete from linkare_private.appointment_directory_v1 where organization_id=org and appointment_id=record_id;
  get diagnostics changed=row_count;if changed>0 then perform linkare_private.bump_directory_version_v1(org);end if;
  return;
 end if;
 begin calendar:=(record.payload->>'calendarId')::uuid;exception when others then calendar:=null;end;
 starts:=linkare_private.try_timestamptz_v1(record.payload->>'start');
 ends:=linkare_private.try_timestamptz_v1(record.payload->>'end');
 if calendar is null or starts is null or ends is null or ends<=starts or not exists(select 1 from public.linkare_calendars_v1 where organization_id=org and id=calendar) then
  delete from linkare_private.appointment_directory_v1 where organization_id=org and appointment_id=record_id;
  return;
 end if;
 insert into linkare_private.appointment_directory_v1(
  organization_id,appointment_id,source_revision,calendar_id,patient_id,event_type,title,start_at,end_at,status,admin_review_status,refreshed_at
 ) values(
  org,record.id,record.revision,calendar,nullif(record.payload->>'patientId',''),
  case when record.payload->>'eventType'='general' then 'general' else 'appointment' end,
  coalesce(nullif(record.payload->>'title',''),record.payload->>'patientId','Evento'),starts,ends,
  coalesce(nullif(record.payload->>'status',''),'pending'),nullif(record.payload->>'adminReviewStatus',''),clock_timestamp()
 ) on conflict(organization_id,appointment_id) do update set
  source_revision=excluded.source_revision,calendar_id=excluded.calendar_id,patient_id=excluded.patient_id,
  event_type=excluded.event_type,title=excluded.title,start_at=excluded.start_at,end_at=excluded.end_at,
  status=excluded.status,admin_review_status=excluded.admin_review_status,refreshed_at=excluded.refreshed_at
 where excluded.source_revision>=linkare_private.appointment_directory_v1.source_revision
   and (linkare_private.appointment_directory_v1.source_revision,linkare_private.appointment_directory_v1.calendar_id,
    linkare_private.appointment_directory_v1.patient_id,linkare_private.appointment_directory_v1.event_type,
    linkare_private.appointment_directory_v1.title,linkare_private.appointment_directory_v1.start_at,
    linkare_private.appointment_directory_v1.end_at,linkare_private.appointment_directory_v1.status,
    linkare_private.appointment_directory_v1.admin_review_status)
   is distinct from
   (excluded.source_revision,excluded.calendar_id,excluded.patient_id,excluded.event_type,excluded.title,
    excluded.start_at,excluded.end_at,excluded.status,excluded.admin_review_status);
 get diagnostics changed=row_count;if changed>0 then perform linkare_private.bump_directory_version_v1(org);end if;
end $$;

create function linkare_private.refresh_patient_v1(org uuid,p_patient_id text)
returns void language plpgsql security definer set search_path='' as $$
declare admin public.linkare_records;clinical public.linkare_records;summary linkare_private.legacy_patient_summary_v1;
 modern_at timestamptz;modern_id text;legacy_on date;legacy_id text;next_at timestamptz;
 activity_on date;activity_at timestamptz;activity_precision text;activity_origin text;activity_id text;
 normalized text;insurance text;changed integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(org::text||':directory:'||p_patient_id,731));
 select * into admin from public.linkare_records where organization_id=org and kind='patient_admin' and id=p_patient_id and not deleted;
 if not found then
  delete from linkare_private.patient_directory_v1 where organization_id=org and patient_id=p_patient_id;
  get diagnostics changed=row_count;if changed>0 then perform linkare_private.bump_directory_version_v1(org);end if;
  return;
 end if;
 select * into clinical from public.linkare_records where organization_id=org and kind='patient_clinical' and id=p_patient_id and not deleted;
 select * into summary from linkare_private.legacy_patient_summary_v1 where organization_id=org and patient_id=p_patient_id;

 if clinical.organization_id is not null then
  select event_at,event_id into modern_at,modern_id from(
   select linkare_private.try_timestamptz_v1(coalesce(note->>'startedAt',note->>'endedAt',note->>'signedAt')) event_at,note->>'id' event_id
   from jsonb_array_elements(coalesce(clinical.payload->'consultations','[]')) note
   where (note->>'status' in('completed','signed') or nullif(note->>'signedAt','') is not null)
    and nullif(note->>'archivedAt','') is null
    and not exists(select 1 from jsonb_array_elements(coalesce(clinical.payload->'consultationRetractions','[]')) retraction where retraction->>'resourceId'=note->>'id')
  ) candidate where event_at is not null and event_at<=clock_timestamp()
  order by event_at desc,event_id desc limit 1;
 end if;

 select occurred_on,id::text into legacy_on,legacy_id
 from linkare_private.legacy_history_v1
 where organization_id=org and patient_id=p_patient_id and source_table='t_mov_diarios'
  and occurred_on is not null and occurred_on<=(clock_timestamp() at time zone 'America/El_Salvador')::date
  and payload->>'passedConsultation'='true'
 order by occurred_on desc,id desc limit 1;

 if modern_at is not null and (legacy_on is null or (modern_at at time zone 'America/El_Salvador')::date>=legacy_on) then
  activity_at:=modern_at;activity_on:=(modern_at at time zone 'America/El_Salvador')::date;
  activity_precision:='timestamp';activity_origin:='modern_signed_consultation';activity_id:=modern_id;
 elsif legacy_on is not null then
  activity_at:=null;activity_on:=legacy_on;activity_precision:='date';activity_origin:='foxpro_passed_consultation';activity_id:=legacy_id;
 end if;

 select min(start_at) into next_at from linkare_private.appointment_directory_v1
 where organization_id=org and patient_id=p_patient_id and event_type='appointment'
  and start_at>=clock_timestamp() and status not in('cancelled','completed','no_show');
 insurance:=nullif(admin.payload#>>'{insurance,provider}','');
 normalized:=linkare_private.search_normalize_v1(concat_ws(' ',admin.payload->>'name',admin.payload->>'phone',admin.payload->>'email',insurance,p_patient_id));
 insert into linkare_private.patient_directory_v1(
  organization_id,patient_id,name,name_sort,phone,email,insurance_provider,archived,data_quality,has_legacy_record,
  last_activity_on,last_activity_at,last_activity_precision,last_activity_origin,last_activity_event_id,next_appointment_at,
  source_revision,projection_revision,search_text,search_vector,refreshed_at
 ) values(
  org,p_patient_id,coalesce(nullif(trim(admin.payload->>'name'),''),'Nombre no registrado'),
  linkare_private.search_normalize_v1(admin.payload->>'name'),nullif(admin.payload->>'phone',''),nullif(admin.payload->>'email',''),insurance,
  coalesce((admin.payload->>'archived')::boolean,false),summary.data_quality,summary.patient_id is not null,
  activity_on,activity_at,activity_precision,activity_origin,activity_id,next_at,admin.revision,1,normalized,to_tsvector('simple',normalized),clock_timestamp()
 ) on conflict(organization_id,patient_id) do update set
  name=excluded.name,name_sort=excluded.name_sort,phone=excluded.phone,email=excluded.email,
  insurance_provider=excluded.insurance_provider,archived=excluded.archived,data_quality=excluded.data_quality,
  has_legacy_record=excluded.has_legacy_record,last_activity_on=excluded.last_activity_on,last_activity_at=excluded.last_activity_at,
  last_activity_precision=excluded.last_activity_precision,last_activity_origin=excluded.last_activity_origin,
  last_activity_event_id=excluded.last_activity_event_id,next_appointment_at=excluded.next_appointment_at,
  source_revision=excluded.source_revision,projection_revision=linkare_private.patient_directory_v1.projection_revision+1,
  search_text=excluded.search_text,search_vector=excluded.search_vector,refreshed_at=excluded.refreshed_at
 where (linkare_private.patient_directory_v1.name,linkare_private.patient_directory_v1.name_sort,
  linkare_private.patient_directory_v1.phone,linkare_private.patient_directory_v1.email,
  linkare_private.patient_directory_v1.insurance_provider,linkare_private.patient_directory_v1.archived,
  linkare_private.patient_directory_v1.data_quality,linkare_private.patient_directory_v1.has_legacy_record,
  linkare_private.patient_directory_v1.last_activity_on,linkare_private.patient_directory_v1.last_activity_at,
  linkare_private.patient_directory_v1.last_activity_precision,linkare_private.patient_directory_v1.last_activity_origin,
  linkare_private.patient_directory_v1.last_activity_event_id,linkare_private.patient_directory_v1.next_appointment_at,
  linkare_private.patient_directory_v1.source_revision,linkare_private.patient_directory_v1.search_text)
 is distinct from
 (excluded.name,excluded.name_sort,excluded.phone,excluded.email,excluded.insurance_provider,excluded.archived,
  excluded.data_quality,excluded.has_legacy_record,excluded.last_activity_on,excluded.last_activity_at,
  excluded.last_activity_precision,excluded.last_activity_origin,excluded.last_activity_event_id,excluded.next_appointment_at,
  excluded.source_revision,excluded.search_text);
 get diagnostics changed=row_count;if changed>0 then perform linkare_private.bump_directory_version_v1(org);end if;
end $$;

create function linkare_private.records_projection_trigger_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare org uuid:=coalesce(new.organization_id,old.organization_id);record_id text:=coalesce(new.id,old.id);old_patient text;new_patient text;
begin
 if coalesce(new.kind,old.kind)='appointment' then
  old_patient:=nullif(old.payload->>'patientId','');new_patient:=nullif(new.payload->>'patientId','');
  perform linkare_private.refresh_appointment_v1(org,record_id);
  if old_patient is not null then perform linkare_private.refresh_patient_v1(org,old_patient);end if;
  if new_patient is not null and new_patient is distinct from old_patient then perform linkare_private.refresh_patient_v1(org,new_patient);end if;
 elsif coalesce(new.kind,old.kind) in('patient_admin','patient_clinical') then
  perform linkare_private.refresh_patient_v1(org,record_id);
 end if;
 return coalesce(new,old);
end $$;

create trigger linkare_records_projection_v1 after insert or update or delete on public.linkare_records
 for each row
 execute function linkare_private.records_projection_trigger_v1();

create function public.linkare_projection_backfill_v1(org uuid,p_phase text,p_after_id text default null,p_limit integer default 500)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ids text[];item text;next_id text;has_more boolean;processed integer:=0;
begin
 if org is null or p_phase not in('appointments','patients') or p_limit not between 1 and 1000 then raise exception 'INVALID_BACKFILL_REQUEST';end if;
 if not exists(select 1 from public.organizations where id=org) then raise exception 'ORGANIZATION_NOT_FOUND';end if;
 insert into linkare_private.patient_directory_state_v1(organization_id) values(org) on conflict do nothing;
 if p_phase='appointments' then
  select coalesce(array_agg(id order by id),'{}') into ids from(
   select id from public.linkare_records where organization_id=org and kind='appointment' and id>coalesce(p_after_id,'') order by id limit p_limit+1
  ) page;
  has_more:=coalesce(array_length(ids,1),0)>p_limit;ids:=ids[1:p_limit];
  foreach item in array coalesce(ids,'{}') loop perform linkare_private.refresh_appointment_v1(org,item);processed:=processed+1;next_id:=item;end loop;
  if not has_more then update linkare_private.patient_directory_state_v1 set appointments_ready=true,updated_at=clock_timestamp() where organization_id=org;end if;
 else
  if not coalesce((select appointments_ready from linkare_private.patient_directory_state_v1 where organization_id=org),false) then raise exception 'APPOINTMENT_BACKFILL_REQUIRED';end if;
  select coalesce(array_agg(id order by id),'{}') into ids from(
   select id from public.linkare_records where organization_id=org and kind='patient_admin' and id>coalesce(p_after_id,'') order by id limit p_limit+1
  ) page;
  has_more:=coalesce(array_length(ids,1),0)>p_limit;ids:=ids[1:p_limit];
  foreach item in array coalesce(ids,'{}') loop perform linkare_private.refresh_patient_v1(org,item);processed:=processed+1;next_id:=item;end loop;
  if not has_more then update linkare_private.patient_directory_state_v1 set patients_ready=true,updated_at=clock_timestamp() where organization_id=org;end if;
 end if;
 return jsonb_build_object('phase',p_phase,'processed',processed,'nextId',next_id,'hasMore',has_more,
  'state',(select to_jsonb(state)-'organization_id' from linkare_private.patient_directory_state_v1 state where organization_id=org));
end $$;
revoke all on function public.linkare_projection_backfill_v1(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.linkare_projection_backfill_v1(uuid,text,text,integer) to service_role;

create function public.linkare_bootstrap_state_v4(org uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare role_name text:=public.linkare_role_v3(org);profile jsonb;settings jsonb;users_json jsonb;calendars_json jsonb;revisions jsonb;projection jsonb;
begin
 if role_name is null or role_name not in('owner','psychiatrist','clinical_assistant','secretary') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 select payload into profile from public.linkare_records where organization_id=org and kind='profile' and id='clinic' and not deleted;
 select payload into settings from public.linkare_records where organization_id=org and kind='settings' and id='clinic' and not deleted;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',m.display_name,'email',u.email,'role',case m.role::text when 'owner' then 'owner' when 'psychiatrist' then 'doctor' when 'clinical_assistant' then 'nurse' else 'secretary' end,'active',m.active,'title',m.professional_title,'phone',m.phone,'permissions',m.permissions)),'[]') into users_json
 from public.organization_members m join auth.users u on u.id=m.user_id where m.organization_id=org and (role_name='owner' or m.user_id=(select auth.uid()));
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'code',c.code,'name',c.name,'visualKey',c.visual_key,'isActive',c.is_active) order by array_position(array['doctor','wife','general'],c.code)),'[]') into calendars_json
 from public.linkare_calendars_v1 c where c.organization_id=org and c.is_active and public.linkare_calendar_permission_v1(org,c.id,'View');
 select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'revision',revision)),'[]') into revisions
 from public.linkare_records where organization_id=org and kind in('profile','settings') and not deleted;
 select jsonb_build_object('ready',appointments_ready and patients_ready,'appointmentsReady',appointments_ready,'patientsReady',patients_ready,'listingVersion',listing_version,'policyVersion',policy_version) into projection
 from linkare_private.patient_directory_state_v1 where organization_id=org;
 if projection is null then projection:=jsonb_build_object('ready',false,'appointmentsReady',false,'patientsReady',false,'listingVersion',0,'policyVersion',1);end if;
 return jsonb_build_object('organizationId',org,'entitled',public.linkare_entitled_v3(org),
  'complimentaryAccess',coalesce((select complimentary_access from public.linkare_subscriptions_v3 where organization_id=org),false),
  'memberRole',case role_name when 'owner' then 'owner' when 'psychiatrist' then 'doctor' when 'clinical_assistant' then 'nurse' else 'secretary' end,
  'userId',(select auth.uid()),'revisions',revisions,'projection',projection,
  'payload',jsonb_build_object('organization',coalesce(profile,'{}'),'settings',coalesce(settings,'{}')||jsonb_build_object('activeUserId',(select auth.uid())),
   'users',users_json,'calendars',calendars_json,'patients','[]'::jsonb,'appointments','[]'::jsonb,'alerts','[]'::jsonb,'payments','[]'::jsonb));
end $$;
revoke all on function public.linkare_bootstrap_state_v4(uuid) from public,anon;
grant execute on function public.linkare_bootstrap_state_v4(uuid) to authenticated,service_role;

create function public.linkare_patient_directory_v1(org uuid,p_scope text default 'recent',p_query text default null,p_cursor jsonb default null,p_as_of timestamptz default null,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare state linkare_private.patient_directory_state_v1;frozen timestamptz:=coalesce(p_as_of,clock_timestamp());local_day date;cutoff date;
 normalized_query text:=linkare_private.search_normalize_v1(p_query);query_ts tsquery;items jsonb;has_more boolean:=false;next_cursor jsonb;cursor_version bigint;
 cursor_name text;cursor_id text;cursor_activity date;
begin
 if auth.uid() is null or not public.linkare_permission_v3(org,'patientsView') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 if p_scope not in('recent','all','no_activity','archived') or p_limit not between 1 and 20 then raise exception 'INVALID_DIRECTORY_REQUEST';end if;
 select * into state from linkare_private.patient_directory_state_v1 where organization_id=org;
 if not found or not state.patients_ready then raise exception 'DIRECTORY_NOT_READY';end if;
 if p_cursor is not null then
  cursor_version:=nullif(p_cursor->>'version','')::bigint;
  if cursor_version is distinct from state.listing_version then raise exception 'CURSOR_STALE' using errcode='40001';end if;
  cursor_name:=p_cursor->>'nameSort';cursor_id:=p_cursor->>'patientId';cursor_activity:=nullif(p_cursor->>'lastActivityOn','')::date;
 end if;
 local_day:=(frozen at time zone 'America/El_Salvador')::date;cutoff:=(local_day-interval '6 months')::date;
 query_ts:=linkare_private.search_query_v1(normalized_query);
 if p_scope='recent' then
  with candidates as(
   select directory.*,row_number() over(order by last_activity_on desc,patient_id) row_number
   from linkare_private.patient_directory_v1 directory
   where organization_id=org and not archived and last_activity_on between cutoff and local_day
    and (query_ts is null or search_vector@@query_ts)
    and (p_cursor is null or last_activity_on<cursor_activity or (last_activity_on=cursor_activity and patient_id>cursor_id))
   order by last_activity_on desc,patient_id limit p_limit+1
  ),page as(select * from candidates where row_number<=p_limit)
  select coalesce(jsonb_agg(jsonb_build_object('id',patient_id,'name',name,'phone',phone,'email',email,'insuranceProvider',insurance_provider,
   'archived',archived,'dataQuality',data_quality,'hasLegacyRecord',has_legacy_record,'lastActivityOn',last_activity_on,
   'lastActivityAt',last_activity_at,'lastActivityPrecision',last_activity_precision,'lastActivityOrigin',last_activity_origin,
   'nextAppointmentAt',next_appointment_at,'revision',source_revision,'projectionRevision',projection_revision) order by last_activity_on desc,patient_id),'[]'),
   exists(select 1 from candidates where row_number>p_limit)
  into items,has_more from page;
  if has_more then
   next_cursor:=jsonb_build_object('version',state.listing_version,'lastActivityOn',items->-1->>'lastActivityOn','patientId',items->-1->>'id');
  end if;
 else
  with candidates as(
   select directory.*,row_number() over(order by name_sort,patient_id) row_number
   from linkare_private.patient_directory_v1 directory
   where organization_id=org
    and case p_scope when 'all' then not archived when 'no_activity' then not archived and last_activity_on is null when 'archived' then archived else false end
    and (query_ts is null or search_vector@@query_ts)
    and (p_cursor is null or (name_sort,patient_id)>(cursor_name,cursor_id))
   order by name_sort,patient_id limit p_limit+1
  ),page as(select * from candidates where row_number<=p_limit)
  select coalesce(jsonb_agg(jsonb_build_object('id',patient_id,'name',name,'phone',phone,'email',email,'insuranceProvider',insurance_provider,
   'archived',archived,'dataQuality',data_quality,'hasLegacyRecord',has_legacy_record,'lastActivityOn',last_activity_on,
   'lastActivityAt',last_activity_at,'lastActivityPrecision',last_activity_precision,'lastActivityOrigin',last_activity_origin,
   'nextAppointmentAt',next_appointment_at,'revision',source_revision,'projectionRevision',projection_revision) order by name_sort,patient_id),'[]'),
   exists(select 1 from candidates where row_number>p_limit)
  into items,has_more from page;
  if has_more then
   select jsonb_build_object('version',state.listing_version,'nameSort',directory.name_sort,'patientId',directory.patient_id)
   into next_cursor from linkare_private.patient_directory_v1 directory
   where directory.organization_id=org and directory.patient_id=items->-1->>'id';
  end if;
 end if;
 return jsonb_build_object('items',items,'limit',p_limit,'hasMore',has_more,'nextCursor',next_cursor,'listingVersion',state.listing_version,
  'asOf',frozen,'cutoffDate',cutoff,'scope',p_scope,'query',coalesce(p_query,''),'policyVersion',state.policy_version);
end $$;
revoke all on function public.linkare_patient_directory_v1(uuid,text,text,jsonb,timestamptz,integer) from public,anon;
grant execute on function public.linkare_patient_directory_v1(uuid,text,text,jsonb,timestamptz,integer) to authenticated,service_role;

create function public.linkare_patient_detail_v1(org uuid,p_patient_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare admin public.linkare_records;clinical public.linkare_records;summary linkare_private.legacy_patient_summary_v1;patient jsonb;private_fields jsonb:='{}';revisions jsonb:='[]';medical boolean:=public.linkare_permission_v3(org,'clinicalView');capture boolean:=public.linkare_permission_v3(org,'medicationsCapture');
begin
 if auth.uid() is null or not public.linkare_permission_v3(org,'patientsView') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 select * into admin from public.linkare_records where organization_id=org and kind='patient_admin' and id=p_patient_id and not deleted;
 if not found then raise exception 'PATIENT_NOT_FOUND';end if;
 select * into clinical from public.linkare_records where organization_id=org and kind='patient_clinical' and id=p_patient_id and not deleted;
 select * into summary from linkare_private.legacy_patient_summary_v1 where organization_id=org and patient_id=p_patient_id;
 if clinical.organization_id is not null then
  if medical then private_fields:=clinical.payload-'documents';
  else
   if public.linkare_permission_v3(org,'prescriptionsEdit') then private_fields:=private_fields||jsonb_build_object('prescriptions',coalesce(clinical.payload->'prescriptions','[]'));end if;
   if capture then private_fields:=private_fields||jsonb_build_object('medications',coalesce((select jsonb_agg(jsonb_build_object('id',m->>'id','name',m->>'name','dose',m->>'dose','doseValue',m->'doseValue','doseUnit',m->>'doseUnit','frequency',m->>'frequency','frequencySlots',coalesce(m->'frequencySlots','[]'::jsonb),'customFrequency',m->>'customFrequency','route',m->>'route','startDate',m->>'startDate','status',m->>'status','source',m->>'source','reportedNotes',m->>'reportedNotes','createdAt',m->>'createdAt')) from jsonb_array_elements(coalesce(clinical.payload->'medications','[]')) m where m->>'source'='secretary_report' and coalesce(m->>'status','pending_review')='pending_review' and nullif(m->>'archivedAt','') is null),'[]'::jsonb));end if;
  end if;
  if public.linkare_permission_v3(org,'documentsView') then private_fields:=private_fields||jsonb_build_object('documents',coalesce(clinical.payload->'documents','[]'));end if;
 end if;
 patient:=admin.payload||private_fields||case when summary.patient_id is null then '{}'::jsonb else jsonb_build_object('dataQuality',summary.data_quality,'sourceSummary',summary.source_summary,'historicalProfile',summary.historical_profile) end;
 revisions:=jsonb_build_array(jsonb_build_object('kind','patient_admin','id',p_patient_id,'revision',admin.revision));
 if clinical.organization_id is not null and private_fields<>'{}'::jsonb then revisions:=revisions||jsonb_build_array(jsonb_build_object('kind','patient_clinical','id',p_patient_id,'revision',clinical.revision));end if;
 return jsonb_build_object('patient',patient,'revisions',revisions,'clinicalIncluded',medical,'loadedAt',clock_timestamp());
end $$;
revoke all on function public.linkare_patient_detail_v1(uuid,text) from public,anon;
grant execute on function public.linkare_patient_detail_v1(uuid,text) to authenticated,service_role;

create function public.linkare_agenda_range_v1(org uuid,p_start timestamptz,p_end timestamptz,p_calendar_ids uuid[] default null,p_cursor jsonb default null,p_limit integer default 200)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare state linkare_private.patient_directory_state_v1;items jsonb;has_more boolean;next_cursor jsonb;cursor_start timestamptz;cursor_id text;medical boolean:=public.linkare_permission_v3(org,'clinicalView');
begin
 if auth.uid() is null or not public.linkare_permission_v3(org,'appointmentsManage') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '62 days' or p_limit not between 1 and 200 then raise exception 'INVALID_AGENDA_RANGE';end if;
 select * into state from linkare_private.patient_directory_state_v1 where organization_id=org;if not found or not state.appointments_ready then raise exception 'DIRECTORY_NOT_READY';end if;
 if p_cursor is not null then
  if nullif(p_cursor->>'version','')::bigint is distinct from state.listing_version then raise exception 'CURSOR_STALE' using errcode='40001';end if;
  cursor_start:=(p_cursor->>'startAt')::timestamptz;cursor_id:=p_cursor->>'appointmentId';
 end if;
 with candidates as(
  select directory.*,record.payload||jsonb_build_object('__revision',directory.source_revision)||case when medical then coalesce(clinical.payload,'{}') else '{}'::jsonb end||
   case when directory.patient_id is null then '{}'::jsonb else jsonb_build_object('patientSummary',jsonb_build_object('id',patient.patient_id,'name',patient.name,'phone',patient.phone)) end payload,
   row_number() over(order by directory.start_at,directory.appointment_id) row_number
  from linkare_private.appointment_directory_v1 directory
  join public.linkare_records record on record.organization_id=directory.organization_id and record.kind='appointment' and record.id=directory.appointment_id and not record.deleted
  left join public.linkare_records clinical on clinical.organization_id=directory.organization_id and clinical.kind='appointment_clinical' and clinical.id=directory.appointment_id and not clinical.deleted and medical
  left join linkare_private.patient_directory_v1 patient on patient.organization_id=directory.organization_id and patient.patient_id=directory.patient_id
  where directory.organization_id=org and directory.start_at<p_end and directory.end_at>p_start
   and (p_calendar_ids is null or directory.calendar_id=any(p_calendar_ids))
   and public.linkare_calendar_permission_v1(org,directory.calendar_id,'View')
   and (p_cursor is null or (directory.start_at,directory.appointment_id)>(cursor_start,cursor_id))
  order by directory.start_at,directory.appointment_id limit p_limit+1
 ),page as(select * from candidates where row_number<=p_limit)
 select coalesce(jsonb_agg(payload order by start_at,appointment_id),'[]'),exists(select 1 from candidates where row_number>p_limit)
 into items,has_more from page;
 if has_more then
  select jsonb_build_object('version',state.listing_version,'startAt',appointment.start_at,'appointmentId',appointment.appointment_id)
  into next_cursor from linkare_private.appointment_directory_v1 appointment
  where appointment.organization_id=org and appointment.appointment_id=items->-1->>'id';
 end if;
 return jsonb_build_object('items',items,'hasMore',has_more,'nextCursor',next_cursor,'listingVersion',state.listing_version,'start',p_start,'end',p_end,'limit',p_limit);
end $$;
revoke all on function public.linkare_agenda_range_v1(uuid,timestamptz,timestamptz,uuid[],jsonb,integer) from public,anon;
grant execute on function public.linkare_agenda_range_v1(uuid,timestamptz,timestamptz,uuid[],jsonb,integer) to authenticated,service_role;

create function public.linkare_dashboard_summary_v1(org uuid,p_as_of timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare frozen timestamptz:=coalesce(p_as_of,clock_timestamp());local_day date;cutoff date;total bigint;recent bigint;archived bigint;without_activity bigint;today_appointments bigint;week_appointments bigint;
begin
 if auth.uid() is null or not public.linkare_permission_v3(org,'patientsView') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 local_day:=(frozen at time zone 'America/El_Salvador')::date;cutoff:=(local_day-interval '6 months')::date;
 select count(*) filter(where not directory.archived),count(*) filter(where not directory.archived and directory.last_activity_on between cutoff and local_day),count(*) filter(where directory.archived),count(*) filter(where not directory.archived and directory.last_activity_on is null)
 into total,recent,archived,without_activity from linkare_private.patient_directory_v1 directory where directory.organization_id=org;
 if public.linkare_permission_v3(org,'appointmentsManage') then
  select count(*) filter(where (start_at at time zone 'America/El_Salvador')::date=local_day and status<>'cancelled'),
   count(*) filter(where (start_at at time zone 'America/El_Salvador')::date>=local_day-date_part('dow',local_day)::integer and (start_at at time zone 'America/El_Salvador')::date<local_day-date_part('dow',local_day)::integer+7 and status<>'cancelled')
  into today_appointments,week_appointments from linkare_private.appointment_directory_v1 appointment
  where organization_id=org and public.linkare_calendar_permission_v1(org,appointment.calendar_id,'View');
 end if;
 return jsonb_build_object('asOf',frozen,'cutoffDate',cutoff,'patients',jsonb_build_object('total',coalesce(total,0),'recent',coalesce(recent,0),'archived',coalesce(archived,0),'withoutActivity',coalesce(without_activity,0)),
  'appointments',jsonb_build_object('today',coalesce(today_appointments,0),'week',coalesce(week_appointments,0)),'activityPolicyVersion',1);
end $$;
revoke all on function public.linkare_dashboard_summary_v1(uuid,timestamptz) from public,anon;
grant execute on function public.linkare_dashboard_summary_v1(uuid,timestamptz) to authenticated,service_role;

create function public.linkare_legacy_patient_history_v2(org uuid,p_patient_id text,p_scope text default 'all',p_cursor jsonb default null,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare can_clinical boolean:=public.linkare_permission_v3(org,'clinicalView');items jsonb;has_more boolean;next_cursor jsonb;cursor_date date;cursor_id uuid;
begin
 if auth.uid() is null or not public.linkare_permission_v3(org,'patientsView') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 if p_scope not in('all','administrative','clinical') or p_limit not between 1 and 20 or (p_scope='clinical' and not can_clinical) then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 if not exists(select 1 from public.linkare_records where organization_id=org and kind='patient_admin' and id=p_patient_id and not deleted) then raise exception 'PATIENT_NOT_FOUND';end if;
 if p_cursor is not null then cursor_date:=nullif(p_cursor->>'occurredOn','')::date;cursor_id:=(p_cursor->>'id')::uuid;end if;
 with candidates as(
  select history.*,row_number() over(order by occurred_on desc nulls last,id desc) row_number
  from linkare_private.legacy_history_v1 history
  where organization_id=org and patient_id=p_patient_id and (scope='administrative' or can_clinical)
   and (p_scope='all' or scope=p_scope)
   and (p_cursor is null or (cursor_date is not null and (occurred_on<cursor_date or (occurred_on=cursor_date and id<cursor_id))) or (cursor_date is null and occurred_on is null and id<cursor_id))
  order by occurred_on desc nulls last,id desc limit p_limit+1
 ),page as(select * from candidates where row_number<=p_limit)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'scope',scope,'occurredOn',occurred_on,'title',title,'payload',payload) order by occurred_on desc nulls last,id desc),'[]'),
  exists(select 1 from candidates where row_number>p_limit) into items,has_more from page;
 if has_more then
  select jsonb_build_object('occurredOn',history.occurred_on,'id',history.id)
  into next_cursor from linkare_private.legacy_history_v1 history
  where history.organization_id=org and history.id=(items->-1->>'id')::uuid;
 end if;
 return jsonb_build_object('items',items,'hasMore',has_more,'nextCursor',next_cursor,'limit',p_limit,'clinicalIncluded',can_clinical,'scope',p_scope);
end $$;
revoke all on function public.linkare_legacy_patient_history_v2(uuid,text,text,jsonb,integer) from public,anon;
grant execute on function public.linkare_legacy_patient_history_v2(uuid,text,text,jsonb,integer) to authenticated,service_role;

-- Phase 1 imports remain compatible. Each chunk refreshes only affected patients
-- after the canonical history writes have committed inside the same transaction.
alter function public.linkare_legacy_apply_v2(uuid,uuid,text,jsonb) rename to linkare_legacy_apply_pre_directory_v2;
revoke all on function public.linkare_legacy_apply_pre_directory_v2(uuid,uuid,text,jsonb) from public,anon,authenticated;
create function public.linkare_legacy_apply_v2(org uuid,p_batch_id uuid,p_backup_sha text,p_records jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;patient text;
begin
 result:=public.linkare_legacy_apply_pre_directory_v2(org,p_batch_id,p_backup_sha,p_records);
 for patient in
  select distinct patient_id from(
   select nullif(value->>'destinationId','') patient_id from jsonb_array_elements(p_records) where value->>'destinationKind'='patient_admin'
   union all
   select history->>'patientId' from jsonb_array_elements(p_records) source cross join lateral jsonb_array_elements(coalesce(source->'historyEntries','[]')) history
  ) affected where patient_id is not null
 loop perform linkare_private.refresh_patient_v1(org,patient);end loop;
 return result;
end $$;
revoke all on function public.linkare_legacy_apply_v2(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.linkare_legacy_apply_v2(uuid,uuid,text,jsonb) to service_role;

revoke all on function linkare_private.search_normalize_v1(text),linkare_private.search_query_v1(text),
 linkare_private.try_timestamptz_v1(text),linkare_private.bump_directory_version_v1(uuid),
 linkare_private.initialize_directory_state_v1(),
 linkare_private.refresh_appointment_v1(uuid,text),linkare_private.refresh_patient_v1(uuid,text),
 linkare_private.records_projection_trigger_v1() from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
