import {deterministicUuid,sha256,stableJson} from './legacy-plan.mjs';
import {extractHistoricalMedicationMentions} from './legacy-medication-extractor.mjs';

export const HISTORICAL_EXTRACTOR_VERSION='dose_heading_v1';

export function buildHistoricalMedicationPlan(records,{organizationId,sourceSystem='foxpro-linkare',batchId}){
  const items=[];let sourceMemos=0,unstructuredMemos=0,datedCandidates=0,instructions=0;
  for(const record of records){
    for(const history of record.historyEntries||[]){
      const memo=history.scope==='clinical'?history.payload?.text:null;
      if(typeof memo!=='string'||!memo.trim())continue;
      sourceMemos+=1;
      const extracted=extractHistoricalMedicationMentions(memo);
      if(!extracted.length)unstructuredMemos+=1;
      const sourceTextSha=sha256(memo);
      for(const mention of extracted){
        if(history.occurredOn)datedCandidates+=1;
        if(mention.instructionText)instructions+=1;
        items.push({organizationId,batchId,id:deterministicUuid(organizationId,sourceSystem,HISTORICAL_EXTRACTOR_VERSION,history.id,mention.sourceLine),
          patientId:history.patientId,historyId:history.id,sourceTextSha,sourceLine:mention.sourceLine,
          name:mention.name,strengthText:mention.strengthText,instructionText:mention.instructionText,
          sourceExcerpt:mention.sourceExcerpt,extractionMethod:HISTORICAL_EXTRACTOR_VERSION});
      }
    }
  }
  return {items,summary:{sourceMemos,unstructuredMemos,candidateMentions:items.length,datedCandidates,instructions,extractorVersion:HISTORICAL_EXTRACTOR_VERSION,
    manifestSha:sha256(stableJson(items.map(item=>[item.id,item.historyId,item.sourceTextSha,item.name,item.strengthText,item.instructionText])))} };
}
