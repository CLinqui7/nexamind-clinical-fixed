// This script is confined to the isolated local SQL/QA server. Never point at production.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {defaultPermissions} from '../../src/domain/permissions.js';
import {LEARNING_CHAPTERS} from '../../src/learning-content.js';
import {timedLearningScenes} from '../../src/domain/learning-scenes.js';
const base='http://127.0.0.1:4173',out=path.resolve('public/tutorials/pages'),work=path.resolve('qa/results/page-videos');
await fs.mkdir(out,{recursive:true});await fs.mkdir(work,{recursive:true});
const hash=c=>crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex');
const prior=await fs.readFile(path.join(out,'manifest.json'),'utf8').then(JSON.parse).catch(()=>({chapters:[]}));
const force=(process.env.LINKARE_REBUILD_CHAPTERS||'').split(',');
const pending=LEARNING_CHAPTERS.filter(c=>prior.version!==2||prior.narration!==false||force.includes(c.id)||!prior.chapters.some(v=>v.id===c.id&&v.sha256===hash(c)));
const music=path.resolve('public/tutorials/calm-reading.mp3');
await fs.access(music);
if(!pending.length){console.log('All chapter media current');process.exit(0)}
const browser=await chromium.launch({channel:'msedge',headless:true});
let page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const appCall=async(code,args)=>page.evaluate(async({code,args})=>{
 const root=document.getElementById('root');const rootKey=Object.keys(root).find(k=>k.startsWith('__reactContainer'));
 const todo=[root[rootKey]],seen=new Set();let app;
 while(todo.length){const f=todo.pop();if(!f||seen.has(f))continue;seen.add(f);if(f.stateNode?.openHelp&&f.stateNode?.setView){app=f.stateNode;break}todo.push(f.child,f.sibling,f.alternate,f.stateNode?.current)}
 if(!app)throw Error('QA App fiber not found');return await new Function('app','args',`return (async()=>{${code}})()`)(app,args);
},{code,args});
const shot=async()=>{await page.waitForTimeout(180);await page.evaluate(()=>{const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);while(w.nextNode()){w.currentNode.nodeValue=w.currentNode.nodeValue.replace(/QA Isolated/g,'Consultorio de práctica').replace(/QA Owner/g,'Profesional de ejemplo').replace(/owner@example.invalid/g,'medico@ejemplo.invalid').replace(/Paciente histórico QA/g,'Paciente histórico ficticio')}});return 'data:image/png;base64,'+(await page.screenshot()).toString('base64')};
try{
 await page.goto(base,{waitUntil:'networkidle'});const login=await shot();
 await page.getByLabel('Correo',{exact:true}).fill('owner@example.invalid');await page.locator('input[type=password]').fill('qa-password-123');await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).click();await page.getByRole('button',{name:'Ayuda',exact:true}).waitFor();
 await page.request.post(base+'/__qa',{data:{control:true,seedLegacy:true}});
 await appCall(`const {normalizePatient}=await import('/src/data.js');const p=normalizePatient({id:'tutorial-patient',name:'Paciente ficticio de capacitación',age:35,phone:'70000001',diagnosis:'Ejemplo de capacitación',medications:[{id:'tutorial-med',name:'Medicamento ficticio A',dose:'1 unidad',doseValue:'1',doseUnit:'unidad',frequency:'Horario de ejemplo',route:'otra',startDate:'2026-01-10',status:'active',isPrimary:true}],consultations:[],prescriptions:[],documents:[]});await app.persistDataUpdate({data:{...app.state.data,patients:[...app.state.data.patients.filter(x=>x.id!==p.id),p]}},'Ficha ficticia creada');app.setState({selectedPatientId:p.id,view:'patient',patientTab:'overview'});`);
 const screenshots={acceso:login};
 for(const c of pending.filter(x=>x.view!=='login'&&!['secretaria-ficha','captura'].includes(x.id))){
  if(['patient','notebook'].includes(c.view))await appCall(`await app.openPatient('tutorial-patient');`);
  await appCall(`app.setState({modal:null,appointmentDetails:null,activeEncounter:null,view:args.view==='notebook'?'patient':args.view,selectedPatientId:'tutorial-patient',patientTab:args.tab||'overview'});`,c);
  if(['foxpro','sistema-anterior'].includes(c.id)){await appCall(`await app.openPatient('70000000-0000-5000-8000-000000000002');app.selectPatientTab(app.state.data.patients.find(p=>p.id==='70000000-0000-5000-8000-000000000002'),args.tab);`,c)}
  if(c.id==='ficha')await appCall('app.openNewPatient();');
  if(c.id==='historia-tomas')await appCall(`app.openMedicationCourse(app.state.data.patients.find(p=>p.id==='tutorial-patient'),{name:'Medicamento ficticio A'});`);
  if(c.id==='libreta')await appCall(`app.startConsultationForSelectedPatient();`);
  if(['cita-formulario','cita-detalle'].includes(c.id))await appCall(`app.openNewAppointment(new Date(Date.now()+86400000),'tutorial-patient');`);
  if(c.id==='equipo')await appCall(`app.openSecretary();`);
  if(c.id==='perfil')await appCall(`app.openClinicProfile();`).catch(()=>{});
  if(c.id==='cuenta')await appCall(`app.setState({modal:{type:'account',draft:{currentPassword:'',newPassword:'',confirmPassword:'',showPasswords:false}}});`);
  if(c.id==='informes')await appCall(`app.openReport(app.state.data.patients.find(p=>p.id==='tutorial-patient'));`);
  screenshots[c.id]=await shot();
 }
 if(pending.some(c=>['secretaria-ficha','captura'].includes(c.id))){
  const ownerPage=page;
  await page.request.post(base+'/__qa',{data:{user:'10000000-0000-4000-8000-000000000001',team:true,teamInput:{action:'update',userId:'10000000-0000-4000-8000-000000000005',name:'Secretaría de práctica',role:'secretary',permissions:{...defaultPermissions('secretary'),medicationsCapture:true}}}});
  page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto(base,{waitUntil:'networkidle'});await page.getByLabel('Correo',{exact:true}).fill('secretary@example.invalid');await page.locator('input[type=password]').fill('qa-password-123');await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).click();await page.getByRole('button',{name:'Ayuda',exact:true}).waitFor();
  await appCall(`await app.openPatient('tutorial-patient');`);
  if(pending.some(c=>c.id==='secretaria-ficha'))screenshots['secretaria-ficha']=await shot();
  if(pending.some(c=>c.id==='captura')){await appCall(`app.openMedication(app.state.data.patients.find(p=>p.id==='tutorial-patient'));`);screenshots.captura=await shot();}
  await page.close();page=ownerPage;
 }
 if(errors.length)throw Error('UI errors capturing lessons: '+errors.join('; '));
 const slide=await browser.newPage({viewport:{width:1280,height:720}});
 await slide.setContent(`<!doctype html><html lang="es"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial;background:#edf4fa;color:#123b65}main{width:1280px;height:720px;padding:28px;display:grid;grid-template-rows:50px 1fr 40px;gap:16px}header,footer{display:flex;justify-content:space-between;align-items:center}section{display:grid;grid-template-columns:650px 1fr;gap:24px;min-height:0}img{width:100%;height:100%;object-fit:contain;background:white;border:8px solid white;border-radius:20px}article{padding:28px;background:white;border-radius:20px;display:flex;flex-direction:column;justify-content:center}h1{font-size:29px;line-height:1.2;margin:12px 0 20px}p{font-size:22px;line-height:1.55;margin:0}small{color:#456d89;line-height:1.5}b{font-size:22px}header span{max-width:720px;text-align:right}.number{color:#25758c;font-size:14px;font-weight:bold}</style><main><header><b>Linkare · Escuela completa</b><span></span></header><section><img alt="Pantalla de práctica de Linkare"><article><div class="number"></div><h1></h1><p></p></article></section><footer><small>Datos ficticios · Texto y música instrumental · Pause para leer y practicar</small><small class="page"></small></footer></main>`);
 const ffmpeg=spawnSync('python',['-c','import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'],{encoding:'utf8'}).stdout.trim();
 const manifest=prior.chapters.filter(v=>!pending.some(c=>c.id===v.id));const stamp=s=>new Date(Math.round(s*1000)).toISOString().slice(11,23);
 for(const c of pending){const pngs=[],vtt=['WEBVTT',''];const chapterScenes=timedLearningScenes(c).map((s,index)=>({...s,index,chapter:c.title,image:screenshots[c.id],count:timedLearningScenes(c).length}));const time=chapterScenes.at(-1).end;
  for(const scene of chapterScenes){const seconds=scene.end-scene.start;
   await slide.evaluate(s=>{document.querySelector('header span').textContent=s.chapter;document.querySelector('img').src=s.image;document.querySelector('h1').textContent=s.title;document.querySelector('p').textContent=s.text;document.querySelector('.number').textContent=`LECCIÓN ${s.index+1}`;document.querySelector('.page').textContent=`${s.index+1} / ${s.count}`},scene);
   const overflow=await slide.evaluate(()=>document.querySelector('article').scrollHeight>document.querySelector('article').clientHeight);if(overflow)throw Error('Slide text overflow '+c.id+' '+scene.index);
   const png=path.join(work,`${c.id}-${scene.index}.png`);await slide.screenshot({path:png});pngs.push(`file '${png.replaceAll('\\','/')}'\nduration ${seconds.toFixed(3)}`);
   const copy=scene.title+'. '+scene.text;const sentences=copy.match(/[^.!?]+[.!?]?/g)||[copy],length=sentences.join('').length;let cursor=scene.start;
   for(const sentence of sentences){const end=cursor+seconds*sentence.length/length;vtt.push(`${stamp(cursor)} --> ${stamp(end)}`,sentence.trim(),'');cursor=end}
  }
  pngs.push(`file '${path.join(work,`${c.id}-${chapterScenes.length-1}.png`).replaceAll('\\','/')}'`);
  const list=path.join(work,c.id+'-images.txt');await fs.writeFile(list,pngs.join('\n'));
  const encoded=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',list,'-stream_loop','-1','-i',music,'-t',String(time),'-vf','fps=2','-c:v','libx264','-preset','fast','-tune','stillimage','-crf','30','-pix_fmt','yuv420p','-af',`afade=t=in:st=0:d=1.5,afade=t=out:st=${time-1.5}:d=1.5`,'-c:a','aac','-b:a','64k','-movflags','+faststart',path.join(out,c.id+'.mp4')],{encoding:'utf8'});if(encoded.status!==0)throw Error(encoded.stderr);
  await fs.writeFile(path.join(out,c.id+'.vtt'),vtt.join('\n'));
  await fs.writeFile(path.join(out,c.id+'.json'),JSON.stringify({id:c.id,title:c.title,scenes:chapterScenes.map(({image,narration,chapter,index,count,...s})=>s)},null,2));
  manifest.push({id:c.id,title:c.title,controls:c.controls.length,scenes:chapterScenes.length,seconds:Math.round(time),bytes:(await fs.stat(path.join(out,c.id+'.mp4'))).size,sha256:crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex')});
  console.log(`VIDEO_OK ${c.id}: ${c.controls.length} controles, ${Math.round(time)} segundos`);
 }
 await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify({version:2,mode:'reading-music',narration:false,readingWpm:135,music:{file:'/tutorials/calm-reading.mp3',original:true,sha256:crypto.createHash('sha256').update(await fs.readFile(music)).digest('hex')},syntheticData:true,chapters:LEARNING_CHAPTERS.map(c=>manifest.find(v=>v.id===c.id))},null,2));
 console.log('PAGE_VIDEOS_COMPLETE '+manifest.length);
}finally{await browser.close()}
