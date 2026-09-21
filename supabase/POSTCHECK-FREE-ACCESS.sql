-- Read only. No clinical payloads or credentials are returned.
select 'organizations' metric,count(*) value from public.organizations
union all select 'subscriptions',count(*) from public.linkare_subscriptions_v3
union all select 'organizations_without_subscription',count(*) from public.organizations o left join public.linkare_subscriptions_v3 s on s.organization_id=o.id where s.organization_id is null
union all select 'paid_orders',count(*) from public.linkare_orders_v3 where status='paid'
union all select 'patients_admin',count(*) from public.linkare_records where kind='patient_admin' and not deleted
union all select 'patients_clinical',count(*) from public.linkare_records where kind='patient_clinical' and not deleted
union all select 'appointments',count(*) from public.linkare_records where kind='appointment' and not deleted;
select count(*) organizations,count(*) filter(where s.complimentary_access) free_accounts,count(*) filter(where public.linkare_entitled_v3(o.id)) entitled_accounts from public.organizations o left join public.linkare_subscriptions_v3 s on s.organization_id=o.id;
select column_default,is_nullable from information_schema.columns where table_schema='public' and table_name='linkare_subscriptions_v3' and column_name='complimentary_access';
select has_table_privilege('authenticated','public.linkare_subscriptions_v3','UPDATE') client_can_change_access;
