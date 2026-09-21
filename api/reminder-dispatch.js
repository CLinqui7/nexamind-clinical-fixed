export default async function handler(request,response){
 if(request.method!=='GET'&&request.method!=='POST')return response.status(405).json({ok:false});
 const expected=process.env.CRON_SECRET||'';const received=String(request.headers.authorization||'').replace(/^Bearer\s+/i,'');
 if(expected.length<32||received!==expected)return response.status(401).json({ok:false});
 const base=String(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'').replace(/\/$/,'');const dispatcherSecret=process.env.LINKARE_CRON_SECRET||expected;
 if(!base||dispatcherSecret.length<32)return response.status(503).json({ok:false});
 try{const upstream=await fetch(`${base}/functions/v1/reminder-dispatch`,{method:'POST',headers:{Authorization:`Bearer ${dispatcherSecret}`}});const body=await upstream.text();response.status(upstream.status).setHeader('Cache-Control','no-store').send(body);}catch{return response.status(503).json({ok:false});}
}
