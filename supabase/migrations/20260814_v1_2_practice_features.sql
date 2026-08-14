-- NexaMind Clinical 1.2.0
-- Apply AFTER supabase/schema.sql and BEFORE using production data.
-- This migration adds clinic identity, insurance, prescriptions, reminders and secretary permissions.

alter type public.member_role add value if not exists 'secretary';

alter table public.organizations
  add column if not exists clinician_name text,
  add column if not exists specialty text,
  add column if not exists professional_license text,
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists website text,
  add column if not exists clinic_logo_path text,
  add column if not exists doctor_photo_path text,
  add column if not exists prescription_footer text,
  add column if not exists reminder_hours integer[] not null default array[24,8],
  add column if not exists reminder_channels text[] not null default array['whatsapp'];

alter table public.organization_members
  add column if not exists phone text,
  add column if not exists avatar_path text,
  add column if not exists permissions jsonb not null default '{}'::jsonb;

alter table public.patients
  add column if not exists photo_path text,
  add column if not exists insurance jsonb not null default '{"has_insurance":false}'::jsonb;

alter table public.appointments
  add column if not exists reminder_log jsonb not null default '[]'::jsonb;

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  prescription_number text not null,
  issued_at timestamptz not null default now(),
  diagnosis text,
  general_instructions text,
  observations text,
  doctor_name text not null,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, prescription_number)
);

create table if not exists public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  position integer not null default 1,
  medication text not null,
  strength text,
  directions text not null,
  quantity text,
  duration text,
  notes text,
  created_at timestamptz not null default now(),
  unique (prescription_id, position)
);

create table if not exists public.appointment_reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  reminder_hours integer not null check (reminder_hours > 0),
  due_at timestamptz not null,
  channel text not null default 'whatsapp',
  status text not null default 'scheduled' check (status in ('scheduled','due','sent','failed','cancelled')),
  sent_at timestamptz,
  sent_by uuid references auth.users(id) on delete set null,
  provider_message_id text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id, reminder_hours, channel)
);

create index if not exists prescriptions_patient_date_idx
  on public.prescriptions (patient_id, issued_at desc);
create index if not exists reminder_due_status_idx
  on public.appointment_reminders (organization_id, status, due_at);

alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;
alter table public.appointment_reminders enable row level security;

drop policy if exists prescriptions_access on public.prescriptions;
create policy prescriptions_access on public.prescriptions
  for all to authenticated
  using (public.has_org_access(organization_id))
  with check (public.has_org_access(organization_id));

drop policy if exists prescription_items_access on public.prescription_items;
create policy prescription_items_access on public.prescription_items
  for all to authenticated
  using (
    exists (
      select 1 from public.prescriptions p
      where p.id = prescription_id
        and public.has_org_access(p.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.prescriptions p
      where p.id = prescription_id
        and public.has_org_access(p.organization_id)
    )
  );

drop policy if exists appointment_reminders_access on public.appointment_reminders;
create policy appointment_reminders_access on public.appointment_reminders
  for all to authenticated
  using (public.has_org_access(organization_id))
  with check (public.has_org_access(organization_id));

comment on column public.patients.insurance is
  'Administrative insurance information. Store only what is necessary for clinic operations.';
comment on table public.prescriptions is
  'Clinician-authored prescriptions requiring review, signature and applicable legal controls.';
comment on table public.appointment_reminders is
  'Reminder queue. Sending requires a separately approved provider integration.';
