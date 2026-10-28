// Complete reading copy shared by videos, their adjacent text, and voice quotes.
export function learningScenes(chapter){
 const where=chapter.view==='login'?'la pantalla de acceso':chapter.view==='patient'?'Pacientes, seleccione la ficha correcta y la pestaña indicada':chapter.view==='notebook'?'el expediente y la sección Consultas':chapter.title;
 const parts=[{kind:'intro',title:chapter.title,text:chapter.intro},
  {kind:'exercise',title:'Cómo llegar y practicar',text:`Abra ${where}. ${chapter.exercise}`},
  ...chapter.controls.map((c,i)=>({kind:'control',controlIndex:i,title:c.label,text:c.how+' '+c.result})),
  {kind:'quiz',title:'Compruebe lo aprendido',text:chapter.quiz.question+' La respuesta correcta es: '+chapter.quiz.answers[chapter.quiz.correct]+'. Puede repetir este capítulo en Ayuda, Escuela completa.'}];
 return parts.map((part,index)=>({...part,narration:`${index===0?'Capítulo. ':''}${part.title}. ${part.text}`}));
}
export function readingSeconds(scene){
 const words=`${scene.title} ${scene.text}`.trim().split(/\s+/u).length;
 return Math.max(12,Math.ceil(words*60/135+3));
}
export function timedLearningScenes(chapter){
 let time=0;
 return learningScenes(chapter).map(scene=>{const start=time;time+=readingSeconds(scene);return {...scene,start,end:time}});
}
