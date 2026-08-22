-- Linkare v1.9.0 - reparación consolidada de producción
-- Seguro para una base nueva o parcialmente configurada.
-- Objetivo: Auth + organizaciones + estado JSON + suscripción $40 + Wompi.

create extension if not exists pgcrypto;

-- 1) Tipos mínimos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.member_role AS ENUM ('owner','psychiatrist','secretary','clinical_assistant','read_only');
  END IF;
END $$;

-- 2) Organizaciones y miembros
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/El_Salvador',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'read_only',
  display_name text,
  professional_title text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- 3) Persistencia simple del sistema
create table if not exists public.linkare_app_state (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4) Suscripción Linkare
create table if not exists public.linkare_platform_billing_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan_name text not null default 'Plan Profesional Linkare',
  plan_description text not null default 'Licencia mensual de Linkare para gestión psiquiátrica.',
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

-- Precio oficial actual
alter table public.linkare_platform_billing_settings
  alter column subscription_price set default 40;
update public.linkare_platform_billing_settings
set subscription_price = 40,
    updated_at = now()
where subscription_price is distinct from 40;

-- 5) Helpers de acceso
create or replace function public.has_org_access(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.active = true
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.active = true
      and m.role = any(allowed_roles)
  );
$$;

revoke all on function public.has_org_access(uuid) from public;
grant execute on function public.has_org_access(uuid) to authenticated;
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'linkare_app_state_updated') THEN
    CREATE TRIGGER linkare_app_state_updated
      BEFORE UPDATE ON public.linkare_app_state
      FOR EACH ROW EXECUTE FUNCTION public.linkare_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'linkare_billing_settings_updated') THEN
    CREATE TRIGGER linkare_billing_settings_updated
      BEFORE UPDATE ON public.linkare_platform_billing_settings
      FOR EACH ROW EXECUTE FUNCTION public.linkare_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'linkare_invoice_updated') THEN
    CREATE TRIGGER linkare_invoice_updated
      BEFORE UPDATE ON public.linkare_subscription_invoices
      FOR EACH ROW EXECUTE FUNCTION public.linkare_set_updated_at();
  END IF;
END $$;

-- 6) Registro self-service: crea una organización una sola vez por usuario
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
  owner_name text;
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

  owner_name := coalesce(
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
    nullif(trim(auth.jwt() ->> 'email'), ''),
    'Profesional Linkare'
  );

  safe_slug := coalesce(
    nullif(trim(requested_slug), ''),
    lower(regexp_replace(coalesce(nullif(trim(requested_name), ''), 'linkare-clinic'), '[^a-zA-Z0-9]+', '-', 'g'))
  );
  safe_slug := trim(both '-' from safe_slug) || '-' || substr(replace(current_user_id::text, '-', ''), 1, 8);

  insert into public.organizations (name, slug, is_demo)
  values (coalesce(nullif(trim(requested_name), ''), 'Linkare Clinic'), safe_slug, false)
  returning id into new_org;

  insert into public.organization_members (organization_id, user_id, role, display_name, active)
  values (new_org, current_user_id, 'owner', owner_name, true)
  on conflict (organization_id, user_id) do update
  set role = 'owner', display_name = excluded.display_name, active = true;

  insert into public.linkare_platform_billing_settings (
    organization_id, plan_name, plan_description, subscription_price,
    currency, billing_cycle, payer_name, payer_email, active
  )
  values (
    new_org,
    'Plan Profesional Linkare',
    'Licencia mensual de Linkare para gestión psiquiátrica.',
    40,
    'USD',
    'mensual',
    owner_name,
    auth.jwt() ->> 'email',
    true
  )
  on conflict (organization_id) do update
  set subscription_price = 40,
      payer_name = coalesce(public.linkare_platform_billing_settings.payer_name, excluded.payer_name),
      payer_email = coalesce(public.linkare_platform_billing_settings.payer_email, excluded.payer_email),
      updated_at = now();

  return new_org;
end;
$$;

revoke all on function public.linkare_bootstrap_organization(text, text) from public;
grant execute on function public.linkare_bootstrap_organization(text, text) to authenticated;

-- 7) RLS
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.linkare_app_state enable row level security;
alter table public.linkare_platform_billing_settings enable row level security;
alter table public.linkare_subscription_invoices enable row level security;
alter table public.linkare_wompi_events enable row level security;

DROP POLICY IF EXISTS organizations_select ON public.organizations;
CREATE POLICY organizations_select ON public.organizations
  FOR SELECT TO authenticated USING (public.has_org_access(id));

DROP POLICY IF EXISTS members_select ON public.organization_members;
CREATE POLICY members_select ON public.organization_members
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_org_access(organization_id));

DROP POLICY IF EXISTS linkare_app_state_access ON public.linkare_app_state;
CREATE POLICY linkare_app_state_access ON public.linkare_app_state
  FOR ALL TO authenticated
  USING (public.has_org_access(organization_id))
  WITH CHECK (public.has_org_access(organization_id));

DROP POLICY IF EXISTS linkare_billing_settings_select ON public.linkare_platform_billing_settings;
CREATE POLICY linkare_billing_settings_select ON public.linkare_platform_billing_settings
  FOR SELECT TO authenticated
  USING (public.has_org_access(organization_id));

DROP POLICY IF EXISTS linkare_billing_settings_insert_owner ON public.linkare_platform_billing_settings;
CREATE POLICY linkare_billing_settings_insert_owner ON public.linkare_platform_billing_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner']::public.member_role[]));

DROP POLICY IF EXISTS linkare_billing_settings_update_owner ON public.linkare_platform_billing_settings;
CREATE POLICY linkare_billing_settings_update_owner ON public.linkare_platform_billing_settings
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner']::public.member_role[]))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner']::public.member_role[]));

DROP POLICY IF EXISTS linkare_invoices_select ON public.linkare_subscription_invoices;
CREATE POLICY linkare_invoices_select ON public.linkare_subscription_invoices
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.has_org_access(organization_id));

-- Fuerza a PostgREST a refrescar funciones/tablas ahora.
NOTIFY pgrst, 'reload schema';

-- Diagnóstico final esperado: una fila con todos los valores TRUE.
select
  to_regclass('public.organizations') is not null as organizations_ok,
  to_regclass('public.organization_members') is not null as organization_members_ok,
  to_regclass('public.linkare_app_state') is not null as app_state_ok,
  to_regclass('public.linkare_platform_billing_settings') is not null as billing_ok,
  to_regclass('public.linkare_subscription_invoices') is not null as invoices_ok,
  to_regprocedure('public.linkare_bootstrap_organization(text,text)') is not null as bootstrap_ok;
