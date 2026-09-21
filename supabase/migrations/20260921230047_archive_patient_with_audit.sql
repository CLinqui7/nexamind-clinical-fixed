create or replace function public.linkare_archive_patient_v1(p_org uuid,p_patient_id text,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
 rec public.linkare_records;
 at_time timestamptz:=clock_timestamp();
 next_revision bigint;
 clean_reason text:=left(trim(coalesce(p_reason,'')),500);
begin
 if auth.uid() is null or not public.linkare_permission_v3(p_org,'patientsEdit') then
  raise exception 'ACCESS_DENIED' using errcode='42501';
 end if;
 if length(clean_reason)<3 then raise exception 'ARCHIVE_REASON_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':patient_admin:'||p_patient_id,303));
 select * into rec from public.linkare_records
 where organization_id=p_org and kind='patient_admin' and id=p_patient_id and not deleted
 for update;
 if not found then raise exception 'PATIENT_NOT_FOUND';end if;
 if coalesce((rec.payload->>'archived')::boolean,false) then
  return jsonb_build_object('ok',true,'duplicate',true,'revision',rec.revision,'patientId',p_patient_id);
 end if;
 next_revision:=rec.revision+1;
 update public.linkare_records
 set payload=rec.payload||jsonb_build_object('archived',true,'archivedAt',at_time,'archivedBy',auth.uid(),'archiveReason',clean_reason,'updatedAt',at_time),
     revision=next_revision,updated_at=at_time,updated_by=auth.uid()
 where organization_id=p_org and kind='patient_admin' and id=p_patient_id;
 insert into public.linkare_audit_v3(organization_id,actor_id,action,kind,record_id,revision)
 values(p_org,auth.uid(),'patient.archived','patient_admin',p_patient_id,next_revision);
 with changed as (
  update public.linkare_records
  set payload=jsonb_set(jsonb_set(payload,'{status}','"cancelled"'::jsonb,true),'{updatedAt}',to_jsonb(at_time),true),
      revision=revision+1,updated_at=at_time,updated_by=auth.uid()
  where organization_id=p_org and kind='appointment' and not deleted
    and payload->>'patientId'=p_patient_id
    and coalesce(payload->>'status','pending') not in('completed','cancelled','no_show')
    and coalesce(nullif(payload->>'start','')::timestamptz,at_time)>=at_time
  returning id,revision
 )
 insert into public.linkare_audit_v3(organization_id,actor_id,action,kind,record_id,revision)
 select p_org,auth.uid(),'appointment.cancelled.patient_archived','appointment',id,revision from changed;
 return jsonb_build_object('ok',true,'revision',next_revision,'patientId',p_patient_id);
end $$;

revoke all on function public.linkare_archive_patient_v1(uuid,text,text) from public,anon;
grant execute on function public.linkare_archive_patient_v1(uuid,text,text) to authenticated;
