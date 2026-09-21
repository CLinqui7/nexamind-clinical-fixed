import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeData } from '../../src/data.js';
import {
  adverseFormDefaults,
  archiveClinicalRecord,
  labFormDefaults,
  medicationFormDefaults,
  recordAdverseEvent,
  recordAssessment,
  recordLab,
  recordVitals,
  updateMedication,
  updatePatientDocumentMetadata,
  vitalsFormDefaults,
} from '../../src/clinical.js';
import { createEncounterCorrection, upsertEncounter } from '../../src/v2features.js';

const baseData = () => normalizeData({
  users: [{ id: 'doctor', name: 'Doctor QA', role: 'owner', active: true }],
  settings: { activeUserId: 'doctor' },
  appointments: [],
  alerts: [],
  patients: [{
    id: 'patient', name: 'Paciente QA', age: 30, diagnosis: 'Diagnóstico QA', diagnosisCode: 'QA',
    medications: [{ id: 'med', name: 'Original', class: 'ISRS', dose: '10 mg', doseValue: 10, doseUnit: 'mg', frequency: 'una vez al día', route: 'oral', startDate: '2026-09-01', status: 'active', isPrimary: true, createdAt: '2026-09-01T12:00:00Z', createdBy: 'doctor', doseHistory: [] }],
    adverseEvents: [], labs: [], vitalsHistory: [], assessments: [], documents: [{ id: 'doc', name: 'Documento original', category: 'Otro', clinicalDate: '2026-09-01', confidentiality: 'Clínico', storagePath: 'org/patient/doc.pdf' }],
    consultations: [
      { id: 'signed', title: 'Nota firmada', status: 'signed', signedAt: '2026-09-01T13:00:00Z', signedBy: 'doctor', startedAt: '2026-09-01T12:00:00Z', freeNotes: 'Contenido original' },
      { id: 'draft', title: 'Borrador', status: 'draft', startedAt: '2026-09-02T12:00:00Z', freeNotes: 'Borrador' },
    ],
  }],
});

test('clinical records can be corrected while retaining their prior version', () => {
  let data = baseData();
  const patient = data.patients[0];
  const medicationDraft = medicationFormDefaults(patient, patient.medications[0]);
  data = updateMedication(data, patient.id, { ...medicationDraft, name: 'Corregido (QA)', doseValue: 20 }).data;
  const medication = data.patients[0].medications[0];
  assert.equal(medication.id, 'med');
  assert.equal(medication.name, 'Corregido (QA)');
  assert.equal(medication.createdAt, '2026-09-01T12:00:00Z');
  assert.equal(medication.corrections[0].before.name, 'Original');

  data = recordAdverseEvent(data, 'patient', { ...adverseFormDefaults(data.patients[0]), name: 'Náusea', relation: 'Inicial' }).data;
  const adverse = data.patients[0].adverseEvents[0];
  data = recordAdverseEvent(data, 'patient', { ...adverseFormDefaults(data.patients[0], adverse), severity: 'moderate', relation: 'Corregida' }).data;
  assert.equal(data.patients[0].adverseEvents[0].severity, 'moderate');
  assert.equal(data.patients[0].adverseEvents[0].versions[0].relation, 'Inicial');

  data = recordLab(data, 'patient', { ...labFormDefaults(data.patients[0]), name: 'TSH', value: '4', unit: 'mUI/L' }).data;
  const lab = data.patients[0].labs[0];
  data = recordLab(data, 'patient', { ...labFormDefaults(data.patients[0], lab), value: '3.5' }).data;
  assert.equal(data.patients[0].labs[0].value, '3.5');
  assert.equal(data.patients[0].labs[0].versions[0].value, '4');

  data = recordVitals(data, 'patient', { ...vitalsFormDefaults(data.patients[0]), weight: '70', height: '170' }).data;
  const vital = data.patients[0].vitalsHistory[0];
  data = recordVitals(data, 'patient', { ...vitalsFormDefaults(data.patients[0], vital), weight: '69' }).data;
  assert.equal(data.patients[0].vitals.weight, 69);
  assert.equal(data.patients[0].vitalsHistory[0].versions[0].weight, 70);

  data = recordAssessment(data, 'patient', { code: 'PHQ-9', score: 12, date: '2026-09-01', adherence: 90, functioningChange: 0, sleepCurrent: 7, status: 'stable', risk: 'low' }).data;
  const point = data.patients[0].assessments[0].points[0];
  data = recordAssessment(data, 'patient', { code: 'PHQ-9', score: 10, date: '2026-09-01', pointId: point.id, originalDate: point.date, editing: true, adherence: 90, functioningChange: 0, sleepCurrent: 7, status: 'stable', risk: 'low' }).data;
  assert.equal(data.patients[0].assessments[0].points[0].value, 10);
  assert.ok(data.patients[0].assessments[0].points[0].correctedAt);

  data = updatePatientDocumentMetadata(data, 'patient', { id: 'doc', name: 'Documento corregido', category: 'Laboratorio', clinicalDate: '2026-09-02', description: 'Corrección', confidentiality: 'Clínico' }).data;
  assert.equal(data.patients[0].documents[0].name, 'Documento corregido');
  assert.equal(data.patients[0].documents[0].versions[0].name, 'Documento original');
});

