begin;

create table if not exists public.legacy_identifiers(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 source_system text not null,
 entity_type text not null,
 legacy_id text not null,
 new_id text not null,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 unique(organization_id,source_system,entity_type,legacy_id),
 unique(organization_id,entity_type,new_id)
);
alter table public.legacy_identifiers enable row level security;
revoke all on public.legacy_identifiers from public,anon,authenticated;
grant all on public.legacy_identifiers to service_role;

create table if not exists linkare_private.legacy_staging_v1(
 id uuid primary key default gen_random_uuid(),
 batch_id uuid not null,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 source_system text not null,
 entity_type text not null,
 legacy_id text not null,
 raw_payload jsonb not null,
 clean_payload jsonb,
 validation_status text not null check(validation_status in('valid','invalid','duplicate','error')),
 validation_errors jsonb not null default '[]',
 imported_at timestamptz,
 created_at timestamptz not null default now(),
 unique(batch_id,entity_type,legacy_id)
);
revoke all on linkare_private.legacy_staging_v1 from public,anon,authenticated;
grant all on linkare_private.legacy_staging_v1 to service_role;

notify pgrst,'reload schema';
commit;
