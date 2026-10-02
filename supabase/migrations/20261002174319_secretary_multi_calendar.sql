begin;

create table public.linkare_calendars_v1 (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 code text not null check(code in ('doctor','wife','general')),
 name text not null check(length(trim(name)) between 1 and 80),
 visual_key text not null check(visual_key in ('stethoscope','heart','users')),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,code),
 unique(organization_id,id)
);
create index linkare_calendars_active_v1 on public.linkare_calendars_v1(organization_id,is_active,code);

insert into public.linkare_calendars_v1(organization_id,code,name,visual_key)
select organization.id,calendar.code,calendar.name,calendar.visual_key
from public.organizations organization
cross join (values ('doctor','Doctor','stethoscope'),('wife','Esposa','heart'),('general','General','users')) calendar(code,name,visual_key)
on conflict(organization_id,code) do nothing;

create or replace function public.linkare_seed_calendars_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.linkare_calendars_v1(organization_id,code,name,visual_key) values
  (new.id,'doctor','Doctor','stethoscope'),(new.id,'wife','Esposa','heart'),(new.id,'general','General','users')
 on conflict(organization_id,code) do nothing;
 return new;
end $$;
create trigger linkare_seed_calendars_v1 after insert on public.organizations for each row execute function public.linkare_seed_calendars_v1();
revoke all on function public.linkare_seed_calendars_v1() from public,anon,authenticated;

-- Every historical live appointment in the audited production set is patient-bound and
-- belonged to the single clinical agenda. General is deliberately never an automatic target.
update public.linkare_records record
set payload=record.payload||jsonb_build_object('calendarId',calendar.id::text,'eventType','appointment')
from public.linkare_calendars_v1 calendar
where record.organization_id=calendar.organization_id and calendar.code='doctor'
 and record.kind='appointment' and not record.deleted
 and nullif(record.payload->>'calendarId','') is null;

-- Preserve the intent of existing Secretary agenda grants during the upgrade.
update public.organization_members
set permissions=permissions||'{"calendarDoctorView":true,"calendarDoctorCreate":true,"calendarDoctorEdit":true,"calendarDoctorCancel":true,"calendarDoctorDelete":true,"calendarWifeView":true,"calendarWifeCreate":true,"calendarWifeEdit":true,"calendarWifeCancel":true,"calendarWifeDelete":true,"calendarGeneralView":true,"calendarGeneralCreate":true,"calendarGeneralEdit":true,"calendarGeneralCancel":true,"calendarGeneralDelete":true}'::jsonb
where role::text='secretary' and coalesce((permissions->>'appointmentsManage')::boolean,false);
update public.linkare_invites_v3
set permissions=permissions||'{"calendarDoctorView":true,"calendarDoctorCreate":true,"calendarDoctorEdit":true,"calendarDoctorCancel":true,"calendarDoctorDelete":true,"calendarWifeView":true,"calendarWifeCreate":true,"calendarWifeEdit":true,"calendarWifeCancel":true,"calendarWifeDelete":true,"calendarGeneralView":true,"calendarGeneralCreate":true,"calendarGeneralEdit":true,"calendarGeneralCancel":true,"calendarGeneralDelete":true}'::jsonb
where requested_role::text='secretary' and status='pending' and coalesce((permissions->>'appointmentsManage')::boolean,false);

