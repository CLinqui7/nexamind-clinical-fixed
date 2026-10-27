begin;

-- Phone formatting is irrelevant for identity; a local Salvador number and
-- the same number prefixed with +503 must resolve to the same key.
create function linkare_private.patient_phone_key_v1(value text)
returns text language sql immutable set search_path='' as $$
  select case when length(digits)=11 and left(digits,3)='503'
    then right(digits,8) else digits end
  from (select regexp_replace(coalesce(value,''),'[^0-9]','','g') digits) normalized
$$;
revoke all on function linkare_private.patient_phone_key_v1(text) from public,anon,authenticated;

create function public.linkare_find_patient_match_v1(org uuid,p_name text,p_phone text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare name_key text:=linkare_private.search_normalize_v1(p_name);
        phone_key text:=linkare_private.patient_phone_key_v1(p_phone);
        candidate jsonb;
begin
 if auth.uid() is null or not public.linkare_permission_v3(org,'patientsView')
    or not public.linkare_permission_v3(org,'patientsCreate') then
  raise exception 'ACCESS_DENIED' using errcode='42501';
 end if;
 if length(name_key)<3 or length(phone_key)<8 then return 'null'::jsonb;end if;
 select jsonb_build_object('id',patient_id,'name',name,'phone',phone)
 into candidate
 from linkare_private.patient_directory_v1
 where organization_id=org and not archived
   and name_sort=name_key
   and linkare_private.patient_phone_key_v1(phone)=phone_key
 order by patient_id limit 1;
 return coalesce(candidate,'null'::jsonb);
end $$;
revoke all on function public.linkare_find_patient_match_v1(uuid,text,text) from public,anon;
grant execute on function public.linkare_find_patient_match_v1(uuid,text,text) to authenticated;

-- Keep the existing per-resource revision and permission contract. The guard
-- serializes equal identities before the delegated write and its directory
-- projection trigger commit, so two tabs cannot create the same patient.
alter function public.linkare_save_changes_v3(uuid,jsonb)
 rename to linkare_save_changes_pre_identity_v3;
revoke all on function public.linkare_save_changes_pre_identity_v3(uuid,jsonb)
 from public,anon,authenticated;

create function public.linkare_save_changes_v3(org uuid,changes jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare incoming jsonb; prior jsonb; name_key text; phone_key text; duplicate_id text;
begin
 if auth.uid() is not null and
    (public.linkare_permission_v3(org,'patientsCreate') or public.linkare_permission_v3(org,'patientsEdit'))
    and jsonb_typeof(changes)='array' then
  for incoming in
   select value from jsonb_array_elements(changes)
   where value->>'kind'='patient_admin'
     and not coalesce((value->>'deleted')::boolean,false)
     and not coalesce((value#>>'{payload,archived}')::boolean,false)
  loop
   name_key:=linkare_private.search_normalize_v1(incoming#>>'{payload,name}');
   phone_key:=linkare_private.patient_phone_key_v1(incoming#>>'{payload,phone}');
   if length(name_key)<3 or length(phone_key)<8 then continue;end if;
   select payload into prior from public.linkare_records
    where organization_id=org and kind='patient_admin' and id=incoming->>'id' and not deleted;
   if found and linkare_private.search_normalize_v1(prior->>'name')=name_key
      and linkare_private.patient_phone_key_v1(prior->>'phone')=phone_key then
    continue;
   end if;
   perform pg_advisory_xact_lock(hashtextextended(org::text||':patient_identity:'||name_key||':'||phone_key,831));
   select patient_id into duplicate_id
    from linkare_private.patient_directory_v1
    where organization_id=org and not archived and patient_id<>incoming->>'id'
      and name_sort=name_key and linkare_private.patient_phone_key_v1(phone)=phone_key
    order by patient_id limit 1;
   if duplicate_id is not null then
    raise exception 'PATIENT_ALREADY_EXISTS:%',duplicate_id using errcode='23505';
   end if;
   select other->>'id' into duplicate_id
   from jsonb_array_elements(changes) other
   where other->>'kind'='patient_admin'
     and other->>'id'<>incoming->>'id'
     and not coalesce((other->>'deleted')::boolean,false)
     and not coalesce((other#>>'{payload,archived}')::boolean,false)
     and linkare_private.search_normalize_v1(other#>>'{payload,name}')=name_key
     and linkare_private.patient_phone_key_v1(other#>>'{payload,phone}')=phone_key
   limit 1;
   if duplicate_id is not null then
    raise exception 'PATIENT_ALREADY_EXISTS:%',duplicate_id using errcode='23505';
   end if;
  end loop;
 end if;
 return public.linkare_save_changes_pre_identity_v3(org,changes);
end $$;
revoke all on function public.linkare_save_changes_v3(uuid,jsonb) from public,anon;
grant execute on function public.linkare_save_changes_v3(uuid,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
