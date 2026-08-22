-- LINKARE PRODUCTION SETUP - FRESH SUPABASE PROJECT ONLY
-- Generated for Linkare v1.7.0
-- Do not run seed.sql in production.

-- NexaMind Clinical
-- Core PostgreSQL schema for Supabase.
-- Clinical rules are configurable and require validation by the responsible psychiatrist.

create extension if not exists pgcrypto;

create type public.member_role as enum ('owner','psychiatrist','secretary','clinical_assistant','read_only');
create type public.patient_status as enum ('active','inactive','discharged');
create type public.medication_status as enum ('active','held','stopped','completed');
create type public.appointment_status as enum ('pending','confirmed','completed','cancelled','no_show');
create type public.alert_severity as enum ('low','medium','high','critical');
create type public.alert_status as enum ('open','acknowledged','snoozed','resolved','dismissed');
create type public.adverse_severity as enum ('mild','moderate','severe','critical');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/El_Salvador',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
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

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  medical_record_number text,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  sex_at_birth text,
  gender_identity text,
  phone text,
  email text,
  preferred_language text not null default 'es',
  status public.patient_status not null default 'active',
  assigned_clinician_id uuid references auth.users(id),
  risk_level text not null default 'low' check (risk_level in ('low','medium','high')),
  emergency_contact jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, medical_record_number)
);

create table public.patient_diagnoses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  code_system text not null default 'ICD-10',
  diagnosis_code text,
  diagnosis_name text not null,
  primary_diagnosis boolean not null default false,
  status text not null default 'active',
  diagnosed_at date,
  resolved_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.medication_catalog (
  id uuid primary key default gen_random_uuid(),
  generic_name text not null,
  brand_names text[] not null default '{}',
  medication_class text,
  atc_code text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  unique (generic_name)
);

create table public.patient_medications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  medication_id uuid references public.medication_catalog(id),
  display_name text not null,
  indication text,
  status public.medication_status not null default 'active',
  dose_value numeric,
  dose_unit text,
  frequency text,
  route text default 'oral',
  formulation text,
  is_prn boolean not null default false,
  start_date date not null,
  end_date date,
  prescribed_by uuid references auth.users(id),
  reason_started text,
  reason_stopped text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.medication_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  patient_medication_id uuid not null references public.patient_medications(id) on delete cascade,
  event_type text not null check (event_type in ('started','dose_increased','dose_decreased','held','restarted','stopped','missed_dose','other')),
  event_at timestamptz not null,
  previous_dose numeric,
  new_dose numeric,
  dose_unit text,
  reason text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.scale_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  domain text,
  minimum_score numeric,
  maximum_score numeric,
  direction text not null default 'lower' check (direction in ('lower','higher')),
  response_threshold_percent numeric,
  remission_threshold numeric,
  license_notes text,
  version text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