create or replace function public.linkare_permission_v3(org uuid,p text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare m public.organization_members; view_key text;
begin
 if p is null or not p=any(array[
  'patientsView','patientsCreate','patientsEdit','appointmentsManage','remindersManage','clinicalView','clinicalEdit','medicationsManage','medicationsCapture','prescriptionsCreate','prescriptionsEdit','documentsView','documentsManage','documentsGenerateAdministrative','documentsGenerateClinical','consultationsManage','postmortemExport','alertsView','analyticsView','exportsManage','settingsManage','usersManage','billingManage','accessManage',
  'calendarDoctorView','calendarDoctorCreate','calendarDoctorEdit','calendarDoctorCancel','calendarDoctorDelete','calendarWifeView','calendarWifeCreate','calendarWifeEdit','calendarWifeCancel','calendarWifeDelete','calendarGeneralView','calendarGeneralCreate','calendarGeneralEdit','calendarGeneralCancel','calendarGeneralDelete'
 ]) then return false;end if;
 select * into m from public.organization_members where organization_id=org and user_id=(select auth.uid()) and active limit 1;
 if not found then return false;end if;
 if m.role::text='owner' then return true;end if;
 if p=any(array['settingsManage','usersManage','billingManage','accessManage']) or m.role::text not in('psychiatrist','clinical_assistant','secretary') then return false;end if;
 if m.role::text='secretary' and p='appointmentsManage' then
  return exists(select 1 from jsonb_each_text(m.permissions) permission where permission.key like 'calendar%View' and permission.value='true');
 end if;
 if m.role::text='secretary' and not (p=any(array['patientsView','patientsCreate','patientsEdit','appointmentsManage','remindersManage','medicationsCapture','prescriptionsEdit','documentsGenerateAdministrative']) or p like 'calendar%') then return false;end if;
 if coalesce(m.permissions->p,'false'::jsonb)<>'true'::jsonb then return false;end if;
 if p like 'calendar%' and p not like '%View' then
  view_key:=regexp_replace(p,'(Create|Edit|Cancel|Delete)$','View');
  if coalesce(m.permissions->view_key,'false'::jsonb)<>'true'::jsonb then return false;end if;
 end if;
 if p=any(array['clinicalView','clinicalEdit','medicationsManage','medicationsCapture','prescriptionsCreate','prescriptionsEdit','documentsView','documentsManage','documentsGenerateAdministrative','documentsGenerateClinical','consultationsManage','postmortemExport','analyticsView','patientsEdit']) and coalesce(m.permissions->'patientsView','false'::jsonb)<>'true'::jsonb then return false;end if;
 if p=any(array['clinicalEdit','medicationsManage','prescriptionsCreate','documentsGenerateClinical','consultationsManage','postmortemExport','analyticsView']) and coalesce(m.permissions->'clinicalView','false'::jsonb)<>'true'::jsonb then return false;end if;
 if p='documentsManage' and coalesce(m.permissions->'documentsView','false'::jsonb)<>'true'::jsonb then return false;end if;
 return true;
end $$;

create or replace function public.linkare_calendar_permission_v1(org uuid,calendar_id uuid,requested_action text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare calendar_code text; role_name text; permission_name text;
begin
 if requested_action not in('View','Create','Edit','Cancel','Delete') then return false;end if;
 select code into calendar_code from public.linkare_calendars_v1 where organization_id=org and id=calendar_id and is_active;
 if calendar_code is null then return false;end if;
 role_name:=public.linkare_role_v3(org);if role_name='owner' then return true;end if;
 permission_name:='calendar'||upper(left(calendar_code,1))||substr(calendar_code,2)||requested_action;
 if public.linkare_permission_v3(org,permission_name) then return true;end if;
 return role_name in('psychiatrist','clinical_assistant') and public.linkare_permission_v3(org,'appointmentsManage');
end $$;
revoke all on function public.linkare_calendar_permission_v1(uuid,uuid,text) from public,anon;
grant execute on function public.linkare_calendar_permission_v1(uuid,uuid,text) to authenticated,service_role;

alter table public.linkare_calendars_v1 enable row level security;
revoke all on public.linkare_calendars_v1 from public,anon,authenticated;
grant select on public.linkare_calendars_v1 to authenticated;
grant all on public.linkare_calendars_v1 to service_role;
create policy linkare_calendars_read_v1 on public.linkare_calendars_v1 for select to authenticated
 using(public.linkare_calendar_permission_v1(organization_id,id,'View'));

create or replace function public.linkare_load_state_v3(org uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare medical boolean:=public.linkare_permission_v3(org,'clinicalView'); capture boolean:=public.linkare_permission_v3(org,'medicationsCapture'); r text:=public.linkare_role_v3(org); profile jsonb; settings jsonb; users_json jsonb; patients_json jsonb; appointments_json jsonb; calendars_json jsonb; alerts_json jsonb; revs jsonb;
begin
 if r is null or r not in ('owner','psychiatrist','clinical_assistant','secretary') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 select payload into profile from public.linkare_records where organization_id=org and kind='profile' and id='clinic' and not deleted;
 select payload into settings from public.linkare_records where organization_id=org and kind='settings' and id='clinic' and not deleted;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',m.display_name,'email',u.email,'role',case m.role::text when 'owner' then 'owner' when 'psychiatrist' then 'doctor' when 'clinical_assistant' then 'nurse' else 'secretary' end,'active',m.active,'title',m.professional_title,'phone',m.phone,'permissions',m.permissions)),'[]') into users_json from public.organization_members m join auth.users u on u.id=m.user_id where m.organization_id=org and (r='owner' or m.user_id=(select auth.uid()));
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'code',c.code,'name',c.name,'visualKey',c.visual_key,'isActive',c.is_active) order by array_position(array['doctor','wife','general'],c.code)),'[]') into calendars_json from public.linkare_calendars_v1 c where c.organization_id=org and c.is_active and public.linkare_calendar_permission_v1(org,c.id,'View');
 select coalesce(jsonb_agg(a.payload||case when medical then coalesce(c.payload,'{}')-'documents' else (case when public.linkare_permission_v3(org,'prescriptionsEdit') then jsonb_build_object('prescriptions',coalesce(c.payload->'prescriptions','[]')) else '{}'::jsonb end)||(case when capture then jsonb_build_object('medications',coalesce((select jsonb_agg(jsonb_build_object('id',m->>'id','name',m->>'name','dose',m->>'dose','doseValue',m->'doseValue','doseUnit',m->>'doseUnit','frequency',m->>'frequency','frequencySlots',coalesce(m->'frequencySlots','[]'::jsonb),'customFrequency',m->>'customFrequency','route',m->>'route','startDate',m->>'startDate','status',m->>'status','source',m->>'source','reportedNotes',m->>'reportedNotes','createdAt',m->>'createdAt')) from jsonb_array_elements(coalesce(c.payload->'medications','[]')) m where m->>'source'='secretary_report' and coalesce(m->>'status','pending_review')='pending_review' and nullif(m->>'archivedAt','') is null),'[]'::jsonb)) else '{}'::jsonb end) end||case when public.linkare_permission_v3(org,'documentsView') then jsonb_build_object('documents',coalesce(c.payload->'documents','[]')) else '{}'::jsonb end),'[]') into patients_json
 from public.linkare_records a left join public.linkare_records c on c.organization_id=a.organization_id and c.kind='patient_clinical' and c.id=a.id and not c.deleted and (medical or capture or public.linkare_permission_v3(org,'documentsView') or public.linkare_permission_v3(org,'prescriptionsEdit')) where a.organization_id=org and a.kind='patient_admin' and not a.deleted and public.linkare_permission_v3(org,'patientsView');
 select coalesce(jsonb_agg(a.payload||coalesce(c.payload,'{}')),'[]') into appointments_json from public.linkare_records a join public.linkare_calendars_v1 calendar on calendar.organization_id=a.organization_id and calendar.id::text=a.payload->>'calendarId' left join public.linkare_records c on c.organization_id=a.organization_id and c.kind='appointment_clinical' and c.id=a.id and not c.deleted and medical where a.organization_id=org and a.kind='appointment' and not a.deleted and public.linkare_calendar_permission_v1(org,calendar.id,'View');
 select coalesce(jsonb_agg(payload),'[]') into alerts_json from public.linkare_records where organization_id=org and kind='alert' and not deleted and public.linkare_permission_v3(org,'alertsView');
 select coalesce(jsonb_agg(jsonb_build_object('kind',record.kind,'id',record.id,'revision',record.revision)),'[]') into revs from public.linkare_records record where record.organization_id=org and (record.kind in('profile','settings') or (record.kind='patient_clinical' and (medical or capture or public.linkare_permission_v3(org,'documentsView') or public.linkare_permission_v3(org,'prescriptionsEdit'))) or (record.kind='appointment_clinical' and medical and exists(select 1 from public.linkare_records appointment join public.linkare_calendars_v1 calendar on calendar.id::text=appointment.payload->>'calendarId' and calendar.organization_id=org where appointment.organization_id=org and appointment.kind='appointment' and appointment.id=record.id and public.linkare_calendar_permission_v1(org,calendar.id,'View'))) or (record.kind='alert' and public.linkare_permission_v3(org,'alertsView')) or (record.kind='patient_admin' and public.linkare_permission_v3(org,'patientsView')) or (record.kind='appointment' and exists(select 1 from public.linkare_calendars_v1 calendar where calendar.organization_id=org and calendar.id::text=record.payload->>'calendarId' and public.linkare_calendar_permission_v1(org,calendar.id,'View'))));
 return jsonb_build_object('organizationId',org,'entitled',public.linkare_entitled_v3(org),'complimentaryAccess',coalesce((select complimentary_access from public.linkare_subscriptions_v3 where organization_id=org),false),'memberRole',case r when 'owner' then 'owner' when 'psychiatrist' then 'doctor' when 'clinical_assistant' then 'nurse' else 'secretary' end,'userId',(select auth.uid()),'revisions',revs,'payload',jsonb_build_object('organization',coalesce(profile,'{}'),'settings',coalesce(settings,'{}')||jsonb_build_object('activeUserId',(select auth.uid())),'users',users_json,'calendars',calendars_json,'patients',patients_json,'appointments',appointments_json,'alerts',alerts_json,'payments','[]'::jsonb));
