import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { wompiConfig, wompiRequest } from '../_shared/wompi.ts';

// Health/status endpoint. It is intentionally public at the Supabase gateway
// and must be deployed with --no-verify-jwt. No secrets are returned.
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { ok: false, message: 'Método no permitido.' }, 405);

  try {
    const config = wompiConfig();
    const raw = await wompiRequest('/Aplicativo', { method: 'GET' }, config);

    const app = {
      nombre: raw?.nombre || raw?.Nombre || 'Wompi',
      estaProductivo: Boolean(raw?.estaProductivo ?? raw?.EsProductiva ?? raw?.esProductivo),
      numeroCuenta: raw?.numeroCuenta || raw?.NumeroCuenta || '',
      cuotasDisponibles: raw?.cuotasDisponibles || raw?.CuotasDisponibles || [],
      aplicaPagoConPuntos: Boolean(raw?.aplicaPagoConPuntos ?? raw?.AplicaPagoConPuntos),
    };

    return jsonResponse(request, { ok: true, app }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo consultar el aplicativo Wompi.';
    // Return 200 so the frontend can show the real diagnostic message instead of
    // the generic "Edge Function returned a non-2xx status code".
    return jsonResponse(request, { ok: false, message }, 200);
  }
});
