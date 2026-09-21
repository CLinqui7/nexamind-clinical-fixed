import { readableError } from '../domain/errors.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function assertSupabaseConfigured() {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase no está configurado. Agregue VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

async function currentSession() {
  const client = assertSupabaseConfigured();
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(error.message || 'No se pudo leer la sesión.');
  let session = data.session;
  if (!session?.access_token) throw new Error('LOGIN_REQUIRED');

  const expiresAtMs = Number(session.expires_at || 0) * 1000;
  if (expiresAtMs && expiresAtMs < Date.now() + 90_000) {
    const refreshed = await client.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session?.access_token) {
      throw new Error('LOGIN_REQUIRED');
    }
    session = refreshed.data.session;
  }
  return session;
}

export async function invokeAuthedFunction(name, body = {}) {
  const client = assertSupabaseConfigured();
  const session = await currentSession();
  const { data, error } = await client.functions.invoke(name, {
    body,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  if(error) {
    console.error('Linkare integration',name,error.name);
    error.message=readableError(error);
  }
  return { data, error };
}
