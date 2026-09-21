// Isolated browser adapter; this file is never part of the production build.
const storage='linkare-isolated-qa-session';
const identities={owner:'10000000-0000-4000-8000-000000000001',other:'10000000-0000-4000-8000-000000000002',doctor:'10000000-0000-4000-8000-000000000003',nurse:'10000000-0000-4000-8000-000000000004',secretary:'10000000-0000-4000-8000-000000000005'};
const callbacks=[];
const session=()=>JSON.parse(localStorage.getItem(storage)||'null');
async function query(body){const s=session();return (await fetch('/__qa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,user:s?.user?.id})})).json();}
class Query{constructor(table){this.table=table;}select(){return this;}insert(value){this.inserted=value;return this;}eq(){return this;}order(){return this;}limit(){return this;}maybeSingle(){this.single=true;return this;}then(resolve,reject){return query({table:this.table,single:this.single,insert:this.inserted}).then(resolve,reject);}}
export function createClient(){return {
 auth:{getSession:async()=>({data:{session:session()},error:null}),getUser:async()=>({data:{user:session()?.user},error:null}),onAuthStateChange(cb){callbacks.push(cb);return {data:{subscription:{unsubscribe(){}}}};},
 signInWithPassword:async({email,password})=>{if(password!=='qa-password-123')return {error:{message:'Invalid login credentials'}};const user={id:identities[email.split('@')[0]],email,email_confirmed_at:'2026-09-01'};const s={user,access_token:'qa-token'};localStorage.setItem(storage,JSON.stringify(s));return {data:{session:s},error:null};},
 signOut:async()=>{localStorage.removeItem(storage);callbacks.forEach(cb=>cb('SIGNED_OUT'));return {error:null};},updateUser:async()=>({error:null})},
 rpc:async(name,args)=>query({name,args}),from:table=>new Query(table),functions:{invoke:async(name)=>name==='linkare-team'?query({team:true}):({data:name==='calendar-status'?{ok:true,status:{google:{connected:false},apple:{connected:false}}}:{ok:true,providers:{email:false,sms:false,whatsapp:false}},error:null})},
 storage:{from:()=>({upload:async(path)=>query({storage:true,path}),createSignedUrl:async()=>({data:{signedUrl:'/qa.pdf'},error:null})})}
};}
