import {jsonResponse,corsHeaders} from '../_shared/cors.ts';
Deno.serve(request=>request.method==='OPTIONS'?new Response('ok',{headers:corsHeaders(request)}):jsonResponse(request,{ok:false,message:'Esta versión del servicio fue retirada. Actualice Linkare.'},410));