create table public.patient_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  scale_id uuid not null references public.scale_definitions(id),
  performed_at timestamptz not null,
  total_score numeric not null,
  severity_band text,
  source text not null default 'clinician',
  answers jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.vital_signs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  measured_at timestamptz not null,
  weight_kg numeric,
  height_cm numeric,
  bmi numeric,
  waist_cm numeric,
  systolic_bp integer,
  diastolic_bp integer,
  standing_systolic_bp integer,
  standing_diastolic_bp integer,
  heart_rate integer,
  temperature_c numeric,
  spo2 numeric,
  source text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.lab_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  test_code text,
  test_name text not null,
  value_numeric numeric,
  value_text text,
  unit text,
  reference_low numeric,
  reference_high numeric,
  flag text check (flag in ('normal','low','high','critical_low','critical_high','abnormal') or flag is null),
  collected_at timestamptz not null,
  resulted_at timestamptz,
  laboratory text,
  source text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.adverse_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  patient_medication_id uuid references public.patient_medications(id) on delete set null,
  event_name text not null,
  onset_at timestamptz not null,
  resolved_at timestamptz,
  severity public.adverse_severity not null,
  status text not null default 'active' check (status in ('active','resolved','unknown')),
  description text,
  temporal_relationship text,
  dechallenge_result text,
  rechallenge_result text,
  action_taken text,
  outcome text,
  clinician_assessment text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinical_context_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  event_type text not null,
  event_at timestamptz not null,
  description text not null,
  impact_domain text,
  impact_direction text check (impact_direction in ('favorable','unfavorable','mixed','unknown') or impact_direction is null),
  severity text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  clinician_id uuid references auth.users(id),
  title text not null,
  appointment_type text not null default 'Seguimiento',
  modality text not null default 'Presencial',
  status public.appointment_status not null default 'pending',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  notes text,
  google_event_id text,
  external_calendar_provider text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.monitoring_protocols (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  version text not null,
  source_reference text,
  effective_from date,
  effective_to date,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

create table public.monitoring_rules (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references public.monitoring_protocols(id) on delete cascade,
  parameter_type text not null,
  parameter_code text not null,
  trigger_event text not null,
  interval_days integer,
  grace_period_days integer not null default 0,
  severity_if_overdue public.alert_severity not null default 'medium',
  conditions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  unique (protocol_id, parameter_type, parameter_code, trigger_event)
);

create table public.patient_monitoring_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  patient_medication_id uuid references public.patient_medications(id) on delete cascade,
  protocol_id uuid references public.monitoring_protocols(id),
  rule_id uuid references public.monitoring_rules(id),
  title text not null,
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','completed','dismissed','overdue')),
  completed_at timestamptz,
  result_reference_type text,
  result_reference_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinical_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  severity public.alert_severity not null,
  category text not null,
  title text not null,
  description text not null,
  trigger_source text,
  trigger_id uuid,
  rule_code text,
  rule_version text,
  status public.alert_status not null default 'open',
  generated_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  resolution_notes text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index patients_org_idx on public.patients (organization_id, status);
create index diagnoses_patient_idx on public.patient_diagnoses (patient_id, primary_diagnosis desc);
create index patient_medications_patient_idx on public.patient_medications (patient_id, status);
create index medication_events_patient_date_idx on public.medication_events (patient_id, event_at desc);
create index assessments_patient_scale_date_idx on public.patient_assessments (patient_id, scale_id, performed_at desc);
create index vitals_patient_date_idx on public.vital_signs (patient_id, measured_at desc);
create index labs_patient_date_idx on public.lab_results (patient_id, collected_at desc);
create index adverse_patient_status_idx on public.adverse_events (patient_id, status);
create index appointments_org_start_idx on public.appointments (organization_id, starts_at);
create index alerts_org_status_idx on public.clinical_alerts (organization_id, status, severity);
create index monitoring_tasks_due_idx on public.patient_monitoring_tasks (organization_id, status, due_at);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger organizations_updated before update on public.organizations for each row execute function public.set_updated_at();
create trigger patients_updated before update on public.patients for each row execute function public.set_updated_at();
create trigger diagnoses_updated before update on public.patient_diagnoses for each row execute function public.set_updated_at();
create trigger patient_medications_updated before update on public.patient_medications for each row execute function public.set_updated_at();
create trigger adverse_events_updated before update on public.adverse_events for each row execute function public.set_updated_at();
create trigger appointments_updated before update on public.appointments for each row execute function public.set_updated_at();
create trigger monitoring_tasks_updated before update on public.patient_monitoring_tasks for each row execute function public.set_updated_at();
create trigger clinical_alerts_updated before update on public.clinical_alerts for each row execute function public.set_updated_at();

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

revoke all on function public.has_org_access(uuid) from public;
grant execute on function public.has_org_access(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.patients enable row level security;
alter table public.patient_diagnoses enable row level security;
alter table public.patient_medications enable row level security;
alter table public.medication_events enable row level security;
alter table public.patient_assessments enable row level security;
alter table public.vital_signs enable row level security;
alter table public.lab_results enable row level security;
alter table public.adverse_events enable row level security;
alter table public.clinical_context_events enable row level security;
alter table public.appointments enable row level security;
alter table public.patient_monitoring_tasks enable row level security;
alter table public.clinical_alerts enable row level security;
alter table public.audit_events enable row level security;

create policy organizations_select on public.organizations for select to authenticated using (public.has_org_access(id));
create policy members_select on public.organization_members for select to authenticated using (user_id = auth.uid() or public.has_org_access(organization_id));
create policy members_manage on public.organization_members for all to authenticated using (public.has_org_access(organization_id)) with check (public.has_org_access(organization_id));

create policy patients_access on public.patients for all to authenticated using (public.has_org_access(organization_id)) with check (public.has_org_access(organization_id));
create policy diagnoses_access on public.patient_diagnoses for all to authenticated using (public.has_org_access(organization_id)) with check (public.has_org_access(organization_id));
create policy patient_medications_access on public.patient_medications for all to authenticated using (public.has_org_access(organization_id)) with check (public.has_org_access(organization_id));
create policy medication_events_access on public.medication_events for all to authenticated using (public.has_org_access(organization_id)) with check (public.has_org_access(organization_id));
create policy assessments_access on public.patient_assessments for all to authenticated using (public.has_org_access(organization_id)) with check (public.has_org_access(organization_id));
create policy vitals_access on public.vital_signs for all to authenticated using (public.has_org_access(organization_id)) with check (public.has_org_access(organization_id));
create policy labs_access on public.lab_results for all to authenticated using (public.has_org_access(organization_id)) with check (public.has_org_access(organization_id));
create policy adverse_access on public.adverse_events for all to authenticated using (public.has_org_access(organization_id)) with check (public.has_org_access(organization_id));
create policy context_access on public.clinical_context_events for all to authenticated using (public.has_org_access(organization_id)) with check (public.has_org_access(organization_id));
create policy appointments_access on public.appointments for all to authenticated using (public.has_org_access(organization_id)) with check (public.has_org_access(organization_id));
create policy monitoring_tasks_access on public.patient_monitoring_tasks for all to authenticated using (public.has_org_access(organization_id)) with check (public.has_org_access(organization_id));
create policy alerts_access on public.clinical_alerts for all to authenticated using (public.has_org_access(organization_id)) with check (public.has_org_access(organization_id));
create policy audit_select on public.audit_events for select to authenticated using (public.has_org_access(organization_id));
create policy audit_insert on public.audit_events for insert to authenticated with check (public.has_org_access(organization_id));

-- Public catalogs are read-only to authenticated users.
alter table public.medication_catalog enable row level security;
alter table public.scale_definitions enable row level security;
alter table public.monitoring_protocols enable row level security;
alter table public.monitoring_rules enable row level security;
create policy medication_catalog_read on public.medication_catalog for select to authenticated using (true);
create policy scale_definitions_read on public.scale_definitions for select to authenticated using (true);
create policy protocols_read on public.monitoring_protocols for select to authenticated using (true);
create policy rules_read on public.monitoring_rules for select to authenticated using (true);

-- Latest assessment and computed change. Thresholds remain scale-specific and configurable.
create or replace view public.patient_latest_assessment_v
with (security_invoker = true)
as
select
  p.organization_id,
  p.id as patient_id,
  sd.code as scale_code,
  sd.name as scale_name,
  sd.direction,
  first_value(pa.total_score) over w_asc as baseline_score,
  first_value(pa.total_score) over w_desc as current_score,
  first_value(pa.performed_at) over w_desc as current_performed_at,
  case
    when first_value(pa.total_score) over w_asc = 0 then null
    when sd.direction = 'lower' then
      ((first_value(pa.total_score) over w_asc - first_value(pa.total_score) over w_desc)
        / abs(first_value(pa.total_score) over w_asc)) * 100
    else
      ((first_value(pa.total_score) over w_desc - first_value(pa.total_score) over w_asc)
        / abs(first_value(pa.total_score) over w_asc)) * 100
  end as improvement_percent,
  row_number() over (partition by p.id, sd.id order by pa.performed_at desc) as latest_rank
from public.patients p
join public.patient_assessments pa on pa.patient_id = p.id
join public.scale_definitions sd on sd.id = pa.scale_id
window
  w_asc as (partition by p.id, sd.id order by pa.performed_at asc rows between unbounded preceding and unbounded following),
  w_desc as (partition by p.id, sd.id order by pa.performed_at desc rows between unbounded preceding and unbounded following);

create or replace view public.patient_current_medications_v
with (security_invoker = true)
as
select pm.organization_id, pm.patient_id, pm.id as patient_medication_id, pm.display_name,
       pm.dose_value, pm.dose_unit, pm.frequency, pm.start_date,
       (current_date - pm.start_date) as exposure_days, pm.indication
from public.patient_medications pm
where pm.status = 'active';

create or replace view public.upcoming_appointments_v
with (security_invoker = true)
as
select a.*, concat_ws(' ',p.first_name,p.last_name) as patient_name
from public.appointments a
left join public.patients p on p.id = a.patient_id
where a.starts_at >= now() and a.status not in ('cancelled','completed','no_show');

comment on schema public is 'NexaMind Clinical: tenant-isolated psychiatric treatment monitoring schema.';
comment on table public.clinical_alerts is 'Decision-support signals requiring human review. Alerts must not autonomously change treatment.';
comment on view public.patient_latest_assessment_v is 'Longitudinal score change. Do not interpret as medication causality without clinical context.';

-- =============================================================
-- PRACTICE FEATURES
-- =============================================================
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

-- =============================================================
-- PLATFORM BILLING, REMOTE STATE AND WOMPI
-- =============================================================
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
