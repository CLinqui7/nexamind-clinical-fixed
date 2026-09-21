import {serveAction} from '../_shared/http.ts';
import {ApiError,publicKey,requireMember,limitAction} from '../_shared/auth.ts';
import {sendWhatsApp} from '../_shared/reminders.ts';

serveAction('send-daily-agenda',async(request,input)=>{
 const {user,db}=await requireMember(request,input.organizationId,'clinicalView');
 const {doctor}=await requireMember(request,input.organizationId,'appointmentsManage');
 if(!doctor)throw new ApiError(403,'Solo el médico puede enviar su agenda clínica.');
 await limitAction(db,'daily-agenda',user.id,10);
 const date=String(input.date||new Date().toISOString().slice(0,10));
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new ApiError(400,'Fecha no válida.');
 const auth=request.headers.get('Authorization')||'';const base=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'');const key=publicKey();
 const response=await fetch(`${base}/rest/v1/rpc/linkare_daily_agenda_v1`,{method:'POST',headers:{Authorization:auth,apikey:key,'Content-Type':'application/json'},body:JSON.stringify({org:input.organizationId,agenda_date:date})});
 if(!response.ok)throw new ApiError(403,'No se pudo generar la agenda autorizada.');
 const agenda=await response.json();
 const {data:member}=await db.from('organization_members').select('phone').eq('organization_id',input.organizationId).eq('user_id',user.id).eq('active',true).maybeSingle();
 const destination=String(member?.phone||'').trim();if(!/^\+[1-9]\d{7,14}$/.test(destination.replace(/[ ()-]/g,'')))throw new ApiError(400,'Registre su WhatsApp con código de país en el perfil del equipo.');
 const lines=(agenda.items||[]).map((item:any)=>`${new Intl.DateTimeFormat('es-SV',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:agenda.timezone||'America/El_Salvador'}).format(new Date(item.start))} · ${item.patientName} · ${item.currentMedication?`${item.currentMedication.name} ${item.currentMedication.dose||''}`:'Sin tratamiento activo'}${item.relevantNote?` · ${item.relevantNote}`:''}`);
 const message=`Agenda clínica ${date}\n${lines.length?lines.join('\n'):'Sin citas programadas.'}`.slice(0,3900);
 const dedupe=`${input.organizationId}:${user.id}:${destination}:whatsapp:daily_agenda:${date}`;
 const {data:delivery,error}=await db.from('linkare_notification_deliveries').insert({organization_id:input.organizationId,channel:'whatsapp',destination,status:'queued',dedupe_key:dedupe,created_by:user.id,message_preview:`Agenda clínica ${date}`,metadata:{type:'daily_agenda',date,recipientUserId:user.id}}).select('id').single();
 if(error){if(error.code==='23505')return {ok:true,duplicate:true,message:'La agenda de esta fecha ya fue procesada.'};throw error;}
 try{const sent=await sendWhatsApp(destination,message);await db.from('linkare_notification_deliveries').update({status:'sent',provider:sent.provider,provider_message_id:sent.id,sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',delivery.id);await db.from('linkare_audit_v3').insert({organization_id:input.organizationId,actor_id:user.id,action:'daily_agenda.sent',kind:'daily_agenda',record_id:date});return {ok:true,status:'accepted',deliveryId:delivery.id};}
 catch(_){await db.from('linkare_notification_deliveries').update({status:'failed',error_message:'No se confirmó la aceptación del proveedor.',updated_at:new Date().toISOString()}).eq('id',delivery.id);throw new ApiError(502,'No se pudo confirmar el envío. Revise el proveedor antes de repetirlo.');}
});
