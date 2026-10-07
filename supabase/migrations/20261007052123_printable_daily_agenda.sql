begin;

-- A narrowly scoped projection lets staff prepare the doctor's paper schedule
-- without granting access to the patient's private clinical chart.
create table linkare_private.appointment_agenda_note_v1 (
 organization_id uuid not null references public.organizations(id),
 appointment_id text not null,
 note text not null default '' check (length(note) <= 2000),
 revision bigint not null default 1 check (revision > 0),
 updated_at timestamptz not null default now(),
 updated_by uuid not null,
 primary key (organization_id, appointment_id)
);
create table linkare_private.appointment_agenda_note_audit_v1 (
 id bigint generated always as identity primary key,
 organization_id uuid not null references public.organizations(id),
 appointment_id text not null,
 old_note text not null,
 new_note text not null,
 revision bigint not null,
 changed_at timestamptz not null default now(),
 changed_by uuid not null
);
create index appointment_agenda_note_audit_lookup_v1
 on linkare_private.appointment_agenda_note_audit_v1 (organization_id, appointment_id, revision);
alter table linkare_private.appointment_agenda_note_v1 enable row level security;
alter table linkare_private.appointment_agenda_note_audit_v1 enable row level security;
revoke all on linkare_private.appointment_agenda_note_v1, linkare_private.appointment_agenda_note_audit_v1 from public, anon, authenticated;
grant all on linkare_private.appointment_agenda_note_v1, linkare_private.appointment_agenda_note_audit_v1 to service_role;

-- Respect explicit false grants on existing memberships and invitations.
update public.organization_members set permissions = jsonb_set(permissions, '{agendaSheetView}', 'true'::jsonb, true)
where active and role::text in ('secretary','psychiatrist','clinical_assistant')
 and not permissions ? 'agendaSheetView'
 and coalesce((permissions->>'patientsView')::boolean,false)
 and (coalesce((permissions->>'calendarDoctorView')::boolean,false) or
      (role::text <> 'secretary' and coalesce((permissions->>'appointmentsManage')::boolean,false)));
update public.organization_members set permissions = jsonb_set(permissions, '{agendaSheetEdit}', 'true'::jsonb, true)
where active and role::text in ('secretary','psychiatrist','clinical_assistant')
 and not permissions ? 'agendaSheetEdit'
 and coalesce((permissions->>'agendaSheetView')::boolean,false)
 and (coalesce((permissions->>'calendarDoctorEdit')::boolean,false) or
      (role::text <> 'secretary' and coalesce((permissions->>'appointmentsManage')::boolean,false)));
update public.linkare_invites_v3 set permissions = jsonb_set(permissions, '{agendaSheetView}', 'true'::jsonb, true)
where status='pending' and requested_role::text='secretary' and not permissions ? 'agendaSheetView'
 and coalesce((permissions->>'patientsView')::boolean,false)
 and coalesce((permissions->>'calendarDoctorView')::boolean,false);
update public.linkare_invites_v3 set permissions = jsonb_set(permissions, '{agendaSheetEdit}', 'true'::jsonb, true)
where status='pending' and requested_role::text='secretary' and not permissions ? 'agendaSheetEdit'
 and coalesce((permissions->>'agendaSheetView')::boolean,false)
 and coalesce((permissions->>'calendarDoctorEdit')::boolean,false);

