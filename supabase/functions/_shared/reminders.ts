import {supabaseAdmin} from './supabase-admin.ts';
import {ApiError,limitAction} from './auth.ts';
async function sendEmail(destination: string, subject: string, message: string) {
  const key = Deno.env.get('RESEND_API_KEY')?.trim();
  const from = Deno.env.get('REMINDER_EMAIL_FROM')?.trim();
  if (!key || !from) throw new Error('Correo automático no configurado. Agregue RESEND_API_KEY y REMINDER_EMAIL_FROM.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [destination], subject, text: message }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || `El proveedor de correo respondió ${response.status}.`);
  return { provider: 'resend', id: body?.id || null };
}

async function sendSms(destination: string, message: string) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')?.trim();
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')?.trim();
  const from = Deno.env.get('TWILIO_FROM_NUMBER')?.trim();
  if (!sid || !token || !from) throw new Error('SMS automático no configurado. Agregue las credenciales de Twilio.');
  const body = new URLSearchParams({ To: destination, From: from, Body: message });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || `El proveedor SMS respondió ${response.status}.`);
  return { provider: 'twilio', id: payload?.sid || null };
}

async function sendWhatsApp(destination: string, message: string) {
  const token = Deno.env.get('META_WHATSAPP_TOKEN')?.trim();
  const phoneNumberId = Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID')?.trim();
  const template = Deno.env.get('META_WHATSAPP_TEMPLATE_NAME')?.trim();
  const language = Deno.env.get('META_WHATSAPP_TEMPLATE_LANGUAGE')?.trim() || 'es';
  const version = Deno.env.get('META_GRAPH_VERSION')?.trim();
  if (!version || !/^v[0-9]+\.[0-9]+$/.test(version)) throw new Error('Configure META_GRAPH_VERSION.');
  if (!token || !phoneNumberId || !template) {
    throw new Error('WhatsApp automático no configurado. Agregue token, Phone Number ID y plantilla aprobada.');
  }
  const digits = destination.replace(/\D/g, '');
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: digits,
      type: 'template',
      template: {
        name: template,
        language: { code: language },
        components: [{ type: 'body', parameters: [{ type: 'text', text: message.slice(0, 900) }] }],
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Meta respondió ${response.status}.`);
  return { provider: 'meta_whatsapp', id: payload?.messages?.[0]?.id || null };
}


export function configuredProviders(){return {
 email:Boolean(Deno.env.get('RESEND_API_KEY')&&Deno.env.get('REMINDER_EMAIL_FROM')),
 sms:Boolean(Deno.env.get('TWILIO_ACCOUNT_SID')&&Deno.env.get('TWILIO_AUTH_TOKEN')&&Deno.env.get('TWILIO_FROM_NUMBER')),
 whatsapp:Boolean(Deno.env.get('META_WHATSAPP_TOKEN')&&Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID')&&Deno.env.get('META_WHATSAPP_TEMPLATE_NAME')&&Deno.env.get('META_GRAPH_VERSION'))
};}
export async function deliverReminder(org:string,appointmentId:string,channel:string,hours:number,actor:string|null){
 if(!['email','sms','whatsapp'].includes(channel)||![2,8,24,48,72].includes(Number(hours)))throw new ApiError(400,'Canal o anticipación no válidos.');
 if(!configuredProviders()[channel as 'email'|'sms'|'whatsapp'])throw new ApiError(503,'Este canal no está configurado.');
 const db=supabaseAdmin();
 const {data:sub,error:subError}=await db.from('linkare_subscriptions_v3').select('current_period_end').eq('organization_id',org).maybeSingle();
 if(subError||!sub?.current_period_end||Date.parse(sub.current_period_end)+7*86400000<Date.now())throw new ApiError(403,'Renueve el plan para enviar recordatorios.');
 const {data:row,error}=await db.from('linkare_records').select('payload').eq('organization_id',org).eq('kind','appointment').eq('id',appointmentId).eq('deleted',false).maybeSingle();
 const a=row?.payload;if(error||!a||['cancelled','completed','no_show'].includes(a.status)||Date.parse(a.start)<Date.now())throw new ApiError(409,'La cita ya no admite recordatorios.');
 const [{data:admin},{data:clinical}]=await Promise.all([
  db.from('linkare_records').select('payload').eq('organization_id',org).eq('kind','patient_admin').eq('id',a.patientId).eq('deleted',false).maybeSingle(),
  db.from('linkare_records').select('payload').eq('organization_id',org).eq('kind','patient_clinical').eq('id',a.patientId).eq('deleted',false).maybeSingle()
 ]);
 const p=admin?.payload,prefs=p?.notificationPreferences||{};
 if(!p||p.archived||clinical?.payload?.vitalStatus==='deceased'||prefs.enabled===false||prefs.consentStatus!=='granted'||!Array.isArray(prefs.channels)||!prefs.channels.includes(channel))throw new ApiError(409,'El paciente no autorizó este canal o no admite recordatorios.');
 const tz=prefs.timezone||Deno.env.get('CLINIC_TIMEZONE')||'America/El_Salvador';
 const localTime=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:tz}).format(new Date());
 const quietStart=String(prefs.quietHoursStart||'20:00'),quietEnd=String(prefs.quietHoursEnd||'07:00');
 if(quietStart!==quietEnd && (quietStart<quietEnd ? localTime>=quietStart&&localTime<quietEnd : localTime>=quietStart||localTime<quietEnd))throw new ApiError(409,'El paciente está en su horario de descanso. El envío automático esperará al siguiente horario permitido.');
 const destination=String(channel==='email'?(prefs.email||p.email):(prefs.phone||p.phone)).trim();
 if(channel==='email'?!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination):!/^\+[1-9]\d{7,14}$/.test(destination.replace(/[ ()-]/g,'')))throw new ApiError(400,'Revise el correo o teléfono internacional del paciente.');
 await limitAction(db,'reminder-org',org,200);
 const when=new Intl.DateTimeFormat('es-SV',{dateStyle:'long',timeStyle:'short',timeZone:tz}).format(new Date(a.start));
 const message=`Le recordamos su cita el ${when}. Para confirmar o reprogramar, contacte directamente a su consultorio.`;
 const key=`${appointmentId}:${a.start}:${hours}:${channel}`;
 const {data:audit,error:reserveError}=await db.from('linkare_notification_deliveries').insert({organization_id:org,appointment_id:appointmentId,patient_id:a.patientId,channel,destination,status:'queued',dedupe_key:key,created_by:actor,metadata:{hours,scheduledStart:a.start}}).select('id').single();
 if(reserveError){if(reserveError.code==='23505')return {ok:true,duplicate:true,message:'Este aviso ya fue procesado. Revise el registro de entregas.'};throw reserveError;}
 try{
  const sent=channel==='email'?await sendEmail(destination,'Recordatorio de cita',message):channel==='sms'?await sendSms(destination.replace(/[ ()-]/g,''),message):await sendWhatsApp(destination,message);
  const {error:save}=await db.from('linkare_notification_deliveries').update({status:'sent',provider:sent.provider,provider_message_id:sent.id,sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',audit.id);if(save)throw save;
  return {ok:true,deliveryId:audit.id,provider:sent.provider,providerMessageId:sent.id,status:'accepted'};
 }catch(error){await db.from('linkare_notification_deliveries').update({status:'failed',error_message:'No se pudo confirmar la aceptación del proveedor. Revisar antes de reintentar.',updated_at:new Date().toISOString()}).eq('id',audit.id);throw new ApiError(502,'No se pudo confirmar el envío. Revise al proveedor antes de repetirlo.');}
}
