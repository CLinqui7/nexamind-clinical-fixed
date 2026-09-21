import { normalizePatientV2 } from './v2features.js';
const defaultClinicLogo = '/assets/linkare-logo.jpg';
const runtimeEnv = import.meta.env ?? {};
const DAY = 24 * 60 * 60 * 1000;

export const SCALE_CATALOG = [
  { code: 'PHQ-9', label: 'Síntomas depresivos', min: 0, max: 27, direction: 'lower' },
  { code: 'GAD-7', label: 'Ansiedad', min: 0, max: 21, direction: 'lower' },
  { code: 'YMRS', label: 'Síntomas maníacos', min: 0, max: 60, direction: 'lower' },
  { code: 'ASRS', label: 'Síntomas de TDAH', min: 0, max: 24, direction: 'lower' },
  { code: 'PANSS', label: 'Síntomas psicóticos', min: 30, max: 210, direction: 'lower' },
  { code: 'Y-BOCS', label: 'Síntomas obsesivo-compulsivos', min: 0, max: 40, direction: 'lower' },
  { code: 'ISI', label: 'Insomnio', min: 0, max: 28, direction: 'lower' },
  { code: 'SDS', label: 'Dificultad funcional', min: 0, max: 30, direction: 'lower' },
  { code: 'CGI-S', label: 'Gravedad clínica global', min: 1, max: 7, direction: 'lower' },
];

export const MEDICATION_CLASSES = [
  'ISRS', 'IRSN', 'Antidepresivo atípico', 'Antipsicótico', 'Estabilizador del ánimo',
  'Estimulante', 'No estimulante para TDAH', 'Benzodiazepina', 'Hipnótico', 'Otro',
];

export const FREQUENCIES = [
  'cada mañana', 'al mediodía', 'cada tarde', 'cada noche', 'cada 12 horas', 'cada 8 horas', 'una vez al día',
  'dos veces al día', 'según necesidad (PRN)', 'otra',
];

export const COMMON_ADVERSE_EFFECTS = [
  'Náusea', 'Somnolencia', 'Insomnio', 'Aumento de peso', 'Pérdida de peso',
  'Disminución de apetito', 'Aumento de apetito', 'Disfunción sexual', 'Temblor',
  'Inquietud o acatisia', 'Rigidez o parkinsonismo', 'Mareo', 'Cefalea',
  'Estreñimiento', 'Boca seca', 'Palpitaciones', 'Dificultad cognitiva', 'Otro',
];


export function isoDate(offset = 0, hour = 9, minute = 0) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setTime(date.getTime() + offset * DAY);
  return date.toISOString();
}

export function dateOnly(offset = 0) {
  return isoDate(offset).slice(0, 10);
}

const assessment = (code, label, values, offsets, direction = 'lower') => ({
  code,
  label,
  direction,
  points: values.map((value, index) => ({ date: isoDate(offsets[index], 8), value })),
});

export function createEmptyData() { return normalizeData({ users: [], patients: [], appointments: [], alerts: [], payments: [] }); }


function getInitials(name = '') {
  return String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'NM';
}

function parseDose(dose = '') {
  const match = String(dose).match(/([0-9]+(?:[.,][0-9]+)?)\s*([a-zA-Zµ]+)?/);
  return {
    value: match ? Number(match[1].replace(',', '.')) : null,
    unit: match?.[2] || 'mg',
  };
}

function firstDoseFromTimeline(patient) {
  const entries = [...(patient.timeline || [])]
    .filter(item => item.type === 'medication')
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const item of entries) {
    const parsed = parseDose(item.title);
    if (parsed.value !== null) return { ...parsed, date: item.date, reason: item.title };
  }
  return null;
}

