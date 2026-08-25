-- Linkare v2.0
-- Plan anual, documentos privados, calendarios, recordatorios y soporte de libreta clínica.
-- Ejecutar después del esquema y migraciones anteriores.

create extension if not exists pgcrypto;

-- 1. Suscripción anual -------------------------------------------------------
alter table public.linkare_platform_billing_settings
  add column if not exists plan_tier text not null default 'professional',
  add column if not exists subscription_status text not null default 'inactive',
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists next_renewal_at timestamptz,
  add column if not exists grace_until timestamptz,
  add column if not exists auto_renew boolean not null default false;

alter table public.linkare_subscription_invoices
  add column if not exists period_start timestamptz,
  add column if not exists period_end timestamptz,
  add column if not exists next_renewal_at timestamptz,
  add column if not exists plan_tier text not null default 'professional',
  add column if not exists receipt_url text;

alter table public.linkare_platform_billing_settings
  alter column subscription_price set default 400,
  alter column billing_cycle set default 'anual',
  alter column plan_description set default 'Licencia anual de la plataforma Linkare para gestión clínica.';

update public.linkare_platform_billing_settings
set subscription_price = 400,
    billing_cycle = 'anual',
    plan_description = 'Licencia anual de la plataforma Linkare para gestión clínica.',
    plan_tier = coalesce(nullif(plan_tier, ''), 'professional'),
    updated_at = now()
where subscription_price = 40
   or billing_cycle = 'mensual'
   or plan_description ilike '%mensual%';

-- 2. Auditoría de documentos -------------------------------------------------
create table if not exists public.patient_document_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id text not null,
  document_id text not null,
  action text not null check (action in ('upload','open','download','delete')),
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists patient_document_audit_org_patient_idx
  on public.patient_document_audit (organization_id, patient_id, created_at desc);

alter table public.patient_document_audit enable row level security;
drop policy if exists patient_document_audit_select on public.patient_document_audit;
create policy patient_document_audit_select on public.patient_document_audit
for select to authenticated
using (public.has_org_role(organization_id, array['owner','psychiatrist']::public.member_role[]));

drop policy if exists patient_document_audit_insert on public.patient_document_audit;
create policy patient_document_audit_insert on public.patient_document_audit
for insert to authenticated
with check (
  public.has_org_role(organization_id, array['owner','psychiatrist']::public.member_role[])
  and (actor_id is null or actor_id = auth.uid())
);

-- Bucket privado. El primer segmento del path es organization_id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-documents',
  'patient-documents',
  false,
  20971520,
  array[
    'application/pdf','image/jpeg','image/png','image/webp','text/plain','text/csv',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists patient_documents_select on storage.objects;
create policy patient_documents_select on storage.objects
for select to authenticated
using (
  bucket_id = 'patient-documents'
  and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner','psychiatrist']::public.member_role[])
);

drop policy if exists patient_documents_insert on storage.objects;
create policy patient_documents_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'patient-documents'
  and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner','psychiatrist']::public.member_role[])
);

drop policy if exists patient_documents_update on storage.objects;
create policy patient_documents_update on storage.objects
for update to authenticated
using (
  bucket_id = 'patient-documents'
  and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner','psychiatrist']::public.member_role[])
)
with check (
  bucket_id = 'patient-documents'
  and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner','psychiatrist']::public.member_role[])
);

drop policy if exists patient_documents_delete on storage.objects;
create policy patient_documents_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'patient-documents'
  and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner','psychiatrist']::public.member_role[])
);

-- 3. Recordatorios multicanal ------------------------------------------------
create table if not exists public.linkare_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id text,
  appointment_id text,
  channel text not null check (channel in ('email','sms','whatsapp')),
  destination text,
  status text not null default 'queued' check (status in ('queued','sent','delivered','read','failed','cancelled')),
  provider text,
  provider_message_id text,
  message_preview text,
  error_message text,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists linkare_notification_org_idx
  on public.linkare_notification_deliveries (organization_id, created_at desc);

alter table public.linkare_notification_deliveries enable row level security;
drop policy if exists linkare_notification_select on public.linkare_notification_deliveries;
create policy linkare_notification_select on public.linkare_notification_deliveries
for select to authenticated
using (public.has_org_access(organization_id));

-- 4. Google Calendar y feed privado para Apple -------------------------------
create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google')),
  provider_account_email text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  calendar_id text default 'primary',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, provider)
);

create table if not exists public.calendar_oauth_states (
  state text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_feed_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.calendar_connections enable row level security;
alter table public.calendar_feed_tokens enable row level security;
alter table public.calendar_oauth_states enable row level security;

drop policy if exists calendar_connections_select on public.calendar_connections;
drop policy if exists calendar_feed_tokens_select on public.calendar_feed_tokens;

-- Tokens de OAuth y feeds se consultan únicamente mediante Edge Functions con service-role.
-- No se crean políticas directas de lectura/escritura para clientes autenticados.

-- 5. Valores iniciales -------------------------------------------------------
update public.linkare_platform_billing_settings
set next_renewal_at = coalesce(next_renewal_at, current_period_end),
    grace_until = coalesce(grace_until, current_period_end + interval '7 days')
where current_period_end is not null;

select
  to_regclass('public.linkare_platform_billing_settings') is not null as billing_ok,
  to_regclass('public.patient_document_audit') is not null as documents_ok,
  to_regclass('public.linkare_notification_deliveries') is not null as reminders_ok,
  to_regclass('public.calendar_connections') is not null as google_calendar_ok,
  to_regclass('public.calendar_feed_tokens') is not null as apple_calendar_ok;
