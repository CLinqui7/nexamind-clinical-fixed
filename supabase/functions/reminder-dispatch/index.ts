import {supabaseAdmin} from '../_shared/supabase-admin.ts';
import {deliverReminder,configuredProviders} from '../_shared/reminders.ts';
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
 }
 return Response.json({ok:true,processed,accepted},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({ok:false,message:'Dispatcher failed'},{status:503});}
});