function normalizeMedication(medication, patient, index = 0) {
  const parsed = parseDose(medication?.dose || `${medication?.doseValue ?? ''} ${medication?.doseUnit ?? 'mg'}`);
  const initial = firstDoseFromTimeline(patient);
  const currentDose = medication?.dose || (parsed.value !== null ? `${parsed.value} ${parsed.unit}` : 'Dosis no registrada');
  const doseHistory = Array.isArray(medication?.doseHistory) && medication.doseHistory.length
    ? medication.doseHistory
    : [
        ...(initial ? [{ id: `dh_${patient.id}_${index}_0`, date: initial.date, doseValue: initial.value, doseUnit: initial.unit, dose: `${initial.value} ${initial.unit}`, reason: initial.reason }] : []),
        { id: `dh_${patient.id}_${index}_1`, date: medication?.startDate || patient.lastVisit || new Date().toISOString(), doseValue: parsed.value, doseUnit: parsed.unit, dose: currentDose, reason: 'Dosis actual registrada' },
      ].filter((item, position, array) => position === 0 || item.dose !== array[position - 1].dose);

  return {
    id: medication?.id || `med_${patient.id}_${index}`,
    name: medication?.name || 'Medicamento sin nombre',
    class: medication?.class || 'Otro',
    dose: currentDose,
    doseValue: medication?.doseValue ?? parsed.value,
    doseUnit: medication?.doseUnit || parsed.unit,
    frequency: medication?.frequency || 'una vez al día',
    frequencySlots: Array.isArray(medication?.frequencySlots) ? medication.frequencySlots : [],
    customFrequency: medication?.customFrequency || '',
    route: medication?.route || 'oral',
    indication: medication?.indication || patient.diagnosis || 'Sin indicación registrada',
    startDate: medication?.startDate || patient.lastVisit || new Date().toISOString(),
    endDate: medication?.endDate || null,
    status: ({held:'suspended',stopped:'discontinued'})[medication?.status] || medication?.status || 'active',
    isPrimary: medication?.isPrimary ?? index === 0,
    isPrn: medication?.isPrn ?? /PRN|necesidad/i.test(currentDose + ' ' + (medication?.frequency || '')),
    notes: medication?.notes || medication?.clinicalNotes || medication?.reportedNotes || '',
    clinicalNotes: medication?.clinicalNotes || medication?.notes || '',
    internalNotes: medication?.internalNotes || '',
    reportedNotes: medication?.reportedNotes || '',
    source: medication?.source || 'clinical',
    createdBy: medication?.createdBy || null,
    // createdAt is server-owned medication identity. Legacy records may not
    // have it, so never synthesize it from a clinical date during hydration:
    // sending that fallback back would look like an identity rewrite.
    createdAt: medication?.createdAt ?? null,
    reviewedBy: medication?.reviewedBy || null,
    reviewedAt: medication?.reviewedAt || null,
    archivedAt: medication?.archivedAt || null,
    archivedBy: medication?.archivedBy || null,
    archiveReason: medication?.archiveReason || '',
    events: Array.isArray(medication?.events) ? medication.events : [],
    doseHistory,
  };
}

