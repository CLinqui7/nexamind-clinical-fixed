begin;

-- Group only source-confirmed names for one patient. This is a read-only,
-- source-linked historical view, never a current medication or prescription.
create function public.linkare_legacy_medication_summary_v1(
  org uuid,p_patient_id text,p_cursor text default null,p_limit integer default 20
)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare items jsonb;has_more boolean;next_cursor text;
begin
 if auth.uid() is null or not public.linkare_permission_v3(org,'clinicalView') then
  raise exception 'ACCESS_DENIED' using errcode='42501';
 end if;
 if p_limit not between 1 and 20 or p_patient_id is null or length(coalesce(p_cursor,''))>100 then
  raise exception 'INVALID_PAGE';
 end if;
 if not exists(select 1 from public.linkare_records
   where organization_id=org and kind='patient_admin' and id=p_patient_id and not deleted) then
  raise exception 'PATIENT_NOT_FOUND';
 end if;
 with ranked as (
  select lower(btrim(regexp_replace(m.name,'[[:space:]]+',' ','g'))) as name_key,
   m.name,m.strength_text,m.instruction_text,m.source_excerpt,m.history_id,
   h.occurred_on,
   row_number() over (
    partition by lower(btrim(regexp_replace(m.name,'[[:space:]]+',' ','g')))
    order by h.occurred_on desc nulls last,m.id desc
   ) as rank_in_group
  from linkare_private.legacy_medication_mentions_v1 m
  join linkare_private.legacy_history_v1 h
   on h.id=m.history_id and h.organization_id=m.organization_id and h.patient_id=m.patient_id
  where m.organization_id=org and m.patient_id=p_patient_id
 ), grouped as (
  select name_key,count(*) as mention_count,min(occurred_on) as first_seen_on,
   max(occurred_on) as last_seen_on,
   max(name) filter(where rank_in_group=1) as name,
   max(strength_text) filter(where rank_in_group=1) as strength_text,
   max(instruction_text) filter(where rank_in_group=1) as instruction_text,
   max(source_excerpt) filter(where rank_in_group=1) as source_excerpt,
   (max(history_id::text) filter(where rank_in_group=1))::uuid as history_id
  from ranked
  where p_cursor is null or name_key>p_cursor
  group by name_key
 ), candidates as (
  select *,row_number() over(order by name_key) as page_position
  from grouped order by name_key limit p_limit+1
 ), page as (select * from candidates where page_position<=p_limit)
 select coalesce(jsonb_agg(jsonb_build_object(
   'nameKey',name_key,'name',name,'strengthText',strength_text,
   'instructionText',instruction_text,'sourceExcerpt',source_excerpt,
   'historyId',history_id,'mentionCount',mention_count,
   'firstSeenOn',first_seen_on,'lastSeenOn',last_seen_on,
   'reviewStatus','historical_unverified'
  ) order by name_key),'[]'::jsonb),
  exists(select 1 from candidates where page_position>p_limit)
 into items,has_more from page;
 if has_more then next_cursor:=items->-1->>'nameKey'; end if;
 return jsonb_build_object('items',items,'hasMore',has_more,
  'nextCursor',next_cursor,'limit',p_limit,
  'semantics','source_mentions_not_current_treatment');
end $$;

revoke all on function public.linkare_legacy_medication_summary_v1(uuid,text,text,integer)
 from public,anon;
grant execute on function public.linkare_legacy_medication_summary_v1(uuid,text,text,integer)
 to authenticated,service_role;

commit;
