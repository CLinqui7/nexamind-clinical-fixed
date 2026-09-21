import { corsHeaders,jsonResponse } from '../_shared/cors.ts';
import { requireMember,limitAction,ApiError,safeApiMessage } from '../_shared/auth.ts';
import { wompiConfig,wompiRequest } from '../_shared/wompi.ts';
function payment(o:any){return {id:o.id,url:o.payment_url,qrUrl:o.qr_url,amount:o.amount_cents/100,currency:o.currency,productive:!o.is_test};}
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders(request)});
 if(request.method!=='POST')return jsonResponse(request,{ok:false,message:'Método no permitido.'},405);
 const reference=crypto.randomUUID();let reservedId:string|null=null;
 try{
  const {organizationId,planCode}=await request.json();const {user,db}=await requireMember(request,organizationId,'owner');await limitAction(db,'checkout',user.id,20);
  if(!['monthly','semiannual','annual'].includes(planCode))throw new ApiError(400,'Seleccione un plan válido.');
  const config=wompiConfig();
  const info=await wompiRequest('/Aplicativo',{method:'GET'},config);
  if(info.estaProductivo!==true)throw new ApiError(503,'El comercio aún no está habilitado para cobros en vivo.');
  const {data:reservation,error}=await db.rpc('linkare_reserve_order_v3',{org:organizationId,payer:user.id,selected_plan:planCode});
  if(error){const message=error.message.includes('PENDING_DIFFERENT_PLAN')?'Ya existe una orden pendiente con otra modalidad. Revísela antes de generar un nuevo cobro.':'Ya hay una solicitud de pago en curso o pendiente de revisión. No se generará un cobro duplicado.';throw new ApiError(409,message);}
  const order=reservation.order;
  if(reservation.existing)return jsonResponse(request,{ok:true,existing:true,reference:order.external_reference,payment:payment(order)});
  reservedId=order.id;
  // The amount, duration, and reference come only from the immutable server order.
  const body={identificadorEnlaceComercio:order.external_reference,monto:order.amount_cents/100,nombreProducto:order.plan_name,
   infoProducto:{descripcionProducto:`Acceso a Linkare durante ${order.months} mes(es). Renovación manual.`},
   configuracion:{urlRedirect:config.appPublicUrl+'/?payment=return',urlRetorno:config.appPublicUrl,urlWebhook:(Deno.env.get('SUPABASE_URL')||'')+'/functions/v1/wompi-webhook',emailsNotificacion:config.notificationEmail||user.email,notificarTransaccionCliente:true,esMontoEditable:false,esCantidadEditable:false,cantidadPorDefecto:1},
   limitesDeUso:{cantidadMaximaPagosExitosos:1,cantidadMaximaPagosFallidos:5}};
  const response=await wompiRequest('/EnlacePago',{method:'POST',body:JSON.stringify(body)},config);
  const url=new URL(String(response.urlEnlace||''));
  if(url.protocol!=='https:' || !['wompi.sv','s.wompi.sv','pagos.wompi.sv'].includes(url.hostname) || response.estaProductivo!==true)throw new Error('Invalid provider checkout response');
  const update={status:'pending',payment_link_id:String(response.idEnlace),payment_url:url.href,qr_url:response.urlQrCodeEnlace||null,is_test:false,updated_at:new Date().toISOString()};
  const {error:updateError}=await db.from('linkare_orders_v3').update(update).eq('id',order.id).eq('status','creating');if(updateError)throw updateError;
  return jsonResponse(request,{ok:true,reference:order.external_reference,payment:payment({...order,...update})});
 }catch(error){
  // A timeout could have created a link at the provider. Do not automatically create another.
  if(reservedId){try{const {supabaseAdmin}=await import('../_shared/supabase-admin.ts');await supabaseAdmin().from('linkare_orders_v3').update({status:'review',updated_at:new Date().toISOString()}).eq('id',reservedId).eq('status','creating');}catch{}}
  console.error('wompi-create-link',reference,error instanceof Error?error.name:'error');
  return jsonResponse(request,{ok:false,message:error instanceof ApiError?safeApiMessage(error):'No se pudo confirmar la creación del enlace. La orden quedó para revisión; no repita un pago sin comprobarla.',reference},error instanceof ApiError?error.status:502);
 }
});
