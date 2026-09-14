-- Linkare 3.0.0. Additive migration. Does not delete clinical data or auth.users.
-- Run in a backed-up project. Legacy JSON is archived, never exposed by the new API.
begin;
create extension if not exists pgcrypto;
create schema if not exists linkare_private;
revoke all on schema linkare_private from public, anon, authenticated;

do $$ begin
 if to_regclass('public.organizations') is null or to_regclass('public.organization_members') is null then
  raise exception 'Missing organizations/organization_members. Apply the supplied 00_BASE.sql first on a NEW database only.';
 end if;
end $$;

alter table public.organization_members add column if not exists permissions jsonb not null default '{"patientsView":true,"patientsCreate":true,"patientsEdit":true,"appointmentsManage":true,"remindersManage":true}'::jsonb;
alter table public.organization_members add column if not exists professional_title text;
alter table public.organization_members add column if not exists phone text;

create table if not exists public.linkare_records (
 organization_id uuid not null references public.organizations(id),
 kind text not null check(kind in ('profile','settings','patient_admin','patient_clinical','appointment','appointment_clinical','alert')),
 id text not null check(length(id) between 1 and 160),
 payload jsonb not null default '{}' check(jsonb_typeof(payload)='object'),
 revision bigint not null default 1,
 deleted boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 primary key(organization_id,kind,id)
);
create index if not exists linkare_records_live_idx on public.linkare_records(organization_id,kind,updated_at) where not deleted;
create table if not exists public.linkare_audit_v3 (
 id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id),
 actor_id uuid references auth.users(id), action text not null, kind text, record_id text, revision bigint,
 fingerprint text, created_at timestamptz not null default now()
);
create table if not exists public.linkare_invites_v3 (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 email text not null check(email=lower(trim(email))), display_name text not null,
 permissions jsonb not null default '{"patientsView":true,"patientsCreate":true,"patientsEdit":true,"appointmentsManage":true,"remindersManage":true}',
 status text not null default 'pending' check(status in ('pending','accepted','revoked')),
 delivery_status text not null default 'pending', invited_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '7 days',
 accepted_at timestamptz, user_id uuid references auth.users(id)
);
create unique index if not exists linkare_invite_pending_email on public.linkare_invites_v3(email) where status='pending';
create table if not exists public.linkare_plans_v3 (
 code text primary key, name text not null, amount_cents integer not null check(amount_cents>0),
 months integer not null check(months in (1,6,12)), currency text not null default 'USD' check(currency='USD'), active boolean not null default true
);
insert into public.linkare_plans_v3(code,name,amount_cents,months) values
 ('monthly','Profesional mensual',4000,1),('semiannual','Profesional semestral',22000,6),('annual','Profesional anual',40000,12)
 on conflict(code) do update set name=excluded.name,amount_cents=excluded.amount_cents,months=excluded.months;
create table if not exists public.linkare_orders_v3 (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 payer_user_id uuid not null references auth.users(id),plan_code text not null references public.linkare_plans_v3(code),
 plan_name text not null,amount_cents integer not null check(amount_cents>0), months integer not null check(months in(1,6,12)),currency text not null default 'USD',
 status text not null default 'creating' check(status in ('creating','pending','paid','failed','review','cancelled')),
 external_reference text not null unique,payment_link_id text,payment_url text,qr_url text,
 is_test boolean not null default true,transaction_id text unique,paid_at timestamptz,period_start timestamptz,period_end timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists linkare_orders_org_idx on public.linkare_orders_v3(organization_id,created_at desc);
create table if not exists public.linkare_subscriptions_v3 (
 organization_id uuid primary key references public.organizations(id),plan_code text references public.linkare_plans_v3(code),
 current_period_start timestamptz,current_period_end timestamptz,last_order_id uuid references public.linkare_orders_v3(id),updated_at timestamptz not null default now()
);
create table if not exists linkare_private.legacy_archive (
 organization_id uuid primary key,payload jsonb not null,archived_at timestamptz not null default now(),imported_at timestamptz,
 fingerprint text not null
);
create table if not exists linkare_private.rate_limits (
 scope text not null,actor text not null,bucket timestamptz not null,hits integer not null default 1,primary key(scope,actor,bucket)
);

create or replace function public.linkare_role_v3(org uuid) returns text language sql stable security definer set search_path='' as $$
 select role::text from public.organization_members where organization_id=org and user_id=(select auth.uid()) and active=true limit 1
$$;
create or replace function public.linkare_doctor_v3(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.linkare_role_v3(org) in ('owner','psychiatrist','doctor'),false)
$$;
create or replace function public.linkare_permission_v3(org uuid,p text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select case when m.role::text in('owner','psychiatrist','doctor') then true
 when m.role::text='secretary' and p=any(array['patientsView','patientsCreate','patientsEdit','appointmentsManage','remindersManage'])
 then coalesce((m.permissions->>p)::boolean,false) else false end
 from public.organization_members m where m.organization_id=org and m.user_id=(select auth.uid()) and m.active limit 1),false)
