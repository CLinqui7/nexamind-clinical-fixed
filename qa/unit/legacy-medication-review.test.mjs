import {test} from 'node:test';
import assert from 'node:assert/strict';
import {historicalMedicationReviewDraft,confirmedHistoricalMedicationPayload} from '../../src/domain/legacy-medication-review.js';
import {medicationFormDefaults,updateMedication} from '../../src/clinical.js';

test('historical review does not infer a present dose or start date from source text',()=>{
  const draft=historicalMedicationReviewDraft({name:'SyntheticMed',strengthText:'20 mg',instructionText:'Past instruction'});
  assert.equal(draft.name,'SyntheticMed');
  for(const key of ['doseValue','doseUnit','frequency','route','startDate'])assert.equal(draft[key],'');
  assert.equal(draft.confirmedCurrent,false);
  assert.throws(()=>confirmedHistoricalMedicationPayload(draft),/Confirme/);
  assert.throws(()=>confirmedHistoricalMedicationPayload({...draft,confirmedCurrent:true}),/dosis válida|Complete/);
  assert.deepEqual(confirmedHistoricalMedicationPayload({...draft,confirmedCurrent:true,doseValue:'1-0-1',doseUnit:'tableta(s)',frequency:'otra',customFrequency:'cada mañana y noche',route:'oral'}),{
    confirmedCurrent:true,name:'SyntheticMed',doseValue:'1-0-1',doseUnit:'tableta(s)',frequency:'cada mañana y noche',route:'oral',indication:'',startDate:'',notes:'',reviewNote:'',isPrn:false,
  });
});

test('editing a verified historical medicine keeps unknown start date and source identity',()=>{
  const medicine={id:'medication_qa',name:'SyntheticMed',source:'foxpro_verified',sourceMentionId:'mention_qa',sourceHistoryId:'history_qa',sourceBatchId:'batch_qa',startDate:null,doseValue:'20',doseUnit:'mg',dose:'20 mg',frequency:'cada noche',route:'oral',status:'active'};
  const patient={id:'patient_qa',name:'Synthetic Patient',medications:[medicine]};
  const draft=medicationFormDefaults(patient,medicine);
  assert.equal(draft.startDate,'');assert.equal(draft.source,'foxpro_verified');
  const result=updateMedication({patients:[patient],settings:{activeUserId:'doctor_qa'}},patient.id,{...draft,doseValue:'30'});
  const updated=result.data.patients[0].medications[0];
  assert.equal(updated.startDate,null);assert.equal(updated.sourceMentionId,medicine.sourceMentionId);
  assert.equal(updated.sourceHistoryId,medicine.sourceHistoryId);assert.equal(updated.sourceBatchId,medicine.sourceBatchId);
});
