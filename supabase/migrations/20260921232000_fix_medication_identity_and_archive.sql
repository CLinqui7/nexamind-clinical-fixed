begin;

-- Older v3 records may have a stable medication id but no server-owned creation
-- metadata. The browser used to derive createdAt from startDate, which made a
-- harmless save look like an identity rewrite. The lifecycle function below
-- preserves identity once present and accepts omitted metadata on legacy rows.

create or replace function public.linkare_clinical_lifecycle_guard_v3()
returns trigger language plpgsql security definer set search_path='' as $$
declare prior_payload jsonb:='{}'; prior_rx jsonb; rx jsonb; guarded_rx jsonb:='[]'; prior_med jsonb; med jsonb; guarded_meds jsonb:='[]'; at_time timestamptz:=clock_timestamp(); capture_mode boolean:=coalesce(current_setting('linkare.medication_capture',true),'')='on';
begin
 if new.kind<>'patient_clinical' then return new;end if;
 if tg_op='UPDATE' then prior_payload:=old.payload;else select payload into prior_payload from public.linkare_records where organization_id=new.organization_id and kind=new.kind and id=new.id;prior_payload:=coalesce(prior_payload,'{}'::jsonb);end if;
 if jsonb_typeof(coalesce(new.payload->'prescriptions','[]'))<>'array' or jsonb_typeof(coalesce(new.payload->'medications','[]'))<>'array' then raise exception 'INVALID_CLINICAL_ARRAY';end if;
 for prior_rx in select value from jsonb_array_elements(coalesce(prior_payload->'prescriptions','[]')) loop
  if not exists(select 1 from jsonb_array_elements(coalesce(new.payload->'prescriptions','[]')) x where x->>'id'=prior_rx->>'id') then raise exception 'PRESCRIPTION_DELETE_DISABLED';end if;
 end loop;
 for rx in select value from jsonb_array_elements(coalesce(new.payload->'prescriptions','[]')) loop
  prior_rx:=null;
  select elem.value into prior_rx from jsonb_array_elements(coalesce(prior_payload->'prescriptions','[]')) as elem(value) where elem.value->>'id'=rx->>'id';
  if prior_rx is null then
   if coalesce(rx->>'status','active')<>'active' or rx ?| array['voidedAt','voidedBy','voidReason','archivedAt','archivedBy'] then raise exception 'INVALID_PRESCRIPTION_STATE';end if;
   rx:=rx||jsonb_build_object('status','active');
  elsif prior_rx->>'status'='voided' or coalesce(prior_rx->>'archivedAt','')<>'' then
   if rx is distinct from prior_rx then raise exception 'PRESCRIPTION_VOIDED';end if;
   rx:=prior_rx;
  elsif rx->>'status'='voided' or coalesce(rx->>'archivedAt','')<>'' then
   if length(trim(coalesce(rx->>'voidReason',rx->>'archiveReason',''))) < 3 then raise exception 'PRESCRIPTION_VOID_REASON_REQUIRED';end if;
   rx:=(rx-array['archivedAt','archivedBy','voidedAt','voidedBy'])||jsonb_build_object('status','voided','voidReason',trim(coalesce(rx->>'voidReason',rx->>'archiveReason')),'voidedAt',at_time,'voidedBy',auth.uid());
  end if;
  guarded_rx:=guarded_rx||jsonb_build_array(rx);
 end loop;
 new.payload:=jsonb_set(new.payload,'{prescriptions}',guarded_rx);
 if new.payload->'medications' is distinct from prior_payload->'medications' then
 if jsonb_array_length(coalesce(new.payload->'medications','[]'))<jsonb_array_length(coalesce(prior_payload->'medications','[]')) then raise exception 'MEDICATION_DELETE_DISABLED';end if;
 for prior_med in select value from jsonb_array_elements(coalesce(prior_payload->'medications','[]')) loop
  if nullif(prior_med->>'id','') is not null and not exists(select 1 from jsonb_array_elements(coalesce(new.payload->'medications','[]')) x where x->>'id'=prior_med->>'id') then raise exception 'MEDICATION_DELETE_DISABLED';end if;
 end loop;
 for med in select value from jsonb_array_elements(coalesce(new.payload->'medications','[]')) loop
  if nullif(med->>'id','') is null then guarded_meds:=guarded_meds||jsonb_build_array(med);continue;end if;
  prior_med:=null;
  select elem.value into prior_med from jsonb_array_elements(coalesce(prior_payload->'medications','[]')) as elem(value) where (nullif(med->>'id','') is not null and elem.value->>'id'=med->>'id') or (nullif(med->>'id','') is null and elem.value=med);
  if prior_med is null then
   if capture_mode then
    if med->>'status'<>'pending_review' or med->>'source'<>'secretary_report' then raise exception 'INVALID_CAPTURED_MEDICATION';end if;
   else
    med:=(med-array['createdBy','createdAt','reviewedBy','reviewedAt'])||jsonb_build_object('status',case when med->>'status'='pending_review' then 'active' else coalesce(med->>'status','active') end,'source',coalesce(med->>'source','clinical'),'createdBy',auth.uid(),'createdAt',at_time);
   end if;
  elsif prior_med->>'status'='pending_review' and med->>'status'='active' then
   med:=(med-array['reviewedBy','reviewedAt'])||jsonb_build_object('reviewedBy',auth.uid(),'reviewedAt',at_time,'events',coalesce(prior_med->'events','[]')||jsonb_build_array(jsonb_build_object('type','approved','at',at_time,'by',auth.uid())));
  elsif med is distinct from prior_med then
   if med->>'id' is distinct from prior_med->>'id'
    or (nullif(prior_med->>'createdBy','') is not null and med->>'createdBy' is distinct from prior_med->>'createdBy')
    or (nullif(prior_med->>'createdAt','') is not null and med->>'createdAt' is distinct from prior_med->>'createdAt') then raise exception 'MEDICATION_IDENTITY_IMMUTABLE';end if;
   if nullif(prior_med->>'createdBy','') is null then med:=med-'createdBy';else med:=jsonb_set(med,'{createdBy}',prior_med->'createdBy');end if;
   if nullif(prior_med->>'createdAt','') is null then med:=med-'createdAt';else med:=jsonb_set(med,'{createdAt}',prior_med->'createdAt');end if;
   if med->>'status' not in ('pending_review','active','suspended','discontinued','completed') then raise exception 'INVALID_MEDICATION_STATUS';end if;
   med:=med||jsonb_build_object('events',coalesce(prior_med->'events','[]')||jsonb_build_array(jsonb_build_object('type','updated','at',at_time,'by',auth.uid(),'previousStatus',prior_med->>'status','status',med->>'status','previousDose',prior_med->>'dose','dose',med->>'dose','previousFrequency',prior_med->>'frequency','frequency',med->>'frequency')));
  end if;
  guarded_meds:=guarded_meds||jsonb_build_array(med);
 end loop;
 new.payload:=jsonb_set(new.payload,'{medications}',guarded_meds);
 end if;
 return new;
