import { COMMON_ADVERSE_EFFECTS, FREQUENCIES, SCALE_CATALOG, normalizePatient } from './data.js';
import { normalizeDeathRecord, normalizeNotificationPreferences, patientExtensionDefaults } from './v2features.js';
import {
  addMinutes,
  calculateBMI,
  fromDateInput,
  fromLocalInputDateTime,
  initialsFromName,
  uid,
} from './utils.js';

const nowIso = () => new Date().toISOString();

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function clinicalDateIso(value) {
  if (!value) return nowIso();
  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  if (value === localToday) return nowIso();
  return fromDateInput(value);
}

function sortedByDate(items, field = 'date') {
  return [...items].sort((left, right) => new Date(left[field]) - new Date(right[field]));
}

function activePrimaryMedication(patient) {
  return patient.medications?.find(item => !item.archivedAt && item.status === 'active' && item.isPrimary)
    || patient.medications?.find(item => !item.archivedAt && item.status === 'active')
    || null;
}

function syncPrimaryMedication(patient) {
  const primary = activePrimaryMedication(patient);
  return normalizePatient({ ...patient, medication: primary || undefined });
}

function updatePatient(data, patientId, updater) {
  return {
    ...data,
    patients: data.patients.map(patient => {
      if (patient.id !== patientId) return patient;
      const updated = updater(patient);
      return syncPrimaryMedication({ ...updated, updatedAt: nowIso() });
    }),
  };
}

function appendAlert(data, alert) {
  return {
    ...data,
    alerts: [
      {
        id: uid('alert'),
        patientId: alert.patientId,
        severity: alert.severity || 'medium',
        category: alert.category || 'Seguimiento',
        title: alert.title,
        detail: alert.detail,
        createdAt: alert.createdAt || nowIso(),
        status: 'open',
      },
      ...data.alerts,
    ],
  };
}

function updateNextVisit(data, patientId) {
  const upcoming = data.appointments
    .filter(item => item.patientId === patientId && item.status !== 'cancelled' && item.status !== 'completed' && new Date(item.start) >= new Date())
    .sort((left, right) => new Date(left.start) - new Date(right.start));
  return updatePatient(data, patientId, patient => ({ ...patient, nextVisit: upcoming[0]?.start || null }));
}

export function patientFormDefaults() {
  return {
    name: '', age: '', sex: 'No registrado', phone: '', email: '', photo: '',
    diagnosis: '', diagnosisCode: '', risk: 'low', status: 'stable',
    scaleCode: 'PHQ-9', initialScore: '', nextVisit: '', notes: '',
    hasInsurance: false, insuranceProvider: '', insurancePlan: '', insuranceMemberId: '',
    insurancePolicyNumber: '', insuranceAuthorizationRequired: false, insuranceCopay: '', insuranceNotes: '',
    preferredName: '', pronouns: '', sexAssignedAtBirth: 'No registrado', genderIdentity: 'No registrada',
    sexualOrientation: 'No registrada', relationshipStatus: 'No registrado', significantPeople: '',
    ideationHistory: 'No registrada', suicideAttemptsCount: 0, lastAttemptDate: '', selfHarmHistory: 'No registrada',
    safetyPlan: '', emergencyContact: '', safetyHistoryNotes: '',
    vitalStatus: 'active', reminderEnabled: true, reminderChannels: ['whatsapp'], reminderHours: [24, 8],
    reminderEmail: '', reminderPhone: '', reminderConsentStatus: 'pending', reminderLanguage: 'Español',
  };
}

export function patientEditFormDefaults(patient) {
  return {
    name: patient?.name || '', age: patient?.age ?? '', sex: patient?.sex || 'No registrado',
    phone: patient?.phone || '', email: patient?.email || '', photo: patient?.photo || '',
    diagnosis: patient?.diagnosis || '', diagnosisCode: patient?.diagnosisCode || '',
    risk: patient?.risk || 'low', status: patient?.status || 'stable', notes: '',
    hasInsurance: Boolean(patient?.insurance?.hasInsurance),
    insuranceProvider: patient?.insurance?.provider || '', insurancePlan: patient?.insurance?.plan || '',
    insuranceMemberId: patient?.insurance?.memberId || '', insurancePolicyNumber: patient?.insurance?.policyNumber || '',
    insuranceAuthorizationRequired: Boolean(patient?.insurance?.authorizationRequired),
    insuranceCopay: patient?.insurance?.copay || '', insuranceNotes: patient?.insurance?.notes || '',
    ...patientExtensionDefaults(patient),
  };
}

export function medicationFormDefaults(patient, medication = null) {
  const customFrequency = medication && !FREQUENCIES.includes(medication.frequency) ? medication.frequency : medication?.customFrequency || '';
  return {
    id: medication?.id || '', patientId: patient?.id || '', name: medication?.name || '', class: medication?.class || 'ISRS', indication: medication?.indication || patient?.diagnosis || '',
    doseValue: medication?.doseValue ?? '', doseUnit: medication?.doseUnit || 'mg', frequency: customFrequency ? 'otra' : medication?.frequency || 'una vez al día', route: medication?.route || 'oral',
    customFrequency, frequencySlots: medication?.frequencySlots || [], startDate: String(medication?.startDate || new Date().toISOString()).slice(0, 10), isPrimary: medication?.isPrimary ?? true, isPrn: medication?.isPrn ?? false, notes: medication?.clinicalNotes || medication?.notes || '',
  };
}

export function frequencySlotsFor(value, custom = '') {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === 'cada mañana') return ['morning'];
  if (normalized === 'al mediodía') return ['noon'];
  if (normalized === 'cada tarde') return ['afternoon'];
  if (normalized === 'cada noche') return ['night'];
  if (normalized === 'cada 12 horas' || normalized === 'dos veces al día') return ['morning', 'night'];
  return normalized === 'otra' && cleanText(custom) ? ['custom'] : [];
}

export function doseFormDefaults(patient, medicationId = null) {
  const medication = patient?.medications?.find(item => item.id === medicationId)
    || activePrimaryMedication(patient);
  return {
    patientId: patient?.id || '', medicationId: medication?.id || '',
    currentDose: medication?.dose || 'Sin dosis registrada', newDoseValue: medication?.doseValue ?? '',
    doseUnit: medication?.doseUnit || 'mg', frequency: medication?.frequency || 'una vez al día',
    effectiveDate: new Date().toISOString().slice(0, 10), reason: '', notes: '',
  };
}

export function assessmentFormDefaults(patient, assessment = null, point = null) {
  const primary = patient?.assessments?.[0];
  return {
    patientId: patient?.id || '', code: assessment?.code || primary?.code || 'PHQ-9', score: point?.value ?? '',
    pointId: point?.id || '', originalDate: point?.date || '', editing: Boolean(point),
    date: String(point?.date || new Date().toISOString()).slice(0, 10), adherence: patient?.adherence ?? 100,
    functioningChange: patient?.functioningChange ?? 0, sleepCurrent: patient?.sleepCurrent ?? '',
    status: patient?.status || 'stable', risk: patient?.risk || 'low', note: '',
  };
}

