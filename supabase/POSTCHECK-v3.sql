-- Read-only checks after applying the migration.
select code,name,amount_cents,months,currency from public.linkare_plans_v3 order by months;
select
 to_regprocedure('public.linkare_bootstrap_v3(text)') is not null as bootstrap,
 to_regprocedure('public.linkare_load_state_v3(uuid)') is not null as load_state,
 to_regprocedure('public.linkare_save_changes_v3(uuid,jsonb)') is not null as versioned_save,
 to_regprocedure('public.linkare_confirm_payment_v3(text,text,integer,boolean,timestamp with time zone)') is not null as payment_confirmation;
select tablename,rowsecurity from pg_tables where schemaname='public' and tablename in('linkare_records','linkare_orders_v3','linkare_subscriptions_v3','linkare_invites_v3','organization_members');
select has_table_privilege('anon','public.linkare_records','SELECT') as anon_read_must_be_false,
 has_table_privilege('authenticated','public.linkare_plans_v3','UPDATE') as client_price_edit_must_be_false,
 has_function_privilege('authenticated','public.linkare_confirm_payment_v3(text,text,integer,boolean,timestamp with time zone)','EXECUTE') as client_confirm_must_be_false;
select organization_id,count(*) as records from public.linkare_records group by organization_id;
select public,file_size_limit from storage.buckets where id='patient-documents';
-- Confirm migration counts against PRECHECK and your backup before allowing writes.