end $$;


create or replace function public.linkare_archive_medication_v1(p_org uuid,p_patient_id text,p_medication_id text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rec public.linkare_records; med jsonb; next_meds jsonb:='[]'::jsonb; medication_found boolean:=false; already_archived boolean:=false; at_time timestamptz:=clock_timestamp(); next_revision bigint; position integer:=0; synthetic_id text;
begin
 if not public.linkare_permission_v3(p_org,'medicationsManage') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'MEDICATION_ARCHIVE_REASON_REQUIRED';end if;
 if not public.linkare_entitled_v3(p_org) then raise exception 'SUBSCRIPTION_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':patient_clinical:'||p_patient_id,304));
 select * into rec from public.linkare_records where organization_id=p_org and kind='patient_clinical' and id=p_patient_id and not deleted for update;
 if not found then raise exception 'PATIENT_NOT_FOUND';end if;
 for med in select value from jsonb_array_elements(coalesce(rec.payload->'medications','[]'::jsonb)) loop
  synthetic_id:='med_'||p_patient_id||'_'||position::text;
  if med->>'id'=p_medication_id or (nullif(med->>'id','') is null and synthetic_id=p_medication_id) then
   medication_found:=true;already_archived:=nullif(med->>'archivedAt','') is not null;
   if not already_archived then med:=med||jsonb_build_object('id',coalesce(nullif(med->>'id',''),p_medication_id),'status','discontinued','isPrimary',false,'archivedAt',at_time,'archivedBy',auth.uid(),'archiveReason',left(trim(p_reason),500),'events',coalesce(med->'events','[]'::jsonb)||jsonb_build_array(jsonb_build_object('type','archived','at',at_time,'by',auth.uid(),'reason',left(trim(p_reason),500))));end if;
  end if;
  next_meds:=next_meds||jsonb_build_array(med);position:=position+1;
 end loop;
 if not medication_found then raise exception 'MEDICATION_NOT_FOUND';end if;
 if already_archived then return jsonb_build_object('ok',true,'duplicate',true,'revision',rec.revision,'medicationId',p_medication_id);end if;
 next_revision:=rec.revision+1;update public.linkare_records set payload=jsonb_set(rec.payload,'{medications}',next_meds),revision=next_revision,updated_at=at_time,updated_by=auth.uid() where organization_id=p_org and kind='patient_clinical' and id=p_patient_id;
 insert into public.linkare_audit_v3(organization_id,actor_id,action,kind,record_id,revision) values(p_org,auth.uid(),'medication.archived','patient_clinical',p_patient_id,next_revision);
 return jsonb_build_object('ok',true,'revision',next_revision,'medicationId',p_medication_id);
end $$;
revoke all on function public.linkare_archive_medication_v1(uuid,text,text,text) from public,anon;
grant execute on function public.linkare_archive_medication_v1(uuid,text,text,text) to authenticated;

notify pgrst,'reload schema';
commit;
