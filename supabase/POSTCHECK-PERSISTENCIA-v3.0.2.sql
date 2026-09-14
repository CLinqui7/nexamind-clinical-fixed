-- Linkare v3.0.2: comprobacion de persistencia. Solo lectura.
select
  (select count(*) from public.organizations) as organizations,
  (select count(*) from public.organization_members where active) as active_members,
  (select count(*) from public.linkare_records where not deleted) as live_records,
  (select count(*) from public.linkare_records where kind='patient_admin' and not deleted) as patients_admin,
  (select count(*) from public.linkare_records where kind='patient_clinical' and not deleted) as patients_clinical,
  (select count(*) from public.linkare_records where kind='appointment' and not deleted) as appointments,
  (select count(*) from public.linkare_records where kind='appointment_clinical' and not deleted) as appointment_private,
  (select count(*) from public.linkare_records where kind='alert' and not deleted) as alerts,
  (select count(*) from public.linkare_orders_v3) as orders,
  (select count(*) from public.linkare_orders_v3 where status='paid') as paid_orders,
  (select count(*) from public.linkare_subscriptions_v3 where current_period_end is not null) as subscriptions_with_period,
  (select count(*) from public.linkare_audit_v3) as audit_events;

select organization_id, kind, count(*) as records, max(updated_at) as last_update
from public.linkare_records
where not deleted
group by organization_id, kind
order by organization_id, kind;

select organization_id, action, count(*) as events, max(created_at) as last_event
from public.linkare_audit_v3
group by organization_id, action
order by last_event desc nulls last;
