begin;

-- This proves that an extracted mention occurs verbatim in the same
-- patient's FoxPro history. It does not attest to present-day use.
alter table linkare_private.legacy_medication_mentions_v1
  add column source_verified_at timestamptz;

create function linkare_private.verify_legacy_medication_source_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from linkare_private.legacy_history_v1 h
    where h.id=new.history_id and h.organization_id=new.organization_id
      and h.patient_id=new.patient_id
      and position(new.source_excerpt in coalesce(h.payload->>'text',''))>0) then
    new.source_verified_at:=coalesce(new.source_verified_at,clock_timestamp());
  else
    new.source_verified_at:=null;
  end if;
  return new;
end $$;
create trigger linkare_verify_legacy_medication_source_v1
  before insert or update of history_id,patient_id,source_excerpt
  on linkare_private.legacy_medication_mentions_v1
  for each row execute function linkare_private.verify_legacy_medication_source_v1();

update linkare_private.legacy_medication_mentions_v1 m
set source_verified_at=clock_timestamp()
from linkare_private.legacy_history_v1 h
where m.organization_id='2ca5b8d4-d711-4ec7-833a-9d018ef067ca'
  and h.id=m.history_id and h.organization_id=m.organization_id
  and h.patient_id=m.patient_id
  and position(m.source_excerpt in coalesce(h.payload->>'text',''))>0
  and m.source_verified_at is null;

-- Keep the clinician review decision separate from source verification.
alter function public.linkare_legacy_medication_page_v1(uuid,text,jsonb,integer)
  rename to linkare_legacy_medication_page_source_v1;
revoke all on function public.linkare_legacy_medication_page_source_v1(uuid,text,jsonb,integer)
  from public,anon,authenticated;
create function public.linkare_legacy_medication_page_v1(
  org uuid,p_patient_id text,p_cursor jsonb default null,p_limit integer default 20
)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;items jsonb;
begin
  result:=public.linkare_legacy_medication_page_source_v1(
    org,p_patient_id,p_cursor,p_limit);
  select coalesce(jsonb_agg(item.value||jsonb_build_object(
    'sourceVerified',m.source_verified_at is not null
  ) order by item.ordinality),'[]'::jsonb) into items
  from jsonb_array_elements(result->'items') with ordinality item(value,ordinality)
  left join linkare_private.legacy_medication_mentions_v1 m
    on m.organization_id=org and m.patient_id=p_patient_id
      and m.id=(item.value->>'id')::uuid;
  return jsonb_set(result,'{items}',items);
end $$;
revoke all on function public.linkare_legacy_medication_page_v1(uuid,text,jsonb,integer)
  from public,anon;
grant execute on function public.linkare_legacy_medication_page_v1(uuid,text,jsonb,integer)
  to authenticated;

alter function public.linkare_legacy_medication_summary_v1(uuid,text,text,integer)
  rename to linkare_legacy_medication_summary_source_v1;
revoke all on function public.linkare_legacy_medication_summary_source_v1(uuid,text,text,integer)
  from public,anon,authenticated;
create function public.linkare_legacy_medication_summary_v1(
  org uuid,p_patient_id text,p_cursor text default null,p_limit integer default 20
)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;items jsonb;
begin
  result:=public.linkare_legacy_medication_summary_source_v1(
    org,p_patient_id,p_cursor,p_limit);
  select coalesce(jsonb_agg(item.value||jsonb_build_object(
    'sourceVerified',m.source_verified_at is not null
  ) order by item.ordinality),'[]'::jsonb) into items
  from jsonb_array_elements(result->'items') with ordinality item(value,ordinality)
  left join linkare_private.legacy_medication_mentions_v1 m
    on m.organization_id=org and m.patient_id=p_patient_id
      and m.id=(item.value->>'mentionId')::uuid;
  return jsonb_set(result,'{items}',items);
end $$;
revoke all on function public.linkare_legacy_medication_summary_v1(uuid,text,text,integer)
  from public,anon;
grant execute on function public.linkare_legacy_medication_summary_v1(uuid,text,text,integer)
  to authenticated;

notify pgrst,'reload schema';
commit;
