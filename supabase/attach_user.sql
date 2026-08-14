-- Sustituye el UUID y ejecuta después de crear el usuario en Supabase Auth.
-- NO uses este archivo sin revisar el organization_id generado por tu seed.

-- Ejemplo conceptual:
-- insert into public.organization_members (organization_id, user_id, role, active)
-- select id, '00000000-0000-0000-0000-000000000000'::uuid, 'psychiatrist', true
-- from public.organizations
-- where slug = 'nexamind-demo'
-- on conflict (organization_id, user_id) do update set active = true;
