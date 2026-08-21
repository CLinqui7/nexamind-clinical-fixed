import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { wompiRequest } from '../_shared/wompi.ts';

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { ok: false, message: 'Método no permitido.' }, 405);

  try {
    const app = await wompiRequest('/Aplicativo', { method: 'GET' });
    return jsonResponse(request, { ok: true, app });
  } catch (error) {
    return jsonResponse(request, {
      ok: false,
      message: error instanceof Error ? error.message : 'No se pudo consultar el aplicativo Wompi.',
    }, 500);
  }
});
