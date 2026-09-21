-- Urgent additive release: no clinical record or payment row is changed.
-- Tables touched: linkare_subscriptions_v3. New organizations receive the same access.
-- Existing paid periods, plans, orders and Wompi handlers are retained.
begin;
alter table public.linkare_subscriptions_v3 add column if not exists complimentary_access boolean not null default true;
insert into public.linkare_subscriptions_v3(organization_id) select id from public.organizations on conflict(organization_id) do nothing;
create or replace function public.linkare_entitled_v3(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.linkare_subscriptions_v3 where organization_id=org and (complimentary_access or current_period_end+interval '7 days'>now()))
$$;
revoke all on function public.linkare_entitled_v3(uuid) from public,anon;
grant execute on function public.linkare_entitled_v3(uuid) to authenticated,service_role;
CREATE OR REPLACE FUNCTION public.linkare_load_state_v3(org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare medical boolean:=public.linkare_doctor_v3(org); r text:=public.linkare_role_v3(org); profile jsonb; settings jsonb; users_json jsonb; patients_json jsonb; appointments_json jsonb; alerts_json jsonb; revs jsonb;
begin
 if r is null or r not in ('owner','doctor','psychiatrist','secretary') then raise exception 'ACCESS_DENIED' using errcode='42501'; end if;
 select payload into profile from public.linkare_records where organization_id=org and kind='profile' and id='clinic' and not deleted;
 select payload into settings from public.linkare_records where organization_id=org and kind='settings' and id='clinic' and not deleted;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',m.display_name,'email',u.email,'role',case when m.role::text in('owner','doctor','psychiatrist') then 'doctor' else 'secretary' end,'active',m.active,'title',m.professional_title,'phone',m.phone,'permissions',m.permissions)),'[]') into users_json
 from public.organization_members m join auth.users u on u.id=m.user_id where m.organization_id=org and (medical or m.user_id=auth.uid());
 select coalesce(jsonb_agg(a.payload || coalesce(c.payload,'{}')),'[]') into patients_json from public.linkare_records a
 left join public.linkare_records c on c.organization_id=a.organization_id and c.kind='patient_clinical' and c.id=a.id and not c.deleted and medical
 where a.organization_id=org and a.kind='patient_admin' and not a.deleted and public.linkare_permission_v3(org,'patientsView');
 select coalesce(jsonb_agg(a.payload || coalesce(c.payload,'{}')),'[]') into appointments_json from public.linkare_records a
 left join public.linkare_records c on c.organization_id=a.organization_id and c.kind='appointment_clinical' and c.id=a.id and not c.deleted and medical
 where a.organization_id=org and a.kind='appointment' and not a.deleted and public.linkare_permission_v3(org,'appointmentsManage');
 select coalesce(jsonb_agg(payload),'[]') into alerts_json from public.linkare_records where organization_id=org and kind='alert' and not deleted and medical;
 select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'revision',revision)),'[]') into revs from public.linkare_records
 where organization_id=org and (medical or kind in('profile','settings') or (kind='patient_admin' and public.linkare_permission_v3(org,'patientsView')) or (kind='appointment' and public.linkare_permission_v3(org,'appointmentsManage')));
 return jsonb_build_object('organizationId',org,'entitled',public.linkare_entitled_v3(org),'complimentaryAccess',coalesce((select complimentary_access from public.linkare_subscriptions_v3 where organization_id=org),false),'memberRole',case when medical then 'doctor' else 'secretary' end,'userId',auth.uid(),'revisions',revs,
 'payload',jsonb_build_object('organization',coalesce(profile,'{}'),'settings',coalesce(settings,'{}')||jsonb_build_object('activeUserId',auth.uid()),'users',users_json,'patients',patients_json,'appointments',appointments_json,'alerts',alerts_json,'payments','[]'::jsonb));
end $function$
;
notify pgrst, 'reload schema';
commit;