export function vitalsFormDefaults(patient, record = null) {
  const source = record || patient?.vitals || {};
  const bp = String(source.bp || '').split('/');
  return {
    id: record?.id || '', patientId: patient?.id || '', date: String(record?.date || new Date().toISOString()).slice(0, 10),
    weight: source.weight ?? '', height: source.height ?? '',
    systolic: bp[0] || '', diastolic: bp[1] || '', pulse: source.pulse ?? '',
    sleepCurrent: source.sleepCurrent ?? patient?.sleepCurrent ?? '', appetite: source.appetite || patient?.appetite || 'No registrado', notes: source.notes || '',
  };
}

export function adverseFormDefaults(patient, adverseEvent = null) {
  const knownName = adverseEvent && COMMON_ADVERSE_EFFECTS.includes(adverseEvent.name) ? adverseEvent.name : adverseEvent ? 'Otro' : COMMON_ADVERSE_EFFECTS[0];
  return {
    id: adverseEvent?.id || '', patientId: patient?.id || '', medicationId: adverseEvent?.medicationId || activePrimaryMedication(patient)?.id || '',
    name: knownName, customName: knownName === 'Otro' ? adverseEvent?.name || '' : '', severity: adverseEvent?.severity || 'mild', status: adverseEvent?.status || 'active',
    onset: String(adverseEvent?.onset || new Date().toISOString()).slice(0, 10), relation: adverseEvent?.relation || '', actionTaken: adverseEvent?.actionTaken || '',
  };
}

export function labFormDefaults(patient, lab = null) {
  return {
    id: lab?.id || '', patientId: patient?.id || '', name: lab?.name || '', value: lab?.value ?? '', unit: lab?.unit || '', status: lab?.status || 'normal',
    date: String(lab?.date || new Date().toISOString()).slice(0, 10), reference: lab?.reference || '', notes: lab?.notes || '',
  };
}

