export function corsHeaders(request: Request) {
  const normalize = (value: string) => String(value || '').trim().replace(/\/+$/, '');
  const origin = normalize(request.headers.get('origin') || '');

  // Build an allow-list from ALL sources instead of letting CORS_ORIGINS
  // completely replace APP_PUBLIC_URL. This avoids a stale secret breaking
  // production after a domain change.
  const configured = [
    ...(Deno.env.get('CORS_ORIGINS') || '').split(','),
    Deno.env.get('APP_PUBLIC_URL') || '',
    'https://nexamind-clinical.vercel.app',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ]
    .map(normalize)
    .filter(Boolean);

  const allowed = new Set(configured);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };

  if (origin && allowed.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

export function jsonResponse(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(request),
  });
}
