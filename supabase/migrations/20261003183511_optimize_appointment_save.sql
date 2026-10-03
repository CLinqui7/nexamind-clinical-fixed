begin;

-- Appointment writes only change the patient's next scheduled visit. Rebuilding
-- the complete historical/clinical patient projection here held a per-patient
-- advisory lock for the whole save and made repeated browser submissions queue.
create or replace function linkare_private.refresh_patient_next_appointment_v1(org uuid,p_patient_id text)
returns void language plpgsql security definer set search_path='' as $$
declare next_at timestamptz;changed integer;
begin
 if p_patient_id is null then return;end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text||':directory:'||p_patient_id,731));
 select min(start_at) into next_at
 from linkare_private.appointment_directory_v1
 where organization_id=org and patient_id=p_patient_id and event_type='appointment'
  and start_at>=clock_timestamp() and status not in('cancelled','completed','no_show');

 update linkare_private.patient_directory_v1
 set next_appointment_at=next_at,projection_revision=projection_revision+1,refreshed_at=clock_timestamp()
 where organization_id=org and patient_id=p_patient_id
  and next_appointment_at is distinct from next_at;
 get diagnostics changed=row_count;
 if changed>0 then perform linkare_private.bump_directory_version_v1(org);end if;

 -- During a combined new-patient/new-appointment transaction the patient row
 -- may not have been projected yet. Its patient_admin trigger will run the full
 -- refresh later in the same transaction, so no placeholder row is invented.
end $$;

create or replace function linkare_private.records_projection_trigger_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare org uuid:=coalesce(new.organization_id,old.organization_id);record_id text:=coalesce(new.id,old.id);old_patient text;new_patient text;
begin
 if coalesce(new.kind,old.kind)='appointment' then
  old_patient:=nullif(old.payload->>'patientId','');new_patient:=nullif(new.payload->>'patientId','');
  perform linkare_private.refresh_appointment_v1(org,record_id);
  if old_patient is not null then perform linkare_private.refresh_patient_next_appointment_v1(org,old_patient);end if;
  if new_patient is not null and new_patient is distinct from old_patient then perform linkare_private.refresh_patient_next_appointment_v1(org,new_patient);end if;
 elsif coalesce(new.kind,old.kind) in('patient_admin','patient_clinical') then
  perform linkare_private.refresh_patient_v1(org,record_id);
 end if;
 return coalesce(new,old);
end $$;

-- Patient detail now reads the canonical computed next appointment from the
-- directory projection instead of depending on a second patient_admin write.
alter function public.linkare_patient_detail_v1(uuid,text) rename to linkare_patient_detail_pre_next_v1;
revoke all on function public.linkare_patient_detail_pre_next_v1(uuid,text) from public,anon,authenticated;

create function public.linkare_patient_detail_v1(org uuid,p_patient_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;next_at timestamptz;
begin
 result:=public.linkare_patient_detail_pre_next_v1(org,p_patient_id);
 select next_appointment_at into next_at from linkare_private.patient_directory_v1
 where organization_id=org and patient_id=p_patient_id;
 return jsonb_set(result,'{patient,nextVisit}',coalesce(to_jsonb(next_at),'null'::jsonb),true);
end $$;

revoke all on function public.linkare_patient_detail_v1(uuid,text),
 linkare_private.refresh_patient_next_appointment_v1(uuid,text),
 linkare_private.records_projection_trigger_v1() from public,anon;
revoke all on function linkare_private.refresh_patient_next_appointment_v1(uuid,text),
 linkare_private.records_projection_trigger_v1() from authenticated;
grant execute on function public.linkare_patient_detail_v1(uuid,text) to authenticated,service_role;

notify pgrst,'reload schema';
commit;
