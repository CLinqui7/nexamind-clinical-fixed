begin;
create or replace function public.linkare_archive_medication_v1(p_org uuid,p_patient_id text,p_medication_id text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rec public.linkare_records; med jsonb; next_meds jsonb:='[]'::jsonb; medication_found boolean:=false; at_time timestamptz:=clock_timestamp(); next_revision bigint;
begin
 if not public.linkare_permission_v3(p_org,'medicationsManage') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'MEDICATION_ARCHIVE_REASON_REQUIRED';end if;
 if not public.linkare_entitled_v3(p_org) then raise exception 'SUBSCRIPTION_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':patient_clinical:'||p_patient_id,304));
 select * into rec from public.linkare_records where organization_id=p_org and kind='patient_clinical' and id=p_patient_id and not deleted for update;
 if not found then raise exception 'PATIENT_NOT_FOUND';end if;
 for med in select value from jsonb_array_elements(coalesce(rec.payload->'medications','[]'::jsonb)) loop
  if med->>'id'=p_medication_id then
   medication_found:=true;
   if nullif(med->>'archivedAt','') is null then
    med:=med||jsonb_build_object('status','discontinued','archivedAt',at_time,'archivedBy',auth.uid(),'archiveReason',left(trim(p_reason),500),'events',coalesce(med->'events','[]'::jsonb)||jsonb_build_array(jsonb_build_object('type','archived','at',at_time,'by',auth.uid(),'reason',left(trim(p_reason),500))));
   end if;
  end if;
  next_meds:=next_meds||jsonb_build_array(med);
 end loop;
 if not medication_found then raise exception 'MEDICATION_NOT_FOUND';end if;
 next_revision:=rec.revision+1;
 update public.linkare_records set payload=jsonb_set(rec.payload,'{medications}',next_meds),revision=next_revision,updated_at=at_time,updated_by=auth.uid() where organization_id=p_org and kind='patient_clinical' and id=p_patient_id;
 insert into public.linkare_audit_v3(organization_id,actor_id,action,kind,record_id,revision) values(p_org,auth.uid(),'medication.archived','patient_clinical',p_patient_id,next_revision);
 return jsonb_build_object('ok',true,'revision',next_revision,'medicationId',p_medication_id);
end $$;
revoke all on function public.linkare_archive_medication_v1(uuid,text,text,text) from public,anon;
grant execute on function public.linkare_archive_medication_v1(uuid,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
