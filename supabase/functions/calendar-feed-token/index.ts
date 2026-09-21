import {serveAction} from '../_shared/http.ts';
import {ApiError,requireMember,limitAction} from '../_shared/auth.ts';
serveAction('calendar-feed-token',async(request,{organizationId,action,scope='staff_busy',patientId,label,tokenId})=>{
 const {db,user,doctor}=await requireMember(request,organizationId,'appointmentsManage');await limitAction(db,'calendar-token',user.id,30);
 if(!['doctor_full','staff_busy','family_busy','patient_own'].includes(scope))throw new ApiError(400,'Alcance de calendario no válido.');
 if(['doctor_full','family_busy'].includes(scope)&&!doctor)throw new ApiError(403,'Este calendario solo puede crearlo el médico.');
 if(scope==='patient_own'){
  if(!/^[A-Za-z0-9._:-]{1,160}$/.test(patientId||''))throw new ApiError(400,'Paciente no válido.');
  const {data:patient}=await db.from('linkare_records').select('id').eq('organization_id',organizationId).eq('kind','patient_admin').eq('id',patientId).eq('deleted',false).maybeSingle();if(!patient)throw new ApiError(404,'Paciente no encontrado.');
 }else patientId=null;
 const base=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'');
 if(action==='list'){const {data,error}=await db.from('calendar_feed_tokens').select('id,scope,patient_id,label,active,created_at,expires_at,revoked_at,last_used_at').eq('organization_id',organizationId).eq('created_by',user.id).order('created_at',{ascending:false});if(error)throw error;return {ok:true,feeds:data||[]};}
 if(action==='revoke'){const {data,error}=await db.from('calendar_feed_tokens').update({active:false,revoked_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('created_by',user.id).eq('id',String(tokenId||'')).select('id').maybeSingle();if(error)throw error;if(data)await db.from('linkare_audit_v3').insert({organization_id:organizationId,actor_id:user.id,action:'calendar.feed_revoked',kind:'calendar_feed',record_id:data.id});return {ok:true,feedUrl:''};}
 let previous:any=null;if(action==='rotate'){const query=db.from('calendar_feed_tokens').select('id').eq('organization_id',organizationId).eq('created_by',user.id).eq('scope',scope).eq('active',true);if(patientId)query.eq('patient_id',patientId);else query.is('patient_id',null);const found=await query.order('created_at',{ascending:false}).limit(1).maybeSingle();previous=found.data;if(previous)await db.from('calendar_feed_tokens').update({active:false,revoked_at:new Date().toISOString()}).eq('id',previous.id);}
 let query=db.from('calendar_feed_tokens').select('id,token,expires_at').eq('organization_id',organizationId).eq('created_by',user.id).eq('scope',scope).eq('active',true).gt('expires_at',new Date().toISOString());if(patientId)query=query.eq('patient_id',patientId);else query=query.is('patient_id',null);let {data:row,error}=await query.order('created_at',{ascending:false}).limit(1).maybeSingle();if(error)throw error;
 if(!row){const result=await db.from('calendar_feed_tokens').insert({organization_id:organizationId,created_by:user.id,scope,patient_id:patientId,label:String(label||'').trim().slice(0,120)||null,expires_at:new Date(Date.now()+90*86400000).toISOString(),rotated_from:previous?.id||null}).select('id,token,expires_at').single();if(result.error)throw result.error;row=result.data;await db.from('linkare_audit_v3').insert({organization_id:organizationId,actor_id:user.id,action:previous?'calendar.feed_rotated':'calendar.feed_created',kind:'calendar_feed',record_id:row.id});}
 return {ok:true,id:row.id,expiresAt:row.expires_at,feedUrl:`${base}/functions/v1/calendar-feed?token=${row.token}`};
});