export function appointmentFormDefaults(data, date = new Date(), appointment = null, patientId = null) {
  if (appointment) {
    return {
      id: appointment.id,
      patientId: appointment.patientId,
      start: appointment.start ? new Date(new Date(appointment.start).getTime() - new Date(appointment.start).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '',
      duration: Math.max(15, Math.round((new Date(appointment.end) - new Date(appointment.start)) / 60_000)),
      type: appointment.type || 'Seguimiento', modality: appointment.modality || 'Presencial',
      status: appointment.status || 'pending', adminReviewStatus: appointment.adminReviewStatus || 'none', notes: appointment.notes || '',
    };
  }
  const start = new Date(date);
  if (start.getHours() === 0) start.setHours(9, 0, 0, 0);
  const offset = start.getTimezoneOffset();
  const local = new Date(start.getTime() - offset * 60_000).toISOString().slice(0, 16);
  return {
    id: null,
    patientId: patientId || data.patients[0]?.id || '',
    start: local,
    duration: 45,
    type: 'Seguimiento', modality: 'Presencial', status: 'pending', adminReviewStatus: 'none', notes: '',
  };
}

export function createPatient(data, draft) {
  const name = cleanText(draft.name);
  const diagnosis = cleanText(draft.diagnosis);
  if (!name) throw new Error('Escribe el nombre del paciente.');
  if (!diagnosis) throw new Error('Escribe el diagnóstico principal.');
  const age = numberOrNull(draft.age);
  if (age === null || age < 0 || age > 120) throw new Error('Escribe una edad válida.');

  const scale = SCALE_CATALOG.find(item => item.code === draft.scaleCode) || SCALE_CATALOG[0];
  const initialScore = numberOrNull(draft.initialScore);
  if (initialScore !== null && (initialScore < scale.min || initialScore > scale.max)) {
    throw new Error(`${scale.code} admite valores entre ${scale.min} y ${scale.max}.`);
  }

  const patientId = uid('patient');
  const timestamp = nowIso();
  const patient = normalizePatient({
    id: patientId,
    initials: initialsFromName(name),
    name,
    age,
    sex: draft.sex || 'No registrado',
    phone: cleanText(draft.phone),
    email: cleanText(draft.email),
    photo: draft.photo || '',
    preferredName: cleanText(draft.preferredName),
    pronouns: cleanText(draft.pronouns),
    sexAssignedAtBirth: draft.sexAssignedAtBirth || 'No registrado',
    genderIdentity: draft.genderIdentity || 'No registrada',
    sexualOrientation: draft.sexualOrientation || 'No registrada',
    relationshipStatus: draft.relationshipStatus || 'No registrado',
    significantPeople: cleanText(draft.significantPeople),
    safetyHistory: {
      ideationHistory: draft.ideationHistory || 'No registrada',
      suicideAttemptsCount: Number(draft.suicideAttemptsCount) || 0,
      lastAttemptDate: draft.lastAttemptDate || '',
      selfHarmHistory: draft.selfHarmHistory || 'No registrada',
      safetyPlan: cleanText(draft.safetyPlan),
      emergencyContact: cleanText(draft.emergencyContact),
      notes: cleanText(draft.safetyHistoryNotes),
    },
    vitalStatus: draft.vitalStatus || 'active',
    deathRecord: normalizeDeathRecord({}),
    notificationPreferences: normalizeNotificationPreferences({
      enabled: draft.reminderEnabled !== false,
      channels: Array.isArray(draft.reminderChannels) ? draft.reminderChannels : ['whatsapp'],
      reminderHours: Array.isArray(draft.reminderHours) ? draft.reminderHours : [24, 8],
      email: draft.reminderEmail || draft.email,
      phone: draft.reminderPhone || draft.phone,
      consentStatus: draft.reminderConsentStatus || 'pending',
      language: draft.reminderLanguage || 'Español',
      consentRecordedAt: draft.reminderConsentStatus === 'granted' ? timestamp : null,
    }, { email: draft.email, phone: draft.phone }),
    documents: [],
    consultations: [],
    insurance: {
      hasInsurance: Boolean(draft.hasInsurance),
      provider: cleanText(draft.insuranceProvider),
      plan: cleanText(draft.insurancePlan),
      memberId: cleanText(draft.insuranceMemberId),
      policyNumber: cleanText(draft.insurancePolicyNumber),
      authorizationRequired: Boolean(draft.insuranceAuthorizationRequired),
      copay: cleanText(draft.insuranceCopay),
      notes: cleanText(draft.insuranceNotes),
    },
    diagnosis,
    diagnosisCode: cleanText(draft.diagnosisCode) || 'Sin código',
    risk: draft.risk || 'low',
    status: draft.status || 'stable',
    clinician: data.organization?.clinician || 'Psiquiatra tratante',
    lastVisit: timestamp,
    nextVisit: draft.nextVisit ? fromLocalInputDateTime(draft.nextVisit) : null,
    medications: [],
    assessments: initialScore === null ? [] : [{
      code: scale.code,
      label: scale.label,
      direction: scale.direction,
      points: [{ date: timestamp, value: initialScore }],
    }],
    adherence: 100,
    functioningChange: 0,
    sleepBaseline: null,
    sleepCurrent: null,
    appetite: 'No registrado',
    vitals: {},
    adverseEvents: [],
    labs: [],
    prescriptions: [],
    timeline: [
      { date: timestamp, type: 'context', title: 'Paciente registrado', detail: `Diagnóstico principal: ${diagnosis}.` },
      ...(initialScore === null ? [] : [{ date: timestamp, type: 'assessment', title: `${scale.code}: ${initialScore}`, detail: 'Puntaje inicial registrado.' }]),
    ],
    notes: cleanText(draft.notes) ? [{ id: uid('note'), date: timestamp, text: cleanText(draft.notes) }] : [],
  });

  let next = { ...data, patients: [patient, ...data.patients] };
  if (draft.nextVisit) {
    const start = fromLocalInputDateTime(draft.nextVisit);
    next = {
      ...next,
      appointments: [
        ...next.appointments,
        {
          id: uid('appointment'), patientId, title: name, start, end: addMinutes(start, 45),
          type: 'Primera consulta', modality: 'Presencial', status: 'pending', adminReviewStatus: 'none', notes: 'Cita creada durante el alta del paciente.',
          reminderLog: [], createdAt: timestamp, updatedAt: timestamp,
        },
      ],
    };
  }
  return { data: next, patientId };
}


export function updatePatientProfile(data, patientId, draft) {
  const name = cleanText(draft.name);
  const diagnosis = cleanText(draft.diagnosis);
  if (!name) throw new Error('Escribe el nombre del paciente.');
  if (!diagnosis) throw new Error('Escribe el diagnóstico principal.');
  const age = numberOrNull(draft.age);
  if (age === null || age < 0 || age > 120) throw new Error('Escribe una edad válida.');
  const timestamp = nowIso();
  const previous = data.patients.find(item => item.id === patientId);
  if (!previous) throw new Error('El paciente ya no está disponible.');
  const vitalStatus = draft.vitalStatus || previous.vitalStatus || 'active';
  const becameDeceased = previous.vitalStatus !== 'deceased' && vitalStatus === 'deceased';
  const deathRecord = vitalStatus === 'deceased'
    ? normalizeDeathRecord({
        ...previous.deathRecord,
        dateOfDeath: draft.deathDate,
        informedAt: draft.deathInformedAt || timestamp,
        confirmedBy: draft.deathConfirmedBy,
        sourceType: draft.deathSourceType,
        sourceDocument: draft.deathSourceDocument,
        place: draft.deathPlace,
        manner: draft.deathManner,
        notes: draft.deathNotes,
        recordedAt: previous.deathRecord?.recordedAt || timestamp,
        recordedBy: data.settings?.activeUserId || null,
      })
    : normalizeDeathRecord(previous.deathRecord);
  const notificationPreferences = normalizeNotificationPreferences({
    ...previous.notificationPreferences,
    enabled: vitalStatus === 'deceased' ? false : draft.reminderEnabled !== false,
    channels: Array.isArray(draft.reminderChannels) ? draft.reminderChannels : previous.notificationPreferences?.channels,
    reminderHours: Array.isArray(draft.reminderHours) ? draft.reminderHours : previous.notificationPreferences?.reminderHours,
    email: draft.reminderEmail || draft.email,
    phone: draft.reminderPhone || draft.phone,
    consentStatus: draft.reminderConsentStatus || previous.notificationPreferences?.consentStatus,
    language: draft.reminderLanguage || previous.notificationPreferences?.language,
    consentRecordedAt: draft.reminderConsentStatus === 'granted' && previous.notificationPreferences?.consentStatus !== 'granted'
      ? timestamp
      : previous.notificationPreferences?.consentRecordedAt,
  }, { email: draft.email, phone: draft.phone });

  const patients = data.patients.map(patient => patient.id === patientId ? {
    ...patient,
    name,
    initials: initialsFromName(name),
    age,
    sex: draft.sex || patient.sex,
    phone: cleanText(draft.phone),
    email: cleanText(draft.email),
    photo: draft.photo ?? patient.photo,
    preferredName: cleanText(draft.preferredName),
    pronouns: cleanText(draft.pronouns),
    sexAssignedAtBirth: draft.sexAssignedAtBirth || 'No registrado',
    genderIdentity: draft.genderIdentity || 'No registrada',
    sexualOrientation: draft.sexualOrientation || 'No registrada',
    relationshipStatus: draft.relationshipStatus || 'No registrado',
    significantPeople: cleanText(draft.significantPeople),
    safetyHistory: {
      ...(patient.safetyHistory || {}),
      ideationHistory: draft.ideationHistory || 'No registrada',
      suicideAttemptsCount: Number(draft.suicideAttemptsCount) || 0,
      lastAttemptDate: draft.lastAttemptDate || '',
      selfHarmHistory: draft.selfHarmHistory || 'No registrada',
      safetyPlan: cleanText(draft.safetyPlan),
      emergencyContact: cleanText(draft.emergencyContact),
      notes: cleanText(draft.safetyHistoryNotes),
    },
    vitalStatus,
    deathRecord,
    notificationPreferences,
    insurance: draft.hasInsurance === undefined ? patient.insurance : {
      hasInsurance: Boolean(draft.hasInsurance),
      provider: cleanText(draft.insuranceProvider),
      plan: cleanText(draft.insurancePlan),
      memberId: cleanText(draft.insuranceMemberId),
      policyNumber: cleanText(draft.insurancePolicyNumber),
      authorizationRequired: Boolean(draft.insuranceAuthorizationRequired),
      copay: cleanText(draft.insuranceCopay),
      notes: cleanText(draft.insuranceNotes),
    },
    diagnosis,
    diagnosisCode: cleanText(draft.diagnosisCode) || 'Sin código',
    risk: draft.risk || patient.risk,
    status: draft.status || patient.status,
    notes: cleanText(draft.notes)
      ? [...(Array.isArray(patient.notes) ? patient.notes : []), { id: uid('note'), date: timestamp, text: cleanText(draft.notes) }]
      : patient.notes,
    timeline: becameDeceased
      ? [{ date: timestamp, type: 'status', title: 'Estado vital actualizado a fallecido', detail: `Fuente: ${deathRecord.sourceType}. Manera documentada: ${deathRecord.manner}.` }, ...(patient.timeline || [])]
      : patient.timeline,
    updatedAt: timestamp,
  } : patient);

  const appointments = vitalStatus === 'deceased'
    ? data.appointments.map(appointment => appointment.patientId === patientId && new Date(appointment.start) >= new Date() && !['completed', 'cancelled', 'no_show'].includes(appointment.status)
      ? { ...appointment, status: 'cancelled', notes: `${appointment.notes || ''}${appointment.notes ? '\n' : ''}Cancelada automáticamente al registrar el estado vital del paciente.`, updatedAt: timestamp }
      : appointment)
    : data.appointments;

  return { data: { ...data, patients, appointments } };
}

export function addMedication(data, patientId, draft) {
  const name = cleanText(draft.name);
  const doseValue = numberOrNull(draft.doseValue);
  if (!name) throw new Error('Escribe el nombre del medicamento.');
  if (doseValue === null || doseValue <= 0) throw new Error('Escribe una dosis mayor que cero.');
  const date = clinicalDateIso(draft.startDate);
  const doseUnit = cleanText(draft.doseUnit) || 'mg';
  const medicationId = uid('medication');
  const actor = data.settings?.activeUserId || null;
  const frequency = draft.frequency === 'otra' ? cleanText(draft.customFrequency) : draft.frequency || 'una vez al día';
  const medication = {
    id: medicationId,
    name,
    class: draft.class || 'Otro',
    doseValue,
    doseUnit,
    dose: `${doseValue} ${doseUnit}`,
    frequency,
    frequencySlots: frequencySlotsFor(draft.frequency, draft.customFrequency),
    customFrequency: draft.frequency === 'otra' ? cleanText(draft.customFrequency) : '',
    route: draft.route || 'oral',
    indication: cleanText(draft.indication) || 'Sin indicación registrada',
    startDate: date,
    endDate: null,
    status: 'active',
    source: draft.source || 'clinical',
    createdBy: actor,
    createdAt: nowIso(),
    reviewedBy: actor,
    reviewedAt: nowIso(),
    isPrimary: Boolean(draft.isPrimary),
    isPrn: Boolean(draft.isPrn),
    notes: cleanText(draft.notes),
    clinicalNotes: cleanText(draft.notes),
    internalNotes: '',
    reportedNotes: '',
    events: [{ id: uid('medevent'), type: 'created', date, actorId: actor, reason: 'Inicio del medicamento' }],
    doseHistory: [{
      id: uid('dose'), date, doseValue, doseUnit, dose: `${doseValue} ${doseUnit}`,
      reason: 'Inicio del medicamento', notes: cleanText(draft.notes),
    }],
  };

  const next = updatePatient(data, patientId, patient => {
    const medications = (patient.medications || []).map(item => draft.isPrimary ? { ...item, isPrimary: false } : item);
    medications.push(medication);
    return {
      ...patient,
      medications,
      medication: draft.isPrimary || !activePrimaryMedication(patient) ? medication : patient.medication,
      timeline: [
        ...(patient.timeline || []),
        {
          date,
          type: 'medication',
          title: `Inicio de ${name} ${doseValue} ${doseUnit}`,
          detail: `${medication.frequency}. Indicación: ${medication.indication}.${medication.notes ? ` ${medication.notes}` : ''}`,
        },
      ],
    };
  });
  return { data: next, medicationId };
}

export function updateMedication(data, patientId, draft) {
  const patient = data.patients.find(item => item.id === patientId);
  const previous = patient?.medications?.find(item => item.id === draft.id);
  if (!previous || previous.archivedAt) throw new Error('El medicamento ya no está disponible para editarse.');
  const name = cleanText(draft.name);
  const doseValue = numberOrNull(draft.doseValue);
  if (!name) throw new Error('Escribe el nombre del medicamento.');
  if (doseValue === null || doseValue <= 0) throw new Error('Escribe una dosis mayor que cero.');
  const timestamp = nowIso();
  const actor = data.settings?.activeUserId || null;
  const doseUnit = cleanText(draft.doseUnit) || 'mg';
  const frequency = draft.frequency === 'otra' ? cleanText(draft.customFrequency) : draft.frequency || 'una vez al día';
  if (!frequency) throw new Error('Escribe la frecuencia del medicamento.');
  const dose = `${doseValue} ${doseUnit}`;
  const correction = {
    at: timestamp,
    by: actor,
    before: {
      name: previous.name, class: previous.class, indication: previous.indication, dose: previous.dose,
      frequency: previous.frequency, route: previous.route, startDate: previous.startDate,
      isPrimary: previous.isPrimary, isPrn: previous.isPrn, clinicalNotes: previous.clinicalNotes || previous.notes || '',
    },
  };
  const updated = {
    ...previous,
    name,
    class: draft.class || 'Otro',
    indication: cleanText(draft.indication) || 'Sin indicación registrada',
    doseValue,
    doseUnit,
    dose,
    frequency,
    frequencySlots: frequencySlotsFor(draft.frequency, draft.customFrequency),
    customFrequency: draft.frequency === 'otra' ? cleanText(draft.customFrequency) : '',
    route: draft.route || 'oral',
    startDate: clinicalDateIso(draft.startDate),
    isPrimary: Boolean(draft.isPrimary),
    isPrn: Boolean(draft.isPrn),
    notes: cleanText(draft.notes),
    clinicalNotes: cleanText(draft.notes),
    correctedAt: timestamp,
    correctedBy: actor,
    corrections: [...(previous.corrections || []), correction],
    events: [...(previous.events || []), { id: uid('medevent'), type: 'corrected', date: timestamp, actorId: actor, reason: 'Datos del medicamento corregidos' }],
    doseHistory: previous.dose === dose ? previous.doseHistory : [...(previous.doseHistory || []), { id: uid('dose'), date: timestamp, doseValue, doseUnit, dose, reason: 'Corrección del registro', notes: cleanText(draft.notes) }],
  };
  const next = updatePatient(data, patientId, current => ({
    ...current,
    medications: (current.medications || []).map(item => item.id === previous.id ? updated : draft.isPrimary ? { ...item, isPrimary: false } : item),
    timeline: [{ date: timestamp, type: 'medication', title: `Registro de ${name} corregido`, detail: `${dose} · ${frequency}.` }, ...(current.timeline || [])],
  }));
  return { data: next, medicationId: previous.id };
}

export function changeMedicationDose(data, patientId, draft) {
  const newDoseValue = numberOrNull(draft.newDoseValue);
  if (newDoseValue === null || newDoseValue <= 0) throw new Error('Escribe una dosis nueva mayor que cero.');
  const patient = data.patients.find(item => item.id === patientId);
  const existing = patient?.medications?.find(item => item.id === draft.medicationId);
  if (!existing) throw new Error('Selecciona un medicamento activo.');
  const previousValue = numberOrNull(existing.doseValue);
  const unit = cleanText(draft.doseUnit) || existing.doseUnit || 'mg';
  const effectiveDate = clinicalDateIso(draft.effectiveDate);
  const reason = cleanText(draft.reason) || 'Ajuste clínico registrado';
  const direction = previousValue === null ? 'Cambio' : newDoseValue > previousValue ? 'Aumento' : newDoseValue < previousValue ? 'Reducción' : 'Confirmación';
  const newDose = `${newDoseValue} ${unit}`;
  const actor = data.settings?.activeUserId || null;
  const frequency = draft.frequency === 'otra' ? cleanText(draft.customFrequency) : draft.frequency || existing.frequency;

  const next = updatePatient(data, patientId, current => {
    const medications = current.medications.map(item => {
      if (item.id !== existing.id) return item;
      return {
        ...item,
        doseValue: newDoseValue,
        doseUnit: unit,
        dose: newDose,
        frequency,
        frequencySlots: frequencySlotsFor(draft.frequency, draft.customFrequency),
        customFrequency: draft.frequency === 'otra' ? cleanText(draft.customFrequency) : '',
        events: [...(item.events || []), { id: uid('medevent'), type: newDose === existing.dose ? 'frequency_changed' : 'dose_changed', date: effectiveDate, actorId: actor, reason }],
        doseHistory: sortedByDate([
          ...(item.doseHistory || []),
          {
            id: uid('dose'), date: effectiveDate, doseValue: newDoseValue, doseUnit: unit,
            dose: newDose, reason, notes: cleanText(draft.notes), previousDose: existing.dose,
          },
        ]),
      };
    });
    return {
      ...current,
      medications,
      timeline: [
        ...(current.timeline || []),
        {
          date: effectiveDate,
          type: 'medication',
          title: `${direction} de ${existing.name}: ${existing.dose} → ${newDose}`,
          detail: `${reason}.${draft.notes ? ` ${cleanText(draft.notes)}` : ''}`,
        },
      ],
    };
  });
  return { data: next };
}

export function setMedicationStatus(data, patientId, medicationId, status, reason = '') {
  const date = nowIso();
  const normalizedStatus = ({held:'suspended',stopped:'discontinued'})[status] || status;
  const actor = data.settings?.activeUserId || null;
  const next = updatePatient(data, patientId, patient => {
    const target = patient.medications.find(item => item.id === medicationId);
    if (!target) return patient;
    const medications = patient.medications.map(item => item.id === medicationId
      ? { ...item, status: normalizedStatus, endDate: ['discontinued','completed'].includes(normalizedStatus) ? date : normalizedStatus === 'active' ? null : item.endDate, events: [...(item.events || []), { id: uid('medevent'), type: normalizedStatus === 'active' ? 'resumed' : normalizedStatus, date, actorId: actor, reason: cleanText(reason) || 'Estado actualizado por el profesional.' }] }
      : item);
    return {
      ...patient,
      medications,
      timeline: [
        ...(patient.timeline || []),
        {
          date,
          type: 'medication',
          title: `${normalizedStatus === 'suspended' ? 'Suspensión' : normalizedStatus === 'active' ? 'Reinicio' : normalizedStatus === 'completed' ? 'Finalización' : 'Descontinuación'} de ${target.name}`,
          detail: cleanText(reason) || 'Estado actualizado por el profesional.',
        },
      ],
    };
  });
  return { data: next };
}

export function approveCapturedMedication(data, patientId, medicationId, reason = '') {
  const patient = data.patients.find(item => item.id === patientId);
  const medication = patient?.medications?.find(item => item.id === medicationId);
  if (!medication || medication.status !== 'pending_review') throw new Error('El medicamento ya no está pendiente de revisión.');
  return setMedicationStatus(data, patientId, medicationId, 'active', reason || 'Revisado y activado por el médico.');
}

export function recordAssessment(data, patientId, draft) {
  const scale = SCALE_CATALOG.find(item => item.code === draft.code) || SCALE_CATALOG[0];
  const score = numberOrNull(draft.score);
  if (score === null || score < scale.min || score > scale.max) {
    throw new Error(`${scale.code} admite valores entre ${scale.min} y ${scale.max}.`);
  }
  const date = clinicalDateIso(draft.date);
  const patient = data.patients.find(item => item.id === patientId);
  const existingScale = patient?.assessments?.find(item => item.code === scale.code);
  const previousPoints = existingScale?.points ? sortedByDate(existingScale.points.filter(point => !point.archivedAt)) : [];
  const previous = previousPoints.at(-1)?.value;
  const adherence = numberOrNull(draft.adherence);
  const functioningChange = numberOrNull(draft.functioningChange);
  const sleepCurrent = numberOrNull(draft.sleepCurrent);
  if (adherence !== null && (adherence < 0 || adherence > 100)) throw new Error('La adherencia debe estar entre 0 y 100%.');
  if (functioningChange !== null && (functioningChange < -100 || functioningChange > 100)) throw new Error('El cambio de funcionamiento debe estar entre -100% y 100%.');
  if (sleepCurrent !== null && (sleepCurrent < 0 || sleepCurrent > 24)) throw new Error('Las horas de sueño deben estar entre 0 y 24.');

  let next = updatePatient(data, patientId, current => {
    const assessments = [...(current.assessments || [])];
    const index = assessments.findIndex(item => item.code === scale.code);
    const priorPoints = index >= 0 ? assessments[index].points : [];
    let pointFound = !draft.editing;
    const correctedPoints = draft.editing
      ? priorPoints.map(point => {
        const matches = (draft.pointId && point.id === draft.pointId) || (!draft.pointId && point.date === draft.originalDate);
        if (!matches) return point;
        pointFound = true;
        return { ...point, id: point.id || uid('assessment'), date, value: score, correctedAt: nowIso(), correctedBy: data.settings?.activeUserId || null };
      })
      : [...priorPoints, { id: uid('assessment'), date, value: score }];
    if (!pointFound) throw new Error('La medición ya no está disponible para editarse.');
    const updatedScale = {
      code: scale.code,
      label: scale.label,
      direction: scale.direction,
      points: sortedByDate(correctedPoints),
    };
    if (index >= 0) assessments[index] = updatedScale;
    else assessments.unshift(updatedScale);
    return {
      ...current,
      assessments,
      adherence: adherence ?? current.adherence,
      functioningChange: functioningChange ?? current.functioningChange,
      sleepCurrent: sleepCurrent ?? current.sleepCurrent,
      status: draft.status || current.status,
      risk: draft.risk || current.risk,
      lastVisit: date,
      timeline: [
        ...(current.timeline || []),
        {
          date,
          type: 'assessment',
          title: `${scale.code}: ${score}${draft.editing ? ' (corregido)' : ''}`,
          detail: `${scale.label}.${draft.note ? ` ${cleanText(draft.note)}` : ''}`,
        },
      ],
    };
  });

  const worsened = previous !== undefined && previous !== null && (
    scale.direction === 'lower' ? score > Number(previous) : score < Number(previous)
  );
  const relativeChange = Number(previous) ? Math.abs(score - Number(previous)) / Math.abs(Number(previous)) * 100 : 0;
  if (worsened && relativeChange >= 20) {
    next = appendAlert(next, {
      patientId,
      severity: 'medium',
      category: 'Evolución',
      title: `Cambio desfavorable observado en ${scale.code}`,
      detail: `El puntaje cambió de ${previous} a ${score}. Debe interpretarse en el contexto clínico y no atribuye causalidad automática.`,
      createdAt: date,
    });
  }
  if ((adherence ?? patient?.adherence ?? 100) < 75) {
    next = appendAlert(next, {
      patientId,
      severity: 'medium',
      category: 'Adherencia',
      title: 'Adherencia reportada menor de 75%',
      detail: 'Conviene revisar olvidos, efectos adversos, acceso, costo y preferencia del paciente antes de interpretar falta de respuesta.',
      createdAt: date,
    });
  }
  if (draft.risk === 'high') {
    next = appendAlert(next, {
      patientId,
      severity: 'high',
      category: 'Riesgo',
      title: 'Nivel de riesgo alto registrado',
      detail: 'Requiere revisión clínica prioritaria según el protocolo del profesional. El sistema no realiza una intervención automática.',
      createdAt: date,
    });
  }
  return { data: next };
}

export function recordVitals(data, patientId, draft) {
  const date = clinicalDateIso(draft.date);
  const weight = numberOrNull(draft.weight);
  const height = numberOrNull(draft.height);
  const systolic = numberOrNull(draft.systolic);
  const diastolic = numberOrNull(draft.diastolic);
  const pulse = numberOrNull(draft.pulse);
  const sleepCurrent = numberOrNull(draft.sleepCurrent);
  if ([weight, height, systolic, diastolic, pulse, sleepCurrent].every(value => value === null) && (!draft.appetite || draft.appetite === 'No registrado') && !cleanText(draft.notes)) {
    throw new Error('Registra al menos un dato del control físico.');
  }
  if (weight !== null && weight <= 0) throw new Error('El peso debe ser mayor que cero.');
  if (height !== null && height <= 0) throw new Error('La estatura debe ser mayor que cero.');
  if (systolic !== null && systolic <= 0) throw new Error('La presión sistólica debe ser mayor que cero.');
  if (diastolic !== null && diastolic <= 0) throw new Error('La presión diastólica debe ser mayor que cero.');
  if (pulse !== null && pulse <= 0) throw new Error('El pulso debe ser mayor que cero.');
  if (sleepCurrent !== null && (sleepCurrent < 0 || sleepCurrent > 24)) throw new Error('Las horas de sueño deben estar entre 0 y 24.');
  const patient = data.patients.find(item => item.id === patientId);
  const effectiveWeight = weight ?? numberOrNull(patient?.vitals?.weight);
  const effectiveHeight = height ?? numberOrNull(patient?.vitals?.height);
  const baselineWeight = numberOrNull(patient?.vitals?.baselineWeight) ?? effectiveWeight;
  const bmi = calculateBMI(effectiveWeight, effectiveHeight) ?? numberOrNull(patient?.vitals?.bmi);
  const bp = systolic !== null && diastolic !== null ? `${systolic}/${diastolic}` : patient?.vitals?.bp || 'Sin registrar';
  const previousRecord = draft.id ? patient?.vitalsHistory?.find(item => item.id === draft.id) : null;
  if (draft.id && (!previousRecord || previousRecord.archivedAt)) throw new Error('El control físico ya no está disponible para editarse.');
  const record = {
    ...previousRecord,
    id: previousRecord?.id || uid('vital'), date, baselineWeight,
    weight: effectiveWeight,
    height: effectiveHeight,
    bmi,
    bp,
    pulse: pulse ?? patient?.vitals?.pulse ?? null,
    sleepCurrent: sleepCurrent ?? patient?.sleepCurrent ?? null,
    appetite: draft.appetite || patient?.appetite || 'No registrado',
    notes: cleanText(draft.notes),
    correctedAt: previousRecord ? nowIso() : null,
    correctedBy: previousRecord ? data.settings?.activeUserId || null : null,
    versions: previousRecord ? [...(previousRecord.versions || []), { ...previousRecord, archivedAt: nowIso() }] : [],
  };

  let next = updatePatient(data, patientId, current => {
    const vitalsHistory = sortedByDate(previousRecord
      ? (current.vitalsHistory || []).map(item => item.id === previousRecord.id ? record : item)
      : [...(current.vitalsHistory || []), record]);
    const latest = [...vitalsHistory].filter(item => !item.archivedAt).at(-1) || {};
    return {
      ...current,
      vitals: latest,
      vitalsHistory,
      sleepCurrent: latest.sleepCurrent ?? current.sleepCurrent,
      appetite: latest.appetite || current.appetite,
      timeline: [
        ...(current.timeline || []),
        {
          date,
          type: 'vital',
          title: previousRecord ? 'Control físico corregido' : 'Control físico registrado',
          detail: [
            record.weight !== null ? `Peso ${record.weight} kg` : null,
            bp !== 'Sin registrar' ? `presión ${bp}` : null,
            record.pulse !== null ? `pulso ${record.pulse} bpm` : null,
          ].filter(Boolean).join(' · ') || 'Datos de seguimiento físico actualizados.',
        },
      ],
    };
  });

  if (baselineWeight && record.weight && ((record.weight - baselineWeight) / baselineWeight) * 100 >= 5) {
    next = appendAlert(next, {
      patientId,
      severity: 'medium',
      category: 'Seguridad',
      title: 'Aumento de peso observado desde el valor inicial',
      detail: `El peso pasó de ${baselineWeight} kg a ${record.weight} kg. La relevancia y el plan deben valorarse clínicamente.`,
      createdAt: date,
    });
  }
  return { data: next };
}

export function recordAdverseEvent(data, patientId, draft) {
  const name = draft.name === 'Otro' ? cleanText(draft.customName) : cleanText(draft.name);
  if (!name) throw new Error('Escribe el efecto observado.');
  const date = clinicalDateIso(draft.onset);
  const patient = data.patients.find(item => item.id === patientId);
  const previous = draft.id ? patient?.adverseEvents?.find(item => item.id === draft.id) : null;
  if (draft.id && (!previous || previous.archivedAt)) throw new Error('El efecto ya no está disponible para editarse.');
  const timestamp = nowIso();
  const event = {
    ...previous,
    id: previous?.id || uid('adverse'),
    medicationId: draft.medicationId || null,
    name,
    severity: draft.severity || 'mild',
    onset: date,
    status: draft.status || 'active',
    relation: cleanText(draft.relation) || 'Relación temporal todavía no evaluada.',
    actionTaken: cleanText(draft.actionTaken),
    createdAt: previous?.createdAt || timestamp,
    createdBy: previous?.createdBy || data.settings?.activeUserId || null,
    correctedAt: previous ? timestamp : null,
    correctedBy: previous ? data.settings?.activeUserId || null : null,
    versions: previous ? [...(previous.versions || []), { ...previous, archivedAt: timestamp }] : [],
  };
  let next = updatePatient(data, patientId, patient => ({
    ...patient,
    adverseEvents: previous
      ? (patient.adverseEvents || []).map(item => item.id === previous.id ? event : item)
      : [event, ...(patient.adverseEvents || [])],
    timeline: [
      ...(patient.timeline || []),
      {
        date,
        type: 'alert',
        title: `${previous ? 'Efecto corregido' : 'Efecto observado'}: ${name}`,
        detail: `${event.relation}${event.actionTaken ? ` Acción registrada: ${event.actionTaken}.` : ''}`,
      },
    ],
  }));
  if (event.status === 'active' && ['moderate', 'severe', 'critical'].includes(event.severity)) {
    next = appendAlert(next, {
      patientId,
      severity: ['severe', 'critical'].includes(event.severity) ? 'high' : 'medium',
      category: 'Seguridad',
      title: `${name} requiere revisión`,
      detail: `${event.relation} El registro describe temporalidad, no causalidad confirmada.`,
      createdAt: date,
    });
  }
  return { data: next };
}


export function setAdverseEventStatus(data, patientId, eventId, status) {
  const date = nowIso();
  const next = updatePatient(data, patientId, patient => {
    const event = (patient.adverseEvents || []).find(item => item.id === eventId);
    if (!event) return patient;
    return {
      ...patient,
      adverseEvents: patient.adverseEvents.map(item => item.id === eventId
        ? { ...item, status, resolvedAt: status === 'resolved' ? date : null }
        : item),
      timeline: [
        ...(patient.timeline || []),
        {
          date,
          type: 'alert',
          title: `${event.name}: ${status === 'resolved' ? 'marcado como resuelto' : 'reabierto'}`,
          detail: 'Estado actualizado por el profesional.',
        },
      ],
    };
  });
  return { data: next };
}

export function recordLab(data, patientId, draft) {
  const name = cleanText(draft.name);
  if (!name) throw new Error('Escribe el nombre de la prueba.');
  if (draft.value === '') throw new Error('Escribe el resultado.');
  const date = clinicalDateIso(draft.date);
  const patient = data.patients.find(item => item.id === patientId);
  const previous = draft.id ? patient?.labs?.find(item => item.id === draft.id) : null;
  if (draft.id && (!previous || previous.archivedAt)) throw new Error('El resultado ya no está disponible para editarse.');
  const timestamp = nowIso();
  const lab = {
    ...previous,
    id: previous?.id || uid('lab'),
    name,
    value: cleanText(draft.value),
    unit: cleanText(draft.unit),
    status: draft.status || 'normal',
    date,
    reference: cleanText(draft.reference),
    notes: cleanText(draft.notes),
    createdAt: previous?.createdAt || timestamp,
    createdBy: previous?.createdBy || data.settings?.activeUserId || null,
    correctedAt: previous ? timestamp : null,
    correctedBy: previous ? data.settings?.activeUserId || null : null,
    versions: previous ? [...(previous.versions || []), { ...previous, archivedAt: timestamp }] : [],
  };
  let next = updatePatient(data, patientId, patient => ({
    ...patient,
    labs: previous
      ? (patient.labs || []).map(item => item.id === previous.id ? lab : item)
      : [lab, ...(patient.labs || [])],
    timeline: [
      ...(patient.timeline || []),
      {
        date,
        type: 'lab',
        title: `${name}: ${lab.value}${lab.unit ? ` ${lab.unit}` : ''}${previous ? ' (corregido)' : ''}`,
        detail: `${lab.status === 'normal' ? 'Registrado dentro del rango indicado.' : 'Marcado para revisión clínica.'}${lab.notes ? ` ${lab.notes}` : ''}`,
      },
    ],
  }));
  if (lab.status !== 'normal') {
    next = appendAlert(next, {
      patientId,
      severity: lab.status.includes('critical') ? 'high' : 'medium',
      category: 'Laboratorio',
      title: `${name} marcado para revisión`,
      detail: `Resultado: ${lab.value}${lab.unit ? ` ${lab.unit}` : ''}. Interpretar según rango del laboratorio, síntomas, diagnóstico y tratamiento.`,
      createdAt: date,
    });
  }
  return { data: next };
}

export function updatePatientDocumentMetadata(data, patientId, draft) {
  const patient = data.patients.find(item => item.id === patientId);
  const previous = patient?.documents?.find(item => item.id === draft.id);
  if (!previous || previous.archived) throw new Error('El documento ya no está disponible para editarse.');
  const name = cleanText(draft.name);
  if (!name) throw new Error('Escribe el nombre del documento.');
  const timestamp = nowIso();
  const actor = data.settings?.activeUserId || null;
  const document = {
    ...previous,
    name,
    category: draft.category || 'Otro',
    clinicalDate: clinicalDateIso(draft.clinicalDate),
    description: cleanText(draft.description),
    confidentiality: draft.confidentiality || 'Clínico',
    correctedAt: timestamp,
    correctedBy: actor,
    versions: [...(previous.versions || []), {
      at: timestamp,
      by: actor,
      name: previous.name,
      category: previous.category,
      clinicalDate: previous.clinicalDate,
      description: previous.description,
      confidentiality: previous.confidentiality,
    }],
    updatedAt: timestamp,
  };
  return {
    data: updatePatient(data, patientId, current => ({
      ...current,
      documents: (current.documents || []).map(item => item.id === previous.id ? document : item),
      timeline: [{ date: timestamp, type: 'document', title: `Documento corregido: ${name}`, detail: document.description || 'Metadatos del documento actualizados.' }, ...(current.timeline || [])],
    })),
    document,
  };
}

export function archiveClinicalRecord(data, patientId, resource, recordId, reason) {
  const archiveReason = cleanText(reason);
  if (archiveReason.length < 3) throw new Error('Escribe un motivo de al menos 3 caracteres.');
  const patient = data.patients.find(item => item.id === patientId);
  if (!patient) throw new Error('El paciente ya no está disponible.');
  const timestamp = nowIso();
  const actor = data.settings?.activeUserId || null;
  const audit = { archivedAt: timestamp, archivedBy: actor, archiveReason };
  let label = 'Registro';
  const next = updatePatient(data, patientId, current => {
    const patch = {};
    if (resource === 'adverseEvent') {
      const target = (current.adverseEvents || []).find(item => item.id === recordId && !item.archivedAt);
      if (!target) throw new Error('El efecto ya no está disponible.');
      label = `Efecto ${target.name}`;
      patch.adverseEvents = current.adverseEvents.map(item => item.id === recordId ? { ...item, ...audit } : item);
    } else if (resource === 'lab') {
      const target = (current.labs || []).find(item => item.id === recordId && !item.archivedAt);
      if (!target) throw new Error('El resultado ya no está disponible.');
      label = `Laboratorio ${target.name}`;
      patch.labs = current.labs.map(item => item.id === recordId ? { ...item, ...audit } : item);
    } else if (resource === 'vital') {
      const target = (current.vitalsHistory || []).find(item => item.id === recordId && !item.archivedAt);
      if (!target) throw new Error('El control físico ya no está disponible.');
      label = 'Control físico';
      patch.vitalsHistory = current.vitalsHistory.map(item => item.id === recordId ? { ...item, ...audit } : item);
      patch.vitals = [...patch.vitalsHistory].filter(item => !item.archivedAt).sort((left, right) => new Date(right.date) - new Date(left.date))[0] || {};
    } else if (resource === 'assessment') {
      const separator = String(recordId).indexOf('|');
      const code = separator >= 0 ? String(recordId).slice(0, separator) : '';
      const pointKey = separator >= 0 ? String(recordId).slice(separator + 1) : '';
      let found = false;
      patch.assessments = (current.assessments || []).map(assessment => assessment.code !== code ? assessment : {
        ...assessment,
        points: (assessment.points || []).map(point => {
          if (!found && !point.archivedAt && (point.id === pointKey || (!point.id && point.date === pointKey))) {
            found = true;
            return { ...point, ...audit };
          }
          return point;
        }),
      });
      if (!found) throw new Error('La medición ya no está disponible.');
      label = `Medición ${code}`;
    } else if (resource === 'document') {
      const target = (current.documents || []).find(item => item.id === recordId && !item.archived);
      if (!target) throw new Error('El documento ya no está disponible.');
      label = `Documento ${target.name}`;
      patch.documents = current.documents.map(item => item.id === recordId ? { ...item, archived: true, ...audit } : item);
    } else if (resource === 'consultation') {
      const target = (current.consultations || []).find(item => item.id === recordId);
      if (!target) throw new Error('La consulta ya no está disponible.');
      const signed = Boolean(target.signedAt) || ['completed', 'signed'].includes(String(target.status || '').toLowerCase());
      label = `Consulta ${target.title || ''}`.trim();
      if (signed) {
        if ((current.consultationRetractions || []).some(item => item.resourceId === recordId)) throw new Error('La consulta ya fue anulada.');
        patch.consultationRetractions = [{ id: uid('retraction'), resourceId: recordId, ...audit }, ...(current.consultationRetractions || [])];
      } else {
        if (target.archivedAt) throw new Error('El borrador ya fue retirado.');
        patch.consultations = current.consultations.map(item => item.id === recordId ? { ...item, ...audit } : item);
      }
    } else {
      throw new Error('Tipo de registro no compatible.');
    }
    return {
      ...current,
      ...patch,
      timeline: [{ date: timestamp, type: 'correction', title: `${label} retirado`, detail: `Motivo: ${archiveReason}.` }, ...(current.timeline || [])],
    };
  });
  return { data: next, archivedAt: timestamp };
}

export function setPatientArchived(data, patientId, reason) {
  const archiveReason = cleanText(reason);
  if (archiveReason.length < 3) throw new Error('Escribe un motivo de al menos 3 caracteres.');
  const timestamp = nowIso();
  const actor = data.settings?.activeUserId || null;
  const patient = data.patients.find(item => item.id === patientId);
  if (!patient) throw new Error('El paciente ya no está disponible.');
  return {
    ...data,
    patients: data.patients.map(item => item.id === patientId ? { ...item, archived: true, archivedAt: timestamp, archivedBy: actor, archiveReason, updatedAt: timestamp } : item),
    appointments: data.appointments.map(item => item.patientId === patientId && !['completed', 'cancelled', 'no_show'].includes(item.status) ? { ...item, status: 'cancelled', updatedAt: timestamp } : item),
  };
}

export function saveAppointment(data, draft) {
  const previousAppointment = draft.id ? data.appointments.find(item => item.id === draft.id) : null;
  const patient = data.patients.find(item => item.id === draft.patientId);
  if (!patient) throw new Error('Selecciona un paciente.');
  if (!draft.start) throw new Error('Selecciona fecha y hora.');
  const start = fromLocalInputDateTime(draft.start);
  const duration = Math.max(15, Number(draft.duration) || 45);
  const appointment = {
    id: draft.id || uid('appointment'),
    patientId: patient.id,
    title: patient.name,
    start,
    end: addMinutes(start, duration),
    type: draft.type || 'Seguimiento',
    modality: draft.modality || 'Presencial',
    status: draft.status || 'pending',
    adminReviewStatus: draft.adminReviewStatus || previousAppointment?.adminReviewStatus || 'none',
    notes: cleanText(draft.notes),
    reminderLog: Array.isArray(previousAppointment?.reminderLog) ? previousAppointment.reminderLog : [],
    createdAt: previousAppointment?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
  let next = {
    ...data,
    appointments: draft.id
      ? data.appointments.map(item => item.id === draft.id ? appointment : item)
      : [...data.appointments, appointment],
  };
  if (previousAppointment?.patientId && previousAppointment.patientId !== patient.id) {
    next = updateNextVisit(next, previousAppointment.patientId);
  }
  next = updateNextVisit(next, patient.id);
  return { data: next, appointment };
}

export function changeAppointmentStatus(data, appointmentId, status) {
  const appointment = data.appointments.find(item => item.id === appointmentId);
  let next = {
    ...data,
    appointments: data.appointments.map(item => item.id === appointmentId ? { ...item, status, updatedAt: nowIso() } : item),
  };
  if (appointment?.patientId) next = updateNextVisit(next, appointment.patientId);
  return next;
}

export function changeAppointmentReviewStatus(data, appointmentId, adminReviewStatus) {
  if (!['none','pending','reviewed'].includes(adminReviewStatus)) throw new Error('Estado de revisión no válido.');
  return {
    ...data,
    appointments: data.appointments.map(item => item.id === appointmentId ? { ...item, adminReviewStatus, updatedAt: nowIso() } : item),
  };
}

export function removeAppointment(data, appointmentId) {
  const appointment = data.appointments.find(item => item.id === appointmentId);
  let next = { ...data, appointments: data.appointments.filter(item => item.id !== appointmentId) };
  if (appointment?.patientId) next = updateNextVisit(next, appointment.patientId);
  return next;
}

export function updateAlertStatus(data, alertId, status) {
  return {
    ...data,
    alerts: data.alerts.map(item => item.id === alertId ? { ...item, status } : item),
  };
}

export function analyticsRows(data) {
  return data.patients.filter(patient => !patient.archived).map(patient => {
    const primary = patient.assessments?.find(item => item.points?.some(point => !point.archivedAt));
    const points = sortedByDate((primary?.points || []).filter(point => !point.archivedAt));
    const baseline = numberOrNull(points[0]?.value);
    const current = numberOrNull(points.at(-1)?.value);
    const improvement = baseline && current !== null
      ? (primary.direction === 'higher' ? (current - baseline) : (baseline - current)) / Math.abs(baseline) * 100
      : null;
    return {
      Paciente: patient.name,
      Diagnóstico: patient.diagnosis,
      Medicamento: activePrimaryMedication(patient)?.name || 'Sin medicamento',
      Dosis: activePrimaryMedication(patient)?.dose || '—',
      Escala: primary?.code || 'Sin escala',
      Inicial: baseline ?? '',
      Actual: current ?? '',
      'Mejoría observada %': improvement === null ? '' : improvement.toFixed(1),
      'Adherencia %': patient.adherence,
      Estado: patient.status,
      Riesgo: patient.risk,
    };
  });
}

export function buildPatientReport(patient, alerts = []) {
  const medication = activePrimaryMedication(patient);
  const primary = patient.assessments?.find(item => item.points?.some(point => !point.archivedAt));
  const points = sortedByDate((primary?.points || []).filter(point => !point.archivedAt));
  const baseline = numberOrNull(points[0]?.value);
  const current = numberOrNull(points.at(-1)?.value);
  const improvement = baseline && current !== null
    ? (primary.direction === 'higher' ? (current - baseline) : (baseline - current)) / Math.abs(baseline) * 100
    : null;
  return {
    patient,
    medication,
    primary,
    baseline,
    current,
    improvement,
    openAlerts: alerts.filter(item => item.patientId === patient.id && item.status === 'open'),
    activeAdverse: patient.adverseEvents.filter(item => !item.archivedAt && item.status === 'active'),
    generatedAt: nowIso(),
  };
}

export function validateImportedData(value) {
  if (!value || typeof value !== 'object') throw new Error('El archivo no contiene un respaldo válido.');
  if (!Array.isArray(value.patients) || !Array.isArray(value.appointments) || !Array.isArray(value.alerts)) {
    throw new Error('El respaldo debe incluir pacientes, citas y alertas.');
  }
  return value;
}
