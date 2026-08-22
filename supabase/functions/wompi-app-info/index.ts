import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { wompiConfig, wompiRequest } from '../_shared/wompi.ts';

function getPublishableKey() {
  const legacy = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
    return String(keys.default || '').trim();
  } catch (_) {
    return '';
  }
}

async function verifySession(request: Request, requireAuth: boolean) {
  if (!requireAuth) return;
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization) throw new Error('Debe iniciar sesión con una cuenta real para verificar Wompi.');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const publishableKey = getPublishableKey();
  if (!publishableKey) throw new Error('Supabase no expuso una llave pública para validar la sesión.');
  const client = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('La sesión de Supabase no es válida.');
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { ok: false, message: 'Método no permitido.' }, 405);

  try {
    const config = wompiConfig();
    await verifySession(request, config.requireAuth);
    const app = await wompiRequest('/Aplicativo', { method: 'GET' }, config);
    return jsonResponse(request, { ok: true, app });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo consultar el aplicativo Wompi.';
    const status = /sesión|iniciar sesión/i.test(message) ? 401 : 502;
    return jsonResponse(request, { ok: false, message }, status);
  }
});
