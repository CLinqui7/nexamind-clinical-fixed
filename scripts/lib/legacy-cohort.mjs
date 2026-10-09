import {sha256,stableJson} from './legacy-plan.mjs';
import {extractHistoricalMedicationMentions} from './legacy-medication-extractor.mjs';

// A pilot is a complete, source-linked subset of patients, not a truncated row list.
// Keep all history rows belonging to each selected patient and never include a
// movement from another patient merely to reach a requested row count.
export function buildLegacyCohort({records,publicReport},patientCount){
  if(!Number.isSafeInteger(patientCount)||patientCount<1||patientCount>500)throw Error('COHORT_SIZE_INVALID');
  const patients=new Map();
  for(const record of records){
    if(record.destinationKind==='patient_admin')patients.set(record.destinationId,{record,lastDate:'',history:0,medications:0});
  }
  for(const record of records)for(const entry of record.historyEntries||[]){
    const patient=patients.get(entry.patientId);
    if(!patient)continue;
    patient.history++;
    if(typeof entry.occurredOn==='string'&&entry.occurredOn>patient.lastDate)patient.lastDate=entry.occurredOn;
    if(entry.scope==='clinical'&&typeof entry.payload?.text==='string')patient.medications+=extractHistoricalMedicationMentions(entry.payload.text).length;
  }
  const eligible=[...patients.values()].filter(patient=>patient.history>0&&patient.medications>0&&patient.lastDate);
  if(eligible.length<patientCount)throw Error('COHORT_NOT_ENOUGH_RICH_PATIENTS');
  eligible.sort((a,b)=>b.lastDate.localeCompare(a.lastDate)||a.record.sourceKeyHash.localeCompare(b.record.sourceKeyHash));
  const selected=new Set();
  const recentCount=Math.ceil(patientCount/2);
  for(const patient of eligible.slice(0,recentCount))selected.add(patient.record.destinationId);
  for(const patient of [...eligible].reverse()){
    if(selected.size>=patientCount)break;
    selected.add(patient.record.destinationId);
  }
  const subset=records.filter(record=>selected.has(record.destinationId)||
    (record.historyEntries||[]).some(entry=>selected.has(entry.patientId)));
  const tableCounts={},dispositions={},destination={patients:0,administrativeHistory:0,clinicalHistory:0};
  for(const record of subset){
    const counts=tableCounts[record.sourceTable]??={physical:0,deleted:0,imported:0,quarantined:0,excluded:0,reference:0};
    counts.physical++;
    if(record.disposition.startsWith('import_'))counts.imported++;
    else if(record.disposition.startsWith('quarantine_'))counts.quarantined++;
    else if(record.disposition.startsWith('reference_'))counts.reference++;
    else if(record.disposition==='deleted_source')counts.deleted++;
    else counts.excluded++;
    dispositions[record.disposition]=(dispositions[record.disposition]||0)+1;
    if(record.destinationKind==='patient_admin')destination.patients++;
    for(const entry of record.historyEntries||[])destination[entry.scope==='clinical'?'clinicalHistory':'administrativeHistory']++;
  }
  if(destination.patients!==patientCount)throw Error('COHORT_RECONCILIATION_FAILED');
  const report={...publicReport,mode:'dry-run',sourceRows:subset.length,sourceFullRows:publicReport.sourceRows,
    tables:tableCounts,dispositions,qualityIssues:{},destination,
    selection:{strategy:'half-recent-half-oldest-with-medication-evidence',requestedPatients:patientCount,
      eligiblePatients:eligible.length,selectedPatients:selected.size,distinctFromFullImport:true},
    planSha:sha256(stableJson(subset)),generatedAt:new Date().toISOString()};
  return {records:subset,publicReport:report};
}
