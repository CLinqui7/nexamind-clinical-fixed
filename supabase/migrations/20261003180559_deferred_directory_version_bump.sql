begin;

-- Projection refreshes can touch many records inside one transaction. Updating
-- the organization-wide cursor version synchronously makes every independent
-- patient save wait on the same row until that transaction ends. Queue one bump
-- per transaction and apply it immediately before commit instead.
create table linkare_private.patient_directory_version_queue_v2 (
 organization_id uuid not null references public.organizations(id),
 transaction_id bigint not null check(transaction_id>0),
 requested_at timestamptz not null default clock_timestamp(),
 primary key(organization_id,transaction_id)
);

alter table linkare_private.patient_directory_version_queue_v2 enable row level security;
revoke all on linkare_private.patient_directory_version_queue_v2 from public,anon,authenticated;
grant all on linkare_private.patient_directory_version_queue_v2 to service_role;

create function linkare_private.apply_directory_version_queue_v2()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into linkare_private.patient_directory_state_v1(organization_id,listing_version,updated_at)
 values(new.organization_id,1,clock_timestamp())
 on conflict(organization_id) do update set
  listing_version=linkare_private.patient_directory_state_v1.listing_version+1,
  updated_at=excluded.updated_at;
 delete from linkare_private.patient_directory_version_queue_v2
 where organization_id=new.organization_id and transaction_id=new.transaction_id;
 return null;
end $$;

create constraint trigger patient_directory_version_commit_v2
after insert on linkare_private.patient_directory_version_queue_v2
deferrable initially deferred
for each row execute function linkare_private.apply_directory_version_queue_v2();

create or replace function linkare_private.bump_directory_version_v1(org uuid)
returns void language sql volatile set search_path='' as $$
 insert into linkare_private.patient_directory_version_queue_v2(organization_id,transaction_id)
 values(org,txid_current())
 on conflict(organization_id,transaction_id) do nothing
$$;

revoke all on function linkare_private.apply_directory_version_queue_v2(),
 linkare_private.bump_directory_version_v1(uuid) from public,anon,authenticated;

commit;
