export function corsHeaders(request: Request) {
  const requestOrigin = request.headers.get('origin')?.trim() || '';
  const allowOrigin = requestOrigin || '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': [
      'authorization',
      'x-client-info',
      'apikey',
      'content-type',
      'x-linkare-admin-key',
      'x-supabase-api-version',
      'x-region',
      'x-retry-count',
      'traceparent',
      'tracestate',
      'baggage',
    ].join(', '),
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  };
}

export function jsonResponse(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(request),
  });
}
