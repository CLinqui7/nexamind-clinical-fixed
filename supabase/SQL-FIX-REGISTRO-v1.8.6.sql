-- Linkare v1.8.0
-- Self-service signup support and default monthly platform price = USD 40.

alter table if exists public.linkare_platform_billing_settings
  alter column subscription_price set default 40;

update public.linkare_platform_billing_settings
set subscription_price = 40,
    updated_at = now()
where subscription_price = 79;

-- Use user metadata collected during Supabase Auth sign-up for the owner display name.
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
  owner_name text;
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

  owner_name := coalesce(
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
    nullif(trim(auth.jwt() ->> 'email'), ''),
    'Profesional Linkare'
  );

  safe_slug := coalesce(nullif(trim(requested_slug), ''),
    lower(regexp_replace(coalesce(nullif(trim(requested_name), ''), 'linkare-clinic'), '[^a-zA-Z0-9]+', '-', 'g'))
  );
  safe_slug := trim(both '-' from safe_slug) || '-' || substr(replace(current_user_id::text, '-', ''), 1, 8);

  insert into public.organizations (name, slug, is_demo)
  values (coalesce(nullif(trim(requested_name), ''), 'Linkare Clinic'), safe_slug, false)
  returning id into new_org;

  insert into public.organization_members (organization_id, user_id, role, display_name, active)
  values (new_org, current_user_id, 'owner', owner_name, true);

  insert into public.linkare_platform_billing_settings (
    organization_id,
    plan_name,
    plan_description,
    subscription_price,
    currency,
    billing_cycle,
    payer_name,
    payer_email,
    active
  )
  values (
    new_org,
    'Plan Profesional Linkare',
    'Licencia mensual de Linkare para gestión psiquiátrica.',
    40,
    'USD',
    'mensual',
    owner_name,
    auth.jwt() ->> 'email',
    true
  )
  on conflict (organization_id) do nothing;

  return new_org;
end;
$$;

revoke all on function public.linkare_bootstrap_organization(text, text) from public;
grant execute on function public.linkare_bootstrap_organization(text, text) to authenticated;
