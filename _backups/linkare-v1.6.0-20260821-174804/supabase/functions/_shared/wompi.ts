const DEFAULT_AUTH_URL = 'https://id.wompi.sv/connect/token';
const DEFAULT_API_URL = 'https://api.wompi.sv';

function required(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Falta el secreto ${name}.`);
  return value;
}

export type WompiRuntimeConfig = {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  apiUrl: string;
  audience: string;
  appPublicUrl: string;
  notificationEmail: string;
  requireAuth: boolean;
};

export function wompiConfig(): WompiRuntimeConfig {
  return {
    clientId: required('WOMPI_CLIENT_ID'),
    clientSecret: required('WOMPI_CLIENT_SECRET'),
    authUrl: Deno.env.get('WOMPI_AUTH_URL')?.trim() || DEFAULT_AUTH_URL,
    apiUrl: (Deno.env.get('WOMPI_API_URL')?.trim() || DEFAULT_API_URL).replace(/\/$/, ''),
    audience: Deno.env.get('WOMPI_AUDIENCE')?.trim() || 'wompi_api',
    appPublicUrl: Deno.env.get('APP_PUBLIC_URL')?.trim() || 'http://localhost:4173',
    notificationEmail: Deno.env.get('WOMPI_NOTIFICATION_EMAIL')?.trim() || '',
    requireAuth: String(Deno.env.get('WOMPI_REQUIRE_AUTH') || 'false').toLowerCase() === 'true',
  };
}

export async function getWompiToken(config = wompiConfig()) {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    audience: config.audience,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetch(config.authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || `Wompi OAuth respondió ${response.status}.`);
  }
  return payload.access_token as string;
}

export async function wompiRequest(path: string, init: RequestInit = {}, config = wompiConfig()) {
  const token = await getWompiToken(config);
  const response = await fetch(`${config.apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.title || payload?.error || `Wompi API respondió ${response.status}.`);
  }
  return payload;
}

export async function verifyWompiWebhook(rawBody: string, receivedHash: string | null, secret: string) {
  if (!receivedHash) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(signature)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  return expected.toLowerCase() === receivedHash.trim().toLowerCase();
}
