begin;

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
   if med->>'id' is distinct from prior_med->>'id' then raise exception 'MEDICATION_IDENTITY_IMMUTABLE';end if;
   -- Creation/review identity belongs to the server. A client may still hold the
   -- millisecond timestamp created before the first save while PostgreSQL stored
   -- its own microsecond timestamp. Preserve the database values instead of
   -- rejecting the next medication in the same browser session.
   med:=(med-array['createdBy','createdAt','reviewedBy','reviewedAt'])||public.linkare_pick_v3(prior_med,array['createdBy','createdAt','reviewedBy','reviewedAt']);
   if med->>'status' not in ('pending_review','active','suspended','discontinued','completed') then raise exception 'INVALID_MEDICATION_STATUS';end if;
   med:=med||jsonb_build_object('events',coalesce(prior_med->'events','[]')||jsonb_build_array(jsonb_build_object('type','updated','at',at_time,'by',auth.uid(),'previousStatus',prior_med->>'status','status',med->>'status','previousDose',prior_med->>'dose','dose',med->>'dose','previousFrequency',prior_med->>'frequency','frequency',med->>'frequency')));
  end if;
  guarded_meds:=guarded_meds||jsonb_build_array(med);
 end loop;
 new.payload:=jsonb_set(new.payload,'{medications}',guarded_meds);
 end if;
 return new;
end $$;


notify pgrst,'reload schema';
commit;
