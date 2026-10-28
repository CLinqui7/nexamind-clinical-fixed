import React from 'react';
import htm from 'htm';
import {LEARNING_CHAPTERS,chapterComplete} from './learning-content.js';
import {LearningVideo} from './learning-video.js';
const html=htm.bind(React.createElement);

export function LearningCenter({initialId,identity='public',can=()=>true,onNavigate,onPractice,allowedIds}){
  const chapters=LEARNING_CHAPTERS.filter(c=>(!allowedIds||allowedIds.includes(c.id))&&(!c.permission||can(c.permission)));
  const [selected,setSelected]=React.useState(initialId||chapters[0]?.id);
  const [query,setQuery]=React.useState('');
  const [step,setStep]=React.useState(0);
  const [mode,setMode]=React.useState('lesson');
  const key=`linkare-learning-v1:${identity}`;
  const [progress,setProgress]=React.useState(()=>{try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return {}}});
  const [answer,setAnswer]=React.useState(null);
  const [feedback,setFeedback]=React.useState('');
  const [storageError,setStorageError]=React.useState(false);
  const chapter=chapters.find(c=>c.id===selected)||chapters[0];
  if(!chapter)return html`<p>No hay capítulos disponibles para estos permisos.</p>`;
  const state=progress[chapter.id]||{},control=chapter.controls[step]||chapter.controls[0];
  const update=patch=>setProgress(previous=>{const next={...previous,[chapter.id]:{...(previous[chapter.id]||{}),...patch}};try{localStorage.setItem(key,JSON.stringify(next));setStorageError(false)}catch{setStorageError(true)}return next});
  const choose=id=>{setSelected(id);setStep(0);setAnswer(null);setFeedback('');setMode('lesson')};
  const matches=chapters.filter(c=>`${c.title} ${c.controls.map(x=>x.label).join(' ')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const completed=chapters.filter(c=>chapterComplete(c,progress[c.id])).length;
  return html`<div className="learning-school" data-testid="learning-school">
    <aside className="learning-index"><h3>Escuela Linkare</h3><a href="/tutorials/manual.html" download>Manual completo</a><p>${chapters.length} capítulos · ${completed} completados</p><label>Buscar pantalla o botón<input aria-label="Buscar capítulo o botón" value=${query} onChange=${e=>setQuery(e.target.value)} placeholder="Ej. anular receta"/></label><nav aria-label="Capítulos de la escuela">${matches.map(c=>html`<button key=${c.id} data-chapter-id=${c.id} type="button" aria-current=${chapter.id===c.id?'page':undefined} onClick=${()=>choose(c.id)}><span>${chapterComplete(c,progress[c.id])?'✓':'○'} ${c.title}</span><small>${c.controls.length} controles</small></button>`)}</nav>${!matches.length?html`<p>Sin coincidencias. Pruebe otro nombre de botón.</p>`:null}</aside>
    <section className="learning-lesson" aria-label="Lección del capítulo"><header><span className="eyebrow">Tutorial de esta pantalla</span><h2>${chapter.title}</h2><p>${chapter.intro}</p></header>
      <div className="learning-modes" role="tablist" aria-label="Formato del capítulo">${[['lesson','Explicación interactiva'],['video','Video con texto'],['practice','Ejercicio y comprobación']].map(([id,label])=>html`<button type="button" key=${id} role="tab" aria-selected=${mode===id} onClick=${()=>setMode(id)}>${label}</button>`)}</div>
      ${storageError?html`<p role="alert">El navegador no pudo conservar el progreso. Puede seguir leyendo; revise el almacenamiento del dispositivo.</p>`:null}
      ${mode==='lesson'?html`<div role="tabpanel"><label>Elegir control<select aria-label="Control explicado" value=${step} onChange=${e=>setStep(Number(e.target.value))}>${chapter.controls.map((c,i)=>html`<option key=${i} value=${i}>${i+1}. ${c.label}</option>`)}</select></label><article className="learning-control"><span>Control ${step+1} de ${chapter.controls.length}</span><h3>${control.label}</h3><h4>Cómo se usa</h4><p>${control.how}</p><h4>Qué debe comprobar después</h4><p>${control.result}</p><label className="learning-read"><input type="checkbox" checked=${state.read?.includes(step)||false} onChange=${e=>update({read:e.target.checked?[...new Set([...(state.read||[]),step])]:(state.read||[]).filter(i=>i!==step)})}/>Entendí este control y sé qué resultado comprobar</label></article><div className="learning-actions"><button type="button" disabled=${step===0} onClick=${()=>setStep(step-1)}>Anterior</button><span aria-live="polite">${(state.read||[]).length}/${chapter.controls.length} comprendidos</span><button type="button" disabled=${step===chapter.controls.length-1} onClick=${()=>setStep(step+1)}>Siguiente control</button></div><details><summary>Leer todos los controles de esta pantalla</summary>${chapter.controls.map((c,i)=>html`<article key=${i}><h4>${i+1}. ${c.label}</h4><p>${c.how}</p><p><b>Resultado:</b> ${c.result}</p></article>`)}</details></div>`:null}
      ${mode==='video'?html`<div role="tabpanel"><${LearningVideo} key=${chapter.id} chapter=${chapter}/></div>`:null}
      ${mode==='practice'?html`<div role="tabpanel"><h3>Ejercicio de este capítulo</h3><p>${chapter.exercise}</p><p>Use el recorrido seguro para ensayar operaciones de guardado. «Abrir pantalla» permite orientarse con su sesión actual; las operaciones realizadas allí afectan el trabajo real.</p><div className="learning-actions">${onNavigate&&chapter.view!=='login'?html`<button type="button" onClick=${()=>onNavigate(chapter)}>Abrir pantalla</button>`:null}${onPractice?html`<button type="button" onClick=${onPractice}>Practicar con datos ficticios</button>`:null}</div><fieldset className="learning-quiz"><legend>${chapter.quiz.question}</legend>${chapter.quiz.answers.map((text,i)=>html`<label key=${i}><input type="radio" name=${`quiz-${chapter.id}`} checked=${answer===i} onChange=${()=>setAnswer(i)}/>${text}</label>`)}<button type="button" disabled=${answer===null} onClick=${()=>{const ok=answer===chapter.quiz.correct;update({passed:ok});setFeedback(ok?'Respuesta correcta. Complete también la lectura de todos los controles para finalizar el capítulo.':`Repase el capítulo. La respuesta correcta es: ${chapter.quiz.answers[chapter.quiz.correct]}`)}}>Comprobar respuesta</button><p role="status">${feedback}</p></fieldset>${chapterComplete(chapter,state)?html`<p className="learning-complete" role="status">✓ Capítulo completado. Puede repasarlo y volver a reproducir su video.</p>`:html`<p>Para completar: marque cada explicación como comprendida y responda correctamente la pregunta.</p>`}</div>`:null}
      <footer className="learning-actions"><button type="button" onClick=${()=>{update({read:[],passed:false});setFeedback('Progreso del capítulo reiniciado.');setAnswer(null)}}>Reiniciar este capítulo</button><small>El progreso se conserva en este navegador para su cuenta. No contiene datos clínicos.</small></footer>
    </section></div>`;
}
