// These are candidate mentions in historical free text, not prescriptions or
// assertions that the patient currently takes a medicine. Keep the source memo.
const strengthUnit='mg|mcg|µg|g|ml|mL|UI|IU|gotas?';
const heading=new RegExp(`^\\s*(?:[-*•]\\s*)?(?<name>[\\p{L}][\\p{L}\\p{N} .,'()/-]{1,79}?)\\s+(?<strength>\\d+(?:[.,]\\d+)?\\s*(?:${strengthUnit}))\\b(?<tail>.*)$`,'iu');
const narrativeStart=/^(?:paciente|refiere|reporta|diagn[oó]stico|antecedentes|laboratorio|resultado|peso|talla|presi[oó]n|temperatura|glucosa|dosis|tomar|aplicar|usar|administrar|suspender|aumentar|disminuir|continuar|iniciar|se|el|la)\b/iu;
const instructionStart=/^(?:tomar|aplicar|usar|administrar|ingerir|colocar|inyectar|\d+(?:[.,]\d+)?\s*(?:mg|mcg|ml|gotas?|comprimidos?|tabletas?)?\s+(?:cada|por|en|comprimidos?|tabletas?))\b/iu;
const continuationStart=/^(?:luego|despu[eé]s|durante|por|y\s+luego)\b/iu;

export function extractHistoricalMedicationMentions(memo){
  if(typeof memo!=='string'||!memo.trim())return [];
  const lines=memo.replace(/\r\n?/g,'\n').split('\n');
  const mentions=[];
  for(let index=0;index<lines.length;index+=1){
    const line=lines[index].trim();
    if(line.length<5||line.length>220)continue;
    const match=line.match(heading);
    if(!match)continue;
    const name=match.groups.name.replace(/\s+/g,' ').trim();
    if(name.length<2||narrativeStart.test(name)||!/[\p{L}]{2}/u.test(name))continue;
    const strength=match.groups.strength.replace(/\s+/g,' ').trim();
    const tail=match.groups.tail.trim();
    const instructions=[];
    if(tail&&instructionStart.test(tail))instructions.push(tail);
    for(let next=index+1;next<Math.min(lines.length,index+3);next+=1){
      const candidate=lines[next].trim();
      if(!candidate||candidate.length>300||heading.test(candidate))break;
      if((instructions.length?continuationStart:instructionStart).test(candidate))instructions.push(candidate);
      else break;
    }
    // A heading with a dose is enough to surface a review candidate. The
    // precise administered dose may differ from the package strength.
    mentions.push({name,strengthText:strength,instructionText:instructions.join('\n')||null,
      sourceLine:index+1,sourceExcerpt:line,status:'historical_unverified',extractionMethod:'dose_heading_v1'});
  }
  return mentions;
}
