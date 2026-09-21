begin;

alter table public.calendar_feed_tokens add column if not exists scope text not null default 'staff_busy';
alter table public.calendar_feed_tokens add column if not exists patient_id text;
alter table public.calendar_feed_tokens add column if not exists label text;
alter table public.calendar_feed_tokens add column if not exists expires_at timestamptz;
alter table public.calendar_feed_tokens add column if not exists revoked_at timestamptz;
alter table public.calendar_feed_tokens add column if not exists rotated_from uuid references public.calendar_feed_tokens(id) on delete set null;
update public.calendar_feed_tokens set expires_at=coalesce(expires_at,created_at+interval '90 days');
alter table public.calendar_feed_tokens alter column expires_at set default now()+interval '90 days';
alter table public.calendar_feed_tokens drop constraint if exists calendar_feed_tokens_scope_check;
alter table public.calendar_feed_tokens add constraint calendar_feed_tokens_scope_check check(scope in('doctor_full','staff_busy','family_busy','patient_own'));
alter table public.calendar_feed_tokens drop constraint if exists calendar_feed_tokens_patient_scope_check;
alter table public.calendar_feed_tokens add constraint calendar_feed_tokens_patient_scope_check check((scope='patient_own')=(patient_id is not null));
create index if not exists calendar_feed_active_scope_v1 on public.calendar_feed_tokens(organization_id,created_by,scope,patient_id) where active;

create table if not exists public.linkare_personal_reminder_recipients_v1(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null check(length(name) between 1 and 120),
 destination text not null check(length(destination) between 8 and 180),
 channel text not null check(channel in('whatsapp','email')),
 enabled boolean not null default true,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists personal_reminder_org_v1 on public.linkare_personal_reminder_recipients_v1(organization_id,enabled);
alter table public.linkare_personal_reminder_recipients_v1 enable row level security;
revoke all on public.linkare_personal_reminder_recipients_v1 from public,anon,authenticated;
grant all on public.linkare_personal_reminder_recipients_v1 to service_role;

notify pgrst,'reload schema';
commit;
