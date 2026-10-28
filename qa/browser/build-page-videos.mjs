// This script is confined to the isolated local SQL/QA server. Never point at production.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {defaultPermissions} from '../../src/domain/permissions.js';
import {LEARNING_CHAPTERS} from '../../src/learning-content.js';
const base='http://127.0.0.1:4173',out=path.resolve('public/tutorials/pages'),work=path.resolve('qa/results/page-videos');
await fs.mkdir(out,{recursive:true});await fs.mkdir(work,{recursive:true});
const hash=c=>crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex');
const prior=await fs.readFile(path.join(out,'manifest.json'),'utf8').then(JSON.parse).catch(()=>({chapters:[]}));
const force=(process.env.LINKARE_REBUILD_CHAPTERS||'').split(',');
const pending=LEARNING_CHAPTERS.filter(c=>force.includes(c.id)||!prior.chapters.some(v=>v.id===c.id&&v.sha256===hash(c)));
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
 const scenes=[];
 for(const c of pending){
  const parts=[{title:c.title,text:c.intro},{title:'Cómo llegar y practicar',text:`Abra ${c.view==='login'?'la pantalla de acceso':c.view==='patient'?'Pacientes, seleccione la ficha correcta y la pestaña indicada':c.view==='notebook'?'el expediente y la sección Consultas':c.title}. ${c.exercise}`},...c.controls.map(x=>({title:x.label,text:x.how+' '+x.result})),{title:'Compruebe lo aprendido',text:c.quiz.question+' La respuesta correcta es: '+c.quiz.answers[c.quiz.correct]+'. Puede repetir este capítulo en Ayuda, Escuela completa.'}];
  for(let i=0;i<parts.length;i++)scenes.push({chapter:c.id,index:i,title:parts[i].title,text:parts[i].text,narration:`${i===0?'Capítulo. ':''}${parts[i].title}. ${parts[i].text}`,image:screenshots[c.id],count:parts.length});
 }
 for(const scene of scenes)await fs.rm(path.join(work,`${scene.chapter}-${scene.index}.wav`),{force:true});
 await fs.writeFile(path.join(work,'speech.json'),JSON.stringify(scenes.map(({image,...s})=>({...s,file:path.join(work,`${s.chapter}-${s.index}.wav`)}))));
 const speechScript=path.join(work,'speech.ps1');
 await fs.writeFile(speechScript,`Add-Type -AssemblyName System.Speech\n$s=New-Object System.Speech.Synthesis.SpeechSynthesizer\n$s.SelectVoice('Microsoft Sabina Desktop')\n$s.Rate=0\n$items=Get-Content -LiteralPath $args[0] -Raw -Encoding UTF8 | ConvertFrom-Json\nforeach($item in $items){if(-not(Test-Path -LiteralPath $item.file)){$s.SetOutputToWaveFile($item.file);$s.Speak($item.narration);$s.SetOutputToNull()}}\n$s.Dispose()\n`);
 const spoken=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',speechScript,path.join(work,'speech.json')],{encoding:'utf8'});if(spoken.status!==0)throw Error(spoken.stderr||spoken.stdout);
 const slide=await browser.newPage({viewport:{width:1280,height:720}});
 await slide.setContent(`<!doctype html><html lang="es"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial;background:#edf4fa;color:#123b65}main{width:1280px;height:720px;padding:28px;display:grid;grid-template-rows:50px 1fr 40px;gap:16px}header,footer{display:flex;justify-content:space-between;align-items:center}section{display:grid;grid-template-columns:650px 1fr;gap:24px;min-height:0}img{width:100%;height:100%;object-fit:contain;background:white;border:8px solid white;border-radius:20px}article{padding:28px;background:white;border-radius:20px;display:flex;flex-direction:column;justify-content:center}h1{font-size:29px;line-height:1.2;margin:12px 0 20px}p{font-size:22px;line-height:1.55;margin:0}small{color:#456d89;line-height:1.5}b{font-size:22px}header span{max-width:720px;text-align:right}.number{color:#25758c;font-size:14px;font-weight:bold}</style><main><header><b>Linkare · Escuela completa</b><span></span></header><section><img alt="Pantalla de práctica de Linkare"><article><div class="number"></div><h1></h1><p></p></article></section><footer><small>Datos ficticios · Guía narrada · Pause para leer y practicar</small><small class="page"></small></footer></main>`);
 const duration=buffer=>{let rate=0,size=0;for(let i=12;i+8<=buffer.length;){const id=buffer.toString('ascii',i,i+4),n=buffer.readUInt32LE(i+4);if(id==='fmt ')rate=buffer.readUInt32LE(i+16);if(id==='data')size=n;i+=8+n+(n%2)}if(!rate||!size)throw Error('Invalid speech WAV');return size/rate};
 const ffmpeg=spawnSync('python',['-c','import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'],{encoding:'utf8'}).stdout.trim();
 const manifest=prior.chapters.filter(v=>!pending.some(c=>c.id===v.id));const stamp=s=>new Date(Math.round(s*1000)).toISOString().slice(11,23);
 for(const c of pending){let time=0;const pngs=[],wavs=[],vtt=['WEBVTT',''];const chapterScenes=scenes.filter(s=>s.chapter===c.id);
  for(const scene of chapterScenes){const wav=path.join(work,`${c.id}-${scene.index}.wav`),seconds=duration(await fs.readFile(wav));
   await slide.evaluate(s=>{document.querySelector('header span').textContent=s.chapter;document.querySelector('img').src=s.image;document.querySelector('h1').textContent=s.title;document.querySelector('p').textContent=s.text;document.querySelector('.number').textContent=`LECCIÓN ${s.index+1}`;document.querySelector('.page').textContent=`${s.index+1} / ${s.count}`},scene);
   const overflow=await slide.evaluate(()=>document.querySelector('article').scrollHeight>document.querySelector('article').clientHeight);if(overflow)throw Error('Slide text overflow '+c.id+' '+scene.index);
   const png=path.join(work,`${c.id}-${scene.index}.png`);await slide.screenshot({path:png});pngs.push(`file '${png.replaceAll('\\','/')}'\nduration ${seconds.toFixed(3)}`);wavs.push(`file '${wav.replaceAll('\\','/')}'`);
   const sentences=scene.narration.match(/[^.!?]+[.!?]?/g)||[scene.narration],length=sentences.join('').length;let cursor=time;
   for(const sentence of sentences){const end=cursor+seconds*sentence.length/length;vtt.push(`${stamp(cursor)} --> ${stamp(end)}`,sentence.trim(),'');cursor=end}time+=seconds;
  }
  pngs.push(`file '${path.join(work,`${c.id}-${chapterScenes.length-1}.png`).replaceAll('\\','/')}'`);
  const list=path.join(work,c.id+'-images.txt'),audio=path.join(work,c.id+'-audio.txt');await fs.writeFile(list,pngs.join('\n'));await fs.writeFile(audio,wavs.join('\n'));
  const encoded=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',list,'-f','concat','-safe','0','-i',audio,'-t',String(time),'-vf','fps=2','-c:v','libx264','-preset','fast','-tune','stillimage','-crf','30','-pix_fmt','yuv420p','-c:a','aac','-b:a','48k','-movflags','+faststart',path.join(out,c.id+'.mp4')],{encoding:'utf8'});if(encoded.status!==0)throw Error(encoded.stderr);
  await fs.writeFile(path.join(out,c.id+'.vtt'),vtt.join('\n'));
  manifest.push({id:c.id,title:c.title,controls:c.controls.length,seconds:Math.round(time),bytes:(await fs.stat(path.join(out,c.id+'.mp4'))).size,sha256:crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex')});
  console.log(`VIDEO_OK ${c.id}: ${c.controls.length} controles, ${Math.round(time)} segundos`);
 }
 await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify({version:1,narration:'Español, voz sintética Microsoft Sabina',syntheticData:true,chapters:LEARNING_CHAPTERS.map(c=>manifest.find(v=>v.id===c.id))},null,2));
 console.log('PAGE_VIDEOS_COMPLETE '+manifest.length);
}finally{await browser.close()}
