import { COMMON_ADVERSE_EFFECTS, SCALE_CATALOG, normalizePatient } from './data.js';
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
  return patient.medications?.find(item => item.status === 'active' && item.isPrimary)
    || patient.medications?.find(item => item.status === 'active')
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
  };
}

export function medicationFormDefaults(patient) {
  return {
    patientId: patient?.id || '', name: '', class: 'ISRS', indication: patient?.diagnosis || '',
    doseValue: '', doseUnit: 'mg', frequency: 'una vez al día', route: 'oral',
    startDate: new Date().toISOString().slice(0, 10), isPrimary: true, isPrn: false, notes: '',
  };
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

export function assessmentFormDefaults(patient) {
  const primary = patient?.assessments?.[0];
  return {
    patientId: patient?.id || '', code: primary?.code || 'PHQ-9', score: '',
    date: new Date().toISOString().slice(0, 10), adherence: patient?.adherence ?? 100,
    functioningChange: patient?.functioningChange ?? 0, sleepCurrent: patient?.sleepCurrent ?? '',
    status: patient?.status || 'stable', risk: patient?.risk || 'low', note: '',
  };
}

export function vitalsFormDefaults(patient) {
  const bp = String(patient?.vitals?.bp || '').split('/');
  return {
    patientId: patient?.id || '', date: new Date().toISOString().slice(0, 10),
    weight: patient?.vitals?.weight ?? '', height: patient?.vitals?.height ?? '',
    systolic: bp[0] || '', diastolic: bp[1] || '', pulse: patient?.vitals?.pulse ?? '',
    sleepCurrent: patient?.sleepCurrent ?? '', appetite: patient?.appetite || 'No registrado', notes: '',
  };
}

export function adverseFormDefaults(patient) {
  return {
    patientId: patient?.id || '', medicationId: activePrimaryMedication(patient)?.id || '',
    name: COMMON_ADVERSE_EFFECTS[0], customName: '', severity: 'mild', status: 'active',
    onset: new Date().toISOString().slice(0, 10), relation: '', actionTaken: '',
  };
}

export function labFormDefaults(patient) {
  return {
    patientId: patient?.id || '', name: '', value: '', unit: '', status: 'normal',
    date: new Date().toISOString().slice(0, 10), reference: '', notes: '',
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
      status: appointment.status || 'confirmed', notes: appointment.notes || '',
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
    type: 'Seguimiento', modality: 'Presencial', status: 'confirmed', notes: '',
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
          type: 'Primera consulta', modality: 'Presencial', status: 'confirmed', notes: 'Cita creada durante el alta del paciente.',
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
  const next = updatePatient(data, patientId, patient => ({
    ...patient,
    name,
    initials: initialsFromName(name),
    age,
    sex: draft.sex || patient.sex,
    phone: cleanText(draft.phone),
    email: cleanText(draft.email),
    photo: draft.photo ?? patient.photo,
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
      ? [...(Array.isArray(patient.notes) ? patient.notes : []), { id: uid('note'), date: nowIso(), text: cleanText(draft.notes) }]
      : patient.notes,
  }));
  return { data: next };
}

export function addMedication(data, patientId, draft) {
  const name = cleanText(draft.name);
  const doseValue = numberOrNull(draft.doseValue);
  if (!name) throw new Error('Escribe el nombre del medicamento.');
  if (doseValue === null || doseValue <= 0) throw new Error('Escribe una dosis mayor que cero.');
  const date = clinicalDateIso(draft.startDate);
  const doseUnit = cleanText(draft.doseUnit) || 'mg';
  const medicationId = uid('medication');
  const medication = {
    id: medicationId,
    name,
    class: draft.class || 'Otro',
    doseValue,
    doseUnit,
    dose: `${doseValue} ${doseUnit}`,
    frequency: draft.frequency || 'una vez al día',
    route: draft.route || 'oral',
    indication: cleanText(draft.indication) || 'Sin indicación registrada',
    startDate: date,
    endDate: null,
    status: 'active',
    isPrimary: Boolean(draft.isPrimary),
    isPrn: Boolean(draft.isPrn),
    notes: cleanText(draft.notes),
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

  const next = updatePatient(data, patientId, current => {
    const medications = current.medications.map(item => {
      if (item.id !== existing.id) return item;
      return {
        ...item,
        doseValue: newDoseValue,
        doseUnit: unit,
        dose: newDose,
        frequency: draft.frequency || item.frequency,
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
  const next = updatePatient(data, patientId, patient => {
    const target = patient.medications.find(item => item.id === medicationId);
    if (!target) return patient;
    const medications = patient.medications.map(item => item.id === medicationId
      ? { ...item, status, endDate: status === 'stopped' || status === 'completed' ? date : item.endDate }
      : item);
    return {
      ...patient,
      medications,
      timeline: [
        ...(patient.timeline || []),
        {
          date,
          type: 'medication',
          title: `${status === 'held' ? 'Pausa' : status === 'active' ? 'Reinicio' : 'Finalización'} de ${target.name}`,
          detail: cleanText(reason) || 'Estado actualizado por el profesional.',
        },
      ],
    };
  });
  return { data: next };
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
  const previousPoints = existingScale?.points ? sortedByDate(existingScale.points) : [];
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
    const updatedScale = {
      code: scale.code,
      label: scale.label,
      direction: scale.direction,
      points: sortedByDate([...(index >= 0 ? assessments[index].points : []), { date, value: score }]),
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
          title: `${scale.code}: ${score}`,
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
  const record = {
    id: uid('vital'), date, baselineWeight,
    weight: effectiveWeight,
    height: effectiveHeight,
    bmi,
    bp,
    pulse: pulse ?? patient?.vitals?.pulse ?? null,
    sleepCurrent: sleepCurrent ?? patient?.sleepCurrent ?? null,
    appetite: draft.appetite || patient?.appetite || 'No registrado',
    notes: cleanText(draft.notes),
  };

  let next = updatePatient(data, patientId, current => ({
    ...current,
    vitals: record,
    vitalsHistory: sortedByDate([...(current.vitalsHistory || []), record]),
    sleepCurrent: sleepCurrent ?? current.sleepCurrent,
    appetite: draft.appetite || current.appetite,
    timeline: [
      ...(current.timeline || []),
      {
        date,
        type: 'vital',
        title: 'Control físico registrado',
        detail: [
          record.weight !== null ? `Peso ${record.weight} kg` : null,
          bp !== 'Sin registrar' ? `presión ${bp}` : null,
          record.pulse !== null ? `pulso ${record.pulse} bpm` : null,
        ].filter(Boolean).join(' · ') || 'Datos de seguimiento físico actualizados.',
      },
    ],
  }));

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
  const event = {
    id: uid('adverse'),
    medicationId: draft.medicationId || null,
    name,
    severity: draft.severity || 'mild',
    onset: date,
    status: draft.status || 'active',
    relation: cleanText(draft.relation) || 'Relación temporal todavía no evaluada.',
    actionTaken: cleanText(draft.actionTaken),
  };
  let next = updatePatient(data, patientId, patient => ({
    ...patient,
    adverseEvents: [event, ...(patient.adverseEvents || [])],
    timeline: [
      ...(patient.timeline || []),
      {
        date,
        type: 'alert',
        title: `Efecto observado: ${name}`,
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
  const lab = {
    id: uid('lab'),
    name,
    value: cleanText(draft.value),
    unit: cleanText(draft.unit),
    status: draft.status || 'normal',
    date,
    reference: cleanText(draft.reference),
    notes: cleanText(draft.notes),
  };
  let next = updatePatient(data, patientId, patient => ({
    ...patient,
    labs: [lab, ...(patient.labs || [])],
    timeline: [
      ...(patient.timeline || []),
      {
        date,
        type: 'lab',
        title: `${name}: ${lab.value}${lab.unit ? ` ${lab.unit}` : ''}`,
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
    status: draft.status || 'confirmed',
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
    appointments: data.appointments.map(item => item.id === appointmentId ? { ...item, status } : item),
  };
  if (appointment?.patientId) next = updateNextVisit(next, appointment.patientId);
  return next;
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
  return data.patients.map(patient => {
    const primary = patient.assessments?.[0];
    const points = sortedByDate(primary?.points || []);
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
  const primary = patient.assessments?.[0];
  const points = sortedByDate(primary?.points || []);
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
    activeAdverse: patient.adverseEvents.filter(item => item.status === 'active'),
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
