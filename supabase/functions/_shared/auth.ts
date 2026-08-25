import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function publishableKey() {
  const legacy = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (legacy) return legacy;
  try { return String(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default || '').trim(); }
  catch (_) { return ''; }
}

export async function requireUser(request: Request) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization) throw new Error('Debe iniciar sesión.');
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = publishableKey();
  if (!url || !key) throw new Error('Supabase no expuso la configuración necesaria para validar la sesión.');
  const client = createClient(url, key, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('La sesión de Supabase no es válida.');
  return data.user;
}
