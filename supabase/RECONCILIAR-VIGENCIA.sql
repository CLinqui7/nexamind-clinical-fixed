-- Administrative reconciliation only after checking the original payment at Wompi.
-- Does not invent a transaction, charge a card or mark an invoice as paid.
-- Fill the values, keep the evidence externally, run as project administrator.
begin;
do $$
declare
 org uuid := null; -- REQUIRED: existing organization UUID
 plan text := null; -- monthly | semiannual | annual
 verified_start timestamptz := null; -- confirmed beginning of previously purchased coverage
 verified_end timestamptz := null; -- confirmed end, not an assumed date
 provider_reference text := null; -- verified transaction or official reconciliation reference
begin
 if org is null or plan is null or verified_start is null or verified_end is null or length(coalesce(provider_reference,''))<5 then raise exception 'Complete all reconciliation values. No changes made.';end if;
 if verified_end<=verified_start or not exists(select 1 from public.organizations where id=org) or not exists(select 1 from public.linkare_plans_v3 where code=plan) then raise exception 'Invalid reconciliation';end if;
 insert into public.linkare_subscriptions_v3(organization_id,plan_code,current_period_start,current_period_end)
 values(org,plan,verified_start,verified_end) on conflict(organization_id) do update set plan_code=excluded.plan_code,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,updated_at=now();
 insert into public.linkare_audit_v3(organization_id,action,record_id) values(org,'subscription.migration_verified',provider_reference);
end $$;
commit;
