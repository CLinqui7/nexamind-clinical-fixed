const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const months={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12};
function validDate(y,m,d){const value=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;const parsed=new Date(value+'T12:00:00Z');return Number(y)>=1900&&Number(y)<=2200&&!Number.isNaN(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value?value:null;}
export function explicitVisitDate(line){
 const text=normalized(line);
 if(!/^(cita|consulta|control|fecha)\b/.test(text)||/proxima|programada|agendada|futura/.test(text))return null;
 let match=text.match(/\b(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+)?(\d{4})\b/);
 if(match&&months[match[2]])return validDate(match[3],months[match[2]],match[1]);
 match=text.match(/\b(\d{1,2})\s+(\d{1,2})\s+(\d{4})\b/);
 return match?validDate(match[3],match[2],match[1]):null;
}
export function recordedSchedule(mention){
 if(mention.instruction?.trim())return mention.instruction.trim();
 const match=String(mention.excerpt||'').match(/\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|g|ml|UI|IU|gotas?)\b[\s.,:;]*(.*)$/i);
 return match?.[1]?.trim()||null;
}
function sourceBlocks(text){
 const blocks=[];let block={date:null,heading:'Sin encabezado de fecha',lines:[],scheduled:false};
 for(const line of String(text||'').replace(/\\r\\n|\\n|\\r/g,'\n').replace(/\r\n?/g,'\n').split('\n')){
  const date=explicitVisitDate(line);
  const header=/^(?:(?:proxima|proximo|siguiente) )?(cita|consulta|control|fecha)\b/.test(normalized(line));
  if(date||header){blocks.push(block);block={date,heading:line.trim(),lines:[],scheduled:/proxima|proximo|siguiente|programada|programado|agendada|futura/.test(normalized(line))}}
  else block.lines.push(line);
 }
 blocks.push(block);
 return blocks.map(b=>({...b,text:b.lines.join('\n').trim()}));
}
export function foxproDatedSections(text,name){
 const key=normalized(name);
 return sourceBlocks(text).filter(b=>b.date&&!b.scheduled&&(' '+normalized(b.text)+' ').includes(' '+key+' ')).map(({date,heading,text})=>({date,heading,text}));
}

// These labels describe the source words; they do not assert adherence.
export function documentedTreatmentSignals(text,name,sourceDate=null){
 const key=normalized(name),blocks=sourceBlocks(text),signals=[];
 const escaped=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 for(const block of blocks.filter(b=>!b.scheduled))for(const sentence of block.text.split(/[\n.!?;]+/)){
  const plain=normalized(sentence);
  if(!(' '+plain+' ').includes(' '+key+' ')||/\b(no|nunca|si|considerar|posible|podria|proxima)\b/.test(plain))continue;
  let type=null;
  if(new RegExp(`\\b(se suspende|se suspendio|dejo de tomar|ha dejado de tomar) (?:el medicamento )?${escaped}(?: |$)`).test(plain))type='stop_instruction';
  else if(new RegExp(`\\b(se inicia|se inicio|iniciar) (?:el medicamento )?${escaped}(?: |$)`).test(plain))type='start_instruction';
  if(type)signals.push({type,date:block.date||sourceDate,excerpt:sentence.trim()});
 }
 return signals;
}
