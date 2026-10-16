const emailPattern = /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;

function address(value: string) {
  const result = String(value || '').trim();
  if (!emailPattern.test(result)) throw new Error('La dirección de correo no es válida.');
  return result;
}

function base64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

export function gmailConfigured() {
  return Boolean(
    Deno.env.get('GMAIL_CLIENT_ID')?.trim() &&
    Deno.env.get('GMAIL_CLIENT_SECRET')?.trim() &&
    Deno.env.get('GMAIL_REFRESH_TOKEN')?.trim() &&
    Deno.env.get('GMAIL_SENDER_EMAIL')?.trim()
  );
}

export function gmailRawMessage(sender: string, recipient: string, subject: string, message: string) {
  const from = address(sender), to = address(recipient);
  const title = String(subject || '').replace(/[\r\n]/g, ' ').trim().slice(0, 160);
  if (!title) throw new Error('El asunto del correo es obligatorio.');
  const body = base64(String(message || '')).match(/.{1,76}/g)?.join('\r\n') || '';
  const mime = [
    `From: <${from}>`, `To: <${to}>`, `Subject: =?UTF-8?B?${base64(title)}?=`,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64', '', body,
  ].join('\r\n');
  return base64(mime).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function sendGmailEmail(recipient: string, subject: string, message: string) {
  if (!gmailConfigured()) throw new Error('Gmail API no está configurada.');
  const clientId = Deno.env.get('GMAIL_CLIENT_ID')!.trim();
  const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET')!.trim();
  const refreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN')!.trim();
  const sender = Deno.env.get('GMAIL_SENDER_EMAIL')!.trim();
  const raw = gmailRawMessage(sender, recipient, subject, message);
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  const tokenBody = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenBody.access_token) throw new Error('Gmail rechazó la autorización del remitente.');
  const sentResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${tokenBody.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  const sentBody = await sentResponse.json().catch(() => ({}));
  if (!sentResponse.ok || !sentBody.id) throw new Error(`Gmail no confirmó el envío (${sentResponse.status}).`);
  return { provider: 'gmail', id: String(sentBody.id) };
}
