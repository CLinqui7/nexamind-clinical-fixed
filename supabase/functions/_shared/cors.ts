export function corsHeaders(request: Request) {
  const configuredOrigin = Deno.env.get('APP_PUBLIC_URL') || '*';
  const requestOrigin = request.headers.get('origin') || '';
  const allowOrigin = configuredOrigin === '*' || requestOrigin === configuredOrigin
    ? (configuredOrigin === '*' ? '*' : requestOrigin)
    : configuredOrigin;

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
