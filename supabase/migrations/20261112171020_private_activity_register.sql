begin;

create table linkare_private.activity_report_state_v1 (
  singleton boolean primary key default true check (singleton),
  viewer_id uuid not null references auth.users(id) on delete cascade,
  checked_at timestamptz,
  check_source text check (check_source in ('nightly', 'manual')),
  published_count integer not null default 0
);

create table linkare_private.activity_event_v1 (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  actor_id uuid not null,
  actor_name text not null,
  actor_role text not null,
  clinic_name text not null,
  action text not null check (action in ('access', 'agenda_open', 'agenda_download', 'agenda_print')),
  agenda_date date,
  occurred_at timestamptz not null default clock_timestamp(),
  published_at timestamptz,
  unique (actor_id, request_id),
  check ((action = 'access') = (agenda_date is null))
);
create index activity_event_pending_v1 on linkare_private.activity_event_v1 (id) where published_at is null;
create index activity_event_published_action_v1 on linkare_private.activity_event_v1 (action, id desc) where published_at is not null;
alter table linkare_private.activity_report_state_v1 enable row level security;
alter table linkare_private.activity_event_v1 enable row level security;
revoke all on linkare_private.activity_report_state_v1, linkare_private.activity_event_v1 from public, anon, authenticated;

-- Keep the dedicated Auth identity out of clinical memberships, including
-- invitation acceptance and automatic clinic creation.
create function linkare_private.reject_activity_viewer_membership_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from auth.users
    where id = new.user_id and raw_app_meta_data @> '{"linkare_activity_viewer":true}'
  ) or exists (
    select 1 from linkare_private.activity_report_state_v1 where viewer_id = new.user_id
  ) then
    raise exception 'ACTIVITY_VIEWER_ONLY' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger reject_activity_viewer_membership_v1
before insert or update of user_id on public.organization_members
for each row execute function linkare_private.reject_activity_viewer_membership_v1();
revoke all on function linkare_private.reject_activity_viewer_membership_v1() from public, anon, authenticated;

create function public.linkare_record_activity_v1(
  org uuid, p_request_id uuid, p_action text, p_agenda_date date default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  staff_name text;
  staff_role text;
  clinic text;
begin
  if p_request_id is null or p_action is null
    or p_action not in ('access', 'agenda_open', 'agenda_download', 'agenda_print')
    or (p_action = 'access') <> (p_agenda_date is null) then
    raise exception 'INVALID_ACTIVITY' using errcode = '22023';
  end if;

  select coalesce(nullif(trim(m.display_name), ''), m.role::text), m.role::text, o.name
    into staff_name, staff_role, clinic
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = actor and m.organization_id = org and m.active and not o.is_demo;
  if not found then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  if p_action <> 'access' and (
    not public.linkare_permission_v3(org, 'agendaSheetView')
    or not exists (
      select 1 from public.linkare_calendars_v1 c
      where c.organization_id = org and c.code = 'doctor' and c.is_active
        and public.linkare_calendar_permission_v1(org, c.id, 'View')
    )
  ) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  insert into linkare_private.activity_event_v1 (
    request_id, actor_id, actor_name, actor_role, clinic_name, action, agenda_date
  ) values (p_request_id, actor, staff_name, staff_role, clinic, p_action, p_agenda_date)
  on conflict (actor_id, request_id) do nothing;
  return true;
end;
$$;
revoke all on function public.linkare_record_activity_v1(uuid, uuid, text, date) from public, anon;
grant execute on function public.linkare_record_activity_v1(uuid, uuid, text, date) to authenticated;

-- Serialize only the daily and manual publication of pending events.
-- A late insert remains pending until the next publication.
create function linkare_private.publish_activity_v1(p_source text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  checked timestamptz;
  published integer;
begin
  perform 1 from linkare_private.activity_report_state_v1 where singleton for update;
  if not found then return; end if;

  checked := clock_timestamp();
  update linkare_private.activity_event_v1
    set published_at = checked where published_at is null;
  get diagnostics published = row_count;

  update linkare_private.activity_report_state_v1
  set checked_at = checked, check_source = p_source, published_count = published
  where singleton;
end;
$$;
revoke all on function linkare_private.publish_activity_v1(text) from public, anon, authenticated;

create function public.linkare_activity_report_v1(
  p_refresh boolean default false,
  p_before bigint default null,
  p_action text default null,
  p_as_of timestamptz default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  state linkare_private.activity_report_state_v1%rowtype;
  cutoff timestamptz;
  page jsonb;
  next_id text;
begin
  select * into state from linkare_private.activity_report_state_v1
  where singleton and viewer_id = auth.uid();
  if not found then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  if p_refresh then
    perform linkare_private.publish_activity_v1('manual');
    select * into state from linkare_private.activity_report_state_v1 where singleton;
  end if;
  cutoff := least(p_as_of, state.checked_at);

  with candidates as materialized (
    select id, actor_name, actor_role, clinic_name, action, agenda_date, occurred_at
    from linkare_private.activity_event_v1
    where published_at is not null and published_at <= cutoff
      and (p_before is null or id < p_before)
      and (p_action is null or action = p_action)
    order by id desc
    limit 51
  ), visible as (
    select * from candidates order by id desc limit 50
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id::text, 'actor', actor_name, 'role', actor_role, 'clinic', clinic_name,
    'action', action, 'agendaDate', agenda_date, 'at', occurred_at
  ) order by id desc), '[]'::jsonb),
  case when (select count(*) from candidates) > 50 then min(id)::text end
  into page, next_id from visible;

  return jsonb_build_object(
    'checkedAt', state.checked_at, 'checkSource', state.check_source,
    'publishedCount', state.published_count, 'asOf', cutoff, 'rows', page, 'next', next_id
  );
end;
$$;
revoke all on function public.linkare_activity_report_v1(boolean, bigint, text, timestamptz) from public, anon;
grant execute on function public.linkare_activity_report_v1(boolean, bigint, text, timestamptz) to authenticated;

-- pg_cron is present on hosted Supabase; the isolated browser DB has no worker.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    if current_setting('cron.timezone', true) not in ('GMT', 'UTC', 'Etc/UTC') then
      raise exception 'Activity scheduling requires the existing UTC cron timezone';
    end if;
    perform cron.schedule(
      'linkare-activity-nightly-v1',
      '0 4 * * *',
      $job$select linkare_private.publish_activity_v1('nightly');$job$
    );
  end if;
end;
$$;

commit;
