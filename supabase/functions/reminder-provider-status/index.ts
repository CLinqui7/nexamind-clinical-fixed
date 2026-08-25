import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { ok: false, message: 'Método no permitido.' }, 405);
  return jsonResponse(request, {
    ok: true,
    providers: {
      email: Boolean(Deno.env.get('RESEND_API_KEY') && Deno.env.get('REMINDER_EMAIL_FROM')),
      sms: Boolean(Deno.env.get('TWILIO_ACCOUNT_SID') && Deno.env.get('TWILIO_AUTH_TOKEN') && Deno.env.get('TWILIO_FROM_NUMBER')),
      whatsapp: Boolean(Deno.env.get('META_WHATSAPP_TOKEN') && Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID') && Deno.env.get('META_WHATSAPP_TEMPLATE_NAME')),
    },
  });
});
