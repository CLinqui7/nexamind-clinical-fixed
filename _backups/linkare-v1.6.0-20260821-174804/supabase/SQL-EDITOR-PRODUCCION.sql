-- Linkare v1.6.0
-- Billing from the psychiatrist/clinic to the Linkare platform owner.
-- This migration does NOT insert demo patients or clinical data.

create extension if not exists pgcrypto;

create table if not exists public.linkare_billing_accounts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  clinic_name text not null,
  billing_email text,
  plan_name text not null default 'Plan Profesional',
  price numeric(10,2) not null default 49.00 check (price >= 0.01),
  currency text not null default 'USD',
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly','quarterly','annual','one_time')),
  active boolean not null default true,
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.linkare_billing_invoices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.linkare_billing_accounts(id) on delete cascade,
  payment_token uuid not null default gen_random_uuid() unique,
  period_label text not null default 'Suscripción Linkare',
  amount numeric(10,2) not null check (amount >= 0.01),
  currency text not null default 'USD',
  due_date date,
  status text not null default 'pending' check (status in ('draft','pending','paid','cancelled','overdue')),
  external_reference text unique,
  payment_link_id text,
  payment_url text,
  qr_url text,
  external_transaction_id text,
  is_test boolean,
  provider_payload jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists linkare_billing_invoices_account_idx
  on public.linkare_billing_invoices(account_id, created_at desc);
create index if not exists linkare_billing_invoices_status_idx
  on public.linkare_billing_invoices(status);

alter table public.linkare_billing_accounts enable row level security;
alter table public.linkare_billing_invoices enable row level security;

-- No direct anon/authenticated policies are created.
-- Billing data is accessed only through Edge Functions using the secret key.

insert into public.linkare_billing_accounts (
  id, slug, clinic_name, billing_email, plan_name, price, currency, billing_cycle, active, is_demo
)
values (
  '00000000-0000-0000-0000-000000000160'::uuid,
  'consultorio-demo',
  'Consultorio Dra. Adriana Salazar',
  'doctora@nexamind.demo',
  'Plan Profesional Linkare',
  49.00,
  'USD',
  'monthly',
  true,
  true
)
on conflict (slug) do nothing;

insert into public.linkare_billing_invoices (
  account_id, period_label, amount, currency, due_date, status
)
select
  id,
  'Suscripción mensual Linkare',
  price,
  currency,
  (current_date + interval '7 days')::date,
  'pending'
from public.linkare_billing_accounts a
where a.slug = 'consultorio-demo'
  and not exists (
    select 1
    from public.linkare_billing_invoices i
    where i.account_id = a.id and i.status in ('draft','pending','overdue')
  );
