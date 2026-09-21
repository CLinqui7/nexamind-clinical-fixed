import { permissionAllowed } from '../_shared/permissions.ts';
import {supabaseAdmin} from '../_shared/supabase-admin.ts';
const stamp=(v:unknown)=>new Date(String(v)).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
const esc=(v:unknown)=>String(v||'').replace(/\\/g,'\\\\').replace(/\r?\n|\r/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
Deno.serve(async request=>{
 if(request.method!=='GET')return new Response('Method not allowed',{status:405});
 const token=new URL(request.url).searchParams.get('token');if(!/^[a-f0-9]{64}$/i.test(token||''))return new Response('Not found',{status:404});
 try{const db=supabaseAdmin();const {data:feed,error}=await db.from('calendar_feed_tokens').select('id,organization_id,created_by,scope,patient_id,expires_at').eq('token',token).eq('active',true).maybeSingle();if(error)throw error;
 if(!feed||!feed.expires_at||Date.parse(feed.expires_at)<=Date.now())return new Response('Not found',{status:404});
 const {data:m}=await db.from('organization_members').select('active,role,permissions').eq('organization_id',feed.organization_id).eq('user_id',feed.created_by).maybeSingle();
 if(!m?.active || !permissionAllowed(m,'appointmentsManage'))return new Response('Not found',{status:404});
 const {data:rows,error:e}=await db.from('linkare_records').select('id,payload').eq('organization_id',feed.organization_id).eq('kind','appointment').eq('deleted',false).limit(5000);if(e)throw e;
 const patientIds=[...new Set((rows||[]).map((r:any)=>r.payload?.patientId).filter(Boolean))];let names=new Map<string,string>();if(feed.scope==='doctor_full'&&patientIds.length){const {data:patients}=await db.from('linkare_records').select('id,payload').eq('organization_id',feed.organization_id).eq('kind','patient_admin').in('id',patientIds);names=new Map((patients||[]).map((p:any)=>[p.id,String(p.payload?.name||'Paciente')]));}
 const out=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Linkare//Agenda privada//ES','CALSCALE:GREGORIAN','X-WR-CALNAME:Linkare'];
 for(const row of rows||[]){const a=row.payload;if(!a.start||!a.end||['cancelled','no_show'].includes(a.status)||feed.scope==='patient_own'&&a.patientId!==feed.patient_id)continue;if(!Number.isFinite(Date.parse(a.start))||!Number.isFinite(Date.parse(a.end)))continue;
 const summary=feed.scope==='doctor_full'?`${names.get(a.patientId)||'Paciente'} · ${String(a.type||'Consulta')}`:feed.scope==='patient_own'?'Su cita médica':feed.scope==='family_busy'?'Ocupado':'Consulta';
 out.push('BEGIN:VEVENT',`UID:${esc(row.id)}@linkare`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(a.start)}`,`DTEND:${stamp(a.end)}`,`SUMMARY:${esc(summary)}`,'CLASS:PRIVATE','END:VEVENT');}
 await db.from('calendar_feed_tokens').update({last_used_at:new Date().toISOString()}).eq('id',feed.id);out.push('END:VCALENDAR');return new Response(out.join('\r\n')+'\r\n',{headers:{'Content-Type':'text/calendar; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
 }catch{return new Response('Calendar temporarily unavailable',{status:503});}
});
