-- Linkare v1.5: Wompi API integration fields
alter table if exists public.clinic_payments
  add column if not exists payment_link_id text,
  add column if not exists payment_url text,
  add column if not exists qr_url text,
  add column if not exists external_transaction_id text,
  add column if not exists is_test boolean not null default true,
  add column if not exists provider_payload jsonb not null default '{}'::jsonb,
  add column if not exists paid_at timestamptz;

create unique index if not exists clinic_payments_external_reference_uidx
  on public.clinic_payments (external_reference)
  where external_reference is not null;

create index if not exists clinic_payments_status_idx
  on public.clinic_payments (status, created_at desc);

create index if not exists clinic_payments_patient_idx
  on public.clinic_payments (patient_id, created_at desc);
