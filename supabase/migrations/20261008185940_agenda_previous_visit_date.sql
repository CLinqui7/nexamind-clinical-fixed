begin;

-- The paper agenda needs the latest *prior* recorded appointment/visit, not
-- the patient's latest activity overall (which may be after the chosen day).
-- Keep the lookup inside the existing scoped RPC: staff never fetch charts.
create or replace function public.linkare_printable_agenda_v1(org uuid, agenda_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare tz text; doctor_calendar uuid; items jsonb;
begin
 if agenda_date is null or auth.uid() is null or not public.linkare_permission_v3(org,'agendaSheetView') then
  raise exception 'ACCESS_DENIED' using errcode='42501';
 end if;
 select id into doctor_calendar from public.linkare_calendars_v1
 where organization_id=org and code='doctor' and is_active;
 if doctor_calendar is null or not public.linkare_calendar_permission_v1(org,doctor_calendar,'View') then
  raise exception 'ACCESS_DENIED' using errcode='42501';
 end if;
 select coalesce(nullif(payload->>'timezone',''),'America/El_Salvador') into tz
 from public.linkare_records where organization_id=org and kind='settings' and id='clinic' and not deleted;
 tz:=coalesce(tz,'America/El_Salvador');
 begin perform now() at time zone tz; exception when invalid_parameter_value then tz:='America/El_Salvador'; end;

 select coalesce(jsonb_agg(jsonb_build_object(
   'appointmentId',a.appointment_id,'patientId',a.patient_id,'patientName',p.name,
   'start',a.start_at,'end',a.end_at,'status',a.status,
   'lastAppointmentOn',greatest(previous_appointment.visited_on,modern_visit.visited_on,legacy_visit.visited_on),
   'medications',coalesce(m.medications,'[]'::jsonb),
   'agendaNote',coalesce(n.note,''),'noteRevision',coalesce(n.revision,0)
 ) order by a.start_at,a.appointment_id),'[]'::jsonb) into items
 from linkare_private.appointment_directory_v1 a
 join linkare_private.patient_directory_v1 p on p.organization_id=a.organization_id and p.patient_id=a.patient_id
 left join public.linkare_records pc on pc.organization_id=a.organization_id and pc.kind='patient_clinical' and pc.id=a.patient_id and not pc.deleted
 left join lateral (
   select (prior.start_at at time zone tz)::date visited_on
   from linkare_private.appointment_directory_v1 prior
   where prior.organization_id=a.organization_id and prior.patient_id=a.patient_id
     and prior.calendar_id=doctor_calendar and prior.event_type='appointment'
     and prior.status not in ('cancelled','no_show')
     and prior.start_at < (agenda_date::timestamp at time zone tz)
   order by prior.start_at desc,prior.appointment_id desc limit 1
 ) previous_appointment on true
 left join lateral (
   select max((visit.event_at at time zone tz)::date) visited_on
   from (
     select linkare_private.try_timestamptz_v1(coalesce(note->>'startedAt',note->>'endedAt',note->>'signedAt')) event_at
     from jsonb_array_elements(case when jsonb_typeof(pc.payload->'consultations')='array'
       then pc.payload->'consultations' else '[]'::jsonb end) note
     where (note->>'status' in ('completed','signed') or nullif(note->>'signedAt','') is not null)
       and nullif(note->>'archivedAt','') is null
       and not exists (
         select 1 from jsonb_array_elements(case when jsonb_typeof(pc.payload->'consultationRetractions')='array'
           then pc.payload->'consultationRetractions' else '[]'::jsonb end) retraction
         where retraction->>'resourceId'=note->>'id'
       )
   ) visit
   where visit.event_at < (agenda_date::timestamp at time zone tz)
 ) modern_visit on true
 left join lateral (
   select history.occurred_on visited_on
   from linkare_private.legacy_history_v1 history
   where history.organization_id=a.organization_id and history.patient_id=a.patient_id
     and history.source_table='t_mov_diarios' and history.payload->>'passedConsultation'='true'
     and history.occurred_on < agenda_date
   order by history.occurred_on desc,history.id desc limit 1
 ) legacy_visit on true
 left join lateral (
   select jsonb_agg(jsonb_build_object('name',med->>'name','dose',med->>'dose',
    'frequency',med->>'frequency','route',med->>'route')
    order by coalesce((med->>'isPrimary')::boolean,false) desc, med->>'name') medications
   from jsonb_array_elements(case when jsonb_typeof(pc.payload->'medications')='array'
    then pc.payload->'medications' else '[]'::jsonb end) med
   where med->>'status'='active' and nullif(med->>'archivedAt','') is null
     and nullif(trim(med->>'name'),'') is not null
 ) m on true
 left join linkare_private.appointment_agenda_note_v1 n
  on n.organization_id=a.organization_id and n.appointment_id=a.appointment_id
 where a.organization_id=org and a.calendar_id=doctor_calendar and a.event_type='appointment'
   and a.status not in ('cancelled','no_show')
   and a.start_at >= (agenda_date::timestamp at time zone tz)
   and a.start_at < ((agenda_date+1)::timestamp at time zone tz);
 return jsonb_build_object('date',agenda_date,'timezone',tz,'items',items);
end $$;

revoke all on function public.linkare_printable_agenda_v1(uuid,date) from public,anon;
grant execute on function public.linkare_printable_agenda_v1(uuid,date) to authenticated;
notify pgrst,'reload schema';
commit;