export function normalizePatient(patient = {}) {
  const sourceMedications = Array.isArray(patient.medications) && patient.medications.length
    ? patient.medications
    : patient.medication && patient.medication.name && patient.medication.name !== 'Sin medicamento'
      ? [patient.medication]
      : [];
  const medications = sourceMedications.map((medication, index) => normalizeMedication(medication, patient, index));
  const primary = medications.find(item => !item.archivedAt && item.isPrimary && item.status === 'active') || medications.find(item => !item.archivedAt && item.status === 'active') || null;
  medications.forEach(item => { item.isPrimary = Boolean(primary && item.id === primary.id); });

  const vitals = patient.vitals || {};
  const vitalsHistory = Array.isArray(patient.vitalsHistory) && patient.vitalsHistory.length
    ? patient.vitalsHistory
    : Object.keys(vitals).length
      ? [{ id: `vital_${patient.id || Date.now()}_0`, date: patient.lastVisit || new Date().toISOString(), ...vitals }]
      : [];

  return {
    id: patient.id || `p_${Date.now()}`,
    initials: patient.initials || getInitials(patient.name),
    name: patient.name || 'Paciente sin nombre',
    age: Number(patient.age) || 0,
    sex: patient.sex || 'No registrado',
    phone: patient.phone || '',
    email: patient.email || '',
    photo: patient.photo || '',
    insurance: {
      hasInsurance: Boolean(patient.insurance?.hasInsurance),
      provider: patient.insurance?.provider || '',
      plan: patient.insurance?.plan || '',
      memberId: patient.insurance?.memberId || '',
      policyNumber: patient.insurance?.policyNumber || '',
      authorizationRequired: Boolean(patient.insurance?.authorizationRequired),
      copay: patient.insurance?.copay || '',
      notes: patient.insurance?.notes || '',
    },
    diagnosis: patient.diagnosis || 'Diagnóstico pendiente',
    diagnosisCode: patient.diagnosisCode || 'Sin código',
    risk: patient.risk || 'low',
    status: patient.status || 'stable',
    clinician: patient.clinician || '',
    lastVisit: patient.lastVisit || new Date().toISOString(),
    nextVisit: patient.nextVisit || null,
    medications,
    medication: primary || {
      id: `none_${patient.id || Date.now()}`,
      name: 'Sin medicamento', class: 'No asignado', dose: '—', doseValue: null, doseUnit: 'mg',
      frequency: '—', startDate: patient.lastVisit || new Date().toISOString(), indication: '—', status: 'inactive', doseHistory: [],
    },
    assessments: Array.isArray(patient.assessments) ? patient.assessments : [],
    adherence: Number.isFinite(Number(patient.adherence)) ? Number(patient.adherence) : 0,
    functioningChange: Number.isFinite(Number(patient.functioningChange)) ? Number(patient.functioningChange) : 0,
    sleepBaseline: Number.isFinite(Number(patient.sleepBaseline)) ? Number(patient.sleepBaseline) : null,
    sleepCurrent: Number.isFinite(Number(patient.sleepCurrent)) ? Number(patient.sleepCurrent) : null,
    appetite: patient.appetite || 'No registrado',
    vitals,
    vitalsHistory,
    adverseEvents: Array.isArray(patient.adverseEvents) ? patient.adverseEvents.map((item, index) => ({ id: item.id || `ae_${patient.id}_${index}`, medicationId: item.medicationId || primary?.id || null, ...item })) : [],
    labs: Array.isArray(patient.labs) ? patient.labs.map((item, index) => ({ id: item.id || `lab_${patient.id}_${index}`, ...item })) : [],
    timeline: Array.isArray(patient.timeline) ? patient.timeline : [],
    medicationEvents: Array.isArray(patient.medicationEvents) ? patient.medicationEvents : [],
    followUps: Array.isArray(patient.followUps) ? patient.followUps : [],
    archived: Boolean(patient.archived),
    notes: Array.isArray(patient.notes) ? patient.notes : [],
    prescriptions: Array.isArray(patient.prescriptions) ? patient.prescriptions.map((item, index) => ({ ...item, id: item.id || `rx_${patient.id}_${index}`, items: Array.isArray(item.items) ? item.items : [] })) : [],
    ...normalizePatientV2(patient),
    createdAt: patient.createdAt || patient.lastVisit || new Date().toISOString(),
    updatedAt: patient.updatedAt || new Date().toISOString(),
  };
}

