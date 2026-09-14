import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { ApiError, requireMember, publicKey, limitAction, safeApiMessage } from '../_shared/auth.ts';
import { corsHeaders,jsonResponse } from '../_shared/cors.ts';
const ADMIN_PERMISSIONS=['patientsView','patientsCreate','patientsEdit','appointmentsManage','remindersManage'];
const clean=(s:unknown,max=160)=>String(s||'').trim().slice(0,max);
function permissions(value:any){return Object.fromEntries(ADMIN_PERMISSIONS.map(k=>[k,value?.[k]!==false]));}
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders(request)});
 if(request.method!=='POST')return jsonResponse(request,{ok:false,message:'Método no permitido.'},405);
 const reference=crypto.randomUUID();
 try{
  if(Number(request.headers.get('content-length')||0)>16384)throw new ApiError(413,'Solicitud demasiado grande.');
  const raw=await request.text();if(raw.length>16384)throw new ApiError(413,'Solicitud demasiado grande.');const input=JSON.parse(raw);const {user,db}=await requireMember(request,input.organizationId,'doctor');
  const org=input.organizationId;const action=input.action;
  if(action==='list'){
   const {data:members,error}=await db.from('organization_members').select('user_id,display_name,role,active,professional_title,phone,permissions').eq('organization_id',org);
   if(error)throw error;
   const users=await Promise.all((members||[]).map(async m=>{const {data}=await db.auth.admin.getUserById(m.user_id);return {id:m.user_id,name:m.display_name,email:data.user?.email||'',role:['owner','doctor','psychiatrist'].includes(m.role)?'doctor':'secretary',active:m.active,title:m.professional_title,phone:m.phone,permissions:m.permissions};}));
   const {data:invitations,error:e}=await db.from('linkare_invites_v3').select('id,email,display_name,status,delivery_status,expires_at,created_at').eq('organization_id',org).eq('status','pending');if(e)throw e;
   return jsonResponse(request,{ok:true,users,invitations});
  }
  await limitAction(db,'team',user.id,30);
  if(action==='invite'||action==='resend'){
   const email=clean(input.email,254).toLowerCase();const name=clean(input.name);
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name)throw new ApiError(400,'Complete el nombre y un correo válido.');
   if(email===user.email?.toLowerCase())throw new ApiError(400,'No puede invitarse a sí mismo.');
   const {data:existing,error:findError}=await db.from('linkare_invites_v3').select('*').eq('email',email).eq('status','pending').maybeSingle();if(findError)throw findError;
   if(existing && existing.organization_id!==org)throw new ApiError(409,'No se puede emitir una invitación para ese correo en este momento.');
   const availability=await db.rpc('linkare_invite_email_available_v3',{candidate:email});
   if(availability.error)throw availability.error;
   if(availability.data!==true)throw new ApiError(409,'Este correo ya pertenece a un consultorio. Use su acceso existente o contacte a soporte.');
   let invite=existing;
   if(!invite){const {data,error}=await db.from('linkare_invites_v3').insert({organization_id:org,email,display_name:name,permissions:permissions(input.permissions),invited_by:user.id}).select().single();if(error)throw new ApiError(409,'No se pudo reservar la invitación. Actualice el equipo y vuelva a intentarlo.');invite=data;}
   else{const {error}=await db.from('linkare_invites_v3').update({expires_at:new Date(Date.now()+7*86400000).toISOString(),delivery_status:'pending'}).eq('id',invite.id);if(error)throw error;}
   const redirectTo=(Deno.env.get('APP_PUBLIC_URL')||'').replace(/\/+$/,'')+'/?auth=invite';
   const {error:sendError}=await db.auth.admin.inviteUserByEmail(email,{redirectTo,data:{full_name:name}});
   let deliveryError=sendError;
   if(sendError && /already|registered|exists/i.test(sendError.message)){
    const client=createClient(Deno.env.get('SUPABASE_URL')||'',publicKey(),{auth:{persistSession:false,autoRefreshToken:false}});
    const r=await client.auth.resetPasswordForEmail(email,{redirectTo});deliveryError=r.error;
   }
   await db.from('linkare_invites_v3').update({delivery_status:deliveryError?'failed':'sent'}).eq('id',invite.id);
   if(deliveryError)throw new ApiError(502,'La invitación quedó pendiente, pero el correo no pudo enviarse. Configure SMTP y use Reenviar.');
   await db.from('linkare_audit_v3').insert({organization_id:org,actor_id:user.id,action:'team.invited',record_id:invite.id});
   return jsonResponse(request,{ok:true,message:'Invitación enviada. La persona elegirá su propia contraseña.'});
  }
  if(action==='revoke'){
   const {error}=await db.from('linkare_invites_v3').update({status:'revoked'}).eq('id',input.inviteId).eq('organization_id',org).eq('status','pending');if(error)throw error;
   return jsonResponse(request,{ok:true});
  }
  if(action==='update'||action==='toggle'){
   if(input.userId===user.id)throw new ApiError(400,'No puede modificar su propio rol desde esta pantalla.');
   const {data:member}=await db.from('organization_members').select('id,role,active').eq('organization_id',org).eq('user_id',input.userId).maybeSingle();
   if(!member||member.role!=='secretary')throw new ApiError(403,'Solo puede administrar usuarios de secretaría de su consultorio.');
   const changes: Record<string,unknown>=action==='toggle'?{active:!member.active}:{display_name:clean(input.name),professional_title:clean(input.title)||'Secretaría',phone:clean(input.phone,40),permissions:permissions(input.permissions)};
   if(action==='update'&&!changes.display_name)throw new ApiError(400,'Indique un nombre.');
   const {error}=await db.from('organization_members').update(changes).eq('id',member.id);if(error)throw error;
   await db.from('linkare_audit_v3').insert({organization_id:org,actor_id:user.id,action:'team.'+action,record_id:member.id});
   return jsonResponse(request,{ok:true});
  }
  throw new ApiError(400,'Acción no válida.');
 }catch(error){console.error('linkare-team',reference,error instanceof Error?error.name:'error');return jsonResponse(request,{ok:false,message:safeApiMessage(error),reference},error instanceof ApiError?error.status:500);}
});
