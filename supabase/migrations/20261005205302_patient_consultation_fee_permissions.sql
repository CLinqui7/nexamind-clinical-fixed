begin;

alter table linkare_private.patient_directory_v1 add column consultation_fee_cents bigint;
alter table linkare_private.patient_directory_v1 add constraint patient_directory_consultation_fee_v1 check(consultation_fee_cents is null or consultation_fee_cents between 0 and 10000000) not valid;
alter table linkare_private.patient_directory_v1 validate constraint patient_directory_consultation_fee_v1;

create table linkare_private.patient_consultation_fee_v1(
 organization_id uuid not null references public.organizations(id),
 patient_id text not null,
 fee_cents bigint not null check(fee_cents between 0 and 10000000),
 updated_at timestamptz not null default now(),
 updated_by uuid,
 primary key(organization_id,patient_id)
);
alter table linkare_private.patient_consultation_fee_v1 enable row level security;
revoke all on linkare_private.patient_consultation_fee_v1 from public,anon,authenticated;
grant all on linkare_private.patient_consultation_fee_v1 to service_role;

-- Give existing Secretaries the safe administrative defaults without changing an explicit setting.
update public.organization_members set permissions=jsonb_set(permissions,'{consultationFeeView}','true'::jsonb,true)
where role::text='secretary' and active and not permissions?'consultationFeeView' and coalesce((permissions->>'patientsView')::boolean,false);
update public.organization_members set permissions=jsonb_set(permissions,'{consultationFeeEdit}','true'::jsonb,true)
where role::text='secretary' and active and not permissions?'consultationFeeEdit' and coalesce((permissions->>'patientsEdit')::boolean,false) and coalesce((permissions->>'consultationFeeView')::boolean,false);
update public.linkare_invites_v3 set permissions=jsonb_set(permissions,'{consultationFeeView}','true'::jsonb,true)
where requested_role::text='secretary' and status='pending' and not permissions?'consultationFeeView' and coalesce((permissions->>'patientsView')::boolean,false);
update public.linkare_invites_v3 set permissions=jsonb_set(permissions,'{consultationFeeEdit}','true'::jsonb,true)
where requested_role::text='secretary' and status='pending' and not permissions?'consultationFeeEdit' and coalesce((permissions->>'patientsEdit')::boolean,false) and coalesce((permissions->>'consultationFeeView')::boolean,false);

