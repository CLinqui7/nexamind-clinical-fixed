begin;

-- A reported medication stops being administrative capture work once a clinician
-- approves or archives it. Keep reviewed treatment out of the Secretary projection.
create or replace function public.linkare_load_state_v3(org uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare medical boolean:=public.linkare_permission_v3(org,'clinicalView'); capture boolean:=public.linkare_permission_v3(org,'medicationsCapture'); r text:=public.linkare_role_v3(org); profile jsonb; settings jsonb; users_json jsonb; patients_json jsonb; appointments_json jsonb; alerts_json jsonb; revs jsonb;
begin
 if r is null or r not in ('owner','psychiatrist','clinical_assistant','secretary') then raise exception 'ACCESS_DENIED' using errcode='42501'; end if;
 select payload into profile from public.linkare_records where organization_id=org and kind='profile' and id='clinic' and not deleted;
 select payload into settings from public.linkare_records where organization_id=org and kind='settings' and id='clinic' and not deleted;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',m.display_name,'email',u.email,'role',case m.role::text when 'owner' then 'owner' when 'psychiatrist' then 'doctor' when 'clinical_assistant' then 'nurse' else 'secretary' end,'active',m.active,'title',m.professional_title,'phone',m.phone,'permissions',m.permissions)),'[]') into users_json
 from public.organization_members m join auth.users u on u.id=m.user_id where m.organization_id=org and (r='owner' or m.user_id=auth.uid());
 select coalesce(jsonb_agg(a.payload
   || case when medical then coalesce(c.payload,'{}')-'documents'
      else (case when public.linkare_permission_v3(org,'prescriptionsEdit') then jsonb_build_object('prescriptions',coalesce(c.payload->'prescriptions','[]')) else '{}'::jsonb end)
        || (case when capture then jsonb_build_object('medications',coalesce((select jsonb_agg(jsonb_build_object(
          'id',m->>'id','name',m->>'name','dose',m->>'dose','doseValue',m->'doseValue','doseUnit',m->>'doseUnit','frequency',m->>'frequency','frequencySlots',coalesce(m->'frequencySlots','[]'::jsonb),'customFrequency',m->>'customFrequency','route',m->>'route','startDate',m->>'startDate','status',m->>'status','source',m->>'source','reportedNotes',m->>'reportedNotes','createdAt',m->>'createdAt'))
          from jsonb_array_elements(coalesce(c.payload->'medications','[]')) m where m->>'source'='secretary_report' and coalesce(m->>'status','pending_review')='pending_review' and nullif(m->>'archivedAt','') is null),'[]'::jsonb)) else '{}'::jsonb end)
      end
   || case when public.linkare_permission_v3(org,'documentsView') then jsonb_build_object('documents',coalesce(c.payload->'documents','[]')) else '{}'::jsonb end),'[]') into patients_json
 from public.linkare_records a left join public.linkare_records c on c.organization_id=a.organization_id and c.kind='patient_clinical' and c.id=a.id and not c.deleted and (medical or capture or public.linkare_permission_v3(org,'documentsView') or public.linkare_permission_v3(org,'prescriptionsEdit'))
 where a.organization_id=org and a.kind='patient_admin' and not a.deleted and public.linkare_permission_v3(org,'patientsView');
 select coalesce(jsonb_agg(a.payload || coalesce(c.payload,'{}')),'[]') into appointments_json from public.linkare_records a
 left join public.linkare_records c on c.organization_id=a.organization_id and c.kind='appointment_clinical' and c.id=a.id and not c.deleted and medical
 where a.organization_id=org and a.kind='appointment' and not a.deleted and public.linkare_permission_v3(org,'appointmentsManage');
 select coalesce(jsonb_agg(payload),'[]') into alerts_json from public.linkare_records where organization_id=org and kind='alert' and not deleted and public.linkare_permission_v3(org,'alertsView');
 select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'revision',revision)),'[]') into revs from public.linkare_records
 where organization_id=org and (kind in('profile','settings') or (kind='patient_clinical' and (medical or capture or public.linkare_permission_v3(org,'documentsView') or public.linkare_permission_v3(org,'prescriptionsEdit'))) or (kind='appointment_clinical' and medical and public.linkare_permission_v3(org,'appointmentsManage')) or (kind='alert' and public.linkare_permission_v3(org,'alertsView')) or (kind='patient_admin' and public.linkare_permission_v3(org,'patientsView')) or (kind='appointment' and public.linkare_permission_v3(org,'appointmentsManage')));
 return jsonb_build_object('organizationId',org,'entitled',public.linkare_entitled_v3(org),'complimentaryAccess',coalesce((select complimentary_access from public.linkare_subscriptions_v3 where organization_id=org),false),'memberRole',case r when 'owner' then 'owner' when 'psychiatrist' then 'doctor' when 'clinical_assistant' then 'nurse' else 'secretary' end,'userId',auth.uid(),'revisions',revs,'payload',jsonb_build_object('organization',coalesce(profile,'{}'),'settings',coalesce(settings,'{}')||jsonb_build_object('activeUserId',auth.uid()),'users',users_json,'patients',patients_json,'appointments',appointments_json,'alerts',alerts_json,'payments','[]'::jsonb));
end $$;

notify pgrst,'reload schema';
commit;
