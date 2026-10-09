import {normalizeDoseValue} from '../clinical.js';

export function historicalMedicationReviewDraft(mention){
  return {
    name:String(mention?.name||'').trim(),
    doseValue:'',doseUnit:'',frequency:'',customFrequency:'',route:'',
    indication:'',startDate:'',notes:'',reviewNote:'',isPrn:false,
    confirmedCurrent:false,
  };
}

export function confirmedHistoricalMedicationPayload(draft){
  if(!draft?.confirmedCurrent)throw new Error('Confirme que verificó el uso actual con el paciente.');
  const name=String(draft.name||'').trim();
  const doseValue=normalizeDoseValue(draft.doseValue);
  const doseUnit=String(draft.doseUnit||'').trim();
  const frequency=String(draft.frequency==='otra'?draft.customFrequency:draft.frequency||'').trim();
  const route=String(draft.route||'').trim();
  if(!name||!doseUnit||!frequency||!route)throw new Error('Complete nombre, dosis, unidad, frecuencia y vía confirmados.');
  return {
    confirmedCurrent:true,name,doseValue:String(doseValue),doseUnit,frequency,route,
    indication:String(draft.indication||'').trim(),
    startDate:String(draft.startDate||'').trim(),
    notes:String(draft.notes||'').trim(),
    reviewNote:String(draft.reviewNote||'').trim(),isPrn:Boolean(draft.isPrn),
  };
}