test('clinical deletions leave an auditable archived record', () => {
  let data = baseData();
  data = recordAdverseEvent(data, 'patient', { ...adverseFormDefaults(data.patients[0]), name: 'Náusea' }).data;
  data = recordLab(data, 'patient', { ...labFormDefaults(data.patients[0]), name: 'TSH', value: '4' }).data;
  data = recordVitals(data, 'patient', { ...vitalsFormDefaults(data.patients[0]), weight: '70' }).data;
  data = recordAssessment(data, 'patient', { code: 'PHQ-9', score: 12, date: '2026-09-01', adherence: 90, functioningChange: 0, sleepCurrent: 7, status: 'stable', risk: 'low' }).data;
  const patient = data.patients[0];
  const point = patient.assessments[0].points[0];
  for (const [resource, id] of [
    ['adverseEvent', patient.adverseEvents[0].id],
    ['lab', patient.labs[0].id],
    ['vital', patient.vitalsHistory[0].id],
    ['assessment', `PHQ-9|${point.id}`],
    ['document', 'doc'],
  ]) data = archiveClinicalRecord(data, 'patient', resource, id, 'Registro agregado por error').data;
  const archived = data.patients[0];
  assert.ok(archived.adverseEvents[0].archivedAt);
  assert.ok(archived.labs[0].archivedAt);
  assert.ok(archived.vitalsHistory[0].archivedAt);
  assert.ok(archived.assessments[0].points[0].archivedAt);
  assert.equal(archived.documents[0].archived, true);
  assert.equal(archived.documents[0].archiveReason, 'Registro agregado por error');
});

test('signed consultations remain byte-preserved when corrected or retracted', () => {
  let data = baseData();
  const original = structuredClone(data.patients[0].consultations.find(item => item.id === 'signed'));
  const correction = createEncounterCorrection(data.patients[0], original, { id: 'doctor' });
  data = upsertEncounter(data, 'patient', correction).data;
  assert.equal(data.patients[0].consultations[0].correctsConsultationId, 'signed');
  assert.deepEqual(data.patients[0].consultations.find(item => item.id === 'signed'), original);
  data = archiveClinicalRecord(data, 'patient', 'consultation', 'signed', 'Nota creada en expediente equivocado').data;
  assert.deepEqual(data.patients[0].consultations.find(item => item.id === 'signed'), original);
  assert.equal(data.patients[0].consultationRetractions[0].resourceId, 'signed');
  data = archiveClinicalRecord(data, 'patient', 'consultation', 'draft', 'Borrador duplicado').data;
  assert.ok(data.patients[0].consultations.find(item => item.id === 'draft').archivedAt);
});
