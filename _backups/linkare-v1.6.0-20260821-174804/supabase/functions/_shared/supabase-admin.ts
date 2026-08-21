import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function readSecretKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (legacy) return legacy;
  const secretMap = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretMap) {
    try {
      const parsed = JSON.parse(secretMap);
      if (parsed?.default) return String(parsed.default);
    } catch (_) { /* fall through */ }
  }
  throw new Error('Supabase secret key is not available in the Edge Function.');
}

export function supabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL')?.trim();
  if (!url) throw new Error('SUPABASE_URL is missing.');
  return createClient(url, readSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
