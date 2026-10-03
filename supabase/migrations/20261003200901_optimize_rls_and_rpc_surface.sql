-- Cache the JWT subject once per statement instead of evaluating auth.uid()
-- for every row considered by these RLS policies.
drop policy if exists linkare_members_read_v3 on public.organization_members;
create policy linkare_members_read_v3
on public.organization_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.linkare_doctor_v3(organization_id)
);

drop policy if exists document_audit_insert_v3 on public.patient_document_audit;
create policy document_audit_insert_v3
on public.patient_document_audit
for insert
to authenticated
with check (
  actor_id = (select auth.uid())
  and case
    when action in ('upload', 'archive', 'delete')
      then public.linkare_permission_v3(organization_id, 'documentsManage')
    else public.linkare_permission_v3(organization_id, 'documentsView')
  end
  and public.linkare_document_access_v3(storage_path)
);

-- SECURITY DEFINER helpers must never be callable by unauthenticated clients.
-- Keep the Storage guard restrictive for anon without invoking a helper that
-- anon is intentionally not allowed to execute.
do $$
begin
  if to_regprocedure('public.has_org_access(uuid)') is not null then
    revoke all on function public.has_org_access(uuid) from public, anon;
  end if;
  if to_regprocedure('public.has_org_role(uuid,public.member_role[])') is not null then
    revoke all on function public.has_org_role(uuid, public.member_role[]) from public, anon;
  end if;
end $$;
revoke all on function public.linkare_document_access_v3(text) from public, anon;
revoke all on function public.linkare_document_insert_v3(text) from public, anon;

drop policy if exists linkare_document_guard_select_v3 on storage.objects;
create policy linkare_document_guard_select_v3
on storage.objects
as restrictive
for select
to authenticated
using (
  bucket_id <> 'patient-documents'
  or public.linkare_document_access_v3(name)
);

drop policy if exists linkare_document_guard_select_anon_v3 on storage.objects;
create policy linkare_document_guard_select_anon_v3
on storage.objects
as restrictive
for select
to anon
using (bucket_id <> 'patient-documents');

drop policy if exists linkare_document_guard_insert_v3 on storage.objects;
create policy linkare_document_guard_insert_v3
on storage.objects
as restrictive
for insert
to authenticated
with check (
  bucket_id <> 'patient-documents'
  or public.linkare_document_insert_v3(name)
);

drop policy if exists linkare_document_guard_insert_anon_v3 on storage.objects;
create policy linkare_document_guard_insert_anon_v3
on storage.objects
as restrictive
for insert
to anon
with check (bucket_id <> 'patient-documents');
