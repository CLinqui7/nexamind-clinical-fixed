import { supabaseAdmin } from '../_shared/supabase-admin.ts';
import { verifyWompiWebhook } from '../_shared/wompi.ts';
Deno.serve(async request=>{
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 if(Number(request.headers.get('content-length')||0)>131072)return new Response('Too large',{status:413});
 const raw=await request.text();if(raw.length>131072)return new Response('Too large',{status:413});
 const secret=Deno.env.get('WOMPI_CLIENT_SECRET')||'';const appId=Deno.env.get('WOMPI_CLIENT_ID')||'';
 if(!secret||!appId)return new Response('Not configured',{status:503});
 if(!await verifyWompiWebhook(raw,request.headers.get('wompi_hash'),secret))return new Response('Invalid signature',{status:401});
 try{
  const p=JSON.parse(raw);
  if(String(p.Aplicativo?.Id||p.aplicativo?.id||'')!==appId)return new Response('Wrong application',{status:400});
  if(String(p.ResultadoTransaccion||p.resultadoTransaccion||'').toLowerCase()!=='exitosaaprobada')return new Response('Ignored',{status:200});
  if((p.EsProductiva??p.esProductiva)!==true)return new Response('Not a live payment',{status:400});
  const ref=p.EnlacePago?.IdentificadorEnlaceComercio||p.enlacePago?.identificadorEnlaceComercio;
  if(!String(ref||'').startsWith('LINKARE-'))return new Response('Unsupported reference; reconcile legacy payment manually',{status:409});
  const amount=Number(p.Monto??p.monto);const cents=Math.round(amount*100);
  if(!Number.isFinite(amount)||amount<=0||Math.abs(cents/100-amount)>0.00001)return new Response('Invalid amount',{status:400});
  const date=p.FechaTransaccion||p.fechaTransaccion;if(!date||!Number.isFinite(Date.parse(date)))return new Response('Invalid date',{status:400});
  const {data,error}=await supabaseAdmin().rpc('linkare_confirm_payment_v3',{ref,transaction_ref:p.IdTransaccion||p.idTransaccion,amount:cents,productive:true,event_date:date});
  if(error){console.error('webhook-rejected',error.code);return new Response('Payment verification pending',{status:409});}
  return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 }catch{return new Response('Invalid event',{status:400});}
});
