create table if not exists public.clinic_payment_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  currency text not null default 'USD',
  consultation_fee numeric(10,2) not null default 45,
  followup_fee numeric(10,2) not null default 35,
  wompi_enabled boolean not null default false,
  wompi_public_key text,
  wompi_checkout_url text,
  wompi_redirect_url text,
  transfer_enabled boolean not null default true,
  transfer_instructions text,
  cash_enabled boolean not null default true,
  insurance_enabled boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.clinic_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  patient_id uuid,
  appointment_id uuid,
  description text not null,
  amount numeric(10,2) not null default 0,
  currency text not null default 'USD',
  method text not null default 'manual',
  status text not null default 'pending' check (status in ('pending','paid','cancelled','failed')),
  provider text,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.clinic_payment_settings enable row level security;
alter table public.clinic_payments enable row level security;