$$;
create or replace function public.linkare_pick_v3(obj jsonb, keys text[]) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(coalesce(obj,'{}')) where key=any(keys)
$$;

-- Do not trust role, membership, billing state, or a password in a saved JSON payload.
create or replace function public.linkare_bootstrap_v3(requested_name text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); o uuid; inv public.linkare_invites_v3; email_value text; meta jsonb; nm text;
begin
 if u is null then raise exception 'LOGIN_REQUIRED' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,301));
 select lower(email), raw_user_meta_data into email_value,meta from auth.users where id=u and email_confirmed_at is not null;
 if email_value is null then raise exception 'EMAIL_NOT_CONFIRMED' using errcode='42501'; end if;
 select organization_id into o from public.organization_members where user_id=u and active order by created_at limit 1;
 if o is not null then return o; end if;
 if exists(select 1 from public.organization_members where user_id=u) then raise exception 'ACCOUNT_DISABLED' using errcode='42501'; end if;
 select * into inv from public.linkare_invites_v3 where email=email_value and status='pending' for update;
 if found then
  if inv.expires_at<now() then raise exception 'INVITATION_EXPIRED'; end if;
  insert into public.organization_members(organization_id,user_id,role,display_name,professional_title,permissions,active)
   values(inv.organization_id,u,'secretary',inv.display_name,'Secretaría',inv.permissions,true);
  update public.linkare_invites_v3 set status='accepted',accepted_at=now(),user_id=u where id=inv.id;
  insert into public.linkare_audit_v3(organization_id,actor_id,action) values(inv.organization_id,u,'invitation.accepted');
  return inv.organization_id;
 end if;
 nm:=coalesce(nullif(trim(meta->>'clinic_name'),''),nullif(trim(requested_name),''));
 if nm is null then raise exception 'INVITATION_REQUIRED'; end if;
 if length(nm)>160 then raise exception 'CLINIC_NAME_TOO_LONG'; end if;
 insert into public.organizations(name,slug,is_demo) values(nm,'clinic-'||replace(u::text,'-',''),false) returning id into o;
 insert into public.organization_members(organization_id,user_id,role,display_name,professional_title,active)
  values(o,u,'owner',coalesce(nullif(trim(meta->>'full_name'),''),'Profesional'),'Psiquiatría',true);
 insert into public.linkare_records(organization_id,kind,id,payload,updated_by) values
 (o,'profile','clinic',jsonb_build_object('name',nm,'clinician',coalesce(meta->>'full_name',''),'email',email_value,'specialty','Psiquiatría','clinicLogo','/assets/linkare-logo.jpg'),u),
 (o,'settings','clinic','{"largeText":false,"reducedMotion":false,"reminderHours":[24,8],"reminderChannels":["email"]}',u);
 insert into public.linkare_subscriptions_v3(organization_id) values(o);
 insert into public.linkare_audit_v3(organization_id,actor_id,action) values(o,u,'clinic.created');
 return o;
end $$;

-- Explicit clinic roles: other historic roles cannot inherit medical or secretary access.
create or replace function public.linkare_entitled_v3(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.linkare_subscriptions_v3 where organization_id=org and current_period_end+interval '7 days'>now())
$$;

