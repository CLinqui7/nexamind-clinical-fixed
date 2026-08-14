import assert from 'node:assert/strict';
import { createSeedData, normalizeData } from '../src/data.js';
import {
  addMedication,
  analyticsRows,
  appointmentFormDefaults,
  assessmentFormDefaults,
  buildPatientReport,
  changeMedicationDose,
  createPatient,
  doseFormDefaults,
  labFormDefaults,
  medicationFormDefaults,
  patientFormDefaults,
  recordAdverseEvent,
  recordAssessment,
  recordLab,
  recordVitals,
  saveAppointment,
  validateImportedData,
  vitalsFormDefaults,
  adverseFormDefaults,
} from '../src/clinical.js';
import {
  buildPrescriptionPrintHtml,
  clinicProfileDefaults,
  createSecretaryUser,
  getReminderQueue,
  markReminderSent,
  prescriptionFormDefaults,
  savePracticeProfile,
  savePrescription,
  secretaryFormDefaults,
  setActiveUser,
  updateUserPermissions,
} from '../src/practice.js';

function localDateInput(daysFromNow = 0) {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function futureLocalInput(hoursFromNow) {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

let data = createSeedData();
assert.equal(data.version, 3);
assert.ok(data.patients.length >= 9, 'El seed debe incluir pacientes ficticios.');
assert.ok(data.users.some(user => user.role === 'doctor'), 'Debe existir un médico demo.');
assert.ok(data.users.some(user => user.role === 'secretary'), 'Debe existir una secretaria demo.');
assert.deepEqual(data.settings.palette, { milk: '#FCFDF6', ceil: '#8FACCB', midnight: '#05316E' });
assert.ok(Array.isArray(data.settings.reminderHours));

const patientDraft = {
  ...patientFormDefaults(),
  name: 'Paciente QA Sintético',
  age: 39,
  sex: 'F',
  phone: '+503 7000 9999',
  email: 'qa@nexamind.demo',
  diagnosis: 'Trastorno depresivo mayor',
  diagnosisCode: 'F33.1',
  scaleCode: 'PHQ-9',
  initialScore: 18,
  hasInsurance: true,
  insuranceProvider: 'Seguro Demo',
  insurancePlan: 'Plan QA',
  insuranceMemberId: 'QA-001',
  insurancePolicyNumber: 'POL-QA-001',
  insuranceAuthorizationRequired: true,
  insuranceCopay: 'US$15',
  insuranceNotes: 'Datos exclusivamente sintéticos.',
};
let created = createPatient(data, patientDraft);
data = created.data;
const patientId = created.patientId;
let patient = data.patients.find(item => item.id === patientId);
assert.ok(patient, 'El paciente debe crearse.');
assert.equal(patient.insurance.provider, 'Seguro Demo');
assert.equal(patient.assessments[0].points[0].value, 18);

let medicationDraft = medicationFormDefaults(patient);
Object.assign(medicationDraft, {
  name: 'Sertralina',
  class: 'ISRS',
  indication: 'Depresión',
  doseValue: 50,
  doseUnit: 'mg',
  frequency: 'cada mañana',
  route: 'oral',
  isPrimary: true,
});
let medicationResult = addMedication(data, patientId, medicationDraft);
data = medicationResult.data;
const medicationId = medicationResult.medicationId;
patient = data.patients.find(item => item.id === patientId);
assert.equal(patient.medication.name, 'Sertralina');
assert.equal(patient.medication.dose, '50 mg');

let doseDraft = doseFormDefaults(patient, medicationId);
Object.assign(doseDraft, {
  newDoseValue: 100,
  doseUnit: 'mg',
  frequency: 'cada mañana',
  reason: 'Respuesta parcial en entorno de prueba',
});
data = changeMedicationDose(data, patientId, doseDraft).data;
patient = data.patients.find(item => item.id === patientId);
assert.equal(patient.medications.find(item => item.id === medicationId).dose, '100 mg');
assert.ok(patient.medications.find(item => item.id === medicationId).doseHistory.length >= 2);

let assessmentDraft = assessmentFormDefaults(patient);
Object.assign(assessmentDraft, {
  code: 'PHQ-9',
  date: localDateInput(1),
  score: 8,
  adherence: 95,
  functioningChange: 35,
  sleepCurrent: 7,
  status: 'responding',
  risk: 'low',
  note: 'Mejoría observada en datos sintéticos.',
});
data = recordAssessment(data, patientId, assessmentDraft).data;
patient = data.patients.find(item => item.id === patientId);
const phqPoints = patient.assessments.find(item => item.code === 'PHQ-9').points;
assert.equal(phqPoints.at(-1).value, 8);
assert.equal(patient.adherence, 95);

let vitalDraft = vitalsFormDefaults(patient);
Object.assign(vitalDraft, {
  date: localDateInput(1),
  weight: 70,
  height: 170,
  systolic: 118,
  diastolic: 76,
  pulse: 72,
  sleepCurrent: 7,
  appetite: 'Normal',
});
data = recordVitals(data, patientId, vitalDraft).data;
patient = data.patients.find(item => item.id === patientId);
assert.equal(patient.vitals.bp, '118/76');
assert.ok(patient.vitals.bmi > 24 && patient.vitals.bmi < 25);

let adverseDraft = adverseFormDefaults(patient);
Object.assign(adverseDraft, {
  medicationId,
  name: 'Somnolencia',
  onset: localDateInput(1),
  severity: 'mild',
  relation: 'Apareció después del ajuste; causalidad no confirmada.',
  actionTaken: 'Seguimiento.',
});
data = recordAdverseEvent(data, patientId, adverseDraft).data;
patient = data.patients.find(item => item.id === patientId);
assert.ok(patient.adverseEvents.some(item => item.name === 'Somnolencia'));

let labDraft = labFormDefaults(patient);
Object.assign(labDraft, {
  date: localDateInput(1),
  name: 'Sodio',
  value: '140',
  unit: 'mmol/L',
  status: 'normal',
  reference: '135-145',
});
data = recordLab(data, patientId, labDraft).data;
patient = data.patients.find(item => item.id === patientId);
assert.ok(patient.labs.some(item => item.name === 'Sodio' && item.value === '140'));

let appointmentDraft = appointmentFormDefaults(data, new Date(Date.now() + 12 * 60 * 60 * 1000), null, patientId);
appointmentDraft.start = futureLocalInput(12);
appointmentDraft.duration = 45;
appointmentDraft.notes = 'Cita sintética para validar recordatorios.';
let appointmentResult = saveAppointment(data, appointmentDraft);
data = appointmentResult.data;
const appointmentId = appointmentResult.appointment.id;
assert.ok(data.appointments.some(item => item.id === appointmentId));

const profileDraft = clinicProfileDefaults(data);
Object.assign(profileDraft, {
  name: 'Clínica QA',
  clinician: 'Dra. Prueba',
  specialty: 'Psiquiatría',
  professionalLicense: 'JVPM QA-001',
  address: 'San Salvador',
  phone: '+503 2200 0000',
  email: 'qa@clinica.demo',
  clinicLogo: 'data:image/png;base64,QUJD',
  doctorPhoto: 'data:image/jpeg;base64,QUJD',
});
data = savePracticeProfile(data, profileDraft);
assert.equal(data.organization.name, 'Clínica QA');
assert.equal(data.users.find(user => user.role === 'doctor').name, 'Dra. Prueba');
assert.match(data.organization.clinicLogo, /^data:image\/png/);

const secretaryDraft = secretaryFormDefaults();
Object.assign(secretaryDraft, {
  name: 'Secretaria QA',
  email: 'secretaria.qa@nexamind.demo',
  phone: '+503 7000 1111',
});
let secretaryResult = createSecretaryUser(data, secretaryDraft);
data = secretaryResult.data;
const secretaryId = secretaryResult.user.id;
assert.equal(secretaryResult.user.role, 'secretary');
assert.equal(secretaryResult.user.permissions.medicationsManage, false);

data = updateUserPermissions(data, secretaryId, {
  ...secretaryDraft,
  permissions: { ...secretaryResult.user.permissions, prescriptionsCreate: true },
});
assert.equal(data.users.find(user => user.id === secretaryId).permissions.prescriptionsCreate, true);
data = setActiveUser(data, secretaryId);
assert.equal(data.settings.activeUserId, secretaryId);
const doctorId = data.users.find(user => user.role === 'doctor').id;
data = setActiveUser(data, doctorId);

patient = data.patients.find(item => item.id === patientId);
let prescriptionDraft = prescriptionFormDefaults(patient, data.organization);
prescriptionDraft.items[0] = {
  ...prescriptionDraft.items[0],
  medication: 'Sertralina',
  strength: '100 mg',
  directions: 'Tomar una tableta cada mañana.',
  quantity: '30 tabletas',
  duration: '30 días',
};
let prescriptionResult = savePrescription(data, patientId, prescriptionDraft);
data = prescriptionResult.data;
patient = data.patients.find(item => item.id === patientId);
assert.equal(patient.prescriptions.length, 1);
const printHtml = buildPrescriptionPrintHtml(data, patient, prescriptionResult.prescription);
assert.match(printHtml, /Clínica QA/);
assert.match(printHtml, /Sertralina/);
assert.match(printHtml, /Seguro Demo/);
assert.match(printHtml, /Firma y sello/);

// Una cita dentro de 12 horas activa el recordatorio de 24 horas.
data = { ...data, settings: { ...data.settings, reminderHours: [24, 8] } };
let queue = getReminderQueue(data, new Date());
const dueReminder = queue.find(item => item.appointment.id === appointmentId && item.hours === 24);
assert.ok(dueReminder, 'Debe generarse el recordatorio de 24 horas.');
assert.equal(dueReminder.status, 'due');
data = markReminderSent(data, appointmentId, 24, 'whatsapp');
queue = getReminderQueue(data, new Date());
assert.equal(queue.find(item => item.appointment.id === appointmentId && item.hours === 24).status, 'sent');

// Editar la cita no debe borrar el historial de recordatorios.
const existingAppointment = data.appointments.find(item => item.id === appointmentId);
const editDraft = appointmentFormDefaults(data, new Date(existingAppointment.start), existingAppointment, patientId);
editDraft.notes = 'Cita editada sin perder recordatorios.';
data = saveAppointment(data, editDraft).data;
assert.equal(data.appointments.find(item => item.id === appointmentId).reminderLog.length, 1);

const rows = analyticsRows(data);
assert.ok(rows.some(row => row.Paciente === 'Paciente QA Sintético'));
patient = data.patients.find(item => item.id === patientId);
const report = buildPatientReport(patient, data.alerts);
assert.equal(report.baseline, 18);
assert.equal(report.current, 8);
assert.ok(report.improvement > 50);
assert.equal(validateImportedData(data), data);

const normalized = normalizeData({
  ...data,
  settings: {
    ...data.settings,
    reminderHours: ['24', 0, -1],
    palette: { milk: '#ffffff' },
  },
});
assert.deepEqual(normalized.settings.reminderHours, [24]);
assert.equal(normalized.settings.palette.milk, '#ffffff');
assert.equal(normalized.settings.palette.midnight, '#05316E');

console.log('DOMAIN_QA_OK');
console.log(JSON.stringify({
  patients: data.patients.length,
  appointments: data.appointments.length,
  users: data.users.length,
  prescriptions: patient.prescriptions.length,
  reminderStatus: queue.find(item => item.appointment.id === appointmentId && item.hours === 24).status,
}, null, 2));
