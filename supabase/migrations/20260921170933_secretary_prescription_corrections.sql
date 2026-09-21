-- Requested exception: secretaries may correct existing prescriptions only.
-- Does not expose diagnoses, notes or medications outside the prescription itself.
begin;
update public.organization_members set permissions=permissions||'{"prescriptionsEdit":true}'::jsonb where role::text in('secretary','psychiatrist') or (role::text='clinical_assistant' and permissions->'prescriptionsCreate'='true'::jsonb);
update public.linkare_invites_v3 set permissions=permissions||'{"prescriptionsEdit":true}'::jsonb where status='pending' and (requested_role in('secretary','psychiatrist') or permissions->'prescriptionsCreate'='true'::jsonb);
create or replace function public.linkare_permission_v3(org uuid,p text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare m public.organization_members;
begin
 if p is null or not p=any(array['patientsView','patientsCreate','patientsEdit','appointmentsManage','remindersManage','clinicalView','clinicalEdit','medicationsManage','prescriptionsCreate','prescriptionsEdit','documentsView','documentsManage','consultationsManage','postmortemExport','alertsView','analyticsView','exportsManage','settingsManage','usersManage','billingManage','accessManage']) then return false;end if;
 select * into m from public.organization_members where organization_id=org and user_id=auth.uid() and active limit 1;
 if not found then return false;end if;
 if m.role::text='owner' then return true;end if;
 if p=any(array['settingsManage','usersManage','billingManage','accessManage']) then return false;end if;
 if m.role::text not in ('psychiatrist','clinical_assistant','secretary') then return false;end if;
 if m.role::text='secretary' and not p=any(array['patientsView','patientsCreate','patientsEdit','appointmentsManage','remindersManage','prescriptionsEdit']) then return false;end if;
 if coalesce(m.permissions->p,'false'::jsonb)<>'true'::jsonb then return false;end if;
 if p=any(array['clinicalView','clinicalEdit','medicationsManage','prescriptionsCreate','consultationsManage','postmortemExport','analyticsView','documentsView','documentsManage','patientsEdit','prescriptionsEdit']) and coalesce(m.permissions->'patientsView','false'::jsonb)<>'true'::jsonb then return false;end if;
 if p=any(array['clinicalEdit','medicationsManage','prescriptionsCreate','consultationsManage','postmortemExport','analyticsView']) and coalesce(m.permissions->'clinicalView','false'::jsonb)<>'true'::jsonb then return false;end if;
 if p='documentsManage' and coalesce(m.permissions->'documentsView','false'::jsonb)<>'true'::jsonb then return false;end if;
 return true;
end $$;
CREATE OR REPLACE FUNCTION public.linkare_load_state_v3(org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare medical boolean:=public.linkare_permission_v3(org,'clinicalView'); r text:=public.linkare_role_v3(org); profile jsonb; settings jsonb; users_json jsonb; patients_json jsonb; appointments_json jsonb; alerts_json jsonb; revs jsonb;
begin
 if r is null or r not in ('owner','psychiatrist','clinical_assistant','secretary') then raise exception 'ACCESS_DENIED' using errcode='42501'; end if;
 select payload into profile from public.linkare_records where organization_id=org and kind='profile' and id='clinic' and not deleted;
 select payload into settings from public.linkare_records where organization_id=org and kind='settings' and id='clinic' and not deleted;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',m.display_name,'email',u.email,'role',case m.role::text when 'owner' then 'owner' when 'psychiatrist' then 'doctor' when 'clinical_assistant' then 'nurse' else 'secretary' end,'active',m.active,'title',m.professional_title,'phone',m.phone,'permissions',m.permissions)),'[]') into users_json
 from public.organization_members m join auth.users u on u.id=m.user_id where m.organization_id=org and (r='owner' or m.user_id=auth.uid());
 select coalesce(jsonb_agg(a.payload || case when medical then coalesce(c.payload,'{}')-'documents' else case when public.linkare_permission_v3(org,'prescriptionsEdit') then jsonb_build_object('prescriptions',coalesce(c.payload->'prescriptions','[]')) else '{}'::jsonb end end || case when public.linkare_permission_v3(org,'documentsView') then jsonb_build_object('documents',coalesce(c.payload->'documents','[]')) else '{}'::jsonb end),'[]') into patients_json from public.linkare_records a
 left join public.linkare_records c on c.organization_id=a.organization_id and c.kind='patient_clinical' and c.id=a.id and not c.deleted and (medical or public.linkare_permission_v3(org,'documentsView') or public.linkare_permission_v3(org,'prescriptionsEdit'))
 where a.organization_id=org and a.kind='patient_admin' and not a.deleted and public.linkare_permission_v3(org,'patientsView');
 select coalesce(jsonb_agg(a.payload || coalesce(c.payload,'{}')),'[]') into appointments_json from public.linkare_records a
 left join public.linkare_records c on c.organization_id=a.organization_id and c.kind='appointment_clinical' and c.id=a.id and not c.deleted and medical
 where a.organization_id=org and a.kind='appointment' and not a.deleted and public.linkare_permission_v3(org,'appointmentsManage');
 select coalesce(jsonb_agg(payload),'[]') into alerts_json from public.linkare_records where organization_id=org and kind='alert' and not deleted and public.linkare_permission_v3(org,'alertsView');
 select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'revision',revision)),'[]') into revs from public.linkare_records
 where organization_id=org and (kind in('profile','settings') or (kind='patient_clinical' and (medical or public.linkare_permission_v3(org,'documentsView') or public.linkare_permission_v3(org,'prescriptionsEdit'))) or (kind='appointment_clinical' and medical and public.linkare_permission_v3(org,'appointmentsManage')) or (kind='alert' and public.linkare_permission_v3(org,'alertsView')) or (kind='patient_admin' and public.linkare_permission_v3(org,'patientsView')) or (kind='appointment' and public.linkare_permission_v3(org,'appointmentsManage')));
 return jsonb_build_object('organizationId',org,'entitled',public.linkare_entitled_v3(org),'complimentaryAccess',coalesce((select complimentary_access from public.linkare_subscriptions_v3 where organization_id=org),false),'memberRole',case r when 'owner' then 'owner' when 'psychiatrist' then 'doctor' when 'clinical_assistant' then 'nurse' else 'secretary' end,'userId',auth.uid(),'revisions',revs,
 'payload',jsonb_build_object('organization',coalesce(profile,'{}'),'settings',coalesce(settings,'{}')||jsonb_build_object('activeUserId',auth.uid()),'users',users_json,'patients',patients_json,'appointments',appointments_json,'alerts',alerts_json,'payments','[]'::jsonb));
