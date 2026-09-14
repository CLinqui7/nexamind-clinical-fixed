-- Apply only when setting up an EMPTY Supabase project; no clinical seed.
begin;
create extension if not exists pgcrypto;
do $$ begin
 if not exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='member_role') then
  create type public.member_role as enum ('owner','psychiatrist','secretary','clinical_assistant','read_only');
 end if;
end $$;
create table if not exists public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
 timezone text not null default 'America/El_Salvador', is_demo boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.organization_members (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 user_id uuid not null references auth.users(id),role public.member_role not null default 'read_only',
 display_name text,professional_title text,active boolean not null default true,created_at timestamptz not null default now(),
 unique(organization_id,user_id)
);
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
revoke all on public.organizations,public.organization_members from anon,authenticated;
grant all on public.organizations,public.organization_members to service_role;
commit;
