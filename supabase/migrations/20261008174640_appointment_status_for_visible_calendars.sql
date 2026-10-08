-- A status change is one atomic appointment write. It must not depend on the
-- browser still holding the appointment in its current calendar page.
create function public.linkare_set_appointment_status_v1(
  org uuid,
  p_appointment_id text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  appointment public.linkare_records%rowtype;
  calendar_id uuid;
  changed_at timestamptz := clock_timestamp();
begin
  if actor is null or public.linkare_role_v3(org) not in ('owner', 'psychiatrist', 'clinical_assistant', 'secretary') then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if p_appointment_id is null or length(p_appointment_id) not between 1 and 160
     or p_status is null or p_status not in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show') then
    raise exception 'INVALID_APPOINTMENT_STATUS' using errcode = '22023';
  end if;
  if not public.linkare_entitled_v3(org) then
    raise exception 'SUBSCRIPTION_REQUIRED' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(org::text || ':appointment:' || p_appointment_id, 303));
  select * into appointment
  from public.linkare_records
  where organization_id = org and kind = 'appointment' and id = p_appointment_id and not deleted
  for update;
  if not found then
    raise exception 'APPOINTMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  begin
    calendar_id := (appointment.payload->>'calendarId')::uuid;
  exception when invalid_text_representation then
    raise exception 'CALENDAR_NOT_FOUND' using errcode = 'P0002';
  end;
  if not public.linkare_calendar_permission_v1(org, calendar_id, 'View')
     or not public.linkare_calendar_permission_v1(org, calendar_id,
       case when p_status = 'cancelled' then 'Cancel' else 'Edit' end) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if appointment.payload->>'status' is not distinct from p_status then
    return appointment.payload || pg_catalog.jsonb_build_object('__revision', appointment.revision);
  end if;

  update public.linkare_records
  set payload = appointment.payload || pg_catalog.jsonb_build_object('status', p_status, 'updatedAt', changed_at),
      revision = appointment.revision + 1,
      updated_at = changed_at,
      updated_by = actor
  where organization_id = org and kind = 'appointment' and id = p_appointment_id
  returning * into appointment;

  insert into public.linkare_audit_v3(organization_id, actor_id, action, kind, record_id, revision, fingerprint)
  values (org, actor, 'appointment.status_changed', 'appointment', p_appointment_id,
          appointment.revision, pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(appointment.payload::text, 'UTF8')), 'hex'));
  return appointment.payload || pg_catalog.jsonb_build_object('__revision', appointment.revision);
end;
$$;

revoke all on function public.linkare_set_appointment_status_v1(uuid, text, text) from public, anon;
grant execute on function public.linkare_set_appointment_status_v1(uuid, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