end $function$
;
CREATE OR REPLACE FUNCTION public.linkare_save_changes_v3(org uuid, changes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare item jsonb; k text; rid text; v bigint; old public.linkare_records; val jsonb; removed boolean; canwrite boolean; med boolean:=public.linkare_doctor_v3(org); result jsonb:='[]'; note jsonb; after_note jsonb; field text; required_permission text; rx jsonb; previous_rx jsonb; corrected_rx jsonb; rx_array jsonb;
begin
 if public.linkare_role_v3(org) is null or public.linkare_role_v3(org) not in ('owner','psychiatrist','clinical_assistant','secretary') then raise exception 'ACCESS_DENIED' using errcode='42501'; end if;
 if changes is null or jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>250 or octet_length(changes::text)>12000000 then raise exception 'INVALID_BATCH'; end if;
 -- An entire delta succeeds or rolls back. Optimistic revision avoids lost updates.
 for item in select value from jsonb_array_elements(changes) order by value->>'kind',value->>'id' loop
  k:=item->>'kind';rid:=item->>'id';removed:=coalesce((item->>'deleted')::boolean,false);val:=coalesce(item->'payload','{}');
  if k is null or rid is null or k not in ('profile','settings','patient_admin','patient_clinical','appointment','appointment_clinical','alert') or length(rid) not between 1 and 160 or jsonb_typeof(val)<>'object' or octet_length(val::text)>4000000 then raise exception 'INVALID_RECORD'; end if;
  perform pg_advisory_xact_lock(hashtextextended(org::text||':'||k||':'||rid,303));
  select * into old from public.linkare_records where organization_id=org and kind=k and id=rid for update;
  v:=coalesce(old.revision,0);
  if v<>coalesce((item->>'expectedRevision')::bigint,0) then raise exception 'REVISION_CONFLICT:%:%',k,rid using errcode='40001'; end if;
  canwrite:=case
   when k in ('profile','settings') then public.linkare_permission_v3(org,'settingsManage')
   when k='patient_admin' then not removed and public.linkare_permission_v3(org,case when v=0 then 'patientsCreate' else 'patientsEdit' end)
   when k='appointment' then public.linkare_permission_v3(org,'appointmentsManage') or (v>0 and not removed and public.linkare_permission_v3(org,'remindersManage'))
   when k='appointment_clinical' then public.linkare_permission_v3(org,'clinicalEdit') and public.linkare_permission_v3(org,'appointmentsManage')
   when k='alert' then public.linkare_permission_v3(org,'alertsView')
   when k='patient_clinical' then public.linkare_permission_v3(org,'clinicalEdit') or public.linkare_permission_v3(org,'documentsManage') or public.linkare_permission_v3(org,'medicationsManage') or public.linkare_permission_v3(org,'prescriptionsCreate') or public.linkare_permission_v3(org,'prescriptionsEdit') or public.linkare_permission_v3(org,'consultationsManage')
   else false end;
  if not canwrite then raise exception 'ACCESS_DENIED' using errcode='42501'; end if;
  if k not in('profile','settings') and not public.linkare_entitled_v3(org) then raise exception 'SUBSCRIPTION_REQUIRED'; end if;
  if k='patient_admin' then
   if removed then raise exception 'PATIENT_DELETE_DISABLED_USE_ARCHIVE'; end if;
   val:=public.linkare_pick_v3(val,array['id','name','initials','age','phone','email','photo','insurance','nextVisit','archived','createdAt','updatedAt','notificationPreferences']);
   if length(trim(coalesce(val->>'name','')))=0 then raise exception 'PATIENT_NAME_REQUIRED'; end if;
   val:=val||jsonb_build_object('id',rid);
  elsif k='appointment' then
   if not public.linkare_permission_v3(org,'appointmentsManage') then
    if (val-array['id','reminderLog'])<>'{}'::jsonb then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
    val:=old.payload||public.linkare_pick_v3(val,array['reminderLog']);
   elsif old.payload->'reminderLog' is distinct from val->'reminderLog' and coalesce(val->'reminderLog','[]')<>'[]'::jsonb and not public.linkare_permission_v3(org,'remindersManage') then
    raise exception 'ACCESS_DENIED' using errcode='42501';
   end if;
   val:=public.linkare_pick_v3(val,array['id','patientId','title','start','end','type','modality','status','reminderLog','googleEventId','googleEventUrl','createdAt','updatedAt']);
   if not removed then
    if not exists(select 1 from public.linkare_records where organization_id=org and kind='patient_admin' and id=val->>'patientId' and not deleted) and not exists(select 1 from jsonb_array_elements(changes) x where x->>'kind'='patient_admin' and x->>'id'=val->>'patientId') then raise exception 'PATIENT_NOT_FOUND'; end if;
    if nullif(val->>'start','') is null or nullif(val->>'end','') is null or (val->>'end')::timestamptz <= (val->>'start')::timestamptz then raise exception 'INVALID_APPOINTMENT_TIME'; end if;
   end if;
   val:=val||jsonb_build_object('id',rid);
  elsif k='appointment_clinical' then
   if not exists(select 1 from public.linkare_records where organization_id=org and kind='appointment' and id=rid) then raise exception 'APPOINTMENT_NOT_FOUND';end if;
   val:=public.linkare_pick_v3(val,array['notes']);
  elsif k='profile' then
   val:=public.linkare_pick_v3(val,array['name','clinician','specialty','professionalLicense','address','phone','email','website','clinicLogo','doctorPhoto','prescriptionFooter','updatedAt']);
   update public.organization_members set display_name=coalesce(nullif(trim(val->>'clinician'),''),display_name),professional_title=coalesce(nullif(trim(val->>'specialty'),''),professional_title) where organization_id=org and user_id=auth.uid() and role::text='owner';
  elsif k='settings' then val:=public.linkare_pick_v3(val,array['largeText','reducedMotion','simpleMode','theme','reminderHours','reminderChannels','palette']);
  elsif k='patient_clinical' then
   -- Clients submit only fields they can edit; omitted private fields are preserved.
   for field in select jsonb_object_keys(val) loop
    if field=any(array['id','name','initials','age','phone','email','photo','insurance','nextVisit','archived','createdAt','updatedAt','notificationPreferences']) then raise exception 'INVALID_CLINICAL_FIELD';end if;
    required_permission:=case when field in('medication','medications','medicationEvents') then 'medicationsManage' when field='documents' then 'documentsManage' when field='prescriptions' then 'prescriptionsCreate' when field='consultations' then 'consultationsManage' else 'clinicalEdit' end;
    if val->field is distinct from old.payload->field and not (public.linkare_permission_v3(org,required_permission) or (field='prescriptions' and public.linkare_permission_v3(org,'prescriptionsEdit'))) then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
   end loop;
   val:=coalesce(old.payload,'{}')||val;
   if not exists(select 1 from public.linkare_records where organization_id=org and kind='patient_admin' and id=rid and not deleted) then raise exception 'PATIENT_NOT_FOUND'; end if;
   if removed then raise exception 'CLINICAL_DELETE_DISABLED'; end if;
   if val->'prescriptions' is distinct from old.payload->'prescriptions' then
    if jsonb_typeof(coalesce(val->'prescriptions','[]'))<>'array' then raise exception 'INVALID_PRESCRIPTIONS';end if;
    if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(coalesce(val->'prescriptions','[]'))) then raise exception 'INVALID_PRESCRIPTION_IDS';end if;
    for previous_rx in select value from jsonb_array_elements(coalesce(old.payload->'prescriptions','[]')) loop
     if not exists(select 1 from jsonb_array_elements(coalesce(val->'prescriptions','[]')) x where x->>'id'=previous_rx->>'id') then raise exception 'PRESCRIPTION_DELETE_DISABLED';end if;
    end loop;
    rx_array:='[]';
    for rx in select value from jsonb_array_elements(coalesce(val->'prescriptions','[]')) loop
     select value into previous_rx from jsonb_array_elements(coalesce(old.payload->'prescriptions','[]')) where value->>'id'=rx->>'id';
     if previous_rx is null then
      if not public.linkare_permission_v3(org,'prescriptionsCreate') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
      corrected_rx:=(rx-array['history','revision','createdBy','updatedBy','updatedAt'])||jsonb_build_object('createdBy',auth.uid(),'revision',1,'history','[]'::jsonb);
     elsif (rx-array['history','revision','updatedBy','updatedAt']) is distinct from (previous_rx-array['history','revision','updatedBy','updatedAt']) then
      if not public.linkare_permission_v3(org,'prescriptionsEdit') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
      if rx->'number' is distinct from previous_rx->'number' or rx->'createdBy' is distinct from previous_rx->'createdBy' or rx->'createdAt' is distinct from previous_rx->'createdAt' then raise exception 'PRESCRIPTION_IDENTITY_IMMUTABLE';end if;
      corrected_rx:=(rx-array['history','revision','updatedBy','updatedAt'])||jsonb_build_object('updatedBy',auth.uid(),'updatedAt',now(),'revision',coalesce((previous_rx->>'revision')::int,1)+1,'history',coalesce(previous_rx->'history','[]')||jsonb_build_array(jsonb_build_object('correctedAt',now(),'correctedBy',auth.uid(),'previous',previous_rx-'history')));
     else corrected_rx:=previous_rx;
     end if;
     rx_array:=rx_array||jsonb_build_array(corrected_rx);
    end loop;
    val:=jsonb_set(val,'{prescriptions}',rx_array);
   end if;
   if jsonb_typeof(coalesce(val->'consultations','[]'))<>'array' then raise exception 'INVALID_NOTES'; end if;
   if (select count(*) <> count(distinct value->>'id') from jsonb_array_elements(coalesce(val->'consultations','[]'))) then raise exception 'INVALID_NOTE_IDS'; end if;
   for note in select value from jsonb_array_elements(coalesce(old.payload->'consultations','[]')) loop
    if note->>'status' in ('completed','signed') or coalesce(note->>'signedAt','')<>'' then
     select value into after_note from jsonb_array_elements(coalesce(val->'consultations','[]')) where value->>'id'=note->>'id';
     if after_note is null or (after_note-'__readOnly') is distinct from (note-'__readOnly') then raise exception 'SIGNED_NOTE_IMMUTABLE'; end if;
    end if;
   end loop;
   for note in select value from jsonb_array_elements(coalesce(val->'consultations','[]')) loop
    if (note->>'status' in ('completed','signed') or coalesce(note->>'signedAt','')<>'') and not exists(select 1 from jsonb_array_elements(coalesce(old.payload->'consultations','[]')) x where x->>'id'=note->>'id' and (x->>'status' in('completed','signed') or coalesce(x->>'signedAt','')<>'')) then
     if public.linkare_role_v3(org) not in ('owner','psychiatrist') or note->>'signedBy' is distinct from auth.uid()::text then raise exception 'INVALID_SIGNER' using errcode='42501'; end if;
    end if;
   end loop;
  end if;
  insert into public.linkare_records(organization_id,kind,id,payload,revision,deleted,updated_by) values(org,k,rid,val,v+1,removed,auth.uid())
   on conflict(organization_id,kind,id) do update set payload=excluded.payload,revision=excluded.revision,deleted=excluded.deleted,updated_at=now(),updated_by=auth.uid();
  insert into public.linkare_audit_v3(organization_id,actor_id,action,kind,record_id,revision,fingerprint) values(org,auth.uid(),case when removed then 'record.archived' else 'record.saved' end,k,rid,v+1,encode(sha256(convert_to(val::text,'UTF8')),'hex'));
  result:=result||jsonb_build_array(jsonb_build_object('kind',k,'id',rid,'revision',v+1));
 end loop;
 return result;
end $function$
;

notify pgrst,'reload schema';
commit;
