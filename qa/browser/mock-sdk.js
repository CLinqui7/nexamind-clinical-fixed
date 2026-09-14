// Test-only adapter. Not imported by the production entry or included in dist.
import {createSeedData} from '/qa/fixtures/legacy-data.js';
import {projectRecords,recordKey} from '/src/domain/records.js';
const ORG='11111111-1111-4111-8111-111111111111',DOCTOR='22222222-2222-4222-8222-222222222222',SECRETARY='33333333-3333-4333-8333-333333333333';
const q=window.__QA={calls:[],session:null,role:'doctor',callbacks:[],failSave:false};
function member(role){return {id:role==='doctor'?DOCTOR:SECRETARY,name:role==='doctor'?'Dra. Prueba QA':'Secretaría QA',email:role+'@example.invalid',role,active:true,title:role==='doctor'?'Psiquiatra':'Secretaría',permissions:{patientsView:true,patientsCreate:true,patientsEdit:true,appointmentsManage:true,remindersManage:true}};}
let initial=createSeedData();initial.users=[member('doctor'),member('secretary')];initial.organization={...initial.organization,name:'Consultorio QA',clinician:'Dra. Prueba QA',email:'doctor@example.invalid'};initial.patients=initial.patients.slice(0,2);initial.appointments=initial.appointments.filter(a=>initial.patients.some(p=>p.id===a.patientId));initial.patients[0].consultations=[{id:'signed-note',patientId:'p1',status:'completed',title:'Nota firmada QA',startedAt:'2026-09-07T12:00:00Z',endedAt:'2026-09-07T12:30:00Z',signedAt:'2026-09-07T12:30:00Z',signedBy:DOCTOR,freeNotes:'Contenido completo protegido de la nota firmada',clinicalImpression:'Resumen de prueba',plan:'Plan documentado',durationMinutes:30}];initial.settings.activeUserId=DOCTOR;
let records=projectRecords(initial,true),revisions=new Map([...records.keys()].map(k=>[k,1]));q.saved=records;
const invited=[];
function payload(){const med=q.role==='doctor';const user=member(q.role);let d={organization:initial.organization,settings:{...initial.settings,activeUserId:user.id},users:med?[member('doctor'),member('secretary')]:[user],patients:[],appointments:[],alerts:[],payments:[]};for(const r of records.values()){if(r.kind==='patient_admin')d.patients.push({...r.payload,...(med?records.get('patient_clinical:'+r.id)?.payload:{})});if(r.kind==='appointment')d.appointments.push({...r.payload,...(med?records.get('appointment_clinical:'+r.id)?.payload:{})});if(med&&r.kind==='alert')d.alerts.push(r.payload);}return d;}
const plans=[{code:'monthly',name:'Profesional mensual',amount_cents:4000,months:1,currency:'USD'},{code:'semiannual',name:'Profesional semestral',amount_cents:22000,months:6,currency:'USD'},{code:'annual',name:'Profesional anual',amount_cents:40000,months:12,currency:'USD'}];
class Query{
 constructor(table){this.table=table;this.isSingle=false;}select(){return this}eq(){return this}order(){return this}limit(){return this}maybeSingle(){this.isSingle=true;return this}single(){this.isSingle=true;return this}insert(row){q.calls.push({table:this.table,insert:row});return this}upsert(){return this}then(resolve,reject){let data=this.table==='linkare_plans_v3'?plans:this.table==='linkare_orders_v3'?(q.orders||[]):this.table==='linkare_subscriptions_v3'?{plan_code:'annual',current_period_start:'2026-01-01T00:00:00Z',current_period_end:'2027-01-01T00:00:00Z'}:this.isSingle?null:[];return Promise.resolve({data,error:null}).then(resolve,reject);}
}
export function createClient(){return {
 auth:{getSession:async()=>({data:{session:q.session},error:null}),getUser:async()=>({data:{user:q.session?.user},error:null}),
 onAuthStateChange(cb){q.callbacks.push(cb);return {data:{subscription:{unsubscribe(){}}}};},
 signInWithPassword:async({email,password})=>{q.calls.push({auth:'login',email});if(password==='invalid-password')return {data:{session:null},error:{message:'Invalid login credentials'}};q.role=email.startsWith('secretary')?'secretary':'doctor';q.session={access_token:'qa-only-token',user:{id:member(q.role).id,email,email_confirmed_at:'2026-09-01'}};return {data:{session:q.session},error:null};},
 signUp:async args=>{q.calls.push({auth:'signup',email:args.email,metadata:args.options.data});return {data:{user:{id:DOCTOR},session:null},error:null};},
 resetPasswordForEmail:async(email)=>{q.calls.push({auth:'recover',email});return {error:null};},
 resend:async()=>({error:null}),updateUser:async()=>({error:null}),signOut:async()=>{q.session=null;q.callbacks.forEach(cb=>cb('SIGNED_OUT'));return {error:null};}},
 rpc:async(name,args)=>{q.calls.push({rpc:name,args:structuredClone(args)});
 if(name==='linkare_bootstrap_v3')return {data:ORG,error:null};
 if(name==='linkare_load_state_v3')return {data:{organizationId:ORG,userId:member(q.role).id,memberRole:q.role,entitled:true,payload:payload(),revisions:[...revisions].map(([k,v])=>({kind:k.split(':')[0],id:k.slice(k.indexOf(':')+1),revision:v}))},error:null};
 if(name==='linkare_save_changes_v3'){
  if(q.failSave)return {data:null,error:{message:'REVISION_CONFLICT',code:'40001'}};
  const out=[];for(const change of args.changes){const key=recordKey(change.kind,change.id);const prev=revisions.get(key)||0;if(change.expectedRevision!==prev)return {data:null,error:{message:'REVISION_CONFLICT',code:'40001'}};revisions.set(key,prev+1);if(change.deleted)records.delete(key);else records.set(key,structuredClone(change));out.push({kind:change.kind,id:change.id,revision:prev+1});}return {data:out,error:null};
 }
 return {data:null,error:{message:'Unknown RPC '+name}};
 },
 from:table=>new Query(table),
 functions:{invoke:async(name,{body}={})=>{q.calls.push({fn:name,body:structuredClone(body)});if(name==='linkare-team')return {data:body.action==='list'?{ok:true,users:[member('doctor'),member('secretary')],invitations:invited}:body.action==='invite'?(invited.push({id:'invite',email:body.email,display_name:body.name,status:'pending',delivery_status:'sent',expires_at:'2026-09-20'}),{ok:true}):{ok:true},error:null};
 if(name==='calendar-status')return {data:{ok:true,status:{google:{connected:false},apple:{connected:false}}},error:null};
 if(name==='reminder-provider-status')return {data:{ok:true,providers:{email:false,sms:false,whatsapp:false}},error:null};
 if(name==='wompi-app-info')return {data:{ok:true,app:{nombre:'Comercio QA',estaProductivo:true}},error:null};
 if(name==='wompi-create-link'){const p=plans.find(p=>p.code===body.planCode);q.orders=[{id:'order',...p,plan_name:p.name,plan_code:p.code,status:'pending',created_at:new Date().toISOString(),payment_url:'https://s.wompi.sv/qa-only',is_test:false}];return {data:{ok:true,payment:{url:'https://s.wompi.sv/qa-only',amount:p.amount_cents/100,currency:'USD',productive:true}},error:null};}
 return {data:{ok:false,message:'Not available in isolated QA'},error:null};}},
 storage:{from:()=>({upload:async()=>({error:null}),createSignedUrl:async()=>({data:{signedUrl:'http://127.0.0.1:4388/qa/mock.pdf'},error:null})})}
};}