create or replace function public.linkare_permission_v3(org uuid,p text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare m public.organization_members; view_key text;
begin
 if p is null or not p=any(array[
  'patientsView','patientsCreate','patientsEdit','consultationFeeView','consultationFeeEdit','appointmentsManage','agendaSheetView','agendaSheetEdit','remindersManage','clinicalView','clinicalEdit','medicationsManage','medicationsCapture','prescriptionsCreate','prescriptionsEdit','documentsView','documentsManage','documentsGenerateAdministrative','documentsGenerateClinical','consultationsManage','postmortemExport','alertsView','analyticsView','exportsManage','settingsManage','usersManage','billingManage','accessManage',
  'calendarDoctorView','calendarDoctorCreate','calendarDoctorEdit','calendarDoctorCancel','calendarDoctorDelete','calendarWifeView','calendarWifeCreate','calendarWifeEdit','calendarWifeCancel','calendarWifeDelete','calendarGeneralView','calendarGeneralCreate','calendarGeneralEdit','calendarGeneralCancel','calendarGeneralDelete'
 ]) then return false;end if;
 select * into m from public.organization_members where organization_id=org and user_id=(select auth.uid()) and active limit 1;
 if not found then return false;end if;
 if m.role::text='owner' then return true;end if;
 if p=any(array['settingsManage','usersManage','billingManage','accessManage']) or m.role::text not in('psychiatrist','clinical_assistant','secretary') then return false;end if;
 if m.role::text='secretary' and p='appointmentsManage' then return exists(select 1 from jsonb_each_text(m.permissions) permission where permission.key like 'calendar%View' and permission.value='true');end if;
 if m.role::text='secretary' and not (p=any(array['patientsView','patientsCreate','patientsEdit','consultationFeeView','consultationFeeEdit','appointmentsManage','agendaSheetView','agendaSheetEdit','remindersManage','medicationsCapture','prescriptionsEdit','documentsGenerateAdministrative']) or p like 'calendar%') then return false;end if;
 if coalesce(m.permissions->p,'false'::jsonb)<>'true'::jsonb then return false;end if;
 if p like 'calendar%' and p not like '%View' then view_key:=regexp_replace(p,'(Create|Edit|Cancel|Delete)$','View');if coalesce(m.permissions->view_key,'false'::jsonb)<>'true'::jsonb then return false;end if;end if;
 if p=any(array['clinicalView','clinicalEdit','medicationsManage','medicationsCapture','prescriptionsCreate','prescriptionsEdit','documentsView','documentsManage','documentsGenerateAdministrative','documentsGenerateClinical','consultationsManage','postmortemExport','analyticsView','patientsEdit','consultationFeeView','consultationFeeEdit','agendaSheetView','agendaSheetEdit']) and coalesce(m.permissions->'patientsView','false'::jsonb)<>'true'::jsonb then return false;end if;
 if p='consultationFeeEdit' and (coalesce(m.permissions->'consultationFeeView','false'::jsonb)<>'true'::jsonb or coalesce(m.permissions->'patientsEdit','false'::jsonb)<>'true'::jsonb) then return false;end if;
 if p='agendaSheetEdit' and coalesce(m.permissions->'agendaSheetView','false'::jsonb)<>'true'::jsonb then return false;end if;
 if p=any(array['clinicalEdit','medicationsManage','prescriptionsCreate','documentsGenerateClinical','consultationsManage','postmortemExport','analyticsView']) and coalesce(m.permissions->'clinicalView','false'::jsonb)<>'true'::jsonb then return false;end if;
 if p='documentsManage' and coalesce(m.permissions->'documentsView','false'::jsonb)<>'true'::jsonb then return false;end if;
 return true;
end $$;

create function public.linkare_printable_agenda_v1(org uuid, agenda_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare tz text; doctor_calendar uuid; items jsonb;
begin
 if agenda_date is null or auth.uid() is null or not public.linkare_permission_v3(org,'agendaSheetView') then
  raise exception 'ACCESS_DENIED' using errcode='42501';
 end if;
 select id into doctor_calendar from public.linkare_calendars_v1
 where organization_id=org and code='doctor' and is_active;
 if doctor_calendar is null or not public.linkare_calendar_permission_v1(org,doctor_calendar,'View') then
  raise exception 'ACCESS_DENIED' using errcode='42501';
 end if;
 select coalesce(nullif(payload->>'timezone',''),'America/El_Salvador') into tz
 from public.linkare_records where organization_id=org and kind='settings' and id='clinic' and not deleted;
 tz:=coalesce(tz,'America/El_Salvador');
 begin perform now() at time zone tz; exception when invalid_parameter_value then tz:='America/El_Salvador'; end;

 select coalesce(jsonb_agg(jsonb_build_object(
   'appointmentId',a.appointment_id,'patientId',a.patient_id,'patientName',p.name,
   'start',a.start_at,'end',a.end_at,'status',a.status,
   'medications',coalesce(m.medications,'[]'::jsonb),
   'agendaNote',coalesce(n.note,''),'noteRevision',coalesce(n.revision,0)
 ) order by a.start_at,a.appointment_id),'[]'::jsonb) into items
 from linkare_private.appointment_directory_v1 a
 join linkare_private.patient_directory_v1 p on p.organization_id=a.organization_id and p.patient_id=a.patient_id
 left join public.linkare_records pc on pc.organization_id=a.organization_id and pc.kind='patient_clinical' and pc.id=a.patient_id and not pc.deleted
 left join lateral (
   select jsonb_agg(jsonb_build_object('name',med->>'name','dose',med->>'dose',
    'frequency',med->>'frequency','route',med->>'route')
    order by coalesce((med->>'isPrimary')::boolean,false) desc, med->>'name') medications
   from jsonb_array_elements(case when jsonb_typeof(pc.payload->'medications')='array'
    then pc.payload->'medications' else '[]'::jsonb end) med
   where med->>'status'='active' and nullif(med->>'archivedAt','') is null
     and nullif(trim(med->>'name'),'') is not null
 ) m on true
 left join linkare_private.appointment_agenda_note_v1 n
  on n.organization_id=a.organization_id and n.appointment_id=a.appointment_id
 where a.organization_id=org and a.calendar_id=doctor_calendar and a.event_type='appointment'
   and a.status not in ('cancelled','no_show')
   and a.start_at >= (agenda_date::timestamp at time zone tz)
   and a.start_at < ((agenda_date+1)::timestamp at time zone tz);
 return jsonb_build_object('date',agenda_date,'timezone',tz,'items',items);
end $$;
revoke all on function public.linkare_printable_agenda_v1(uuid,date) from public,anon;
grant execute on function public.linkare_printable_agenda_v1(uuid,date) to authenticated;

create function public.linkare_save_agenda_note_v1(org uuid,p_appointment_id text,p_note text,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare doctor_calendar uuid; old_note linkare_private.appointment_agenda_note_v1; cleaned text:=trim(coalesce(p_note,'')); new_revision bigint;
begin
 if auth.uid() is null or not public.linkare_permission_v3(org,'agendaSheetEdit')
   or p_expected_revision is null or p_expected_revision < 0 or p_appointment_id is null then
  raise exception 'ACCESS_DENIED' using errcode='42501';
 end if;
 if length(cleaned)>2000 then raise exception 'AGENDA_NOTE_TOO_LONG' using errcode='22001'; end if;
 select id into doctor_calendar from public.linkare_calendars_v1
 where organization_id=org and code='doctor' and is_active;
 if doctor_calendar is null or not public.linkare_calendar_permission_v1(org,doctor_calendar,'View')
    or not public.linkare_calendar_permission_v1(org,doctor_calendar,'Edit')
    or not exists(select 1 from linkare_private.appointment_directory_v1 a
      where a.organization_id=org and a.appointment_id=p_appointment_id
        and a.calendar_id=doctor_calendar and a.event_type='appointment') then
  raise exception 'ACCESS_DENIED' using errcode='42501';
 end if;
 select * into old_note from linkare_private.appointment_agenda_note_v1
 where organization_id=org and appointment_id=p_appointment_id for update;
 if not found then
  if p_expected_revision<>0 then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
  insert into linkare_private.appointment_agenda_note_v1(organization_id,appointment_id,note,revision,updated_by)
  values(org,p_appointment_id,cleaned,1,auth.uid()) on conflict do nothing returning revision into new_revision;
  if new_revision is null then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
  if cleaned<>'' then
   insert into linkare_private.appointment_agenda_note_audit_v1
   (organization_id,appointment_id,old_note,new_note,revision,changed_by)
   values(org,p_appointment_id,'',cleaned,1,auth.uid());
  end if;
  return jsonb_build_object('note',cleaned,'revision',1);
 end if;
 if old_note.revision is distinct from p_expected_revision then
  raise exception 'REVISION_CONFLICT' using errcode='40001';
 end if;
 if old_note.note=cleaned then return jsonb_build_object('note',cleaned,'revision',old_note.revision); end if;
 new_revision:=old_note.revision+1;
 update linkare_private.appointment_agenda_note_v1
 set note=cleaned,revision=new_revision,updated_at=now(),updated_by=auth.uid()
 where organization_id=org and appointment_id=p_appointment_id;
 insert into linkare_private.appointment_agenda_note_audit_v1
 (organization_id,appointment_id,old_note,new_note,revision,changed_by)
 values(org,p_appointment_id,old_note.note,cleaned,new_revision,auth.uid());
 return jsonb_build_object('note',cleaned,'revision',new_revision);
end $$;
revoke all on function public.linkare_save_agenda_note_v1(uuid,text,text,bigint) from public,anon;
grant execute on function public.linkare_save_agenda_note_v1(uuid,text,text,bigint) to authenticated;

notify pgrst,'reload schema';
commit;
