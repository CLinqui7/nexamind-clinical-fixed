export function corsHeaders(request:Request){
 const origin=request.headers.get('origin')?.trim()||'';
 const allowed=(Deno.env.get('CORS_ORIGINS')||Deno.env.get('APP_PUBLIC_URL')||'https://nexamind-clinical.vercel.app').split(',').map(s=>s.trim().replace(/\/+$/,''));
 return {
  ...(origin && allowed.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Max-Age':'600','Vary':'Origin',
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
 };
}
export function jsonResponse(request:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:corsHeaders(request)});}
