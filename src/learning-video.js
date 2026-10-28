import React from 'react';
import htm from 'htm';
import {timedLearningScenes} from './domain/learning-scenes.js';
const html=htm.bind(React.createElement);

// Timings and full reading copy share the same source as the encoded videos.
export function LearningVideo({chapter}){
 const video=React.useRef(null),selectId=React.useId();
 const scenes=React.useMemo(()=>timedLearningScenes(chapter),[chapter]);
 const [step,setStep]=React.useState(0),[muted,setMuted]=React.useState(false),[error,setError]=React.useState(false);
 React.useEffect(()=>{setStep(0);setError(false);setMuted(false);if(video.current){video.current.volume=0.35;video.current.muted=false}},[chapter.id]);
 const sync=()=>{const time=video.current?.currentTime||0;const index=scenes.findIndex(s=>time<s.end);setStep(index<0?scenes.length-1:index)};
 const jump=index=>{const target=Math.max(0,Math.min(index,scenes.length-1));if(video.current){video.current.pause();video.current.currentTime=scenes[target].start}setStep(target)};
 const toggleMusic=()=>{const media=video.current;if(!media)return;if(muted&&media.volume===0)media.volume=0.35;media.muted=!muted;setMuted(!muted)};
 const scene=scenes[Math.min(step,scenes.length-1)];
 return html`<div className="learning-video-player" data-testid="learning-video-player">
  <p>Video sin voz, con música instrumental suave y texto completo al lado. Puede pausar para leer, elegir un paso y silenciar la música.</p>
  <div className="learning-video-layout">
   <div className="learning-video-media"><video ref=${video} key=${chapter.id} className="training-video" controls preload="metadata" playsInline aria-label=${`Video de ${chapter.title}`} src=${chapter.video+'?v=reading-music-2'} onTimeUpdate=${sync} onSeeked=${sync} onVolumeChange=${()=>setMuted(Boolean(video.current?.muted)||video.current?.volume===0)} onError=${()=>setError(true)}><track kind="captions" srcLang="es" label="Español" src=${chapter.captions+'?v=reading-music-2'} default/>Su navegador no reproduce este formato.</video>
   <button type="button" className="text-button" aria-pressed=${muted} onClick=${toggleMusic}>${muted?'Activar música':'Silenciar música'}</button>
   ${error?html`<p role="alert">No se pudo cargar el video. Puede leer todos los pasos en la explicación interactiva o descargar el manual completo.</p>`:null}</div>
   <section className="learning-video-reading" aria-label="Texto del paso del video"><label htmlFor=${selectId}>Elegir paso del video</label><select id=${selectId} value=${step} onChange=${e=>jump(Number(e.target.value))}>${scenes.map((s,i)=>html`<option key=${i} value=${i}>${i+1}. ${s.title}</option>`)}</select><small aria-live="polite">Paso ${step+1} de ${scenes.length}</small><h3>${scene.title}</h3><p className="learning-video-copy">${scene.text}</p><div className="learning-actions"><button type="button" disabled=${step===0} onClick=${()=>jump(step-1)}>Paso anterior</button><button type="button" disabled=${step===scenes.length-1} onClick=${()=>jump(step+1)}>Paso siguiente</button></div><small>Al elegir un paso, el video queda pausado para que pueda leerlo. Pulse reproducir cuando quiera continuar.</small></section>
  </div><div className="training-video-actions"><a className="button button-secondary" href=${chapter.video+'?v=reading-music-2'} download>Descargar video de esta página</a><a className="text-button" href=${chapter.captions+'?v=reading-music-2'} download>Descargar subtítulos</a><span>Datos ficticios de capacitación.</span></div>
 </div>`;
}
