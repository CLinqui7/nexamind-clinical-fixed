import {supabaseAdmin} from '../_shared/supabase-admin.ts';
import {deliverReminder,configuredProviders,sendEmail,sendWhatsApp} from '../_shared/reminders.ts';
function same(a:string,b:string){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
Deno.serve(async request=>{
 const secret=Deno.env.get('LINKARE_CRON_SECRET')||'';const received=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
 if(request.method!=='POST'||secret.length<32||!same(secret,received))return new Response('Unauthorized',{status:401});
 try{const db=supabaseAdmin(),now=Date.now(),providers=configuredProviders();let processed=0,accepted=0;
 const {data:orgs,error}=await db.from('linkare_subscriptions_v3').select('organization_id').or(`complimentary_access.eq.true,current_period_end.gt.${new Date(now-7*86400000).toISOString()}`).limit(100);if(error)throw error;
 for(const {organization_id:org} of orgs||[]){
  const {data:settings}=await db.from('linkare_records').select('payload').eq('organization_id',org).eq('kind','settings').eq('id','clinic').maybeSingle();
  const {data:appointments}=await db.from('linkare_records').select('id,payload').eq('organization_id',org).eq('kind','appointment').eq('deleted',false).gt('payload->>start',new Date(now).toISOString()).lt('payload->>start',new Date(now+73*3600000).toISOString()).limit(200);
  for(const a of appointments||[]){
   const {data:patient}=await db.from('linkare_records').select('payload').eq('organization_id',org).eq('kind','patient_admin').eq('id',a.payload.patientId).eq('deleted',false).maybeSingle();const prefs=patient?.payload?.notificationPreferences;
   if(!prefs||prefs.enabled===false||prefs.consentStatus!=='granted')continue;
   const eligible=(prefs.reminderHours?.length?prefs.reminderHours:(settings?.payload?.reminderHours||[24,8])).map(Number).filter(h=>[2,8,24,48,72].includes(h)&&now>=Date.parse(a.payload.start)-h*3600000).sort((a,b)=>a-b).slice(0,1);
   for(const hours of eligible){
    for(const channel of prefs.channels||[]){if(!providers[channel as 'email'|'sms'|'whatsapp']||processed>=50)continue;processed++;
     try{const result=await deliverReminder(org,a.id,channel,Number(hours),null);if(!result.duplicate)accepted++;}catch{/* Persisted provider failures are reviewed; no blind resend. */}
    }
   }
  }
  const timezone=Deno.env.get('CLINIC_TIMEZONE')||'America/El_Salvador',day=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}),tomorrow=day.format(new Date(now+30*3600000));const tomorrowAppointments=(appointments||[]).map((r:any)=>r.payload).filter((a:any)=>a.start&&!['cancelled','no_show'].includes(a.status)&&day.format(new Date(a.start))===tomorrow).sort((a:any,b:any)=>Date.parse(a.start)-Date.parse(b.start));
  if(tomorrowAppointments.length){const {data:recipients}=await db.from('linkare_personal_reminder_recipients_v1').select('id,name,destination,channel').eq('organization_id',org).eq('enabled',true).limit(20);const time=new Intl.DateTimeFormat('es-SV',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}),first=time.format(new Date(tomorrowAppointments[0].start)),last=time.format(new Date(tomorrowAppointments.at(-1).end||tomorrowAppointments.at(-1).start));for(const recipient of recipients||[]){if(!providers[recipient.channel as 'email'|'sms'|'whatsapp']||processed>=50)continue;processed++;const message=`Mañana tiene agenda clínica de ${first} a ${last}.`;const key=`${org}:personal:${recipient.id}:${tomorrow}:${recipient.channel}`;const {data:audit,error:reserve}=await db.from('linkare_notification_deliveries').insert({organization_id:org,appointment_id:`personal:${tomorrow}`,channel:recipient.channel,destination:recipient.destination,status:'queued',dedupe_key:key,metadata:{kind:'personal_schedule',date:tomorrow}}).select('id').single();if(reserve?.code==='23505')continue;if(reserve)continue;try{const sent=recipient.channel==='email'?await sendEmail(recipient.destination,'Agenda clínica de mañana',message):await sendWhatsApp(recipient.destination,message);await db.from('linkare_notification_deliveries').update({status:'sent',provider:sent.provider,provider_message_id:sent.id,sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',audit.id);accepted++;}catch{await db.from('linkare_notification_deliveries').update({status:'failed',error_message:'No se pudo confirmar la aceptación del proveedor.',updated_at:new Date().toISOString()}).eq('id',audit.id);}}
  }
 }
 return Response.json({ok:true,processed,accepted},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({ok:false,message:'Dispatcher failed'},{status:503});}
});
