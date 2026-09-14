-- READ ONLY. Run before migration in the intended Supabase project.
select current_database() as database_name,
 to_regclass('public.organizations') is not null as organizations_exists,
 to_regclass('public.organization_members') is not null as members_exists,
 to_regclass('public.linkare_app_state') is not null as legacy_state_exists,
 to_regclass('public.linkare_records') is not null as v3_already_exists;
select table_name,column_name,data_type from information_schema.columns
 where table_schema='public' and table_name in('organizations','organization_members') order by table_name,ordinal_position;
-- Only counts, never display clinical documents or credentials.
do $$ declare n bigint; paid bigint; pending bigint;begin
 if to_regclass('public.linkare_app_state') is not null then
  execute 'select count(*) from public.linkare_app_state' into n;raise notice 'Legacy organization payloads: %',n;
 end if;
 if to_regclass('public.linkare_subscription_invoices') is not null then
  execute 'select count(*) filter(where status=''paid''), count(*) filter(where status=''pending'') from public.linkare_subscription_invoices' into paid,pending;
  raise notice 'Legacy PAID invoices: %, PENDING invoices: %. Reconcile live payments and outstanding links with Wompi before cutover.',paid,pending;
 end if;
end $$;
-- Any broad Storage policies must be reviewed. The migration adds restrictive guards.
select policyname,roles,cmd,permissive from pg_policies where schemaname='storage' and tablename='objects';