create or replace function public.linkare_permission_v3(org uuid,p text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare m public.organization_members; view_key text;
begin
 if p is null or not p=any(array[
  'patientsView','patientsCreate','patientsEdit','consultationFeeView','consultationFeeEdit','appointmentsManage','remindersManage','clinicalView','clinicalEdit','medicationsManage','medicationsCapture','prescriptionsCreate','prescriptionsEdit','documentsView','documentsManage','documentsGenerateAdministrative','documentsGenerateClinical','consultationsManage','postmortemExport','alertsView','analyticsView','exportsManage','settingsManage','usersManage','billingManage','accessManage',
  'calendarDoctorView','calendarDoctorCreate','calendarDoctorEdit','calendarDoctorCancel','calendarDoctorDelete','calendarWifeView','calendarWifeCreate','calendarWifeEdit','calendarWifeCancel','calendarWifeDelete','calendarGeneralView','calendarGeneralCreate','calendarGeneralEdit','calendarGeneralCancel','calendarGeneralDelete'
 ]) then return false;end if;
 select * into m from public.organization_members where organization_id=org and user_id=(select auth.uid()) and active limit 1;
 if not found then return false;end if;
 if m.role::text='owner' then return true;end if;
 if p=any(array['settingsManage','usersManage','billingManage','accessManage']) or m.role::text not in('psychiatrist','clinical_assistant','secretary') then return false;end if;
 if m.role::text='secretary' and p='appointmentsManage' then return exists(select 1 from jsonb_each_text(m.permissions) permission where permission.key like 'calendar%View' and permission.value='true');end if;
 if m.role::text='secretary' and not (p=any(array['patientsView','patientsCreate','patientsEdit','consultationFeeView','consultationFeeEdit','appointmentsManage','remindersManage','medicationsCapture','prescriptionsEdit','documentsGenerateAdministrative']) or p like 'calendar%') then return false;end if;
 if coalesce(m.permissions->p,'false'::jsonb)<>'true'::jsonb then return false;end if;
 if p like 'calendar%' and p not like '%View' then view_key:=regexp_replace(p,'(Create|Edit|Cancel|Delete)$','View');if coalesce(m.permissions->view_key,'false'::jsonb)<>'true'::jsonb then return false;end if;end if;
 if p=any(array['clinicalView','clinicalEdit','medicationsManage','medicationsCapture','prescriptionsCreate','prescriptionsEdit','documentsView','documentsManage','documentsGenerateAdministrative','documentsGenerateClinical','consultationsManage','postmortemExport','analyticsView','patientsEdit','consultationFeeView','consultationFeeEdit']) and coalesce(m.permissions->'patientsView','false'::jsonb)<>'true'::jsonb then return false;end if;
 if p='consultationFeeEdit' and (coalesce(m.permissions->'consultationFeeView','false'::jsonb)<>'true'::jsonb or coalesce(m.permissions->'patientsEdit','false'::jsonb)<>'true'::jsonb) then return false;end if;
 if p=any(array['clinicalEdit','medicationsManage','prescriptionsCreate','documentsGenerateClinical','consultationsManage','postmortemExport','analyticsView']) and coalesce(m.permissions->'clinicalView','false'::jsonb)<>'true'::jsonb then return false;end if;
 if p='documentsManage' and coalesce(m.permissions->'documentsView','false'::jsonb)<>'true'::jsonb then return false;end if;
 return true;
end $$;

-- The exact fee is kept in a dedicated private administrative table. The public
-- patient JSON remains compatible with old clients and cannot leak the amount.

alter function public.linkare_patient_directory_v1(uuid,text,text,jsonb,timestamptz,integer) rename to linkare_patient_directory_pre_fee_v1;
revoke all on function public.linkare_patient_directory_pre_fee_v1(uuid,text,text,jsonb,timestamptz,integer) from public,anon,authenticated;
create function public.linkare_patient_directory_v1(org uuid,p_scope text default 'recent',p_query text default null,p_cursor jsonb default null,p_as_of timestamptz default null,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;items jsonb;
begin
 result:=public.linkare_patient_directory_pre_fee_v1(org,p_scope,p_query,p_cursor,p_as_of,p_limit);
 if public.linkare_permission_v3(org,'consultationFeeView') then
  select coalesce(jsonb_agg(item||jsonb_build_object('consultationFeeCents',directory.consultation_fee_cents) order by ordinal),'[]'::jsonb) into items
  from jsonb_array_elements(result->'items') with ordinality source(item,ordinal)
  left join linkare_private.patient_directory_v1 directory on directory.organization_id=org and directory.patient_id=item->>'id';
  result:=jsonb_set(result,'{items}',items,true);
 end if;
 return result;
end $$;

alter function public.linkare_patient_detail_v1(uuid,text) rename to linkare_patient_detail_pre_fee_v1;
revoke all on function public.linkare_patient_detail_pre_fee_v1(uuid,text) from public,anon,authenticated;
create function public.linkare_patient_detail_v1(org uuid,p_patient_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;fee bigint;
begin
 result:=public.linkare_patient_detail_pre_fee_v1(org,p_patient_id);
 if public.linkare_permission_v3(org,'consultationFeeView') then
  select fee_cents into fee from linkare_private.patient_consultation_fee_v1 where organization_id=org and patient_id=p_patient_id;
  result:=jsonb_set(result,'{patient,consultationFeeCents}',coalesce(to_jsonb(fee),'null'::jsonb),true);
 else result:=result#-'{patient,consultationFeeCents}';end if;
 return result;
end $$;

alter function public.linkare_agenda_range_v1(uuid,timestamptz,timestamptz,uuid[],jsonb,integer) rename to linkare_agenda_range_pre_fee_v1;
revoke all on function public.linkare_agenda_range_pre_fee_v1(uuid,timestamptz,timestamptz,uuid[],jsonb,integer) from public,anon,authenticated;
create function public.linkare_agenda_range_v1(org uuid,p_start timestamptz,p_end timestamptz,p_calendar_ids uuid[] default null,p_cursor jsonb default null,p_limit integer default 200)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;items jsonb;
begin
 result:=public.linkare_agenda_range_pre_fee_v1(org,p_start,p_end,p_calendar_ids,p_cursor,p_limit);
 if public.linkare_permission_v3(org,'consultationFeeView') then
  select coalesce(jsonb_agg(case when jsonb_typeof(item->'patientSummary')='object' then jsonb_set(item,'{patientSummary}',(item->'patientSummary')||jsonb_build_object('consultationFeeCents',directory.consultation_fee_cents),true) else item end order by ordinal),'[]'::jsonb) into items
  from jsonb_array_elements(result->'items') with ordinality source(item,ordinal)
  left join linkare_private.patient_directory_v1 directory on directory.organization_id=org and directory.patient_id=item#>>'{patientSummary,id}';
  result:=jsonb_set(result,'{items}',items,true);
 end if;
 return result;
end $$;

alter function public.linkare_load_state_v3(uuid) rename to linkare_load_state_pre_fee_v3;
revoke all on function public.linkare_load_state_pre_fee_v3(uuid) from public,anon,authenticated;
create function public.linkare_load_state_v3(org uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;patients jsonb;
begin
 result:=public.linkare_load_state_pre_fee_v3(org);
 if public.linkare_permission_v3(org,'consultationFeeView') then
  select coalesce(jsonb_agg(patient||jsonb_build_object('consultationFeeCents',fee.fee_cents)),'[]'::jsonb) into patients
  from jsonb_array_elements(result#>'{payload,patients}') patient
  left join linkare_private.patient_consultation_fee_v1 fee on fee.organization_id=org and fee.patient_id=patient->>'id';
  result:=jsonb_set(result,'{payload,patients}',patients,true);
 else
  select coalesce(jsonb_agg(patient-'consultationFeeCents'),'[]'::jsonb) into patients from jsonb_array_elements(result#>'{payload,patients}') patient;
  result:=jsonb_set(result,'{payload,patients}',patients,true);
 end if;
 return result;
end $$;

alter function public.linkare_save_changes_v3(uuid,jsonb) rename to linkare_save_changes_pre_fee_v3;
revoke all on function public.linkare_save_changes_pre_fee_v3(uuid,jsonb) from public,anon,authenticated;
create function public.linkare_save_changes_v3(org uuid,changes jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb;processed jsonb:='[]'::jsonb;payload jsonb;incoming_fee jsonb;existing_fee bigint;result jsonb;old_fee bigint;fee_patient_id text;changed integer;can_edit boolean:=public.linkare_permission_v3(org,'consultationFeeEdit');
begin
 if changes is null or jsonb_typeof(changes)<>'array' then return public.linkare_save_changes_pre_fee_v3(org,changes);end if;
 for item in select value from jsonb_array_elements(changes) loop
  if item->>'kind'='patient_admin' and not coalesce((item->>'deleted')::boolean,false) then
   payload:=coalesce(item->'payload','{}'::jsonb);if jsonb_typeof(payload)<>'object' then raise exception 'INVALID_RECORD';end if;
   if payload?'consultationFeeCents' then incoming_fee:=payload->'consultationFeeCents';if incoming_fee<>'null'::jsonb and (jsonb_typeof(incoming_fee)<>'number' or (incoming_fee#>>'{}')!~'^[0-9]+$' or (incoming_fee#>>'{}')::numeric>10000000) then raise exception 'INVALID_CONSULTATION_FEE';end if;else incoming_fee:=null;end if;
   if not can_edit and payload?'consultationFeeCents' then
    select fee_cents into existing_fee from linkare_private.patient_consultation_fee_v1 where organization_id=org and patient_id=item->>'id';
    if coalesce(incoming_fee,'null'::jsonb) is distinct from coalesce(to_jsonb(existing_fee),'null'::jsonb) then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
   end if;
   item:=jsonb_set(item,'{payload}',payload-'consultationFeeCents',true);
  end if;
  processed:=processed||jsonb_build_array(item);
 end loop;
 result:=public.linkare_save_changes_pre_fee_v3(org,processed);
 if exists(select 1 from jsonb_array_elements(result) response where coalesce((response->>'conflict')::boolean,false)) then return result;end if;
 if can_edit then
  for item in select value from jsonb_array_elements(changes) where value->>'kind'='patient_admin' and not coalesce((value->>'deleted')::boolean,false) and coalesce(value->'payload','{}'::jsonb)?'consultationFeeCents' loop
   fee_patient_id:=item->>'id';incoming_fee:=item#>'{payload,consultationFeeCents}';
   select fee_cents into old_fee from linkare_private.patient_consultation_fee_v1 where organization_id=org and patient_id=fee_patient_id;
   if incoming_fee='null'::jsonb then delete from linkare_private.patient_consultation_fee_v1 where organization_id=org and patient_id=fee_patient_id;
   else insert into linkare_private.patient_consultation_fee_v1(organization_id,patient_id,fee_cents,updated_at,updated_by) values(org,fee_patient_id,(incoming_fee#>>'{}')::bigint,clock_timestamp(),(select auth.uid())) on conflict(organization_id,patient_id) do update set fee_cents=excluded.fee_cents,updated_at=excluded.updated_at,updated_by=excluded.updated_by;end if;
   update linkare_private.patient_directory_v1 set consultation_fee_cents=case when incoming_fee='null'::jsonb then null else (incoming_fee#>>'{}')::bigint end,projection_revision=projection_revision+1,refreshed_at=clock_timestamp()
   where organization_id=org and patient_id=fee_patient_id and consultation_fee_cents is distinct from case when incoming_fee='null'::jsonb then null else (incoming_fee#>>'{}')::bigint end;
   get diagnostics changed=row_count;if changed>0 then perform linkare_private.bump_directory_version_v1(org);end if;
   if old_fee is distinct from (case when incoming_fee='null'::jsonb then null else (incoming_fee#>>'{}')::bigint end) then
    insert into public.linkare_audit_v3(organization_id,actor_id,action,kind,record_id,revision,fingerprint)
    select org,(select auth.uid()),'patient.consultation_fee_changed','patient_admin',fee_patient_id,coalesce((select revision from public.linkare_records where organization_id=org and kind='patient_admin' and id=fee_patient_id),0),encode(sha256(convert_to(coalesce(incoming_fee::text,'null'),'UTF8')),'hex');
   end if;
  end loop;
 end if;
 return result;
end $$;

revoke all on function public.linkare_patient_directory_v1(uuid,text,text,jsonb,timestamptz,integer),public.linkare_patient_detail_v1(uuid,text),public.linkare_agenda_range_v1(uuid,timestamptz,timestamptz,uuid[],jsonb,integer),public.linkare_load_state_v3(uuid),public.linkare_save_changes_v3(uuid,jsonb) from public,anon;
grant execute on function public.linkare_patient_directory_v1(uuid,text,text,jsonb,timestamptz,integer),public.linkare_patient_detail_v1(uuid,text),public.linkare_agenda_range_v1(uuid,timestamptz,timestamptz,uuid[],jsonb,integer),public.linkare_load_state_v3(uuid),public.linkare_save_changes_v3(uuid,jsonb) to authenticated,service_role;

notify pgrst,'reload schema';
commit;
