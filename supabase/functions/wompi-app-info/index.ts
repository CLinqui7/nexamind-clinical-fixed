import { corsHeaders,jsonResponse } from '../_shared/cors.ts';
import { requireMember,limitAction,ApiError,safeApiMessage } from '../_shared/auth.ts';
import { wompiConfig,wompiRequest } from '../_shared/wompi.ts';
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders(request)});
 if(request.method!=='POST')return jsonResponse(request,{ok:false,message:'Método no permitido.'},405);
 const reference=crypto.randomUUID();
 try{
  const {organizationId}=await request.json();const {user,db}=await requireMember(request,organizationId,'doctor');await limitAction(db,'wompi-status',user.id,120);
  const app=await wompiRequest('/Aplicativo',{method:'GET'},wompiConfig());
  // Do not expose the settlement account, provider keys, or the full provider response.
  return jsonResponse(request,{ok:true,app:{nombre:app.nombre||'Wompi',estaProductivo:app.estaProductivo===true}});
 }catch(error){console.error('wompi-app-info',reference,error instanceof Error?error.name:'error');return jsonResponse(request,{ok:false,message:error instanceof ApiError?safeApiMessage(error):'No se pudo verificar Wompi. Revise las credenciales del servidor.',reference},error instanceof ApiError?error.status:502);}
});