end $$;

-- Keep the thoroughly-tested clinical writer intact and wrap only agenda records.
alter function public.linkare_save_changes_v3(uuid,jsonb) rename to linkare_save_changes_legacy_v3;
revoke all on function public.linkare_save_changes_legacy_v3(uuid,jsonb) from public,anon,authenticated;

create function public.linkare_save_changes_v3(org uuid,changes jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb; other_changes jsonb; result jsonb:='[]'; old public.linkare_records; val jsonb; rid text; v bigint; removed boolean; old_calendar uuid; new_calendar uuid; old_code text; new_code text; reminder_only boolean:=false;
begin
 if public.linkare_role_v3(org) is null or public.linkare_role_v3(org) not in('owner','psychiatrist','clinical_assistant','secretary') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 if changes is null or jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>250 or octet_length(changes::text)>12000000 then raise exception 'INVALID_BATCH';end if;
 for item in select value from jsonb_array_elements(changes) where value->>'kind'='appointment' order by value->>'id' loop
  rid:=item->>'id';removed:=coalesce((item->>'deleted')::boolean,false);val:=coalesce(item->'payload','{}');
  if rid is null or length(rid) not between 1 and 160 or jsonb_typeof(val)<>'object' or octet_length(val::text)>4000000 then raise exception 'INVALID_RECORD';end if;
  perform pg_advisory_xact_lock(hashtextextended(org::text||':appointment:'||rid,303));
  select * into old from public.linkare_records where organization_id=org and kind='appointment' and id=rid for update;v:=coalesce(old.revision,0);
  if v<>coalesce((item->>'expectedRevision')::bigint,0) then raise exception 'REVISION_CONFLICT:appointment:%',rid using errcode='40001';end if;
  if not public.linkare_entitled_v3(org) then raise exception 'SUBSCRIPTION_REQUIRED';end if;
  old_calendar:=nullif(old.payload->>'calendarId','')::uuid;
  if v>0 and not removed and public.linkare_permission_v3(org,'remindersManage') and public.linkare_calendar_permission_v1(org,old_calendar,'View') and (val-array['id','reminderLog','updatedAt'])=(old.payload-array['id','reminderLog','updatedAt']) then reminder_only:=true;val:=old.payload||public.linkare_pick_v3(val,array['reminderLog','updatedAt']);else reminder_only:=false;end if;
  if not reminder_only then
   val:=public.linkare_pick_v3(val,array['id','calendarId','eventType','patientId','title','start','end','type','modality','status','reminderLog','googleEventId','googleEventUrl','createdAt','updatedAt','adminReviewStatus','confirmedAt','confirmedBy','cancelledAt','cancelledBy','reviewedAt','reviewedBy']);
   if not removed then
    begin new_calendar:=(val->>'calendarId')::uuid;exception when others then raise exception 'CALENDAR_REQUIRED';end;
    select code into new_code from public.linkare_calendars_v1 where organization_id=org and id=new_calendar and is_active;if new_code is null then raise exception 'CALENDAR_NOT_FOUND';end if;
    if coalesce(val->>'eventType','appointment')='general' then
     if new_code<>'general' then raise exception 'GENERAL_CALENDAR_REQUIRED';end if;
     val:=(val-'patientId')||jsonb_build_object('eventType','general');
     if nullif(trim(val->>'title'),'') is null then raise exception 'EVENT_TITLE_REQUIRED';end if;
    else
     val:=val||jsonb_build_object('eventType','appointment');
     if not exists(select 1 from public.linkare_records where organization_id=org and kind='patient_admin' and id=val->>'patientId' and not deleted) and not exists(select 1 from jsonb_array_elements(changes) pending where pending->>'kind'='patient_admin' and pending->>'id'=val->>'patientId') then raise exception 'PATIENT_NOT_FOUND';end if;
    end if;
    if nullif(val->>'start','') is null or nullif(val->>'end','') is null or (val->>'end')::timestamptz<=(val->>'start')::timestamptz then raise exception 'INVALID_APPOINTMENT_TIME';end if;
   end if;
   if v=0 then
    if removed or not public.linkare_calendar_permission_v1(org,new_calendar,'Create') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
   elsif removed then
    if not public.linkare_calendar_permission_v1(org,old_calendar,'Delete') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
   elsif new_calendar is distinct from old_calendar then
    if not public.linkare_calendar_permission_v1(org,old_calendar,'Edit') or not public.linkare_calendar_permission_v1(org,new_calendar,'Create') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
   elsif val->>'status'='cancelled' and old.payload->>'status' is distinct from 'cancelled' then
    if not public.linkare_calendar_permission_v1(org,old_calendar,'Cancel') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
   elsif not public.linkare_calendar_permission_v1(org,old_calendar,'Edit') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
   if old.payload->'reminderLog' is distinct from val->'reminderLog' and coalesce(val->'reminderLog','[]')<>'[]'::jsonb and not public.linkare_permission_v3(org,'remindersManage') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
  end if;
  val:=val||jsonb_build_object('id',rid);
  insert into public.linkare_records(organization_id,kind,id,payload,revision,deleted,updated_by) values(org,'appointment',rid,val,v+1,removed,(select auth.uid())) on conflict(organization_id,kind,id) do update set payload=excluded.payload,revision=excluded.revision,deleted=excluded.deleted,updated_at=now(),updated_by=(select auth.uid());
  insert into public.linkare_audit_v3(organization_id,actor_id,action,kind,record_id,revision,fingerprint) values(org,(select auth.uid()),case when removed then 'appointment.deleted' when reminder_only then 'appointment.reminder_updated' else 'appointment.saved' end,'appointment',rid,v+1,encode(sha256(convert_to(val::text,'UTF8')),'hex'));
  result:=result||jsonb_build_array(jsonb_build_object('kind','appointment','id',rid,'revision',v+1));
 end loop;
 select coalesce(jsonb_agg(value),'[]'::jsonb) into other_changes from jsonb_array_elements(changes) where value->>'kind'<>'appointment';
 if jsonb_array_length(other_changes)>0 then result:=result||public.linkare_save_changes_legacy_v3(org,other_changes);end if;
 return result;
end $$;
revoke all on function public.linkare_save_changes_v3(uuid,jsonb) from public,anon;
grant execute on function public.linkare_save_changes_v3(uuid,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
