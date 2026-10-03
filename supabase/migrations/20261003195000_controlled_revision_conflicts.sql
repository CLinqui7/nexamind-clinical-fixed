begin;

-- Deployments already open in a browser can keep an older autosave loop alive
-- after production is promoted. PostgreSQL exceptions make those stale clients
-- retry forever and flood postgres_logs. Preserve optimistic concurrency while
-- returning a typed conflict result that current clients reject explicitly.
alter function public.linkare_save_changes_v3(uuid,jsonb)
 rename to linkare_save_changes_throwing_v3;
revoke all on function public.linkare_save_changes_throwing_v3(uuid,jsonb)
 from public,anon,authenticated;

create function public.linkare_save_changes_v3(org uuid,changes jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 failure_message text;
 conflict_kind text;
 conflict_id text;
 current_revision bigint;
begin
 begin
  return public.linkare_save_changes_throwing_v3(org,changes);
 exception when serialization_failure then
  get stacked diagnostics failure_message=MESSAGE_TEXT;
  if failure_message !~ '^REVISION_CONFLICT:[a-z_]+:.+$' then raise;end if;
  conflict_kind:=split_part(failure_message,':',2);
  conflict_id:=substring(failure_message from length('REVISION_CONFLICT:'||conflict_kind||':')+1);
  select revision into current_revision
    from public.linkare_records
   where organization_id=org and kind=conflict_kind and id=conflict_id;
  return jsonb_build_array(jsonb_build_object(
   'kind',conflict_kind,
   'id',conflict_id,
   'revision',coalesce(current_revision,0),
   'conflict',true,
   'code','REVISION_CONFLICT'
  ));
 end;
end $$;

revoke all on function public.linkare_save_changes_v3(uuid,jsonb) from public,anon;
grant execute on function public.linkare_save_changes_v3(uuid,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
