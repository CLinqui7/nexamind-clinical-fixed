-- Prescription deletion is an audited archive. The server owns archive metadata
-- and archived prescriptions cannot be changed, restored, or physically removed.
begin;

create or replace function public.linkare_prescription_archive_guard_v3()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  prior_payload jsonb;
  prior_rx jsonb;
  rx jsonb;
  guarded jsonb := '[]'::jsonb;
  archived_at timestamptz := clock_timestamp();
begin
  if new.kind <> 'patient_clinical' or jsonb_typeof(coalesce(new.payload->'prescriptions', '[]'::jsonb)) <> 'array' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    prior_payload := old.payload;
  else
    select payload into prior_payload
    from public.linkare_records
    where organization_id = new.organization_id and kind = new.kind and id = new.id;
  end if;

  for rx in select value from jsonb_array_elements(coalesce(new.payload->'prescriptions', '[]'::jsonb)) loop
    prior_rx := null;
    select value into prior_rx
    from jsonb_array_elements(coalesce(prior_payload->'prescriptions', '[]'::jsonb))
    where value->>'id' = rx->>'id';

    if prior_rx is null then
      if coalesce(rx->>'archivedAt', '') <> '' or rx ? 'archivedBy' then
        raise exception 'INVALID_PRESCRIPTION_ARCHIVE';
      end if;
    elsif coalesce(prior_rx->>'archivedAt', '') <> '' then
      if rx is distinct from prior_rx then
        raise exception 'PRESCRIPTION_ARCHIVED';
      end if;
      rx := prior_rx;
    elsif coalesce(rx->>'archivedAt', '') <> '' then
      rx := (rx - array['archivedAt','archivedBy']) || jsonb_build_object(
        'archivedAt', archived_at,
        'archivedBy', auth.uid()
      );
    elsif rx ? 'archivedBy' then
      raise exception 'INVALID_PRESCRIPTION_ARCHIVE';
    end if;

    guarded := guarded || jsonb_build_array(rx);
  end loop;

  new.payload := jsonb_set(new.payload, '{prescriptions}', guarded);
  return new;
end
$function$;

revoke all on function public.linkare_prescription_archive_guard_v3() from public, anon, authenticated;

drop trigger if exists linkare_prescription_archive_guard_v3 on public.linkare_records;
create trigger linkare_prescription_archive_guard_v3
before insert or update on public.linkare_records
for each row execute function public.linkare_prescription_archive_guard_v3();

notify pgrst, 'reload schema';
commit;