create or replace function public.linkare_load_state_v3(org uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare medical boolean:=public.linkare_doctor_v3(org); r text:=public.linkare_role_v3(org); profile jsonb; settings jsonb; users_json jsonb; patients_json jsonb; appointments_json jsonb; alerts_json jsonb; revs jsonb;
begin
 if r is null or r not in ('owner','doctor','psychiatrist','secretary') then raise exception 'ACCESS_DENIED' using errcode='42501'; end if;
 select payload into profile from public.linkare_records where organization_id=org and kind='profile' and id='clinic' and not deleted;
 select payload into settings from public.linkare_records where organization_id=org and kind='settings' and id='clinic' and not deleted;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',m.display_name,'email',u.email,'role',case when m.role::text in('owner','doctor','psychiatrist') then 'doctor' else 'secretary' end,'active',m.active,'title',m.professional_title,'phone',m.phone,'permissions',m.permissions)),'[]') into users_json
 from public.organization_members m join auth.users u on u.id=m.user_id where m.organization_id=org and (medical or m.user_id=auth.uid());
 select coalesce(jsonb_agg(a.payload || coalesce(c.payload,'{}')),'[]') into patients_json from public.linkare_records a
 left join public.linkare_records c on c.organization_id=a.organization_id and c.kind='patient_clinical' and c.id=a.id and not c.deleted and medical
 where a.organization_id=org and a.kind='patient_admin' and not a.deleted and public.linkare_permission_v3(org,'patientsView');
 select coalesce(jsonb_agg(a.payload || coalesce(c.payload,'{}')),'[]') into appointments_json from public.linkare_records a
 left join public.linkare_records c on c.organization_id=a.organization_id and c.kind='appointment_clinical' and c.id=a.id and not c.deleted and medical
 where a.organization_id=org and a.kind='appointment' and not a.deleted and public.linkare_permission_v3(org,'appointmentsManage');
 select coalesce(jsonb_agg(payload),'[]') into alerts_json from public.linkare_records where organization_id=org and kind='alert' and not deleted and medical;
 select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'revision',revision)),'[]') into revs from public.linkare_records
 where organization_id=org and (medical or kind in('profile','settings') or (kind='patient_admin' and public.linkare_permission_v3(org,'patientsView')) or (kind='appointment' and public.linkare_permission_v3(org,'appointmentsManage')));
 return jsonb_build_object('organizationId',org,'entitled',public.linkare_entitled_v3(org),'memberRole',case when medical then 'doctor' else 'secretary' end,'userId',auth.uid(),'revisions',revs,
 'payload',jsonb_build_object('organization',coalesce(profile,'{}'),'settings',coalesce(settings,'{}')||jsonb_build_object('activeUserId',auth.uid()),'users',users_json,'patients',patients_json,'appointments',appointments_json,'alerts',alerts_json,'payments','[]'::jsonb));
end $$;

