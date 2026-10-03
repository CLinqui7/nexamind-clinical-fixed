begin;

-- Keep the authenticated bootstrap small. Large data-URL images are fetched only
-- after the first directory page is usable and are never interpreted as empty.
create or replace function public.linkare_bootstrap_state_v4(org uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare role_name text:=public.linkare_role_v3(org);profile jsonb;settings jsonb;users_json jsonb;calendars_json jsonb;revisions jsonb;projection jsonb;
begin
 if role_name is null or role_name not in('owner','psychiatrist','clinical_assistant','secretary') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 select payload-array['clinicLogo','doctorPhoto'] into profile from public.linkare_records where organization_id=org and kind='profile' and id='clinic' and not deleted;
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

create or replace function public.linkare_profile_assets_v1(org uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare role_name text:=public.linkare_role_v3(org);profile public.linkare_records;
begin
 if role_name is null or role_name not in('owner','psychiatrist','clinical_assistant','secretary') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 select * into profile from public.linkare_records where organization_id=org and kind='profile' and id='clinic' and not deleted;
 if not found then return jsonb_build_object('organization','{}'::jsonb,'revision',null);end if;
 return jsonb_build_object(
  'organization',jsonb_strip_nulls(jsonb_build_object('clinicLogo',profile.payload->'clinicLogo','doctorPhoto',profile.payload->'doctorPhoto')),
  'revision',profile.revision
 );
end $$;
revoke all on function public.linkare_profile_assets_v1(uuid) from public,anon;
grant execute on function public.linkare_profile_assets_v1(uuid) to authenticated,service_role;

notify pgrst,'reload schema';
commit;
