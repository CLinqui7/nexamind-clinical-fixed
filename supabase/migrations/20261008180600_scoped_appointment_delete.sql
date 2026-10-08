-- Calendar pages are partial. Delete one known appointment by revision instead
-- of diffing the browser's current (possibly different) month. Preserve the
-- original payload in a tombstone for audit and controlled recovery.
create function public.linkare_delete_appointment_v1(
  org uuid,
  p_appointment_id text,
  p_expected_revision bigint
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
     or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'INVALID_APPOINTMENT_DELETE' using errcode = '22023';
  end if;
  if not public.linkare_entitled_v3(org) then
    raise exception 'SUBSCRIPTION_REQUIRED' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(org::text || ':appointment:' || p_appointment_id, 303));
  select * into appointment
  from public.linkare_records
  where organization_id = org and kind = 'appointment' and id = p_appointment_id
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
     or not public.linkare_calendar_permission_v1(org, calendar_id, 'Delete') then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if appointment.deleted then
    return pg_catalog.jsonb_build_object('id', p_appointment_id, 'deleted', true, 'revision', appointment.revision);
  end if;
  if appointment.revision <> p_expected_revision then
    return pg_catalog.jsonb_build_object('id', p_appointment_id, 'conflict', true,
      'code', 'REVISION_CONFLICT', 'revision', appointment.revision);
  end if;

  update public.linkare_records
  set deleted = true,
      payload = appointment.payload || pg_catalog.jsonb_build_object(
        'deletedAt', changed_at, 'deletedBy', actor, 'updatedAt', changed_at),
      revision = appointment.revision + 1,
      updated_at = changed_at,
      updated_by = actor
  where organization_id = org and kind = 'appointment' and id = p_appointment_id
  returning * into appointment;

  insert into public.linkare_audit_v3(organization_id, actor_id, action, kind, record_id, revision, fingerprint)
  values (org, actor, 'appointment.deleted', 'appointment', p_appointment_id,
    appointment.revision, pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(appointment.payload::text, 'UTF8')), 'hex'));
  return pg_catalog.jsonb_build_object('id', p_appointment_id, 'deleted', true, 'revision', appointment.revision);
end;
$$;

revoke all on function public.linkare_delete_appointment_v1(uuid, text, bigint) from public, anon;
grant execute on function public.linkare_delete_appointment_v1(uuid, text, bigint) to authenticated, service_role;

notify pgrst, 'reload schema';