create or replace function public.linkare_save_changes_v3(org uuid, changes jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb; k text; rid text; v bigint; old public.linkare_records; val jsonb; removed boolean; canwrite boolean; med boolean:=public.linkare_doctor_v3(org); result jsonb:='[]'; note jsonb; after_note jsonb;
begin
 if public.linkare_role_v3(org) is null or public.linkare_role_v3(org) not in ('owner','doctor','psychiatrist','secretary') then raise exception 'ACCESS_DENIED' using errcode='42501'; end if;
 if changes is null or jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>250 or octet_length(changes::text)>12000000 then raise exception 'INVALID_BATCH'; end if;
 -- An entire delta succeeds or rolls back. Optimistic revision avoids lost updates.
 for item in select value from jsonb_array_elements(changes) order by value->>'kind',value->>'id' loop
  k:=item->>'kind';rid:=item->>'id';removed:=coalesce((item->>'deleted')::boolean,false);val:=coalesce(item->'payload','{}');
  if k is null or rid is null or k not in ('profile','settings','patient_admin','patient_clinical','appointment','appointment_clinical','alert') or length(rid) not between 1 and 160 or jsonb_typeof(val)<>'object' or octet_length(val::text)>4000000 then raise exception 'INVALID_RECORD'; end if;
  perform pg_advisory_xact_lock(hashtextextended(org::text||':'||k||':'||rid,303));
  select * into old from public.linkare_records where organization_id=org and kind=k and id=rid for update;
  v:=coalesce(old.revision,0);
  if v<>coalesce((item->>'expectedRevision')::bigint,0) then raise exception 'REVISION_CONFLICT:%:%',k,rid using errcode='40001'; end if;
  canwrite:=med or (k='patient_admin' and not removed and public.linkare_permission_v3(org,case when v=0 then 'patientsCreate' else 'patientsEdit' end)) or (k='appointment' and public.linkare_permission_v3(org,'appointmentsManage'));
  if not canwrite then raise exception 'ACCESS_DENIED' using errcode='42501'; end if;
  if k not in('profile','settings') and not public.linkare_entitled_v3(org) then raise exception 'SUBSCRIPTION_REQUIRED'; end if;
  if k='patient_admin' then
   if removed then raise exception 'PATIENT_DELETE_DISABLED_USE_ARCHIVE'; end if;
   val:=public.linkare_pick_v3(val,array['id','name','initials','age','phone','email','photo','insurance','nextVisit','archived','createdAt','updatedAt','notificationPreferences']);
   if length(trim(coalesce(val->>'name','')))=0 then raise exception 'PATIENT_NAME_REQUIRED'; end if;
   val:=val||jsonb_build_object('id',rid);
  elsif k='appointment' then
   val:=public.linkare_pick_v3(val,array['id','patientId','title','start','end','type','modality','status','reminderLog','googleEventId','googleEventUrl','createdAt','updatedAt']);
   if not removed then
    if not exists(select 1 from public.linkare_records where organization_id=org and kind='patient_admin' and id=val->>'patientId' and not deleted) and not exists(select 1 from jsonb_array_elements(changes) x where x->>'kind'='patient_admin' and x->>'id'=val->>'patientId') then raise exception 'PATIENT_NOT_FOUND'; end if;
    if nullif(val->>'start','') is null or nullif(val->>'end','') is null or (val->>'end')::timestamptz <= (val->>'start')::timestamptz then raise exception 'INVALID_APPOINTMENT_TIME'; end if;
   end if;
   val:=val||jsonb_build_object('id',rid);
  elsif k='profile' then val:=public.linkare_pick_v3(val,array['name','clinician','specialty','professionalLicense','address','phone','email','website','clinicLogo','doctorPhoto','prescriptionFooter','updatedAt']);
  elsif k='settings' then val:=public.linkare_pick_v3(val,array['largeText','reducedMotion','simpleMode','theme','reminderHours','reminderChannels','palette']);
  elsif k='patient_clinical' then
   if not exists(select 1 from public.linkare_records where organization_id=org and kind='patient_admin' and id=rid and not deleted) then raise exception 'PATIENT_NOT_FOUND'; end if;
   if removed then raise exception 'CLINICAL_DELETE_DISABLED'; end if;
   if jsonb_typeof(coalesce(val->'consultations','[]'))<>'array' then raise exception 'INVALID_NOTES'; end if;
   if (select count(*) <> count(distinct value->>'id') from jsonb_array_elements(coalesce(val->'consultations','[]'))) then raise exception 'INVALID_NOTE_IDS'; end if;
   for note in select value from jsonb_array_elements(coalesce(old.payload->'consultations','[]')) loop
    if note->>'status' in ('completed','signed') or coalesce(note->>'signedAt','')<>'' then
     select value into after_note from jsonb_array_elements(coalesce(val->'consultations','[]')) where value->>'id'=note->>'id';
     if after_note is null or (after_note-'__readOnly') is distinct from (note-'__readOnly') then raise exception 'SIGNED_NOTE_IMMUTABLE'; end if;
    end if;
   end loop;
   for note in select value from jsonb_array_elements(coalesce(val->'consultations','[]')) loop
    if (note->>'status' in ('completed','signed') or coalesce(note->>'signedAt','')<>'') and not exists(select 1 from jsonb_array_elements(coalesce(old.payload->'consultations','[]')) x where x->>'id'=note->>'id' and (x->>'status' in('completed','signed') or coalesce(x->>'signedAt','')<>'')) then
     if note->>'signedBy' is distinct from auth.uid()::text then raise exception 'INVALID_SIGNER' using errcode='42501'; end if;
    end if;
   end loop;
  end if;
  insert into public.linkare_records(organization_id,kind,id,payload,revision,deleted,updated_by) values(org,k,rid,val,v+1,removed,auth.uid())
   on conflict(organization_id,kind,id) do update set payload=excluded.payload,revision=excluded.revision,deleted=excluded.deleted,updated_at=now(),updated_by=auth.uid();
  insert into public.linkare_audit_v3(organization_id,actor_id,action,kind,record_id,revision,fingerprint) values(org,auth.uid(),case when removed then 'record.archived' else 'record.saved' end,k,rid,v+1,encode(sha256(convert_to(val::text,'UTF8')),'hex'));
  result:=result||jsonb_build_array(jsonb_build_object('kind',k,'id',rid,'revision',v+1));
 end loop;
 return result;
end $$;

-- Server-only invitation and checkout throttles; never usable with the public browser key.
create or replace function public.linkare_rate_v3(s text,a text,max_hits integer) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer; b timestamptz:=date_trunc('hour',now()); begin
 insert into linkare_private.rate_limits(scope,actor,bucket) values(s,a,b) on conflict(scope,actor,bucket) do update set hits=linkare_private.rate_limits.hits+1 returning hits into n;
 return n<=max_hits; end $$;

create or replace function public.linkare_reserve_order_v3(org uuid,payer uuid,selected_plan text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.linkare_plans_v3; o public.linkare_orders_v3; rid uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(org::text,310));
 if not exists(select 1 from public.organization_members where organization_id=org and user_id=payer and active and role::text in('owner','doctor','psychiatrist')) then raise exception 'ACCESS_DENIED'; end if;
 select * into p from public.linkare_plans_v3 where code=selected_plan and active;
 if not found then raise exception 'INVALID_PLAN'; end if;
 select * into o from public.linkare_orders_v3 where organization_id=org and status in('creating','review','pending') order by created_at desc limit 1 for update;
 if found then
  if o.plan_code<>selected_plan then raise exception 'PENDING_DIFFERENT_PLAN'; end if;
  if o.status='pending' and o.payment_url is not null then return jsonb_build_object('existing',true,'order',to_jsonb(o)); end if;
  raise exception 'PAYMENT_CREATION_IN_PROGRESS_OR_REVIEW';
 end if;
 rid:=gen_random_uuid();
 insert into public.linkare_orders_v3(id,organization_id,payer_user_id,plan_code,plan_name,amount_cents,months,currency,external_reference)
 values(rid,org,payer,p.code,p.name,p.amount_cents,p.months,p.currency,'LINKARE-'||rid::text) returning * into o;
 return jsonb_build_object('existing',false,'order',to_jsonb(o));
end $$;

create or replace function public.linkare_confirm_payment_v3(ref text,transaction_ref text,amount integer,productive boolean,event_date timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.linkare_orders_v3;s public.linkare_subscriptions_v3; started timestamptz; ended timestamptz;
begin
 if productive is distinct from true then raise exception 'NON_PRODUCTIVE_PAYMENT'; end if;
 if length(coalesce(transaction_ref,''))<8 then raise exception 'INVALID_TRANSACTION'; end if;
 select * into o from public.linkare_orders_v3 where external_reference=ref for update;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if amount is null or o.amount_cents<>amount or o.currency<>'USD' then raise exception 'AMOUNT_MISMATCH'; end if;
 if o.status='paid' then
  if o.transaction_id<>transaction_ref then raise exception 'TRANSACTION_MISMATCH';end if;
  return jsonb_build_object('ok',true,'duplicate',true);
 end if;
 if exists(select 1 from public.linkare_orders_v3 where transaction_id=transaction_ref and id<>o.id) then raise exception 'TRANSACTION_REUSED'; end if;
 if event_date is null or event_date<o.created_at-interval '1 day' or event_date>now()+interval '10 minutes' then raise exception 'INVALID_PAYMENT_DATE'; end if;
 insert into public.linkare_subscriptions_v3(organization_id) values(o.organization_id) on conflict do nothing;
 select * into s from public.linkare_subscriptions_v3 where organization_id=o.organization_id for update;
 started:=greatest(event_date,coalesce(s.current_period_end,event_date));
 ended:=((started at time zone 'UTC') + make_interval(months => o.months)) at time zone 'UTC';
 update public.linkare_orders_v3 set status='paid',transaction_id=transaction_ref,is_test=false,paid_at=event_date,period_start=started,period_end=ended,updated_at=now() where id=o.id;
 update public.linkare_subscriptions_v3 set plan_code=o.plan_code,current_period_start=case when s.current_period_end>event_date then s.current_period_start else started end,current_period_end=ended,last_order_id=o.id,updated_at=now() where organization_id=o.organization_id;
 insert into public.linkare_audit_v3(organization_id,action,record_id) values(o.organization_id,'subscription.paid',o.id::text);
 return jsonb_build_object('ok',true,'duplicate',false,'periodEnd',ended);
end $$;

-- Policies and grants for browser reads. All record mutations use the versioned RPC.
alter table public.linkare_records enable row level security;
alter table public.linkare_audit_v3 enable row level security;
alter table public.linkare_invites_v3 enable row level security;
alter table public.linkare_plans_v3 enable row level security;
alter table public.linkare_orders_v3 enable row level security;
alter table public.linkare_subscriptions_v3 enable row level security;
revoke all on public.linkare_records,public.linkare_audit_v3,public.linkare_invites_v3,public.linkare_plans_v3,public.linkare_orders_v3,public.linkare_subscriptions_v3 from public,anon,authenticated;
grant select on public.linkare_records,public.linkare_audit_v3,public.linkare_invites_v3,public.linkare_plans_v3,public.linkare_orders_v3,public.linkare_subscriptions_v3 to authenticated;
grant all on public.linkare_records,public.linkare_audit_v3,public.linkare_invites_v3,public.linkare_plans_v3,public.linkare_orders_v3,public.linkare_subscriptions_v3 to service_role;
grant usage,select on sequence public.linkare_audit_v3_id_seq to service_role;

drop policy if exists linkare_records_read_v3 on public.linkare_records;
create policy linkare_records_read_v3 on public.linkare_records for select to authenticated using (
 public.linkare_doctor_v3(organization_id) or
 (public.linkare_role_v3(organization_id)='secretary' and (kind in('profile','settings') or (kind='patient_admin' and public.linkare_permission_v3(organization_id,'patientsView')) or (kind='appointment' and public.linkare_permission_v3(organization_id,'appointmentsManage'))))
);
drop policy if exists linkare_audit_read_v3 on public.linkare_audit_v3;
create policy linkare_audit_read_v3 on public.linkare_audit_v3 for select to authenticated using(public.linkare_doctor_v3(organization_id));
drop policy if exists linkare_invites_read_v3 on public.linkare_invites_v3;
create policy linkare_invites_read_v3 on public.linkare_invites_v3 for select to authenticated using(public.linkare_doctor_v3(organization_id));
drop policy if exists linkare_plans_read_v3 on public.linkare_plans_v3;
create policy linkare_plans_read_v3 on public.linkare_plans_v3 for select to authenticated using(active);
drop policy if exists linkare_orders_read_v3 on public.linkare_orders_v3;
create policy linkare_orders_read_v3 on public.linkare_orders_v3 for select to authenticated using(public.linkare_doctor_v3(organization_id));
drop policy if exists linkare_subscription_read_v3 on public.linkare_subscriptions_v3;
create policy linkare_subscription_read_v3 on public.linkare_subscriptions_v3 for select to authenticated using(public.linkare_doctor_v3(organization_id));

-- Remove old client write paths that could elevate a secretary or edit the stored price.
revoke all on public.organization_members,public.organizations from public,anon,authenticated;
grant all on public.organization_members,public.organizations to service_role;
grant select on public.organization_members,public.organizations to authenticated;
alter table public.organization_members enable row level security;
alter table public.organizations enable row level security;
do $$ declare p record;begin
 for p in select policyname,tablename from pg_policies where schemaname='public' and tablename in('organization_members','organizations') loop execute format('drop policy %I on public.%I',p.policyname,p.tablename);end loop;
end $$;
create policy linkare_members_read_v3 on public.organization_members for select to authenticated using(user_id=auth.uid() or public.linkare_doctor_v3(organization_id));
create policy linkare_org_read_v3 on public.organizations for select to authenticated using(public.linkare_role_v3(id) is not null);

-- Revoke legacy browser access without dropping rows. Prevent alternative v2 endpoints.
do $$ declare t text;f record;begin
 foreach t in array array['adverse_events','appointment_reminders','appointments','audit_events','clinic_payment_settings','clinic_payments','clinical_alerts','clinical_context_events','lab_results','linkare_app_state','linkare_billing_accounts','linkare_billing_invoices','linkare_platform_billing_settings','linkare_subscription_invoices','linkare_wompi_events','medication_catalog','medication_events','monitoring_protocols','monitoring_rules','patient_assessments','patient_diagnoses','patient_medications','patient_monitoring_tasks','patients','prescription_items','prescriptions','scale_definitions','vital_signs'] loop
  if to_regclass('public.'||t) is not null then execute format('revoke all on public.%I from public,anon,authenticated',t);end if;
 end loop;
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('linkare_bootstrap_organization') loop execute 'revoke all on function '||f.signature||' from public,anon,authenticated';end loop;
end $$;

-- Archive existing JSON and migrate once. Users/passwords are deliberately not imported.
do $$ declare old record; p jsonb; a jsonb; al jsonb; begin
 if to_regclass('public.linkare_app_state') is not null then
  for old in execute 'select organization_id,payload from public.linkare_app_state' loop
   insert into linkare_private.legacy_archive(organization_id,payload,fingerprint) values(old.organization_id,old.payload,encode(sha256(convert_to(old.payload::text,'UTF8')),'hex')) on conflict do nothing;
   if exists(select 1 from linkare_private.legacy_archive where organization_id=old.organization_id and imported_at is not null) then continue; end if;
   insert into public.linkare_records(organization_id,kind,id,payload) values
    (old.organization_id,'profile','clinic',public.linkare_pick_v3(old.payload->'organization',array['name','clinician','specialty','professionalLicense','address','phone','email','website','clinicLogo','doctorPhoto','prescriptionFooter','updatedAt'])),
    (old.organization_id,'settings','clinic',public.linkare_pick_v3(old.payload->'settings',array['largeText','reducedMotion','simpleMode','theme','reminderHours','reminderChannels','palette'])) on conflict do nothing;
   for p in select value from jsonb_array_elements(coalesce(old.payload->'patients','[]')) loop
    if nullif(p->>'id','') is null then raise exception 'Legacy patient missing id in organization %',old.organization_id;end if;
    insert into public.linkare_records(organization_id,kind,id,payload) values
     (old.organization_id,'patient_admin',p->>'id',public.linkare_pick_v3(p,array['id','name','initials','age','phone','email','photo','insurance','nextVisit','archived','createdAt','updatedAt','notificationPreferences'])),
     (old.organization_id,'patient_clinical',p->>'id',p-array['id','name','initials','age','phone','email','photo','insurance','nextVisit','archived','createdAt','updatedAt','notificationPreferences']) on conflict do nothing;
   end loop;
   for a in select value from jsonb_array_elements(coalesce(old.payload->'appointments','[]')) loop
    insert into public.linkare_records(organization_id,kind,id,payload) values
     (old.organization_id,'appointment',a->>'id',public.linkare_pick_v3(a,array['id','patientId','title','start','end','type','modality','status','reminderLog','googleEventId','googleEventUrl','createdAt','updatedAt'])),
     (old.organization_id,'appointment_clinical',a->>'id',jsonb_build_object('notes',coalesce(a->>'notes',''))) on conflict do nothing;
   end loop;
   for al in select value from jsonb_array_elements(coalesce(old.payload->'alerts','[]')) loop
    insert into public.linkare_records(organization_id,kind,id,payload) values(old.organization_id,'alert',al->>'id',al) on conflict do nothing;
   end loop;
   update linkare_private.legacy_archive set imported_at=now() where organization_id=old.organization_id;
  end loop;
 end if;
end $$;


-- Auxiliary tables, also created on fresh databases.
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
alter table public.patient_document_audit drop constraint if exists patient_document_audit_action_check;
alter table public.patient_document_audit add constraint patient_document_audit_action_check check(action in('upload','open','download','delete','archive'));
alter table public.linkare_notification_deliveries add column if not exists dedupe_key text;
create unique index if not exists linkare_delivery_dedupe_v3 on public.linkare_notification_deliveries(organization_id,dedupe_key) where dedupe_key is not null;
create table if not exists public.linkare_calendar_links_v3 (
 organization_id uuid not null references public.organizations(id), user_id uuid not null references auth.users(id), appointment_id text not null,
 google_event_id text not null, updated_at timestamptz not null default now(), primary key(organization_id,user_id,appointment_id)
);
do $$ declare t text; p record; begin
 foreach t in array array['patient_document_audit','linkare_notification_deliveries','calendar_connections','calendar_oauth_states','calendar_feed_tokens','linkare_calendar_links_v3'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  for p in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on public.%I',p.policyname,t); end loop;
 end loop;
end $$;
grant select,insert on public.patient_document_audit to authenticated;
create policy document_audit_read_v3 on public.patient_document_audit for select to authenticated using(public.linkare_doctor_v3(organization_id));
create policy document_audit_insert_v3 on public.patient_document_audit for insert to authenticated with check(public.linkare_doctor_v3(organization_id) and actor_id=auth.uid());
grant select on public.linkare_notification_deliveries to authenticated;
create policy reminder_read_v3 on public.linkare_notification_deliveries for select to authenticated using(public.linkare_permission_v3(organization_id,'remindersManage'));
-- Calendar credentials and bearer feeds remain service-role only.

-- Clinical documents: replace prior policies only for the supplied patient-documents bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('patient-documents','patient-documents',false,20971520,array['application/pdf','image/jpeg','image/png','image/webp','text/plain','text/csv','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.linkare_document_access_v3(object_name text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare org uuid; begin
 begin org:=split_part(object_name,'/',1)::uuid;exception when invalid_text_representation then return false;end;
 return public.linkare_doctor_v3(org) and exists(select 1 from public.linkare_records where organization_id=org and kind='patient_admin' and id=split_part(object_name,'/',2) and not deleted);
end $$;
create or replace function public.linkare_document_insert_v3(object_name text) returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if not public.linkare_document_access_v3(object_name) then return false;end if;
 return public.linkare_entitled_v3(split_part(object_name,'/',1)::uuid);
end $$;
do $$ declare p record;begin
 for p in select policyname from pg_policies where schemaname='storage' and tablename='objects' and (coalesce(qual,'')||coalesce(with_check,'')) like '%patient-documents%' loop execute format('drop policy %I on storage.objects',p.policyname);end loop;
end $$;
create policy linkare_documents_read_v3 on storage.objects for select to authenticated using(bucket_id='patient-documents' and public.linkare_document_access_v3(name));
create policy linkare_documents_insert_v3 on storage.objects for insert to authenticated with check(bucket_id='patient-documents' and public.linkare_document_insert_v3(name));
-- Restrictive guards remain effective even if another app created a broad Storage policy.
drop policy if exists linkare_document_guard_select_v3 on storage.objects;
create policy linkare_document_guard_select_v3 on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'patient-documents' or public.linkare_document_access_v3(name));
drop policy if exists linkare_document_guard_insert_v3 on storage.objects;
create policy linkare_document_guard_insert_v3 on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'patient-documents' or (public.linkare_document_insert_v3(name)));
drop policy if exists linkare_document_guard_update_v3 on storage.objects;
create policy linkare_document_guard_update_v3 on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'patient-documents') with check(bucket_id<>'patient-documents');
drop policy if exists linkare_document_guard_delete_v3 on storage.objects;
create policy linkare_document_guard_delete_v3 on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'patient-documents');

-- Physical delete intentionally withheld. Use metadata archiving; retain evidence for recovery.


create or replace function public.linkare_invite_email_available_v3(candidate text) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from auth.users u join public.organization_members m on m.user_id=u.id where lower(u.email)=lower(trim(candidate)))
$$;

