-- Linkare v1.7.0
-- Platform subscription billing + JSON state persistence for a fast production bridge.
-- Run after schema.sql and 20260814_v1_2_practice_features.sql.

create extension if not exists pgcrypto;

create table if not exists public.linkare_app_state (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.linkare_platform_billing_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan_name text not null default 'Plan Profesional Linkare',
  plan_description text not null default 'Licencia mensual de la plataforma Linkare para gestión clínica.',
  subscription_price numeric(10,2) not null default 40 check (subscription_price >= 0.01),
  currency text not null default 'USD',
  billing_cycle text not null default 'mensual',
  payer_name text,
  payer_email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.linkare_subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  payer_user_id uuid references auth.users(id) on delete set null,
  plan_name text not null default 'Plan Profesional Linkare',
  description text not null,
  billing_period text,
  payer_name text,
  payer_email text not null,
  amount numeric(10,2) not null check (amount >= 0.01),
  currency text not null default 'USD',
  method text not null default 'wompi',
  status text not null default 'pending' check (status in ('pending','paid','cancelled','expired','refunded')),
  provider text not null default 'wompi_sv',
  external_reference text unique,
  payment_link_id text,
  payment_url text,
  qr_url text,
  external_transaction_id text,
  is_test boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  provider_payload jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.linkare_wompi_events (
  id bigint generated always as identity primary key,
  external_reference text,
  transaction_id text,
  result text,
  is_productive boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists linkare_invoice_org_status_idx
  on public.linkare_subscription_invoices (organization_id, status, created_at desc);
create index if not exists linkare_invoice_reference_idx
  on public.linkare_subscription_invoices (external_reference);
create index if not exists linkare_event_reference_idx
  on public.linkare_wompi_events (external_reference, created_at desc);
create unique index if not exists linkare_event_transaction_unique_idx
  on public.linkare_wompi_events (transaction_id)
  where transaction_id is not null;

create or replace function public.has_org_role(target_org uuid, allowed_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.active = true
      and m.role = any(allowed_roles)
  );
$$;

revoke all on function public.has_org_role(uuid, public.member_role[]) from public;
grant execute on function public.has_org_role(uuid, public.member_role[]) to authenticated;

create or replace function public.linkare_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists linkare_app_state_updated on public.linkare_app_state;
create trigger linkare_app_state_updated
before update on public.linkare_app_state
for each row execute function public.linkare_set_updated_at();

drop trigger if exists linkare_billing_settings_updated on public.linkare_platform_billing_settings;
create trigger linkare_billing_settings_updated
before update on public.linkare_platform_billing_settings
for each row execute function public.linkare_set_updated_at();

drop trigger if exists linkare_invoice_updated on public.linkare_subscription_invoices;
create trigger linkare_invoice_updated
before update on public.linkare_subscription_invoices
for each row execute function public.linkare_set_updated_at();

-- First authenticated user can create the initial organization and become owner.
create or replace function public.linkare_bootstrap_organization(
  requested_name text default 'Linkare Clinic',
  requested_slug text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_org uuid;
  new_org uuid;
  safe_slug text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select organization_id into existing_org
  from public.organization_members
  where user_id = current_user_id and active = true
  order by created_at asc
  limit 1;

  if existing_org is not null then
    return existing_org;
  end if;

  safe_slug := coalesce(nullif(trim(requested_slug), ''),
    lower(regexp_replace(coalesce(nullif(trim(requested_name), ''), 'linkare-clinic'), '[^a-zA-Z0-9]+', '-', 'g'))
  );
  safe_slug := trim(both '-' from safe_slug) || '-' || substr(replace(current_user_id::text, '-', ''), 1, 8);

  insert into public.organizations (name, slug, is_demo)
  values (coalesce(nullif(trim(requested_name), ''), 'Linkare Clinic'), safe_slug, false)
  returning id into new_org;

  insert into public.organization_members (organization_id, user_id, role, display_name, active)
  values (new_org, current_user_id, 'owner', coalesce(nullif(trim(requested_name), ''), 'Linkare Owner'), true);

  insert into public.linkare_platform_billing_settings (organization_id)
  values (new_org)
  on conflict (organization_id) do nothing;

  return new_org;
end;
$$;

revoke all on function public.linkare_bootstrap_organization(text, text) from public;
grant execute on function public.linkare_bootstrap_organization(text, text) to authenticated;

alter table public.linkare_app_state enable row level security;
alter table public.linkare_platform_billing_settings enable row level security;
alter table public.linkare_subscription_invoices enable row level security;
alter table public.linkare_wompi_events enable row level security;

drop policy if exists linkare_app_state_access on public.linkare_app_state;
create policy linkare_app_state_access on public.linkare_app_state
for all to authenticated
using (public.has_org_access(organization_id))
with check (public.has_org_access(organization_id));

drop policy if exists linkare_billing_settings_access on public.linkare_platform_billing_settings;
drop policy if exists linkare_billing_settings_select on public.linkare_platform_billing_settings;
drop policy if exists linkare_billing_settings_insert_owner on public.linkare_platform_billing_settings;
drop policy if exists linkare_billing_settings_update_owner on public.linkare_platform_billing_settings;
drop policy if exists linkare_billing_settings_delete_owner on public.linkare_platform_billing_settings;

create policy linkare_billing_settings_select on public.linkare_platform_billing_settings
for select to authenticated
using (public.has_org_access(organization_id));

create policy linkare_billing_settings_insert_owner on public.linkare_platform_billing_settings
for insert to authenticated
with check (public.has_org_role(organization_id, array['owner']::public.member_role[]));

create policy linkare_billing_settings_update_owner on public.linkare_platform_billing_settings
for update to authenticated
using (public.has_org_role(organization_id, array['owner']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner']::public.member_role[]));

create policy linkare_billing_settings_delete_owner on public.linkare_platform_billing_settings
for delete to authenticated
using (public.has_org_role(organization_id, array['owner']::public.member_role[]));

drop policy if exists linkare_invoices_select on public.linkare_subscription_invoices;
create policy linkare_invoices_select on public.linkare_subscription_invoices
for select to authenticated
using (organization_id is null or public.has_org_access(organization_id));

-- Insert/update of invoices is performed by Edge Functions with service-role.
-- Authenticated users can only read their organization's invoices.

-- Webhook events remain service-role only. No public policy is created.
