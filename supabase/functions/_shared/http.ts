import { corsHeaders,jsonResponse } from './cors.ts';
import { ApiError,safeApiMessage } from './auth.ts';
export function serveAction(name:string,fn:(request:Request,input:any)=>Promise<unknown>){
 Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders(request)});
  if(request.method!=='POST')return jsonResponse(request,{ok:false,message:'Método no permitido.'},405);
  const reference=crypto.randomUUID();
  try{const text=await request.text();if(text.length>262144)throw new ApiError(413,'La solicitud es demasiado grande.');let input;try{input=JSON.parse(text||'{}');}catch{throw new ApiError(400,'Solicitud no válida.');}return jsonResponse(request,await fn(request,input));}
  catch(error){console.error(name,reference,error instanceof Error?error.name:'Error');return jsonResponse(request,{ok:false,message:safeApiMessage(error),reference},error instanceof ApiError?error.status:500);}
 });
}