-- Restrict every new function explicitly (Postgres defaults otherwise grant EXECUTE to PUBLIC).
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'linkare_%_v3' loop execute 'revoke all on function '||f.signature||' from public,anon,authenticated';end loop;
end $$;
grant execute on function public.linkare_document_access_v3(text),public.linkare_document_insert_v3(text) to anon;
grant execute on function public.linkare_document_insert_v3(text),public.linkare_entitled_v3(uuid),public.linkare_role_v3(uuid),public.linkare_doctor_v3(uuid),public.linkare_permission_v3(uuid,text),public.linkare_document_access_v3(text),public.linkare_bootstrap_v3(text),public.linkare_load_state_v3(uuid),public.linkare_save_changes_v3(uuid,jsonb) to authenticated;
grant execute on function public.linkare_invite_email_available_v3(text),public.linkare_rate_v3(text,text,integer),public.linkare_reserve_order_v3(uuid,uuid,text),public.linkare_confirm_payment_v3(text,text,integer,boolean,timestamptz) to service_role;
-- Preserve historical billing rows for a manual provider reconciliation, without changing amounts.
create table if not exists linkare_private.legacy_billing_archive (source text not null, row_key text not null, payload jsonb not null, archived_at timestamptz not null default now(),primary key(source,row_key));
do $$ declare t text;begin
 foreach t in array array['linkare_subscription_invoices','linkare_platform_billing_settings'] loop
  if to_regclass('public.'||t) is not null then execute format('insert into linkare_private.legacy_billing_archive(source,row_key,payload) select %L,coalesce(to_jsonb(x)->>''id'',to_jsonb(x)->>''organization_id''),to_jsonb(x) from public.%I x on conflict do nothing',t,t);end if;
 end loop;
end $$;
notify pgrst, 'reload schema';
commit;
select 'Linkare 3.0 schema installed' as result,
 (select count(*) from public.linkare_plans_v3) as plans,
 (select count(*) from linkare_private.legacy_archive where imported_at is not null) as organizations_migrated;
