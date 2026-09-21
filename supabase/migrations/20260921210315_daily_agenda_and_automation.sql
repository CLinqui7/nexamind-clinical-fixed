begin;

create or replace function public.linkare_daily_agenda_v1(org uuid, agenda_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare tz text; result jsonb;
begin
 if auth.uid() is null or not public.linkare_permission_v3(org,'clinicalView') or not public.linkare_permission_v3(org,'appointmentsManage') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 select coalesce(nullif(payload->>'timezone',''),'America/El_Salvador') into tz from public.linkare_records where organization_id=org and kind='settings' and id='clinic' and not deleted;
 tz:=coalesce(tz,'America/El_Salvador');
 begin perform now() at time zone tz;exception when invalid_parameter_value then tz:='America/El_Salvador';end;
 select coalesce(jsonb_agg(row_data order by row_data->>'start'),'[]'::jsonb) into result from (
  select jsonb_build_object(
   'appointmentId',a.id,'patientId',a.payload->>'patientId','patientName',pa.payload->>'name','start',a.payload->>'start','end',a.payload->>'end','status',coalesce(a.payload->>'status','pending'),'type',a.payload->>'type','modality',a.payload->>'modality',
   'currentMedication',coalesce((select jsonb_build_object('id',m->>'id','name',m->>'name','dose',m->>'dose','frequency',m->>'frequency') from jsonb_array_elements(coalesce(pc.payload->'medications','[]')) m where m->>'status'='active' order by coalesce((m->>'isPrimary')::boolean,false) desc,coalesce(m->>'startDate','') desc limit 1),'null'::jsonb),
   'relevantNote',coalesce((select nullif(coalesce(e->>'reason',e->>'note'),'') from jsonb_array_elements(coalesce((select m->'events' from jsonb_array_elements(coalesce(pc.payload->'medications','[]')) m where m->>'status'='active' order by coalesce((m->>'isPrimary')::boolean,false) desc limit 1),'[]')) e order by coalesce(e->>'at',e->>'date','') desc limit 1),''),
   'timezone',tz,'agendaDate',agenda_date
  ) row_data
  from public.linkare_records a
  join public.linkare_records pa on pa.organization_id=org and pa.kind='patient_admin' and pa.id=a.payload->>'patientId' and not pa.deleted
  left join public.linkare_records pc on pc.organization_id=org and pc.kind='patient_clinical' and pc.id=a.payload->>'patientId' and not pc.deleted
  where a.organization_id=org and a.kind='appointment' and not a.deleted and coalesce(a.payload->>'status','pending') not in('cancelled','no_show') and ((a.payload->>'start')::timestamptz at time zone tz)::date=agenda_date
 ) q;
 return jsonb_build_object('organizationId',org,'date',agenda_date,'timezone',tz,'items',result);
end $$;

revoke all on function public.linkare_daily_agenda_v1(uuid,date) from public,anon;
grant execute on function public.linkare_daily_agenda_v1(uuid,date) to authenticated;
notify pgrst,'reload schema';
commit;