export function normalizeData(input = {}) {
  const users = Array.isArray(input.users) ? input.users.map(user => ({
    id: user.id, name: user.name || 'Profesional', email: user.email || '',
    phone: user.phone || '', title: user.title || '', role: user.role || 'read_only',
    active: user.active !== false, avatar: user.avatar || '', permissions: user.permissions || {},
    createdAt: user.createdAt || null, updatedAt: user.updatedAt || null,
  })) : [];
  const doctor = users.find(user => user.role === 'owner') || {};
  return {
    version: 3,
    organization: {
      name: input.organization?.name || 'Linkare',
      clinician: input.organization?.clinician || doctor.name || '',
      specialty: input.organization?.specialty || doctor.title || 'Psiquiatría',
      professionalLicense: input.organization?.professionalLicense || '',
      address: input.organization?.address || '',
      phone: input.organization?.phone || '',
      email: input.organization?.email || '',
      website: input.organization?.website || '',
      clinicLogo: input.organization?.clinicLogo || defaultClinicLogo,
      doctorPhoto: input.organization?.doctorPhoto || doctor.avatar || '',
      prescriptionFooter: input.organization?.prescriptionFooter || 'Documento emitido para revisión, firma y sello del profesional tratante.',
      updatedAt: input.organization?.updatedAt || null,
    },
    users,
    patients: Array.isArray(input.patients) ? input.patients.map(normalizePatient) : [],
    appointments: Array.isArray(input.appointments) ? input.appointments.map(item => ({ ...item, reminderLog: Array.isArray(item.reminderLog) ? item.reminderLog : [] })) : [],
    alerts: Array.isArray(input.alerts) ? input.alerts.map(item => ({ ...item })) : [],
    billing: {
      planName: input.billing?.planName || 'Plan Profesional Linkare',
      planDescription: input.billing?.planDescription || 'Licencia anual de la plataforma Linkare para gestión clínica.',
      subscriptionPrice: Number(input.billing?.subscriptionPrice ?? input.billing?.consultationFee) || 400,
      billingCycle: input.billing?.billingCycle || 'anual',
      currency: input.billing?.currency || 'USD',
      payerName: input.billing?.payerName || input.organization?.clinician || doctor.name || '',
      payerEmail: input.billing?.payerEmail || input.organization?.email || doctor.email || '',
      wompiEnabled: Boolean(input.billing?.wompiEnabled || (runtimeEnv.VITE_SUPABASE_URL && runtimeEnv.VITE_SUPABASE_ANON_KEY)),
      manualCheckoutUrl: input.billing?.manualCheckoutUrl || input.billing?.wompiCheckoutUrl || '',
      note: input.billing?.note || 'La licencia se renueva una vez al año mediante un enlace único de Wompi.',
      planTier: input.billing?.planTier || 'professional',
      subscriptionStatus: input.billing?.subscriptionStatus || 'inactive',
      currentPeriodStart: input.billing?.currentPeriodStart || null,
      currentPeriodEnd: input.billing?.currentPeriodEnd || null,
      nextRenewalAt: input.billing?.nextRenewalAt || input.billing?.currentPeriodEnd || null,
      graceUntil: input.billing?.graceUntil || null,
      autoRenew: Boolean(input.billing?.autoRenew),
    },
    payments: Array.isArray(input.payments) ? input.payments.map(item => ({ ...item })) : [],
    settings: {
      ...(input.settings || {}),
      theme: input.settings?.theme || 'light',
      googleConnected: Boolean(input.settings?.googleConnected),
      requireLogin: true,
      simpleMode: input.settings?.simpleMode ?? true,
      largeText: input.settings?.largeText ?? false,
      reducedMotion: input.settings?.reducedMotion ?? false,
      activeUserId: input.settings?.activeUserId || null,
      reminderHours: Array.isArray(input.settings?.reminderHours) && input.settings.reminderHours.length
        ? [...new Set(input.settings.reminderHours.map(Number).filter(value => Number.isFinite(value) && value > 0))]
        : [24, 8],
      reminderChannels: Array.isArray(input.settings?.reminderChannels) && input.settings.reminderChannels.length
        ? [...new Set(input.settings.reminderChannels.map(value => String(value).trim()).filter(Boolean))]
        : ['whatsapp'],
      palette: { milk: '#FCFDF6', ceil: '#8FACCB', midnight: '#05316E', ...(input.settings?.palette || {}) },
    },
  };
}
