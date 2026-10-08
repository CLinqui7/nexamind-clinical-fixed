begin;

-- A calendar form sends only fields the editor actually changed, together
-- with the values observed when it was opened. Row locks serialize writers;
-- disjoint changes merge, while a same-field change requires a human choice.
create function public.linkare_patch_appointment_v1(
  org uuid,
  p_appointment_id text,
  p_expected_revision bigint,
  p_base jsonb,
  p_changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  appointment public.linkare_records%rowtype;
  clinical public.linkare_records%rowtype;
  current_payload jsonb;
  next_payload jsonb;
  current_value jsonb;
  desired_value jsonb;
  conflicts jsonb := '[]'::jsonb;
  field text;
  old_calendar uuid;
  new_calendar uuid;
  new_calendar_code text;
  administrative_change boolean := false;
  note_change boolean := false;
  merged boolean;
  changed_at timestamptz := clock_timestamp();
begin
  if actor is null or public.linkare_role_v3(org) not in ('owner', 'psychiatrist', 'clinical_assistant', 'secretary') then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if p_appointment_id is null or length(p_appointment_id) not between 1 and 160
     or p_expected_revision is null or p_expected_revision < 1
     or pg_catalog.jsonb_typeof(p_base) <> 'object' or pg_catalog.jsonb_typeof(p_changes) <> 'object'
     or (select count(*) from pg_catalog.jsonb_object_keys(p_changes)) > 12
     or pg_catalog.octet_length(p_changes::text) > 50000 then
    raise exception 'INVALID_APPOINTMENT_EDIT' using errcode = '22023';
  end if;
  if not public.linkare_entitled_v3(org) then
    raise exception 'SUBSCRIPTION_REQUIRED' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(org::text || ':appointment:' || p_appointment_id, 303));
  select * into appointment from public.linkare_records
   where organization_id = org and kind = 'appointment' and id = p_appointment_id and not deleted
   for update;
  if not found then raise exception 'APPOINTMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  begin
    old_calendar := (appointment.payload->>'calendarId')::uuid;
  exception when invalid_text_representation then
    raise exception 'CALENDAR_NOT_FOUND' using errcode = 'P0002';
  end;
  if not public.linkare_calendar_permission_v1(org, old_calendar, 'View') then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  if public.linkare_permission_v3(org, 'clinicalView') then
    select * into clinical from public.linkare_records
     where organization_id = org and kind = 'appointment_clinical' and id = p_appointment_id and not deleted
     for update;
  end if;
  current_payload := appointment.payload || pg_catalog.jsonb_build_object('__revision', appointment.revision);
  if public.linkare_permission_v3(org, 'clinicalView') then
    current_payload := current_payload || pg_catalog.jsonb_build_object(
      'notes', coalesce(clinical.payload->>'notes', ''), '__notesRevision', coalesce(clinical.revision, 0));
  end if;
  merged := appointment.revision <> p_expected_revision;
  next_payload := appointment.payload;

  -- Reassignment changes the meaning of every other edit. Do not attach
  -- notes, status, or scheduling decisions to another patient's event.
  foreach field in array array['calendarId', 'eventType', 'patientId'] loop
    if p_base ? field and not p_changes ? field
       and coalesce(appointment.payload->field, 'null'::jsonb) is distinct from p_base->field then
      conflicts := conflicts || pg_catalog.jsonb_build_array(field);
    end if;
  end loop;

  for field in select pg_catalog.jsonb_object_keys(p_changes) loop
    if field not in ('calendarId', 'eventType', 'patientId', 'title', 'start', 'end',
                     'type', 'modality', 'status', 'adminReviewStatus', 'notes')
       or not p_base ? field then
      raise exception 'INVALID_APPOINTMENT_EDIT' using errcode = '22023';
    end if;
    if field = 'notes' then
      if not public.linkare_permission_v3(org, 'clinicalEdit')
         or not public.linkare_permission_v3(org, 'appointmentsManage') then
        raise exception 'ACCESS_DENIED' using errcode = '42501';
      end if;
      current_value := pg_catalog.to_jsonb(coalesce(clinical.payload->>'notes', ''));
      desired_value := pg_catalog.to_jsonb(coalesce(p_changes->>'notes', ''));
    else
      current_value := coalesce(appointment.payload->field, 'null'::jsonb);
      desired_value := p_changes->field;
    end if;
    if current_value is distinct from desired_value
       and current_value is distinct from p_base->field then
      conflicts := conflicts || pg_catalog.jsonb_build_array(field);
    elsif current_value is distinct from desired_value then
      if field = 'notes' then
        note_change := true;
      else
        administrative_change := true;
        next_payload := next_payload || pg_catalog.jsonb_build_object(field, desired_value);
      end if;
    end if;
  end loop;
  if pg_catalog.jsonb_array_length(conflicts) > 0 then
    return pg_catalog.jsonb_build_object('conflict', true, 'code', 'FIELD_CONFLICT',
      'fields', conflicts, 'current', current_payload);
  end if;
  if not administrative_change and not note_change then
    return pg_catalog.jsonb_build_object('saved', true, 'merged', merged, 'appointment', current_payload);
  end if;

  if administrative_change then
    begin
      new_calendar := (next_payload->>'calendarId')::uuid;
    exception when invalid_text_representation then
      raise exception 'CALENDAR_REQUIRED' using errcode = '22023';
    end;
    select code into new_calendar_code from public.linkare_calendars_v1
     where organization_id = org and id = new_calendar and is_active;
    if new_calendar_code is null then raise exception 'CALENDAR_NOT_FOUND' using errcode = 'P0002'; end if;
    if not (public.linkare_calendar_permission_v1(org, old_calendar, 'Edit')
         or ((select count(*) from pg_catalog.jsonb_object_keys(p_changes)) = 1
             and p_changes ? 'status' and next_payload->>'status' = 'cancelled'
             and public.linkare_calendar_permission_v1(org, old_calendar, 'Cancel')))
       or (new_calendar is distinct from old_calendar and
           not public.linkare_calendar_permission_v1(org, new_calendar, 'Create'))
       or (next_payload->>'status' = 'cancelled' and appointment.payload->>'status' is distinct from 'cancelled'
           and not public.linkare_calendar_permission_v1(org, old_calendar, 'Cancel')) then
      raise exception 'ACCESS_DENIED' using errcode = '42501';
    end if;
    if next_payload->>'eventType' = 'general' then
      if new_calendar_code <> 'general' or nullif(pg_catalog.btrim(next_payload->>'title'), '') is null then
        raise exception 'INVALID_GENERAL_EVENT' using errcode = '22023';
      end if;
      next_payload := next_payload - 'patientId';
    elsif coalesce(next_payload->>'eventType', 'appointment') = 'appointment' then
      if nullif(next_payload->>'patientId', '') is null or not exists (
        select 1 from public.linkare_records where organization_id = org and kind = 'patient_admin'
         and id = next_payload->>'patientId' and not deleted) then
        raise exception 'PATIENT_NOT_FOUND' using errcode = 'P0002';
      end if;
    else
      raise exception 'INVALID_APPOINTMENT_EDIT' using errcode = '22023';
    end if;
    if coalesce(next_payload->>'status', '') not in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')
       or coalesce(next_payload->>'adminReviewStatus', 'none') not in ('none', 'pending', 'reviewed') then
      raise exception 'INVALID_APPOINTMENT_STATUS' using errcode = '22023';
    end if;
    begin
      if nullif(next_payload->>'start', '') is null or nullif(next_payload->>'end', '') is null
         or (next_payload->>'end')::timestamptz <= (next_payload->>'start')::timestamptz then
        raise exception 'INVALID_APPOINTMENT_TIME' using errcode = '22023';
      end if;
    exception when invalid_datetime_format or datetime_field_overflow then
      raise exception 'INVALID_APPOINTMENT_TIME' using errcode = '22023';
    end;
    update public.linkare_records
       set payload = next_payload || pg_catalog.jsonb_build_object('updatedAt', changed_at),
           revision = appointment.revision + 1, updated_at = changed_at, updated_by = actor
     where organization_id = org and kind = 'appointment' and id = p_appointment_id
     returning * into appointment;
    insert into public.linkare_audit_v3(organization_id, actor_id, action, kind, record_id, revision, fingerprint)
    values (org, actor, 'appointment.merged_edit', 'appointment', p_appointment_id, appointment.revision,
      pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(appointment.payload::text, 'UTF8')), 'hex'));
  end if;
  if note_change then
    insert into public.linkare_records(organization_id, kind, id, payload, revision, deleted, updated_by)
    values (org, 'appointment_clinical', p_appointment_id,
      pg_catalog.jsonb_build_object('notes', coalesce(p_changes->>'notes', '')), 1, false, actor)
    on conflict (organization_id, kind, id) do update
       set payload = linkare_records.payload || excluded.payload,
           revision = linkare_records.revision + 1,
           deleted = false, updated_at = changed_at, updated_by = actor
    returning * into clinical;
    insert into public.linkare_audit_v3(organization_id, actor_id, action, kind, record_id, revision, fingerprint)
    values (org, actor, 'appointment.notes_changed', 'appointment_clinical', p_appointment_id, clinical.revision,
      pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(clinical.payload::text, 'UTF8')), 'hex'));
  end if;
  current_payload := appointment.payload || pg_catalog.jsonb_build_object('__revision', appointment.revision);
  if public.linkare_permission_v3(org, 'clinicalView') then
    current_payload := current_payload || pg_catalog.jsonb_build_object(
      'notes', coalesce(clinical.payload->>'notes', ''), '__notesRevision', coalesce(clinical.revision, 0));
  end if;
  return pg_catalog.jsonb_build_object('saved', true, 'merged', merged,
    'appointment', current_payload);
end;
$$;

revoke all on function public.linkare_patch_appointment_v1(uuid, text, bigint, jsonb, jsonb) from public, anon;
grant execute on function public.linkare_patch_appointment_v1(uuid, text, bigint, jsonb, jsonb) to authenticated, service_role;
notify pgrst, 'reload schema';

commit;
