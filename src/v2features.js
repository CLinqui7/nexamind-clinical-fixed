import { addDays, formatDate, formatDateTime, formatLongDate, uid } from './utils.js';

export const DOCUMENT_CATEGORIES = [
  'Receta externa', 'Medicamento', 'Carta del paciente', 'Laboratorio', 'Consentimiento',
  'Informe externo', 'Seguro médico', 'Documento legal', 'Documento post mortem', 'Otro',
];

export const GENDER_IDENTITY_OPTIONS = [
  'No registrada', 'Mujer', 'Hombre', 'Mujer trans', 'Hombre trans', 'No binaria', 'Otra', 'Prefiere no responder',
];

export const SEXUAL_ORIENTATION_OPTIONS = [
  'No registrada', 'Heterosexual', 'Gay', 'Lesbiana', 'Bisexual', 'Pansexual', 'Asexual',
  'En exploración', 'Otra', 'Prefiere no responder',
];

export const SEX_ASSIGNED_AT_BIRTH_OPTIONS = [
  'No registrado', 'Femenino', 'Masculino', 'Intersexual', 'Prefiere no responder',
];

export const RELATIONSHIP_STATUS_OPTIONS = [
  'No registrado', 'Soltero/a', 'En relación', 'Casado/a', 'Separado/a', 'Divorciado/a', 'Viudo/a', 'Otro',
];

export const VITAL_STATUS_OPTIONS = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'deceased', label: 'Fallecido' },
  { value: 'unconfirmed', label: 'No confirmado' },
];

export const DEATH_MANNER_OPTIONS = [
  'Pendiente de confirmación', 'Natural', 'Accidente', 'Suicidio', 'Homicidio', 'Indeterminada', 'No registrada',
];

export const REMINDER_CHANNELS = [
  { value: 'email', label: 'Correo' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

export const CONFIDENTIALITY_LEVELS = [
  'Clínico', 'Administrativo', 'Restringido al médico', 'Médico-legal',
];

const nowIso = () => new Date().toISOString();
const clean = value => String(value ?? '').trim();
const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export function normalizeNotificationPreferences(value = {}, patient = {}) {
  const channels = Array.isArray(value.channels) && value.channels.length
    ? [...new Set(value.channels.filter(item => REMINDER_CHANNELS.some(option => option.value === item)))]
    : ['whatsapp'];
  const reminderHours = Array.isArray(value.reminderHours) && value.reminderHours.length
    ? [...new Set(value.reminderHours.map(Number).filter(item => Number.isFinite(item) && item > 0))]
    : [24, 8];
  return {
    enabled: value.enabled !== false,
    channels,
    reminderHours,
    email: clean(value.email || patient.email),
    phone: clean(value.phone || patient.phone),
    language: clean(value.language) || 'Español',
    timezone: clean(value.timezone) || 'America/El_Salvador',
    consentStatus: value.consentStatus || 'pending',
    consentRecordedAt: value.consentRecordedAt || null,
    quietHoursStart: value.quietHoursStart || '20:00',
    quietHoursEnd: value.quietHoursEnd || '07:00',
  };
}

export function normalizeDeathRecord(value = {}) {
  return {
    dateOfDeath: value.dateOfDeath || '',
    informedAt: value.informedAt || '',
    confirmedBy: clean(value.confirmedBy),
    sourceType: value.sourceType || 'No registrada',
    sourceDocument: clean(value.sourceDocument),
    place: clean(value.place),
    manner: value.manner || 'Pendiente de confirmación',
    notes: clean(value.notes),
    recordedAt: value.recordedAt || null,
    recordedBy: value.recordedBy || null,
  };
}

export function normalizePatientV2(patient = {}) {
  return {
    preferredName: clean(patient.preferredName),
    pronouns: clean(patient.pronouns),
    sexAssignedAtBirth: patient.sexAssignedAtBirth || 'No registrado',
    genderIdentity: patient.genderIdentity || 'No registrada',
    sexualOrientation: patient.sexualOrientation || 'No registrada',
    relationshipStatus: patient.relationshipStatus || 'No registrado',
    significantPeople: clean(patient.significantPeople),
    safetyHistory: {
      ideationHistory: patient.safetyHistory?.ideationHistory || 'No registrada',
      suicideAttemptsCount: Number(patient.safetyHistory?.suicideAttemptsCount) || 0,
      lastAttemptDate: patient.safetyHistory?.lastAttemptDate || '',
      selfHarmHistory: patient.safetyHistory?.selfHarmHistory || 'No registrada',
      safetyPlan: clean(patient.safetyHistory?.safetyPlan),
      emergencyContact: clean(patient.safetyHistory?.emergencyContact),
      notes: clean(patient.safetyHistory?.notes),
    },
    vitalStatus: patient.vitalStatus || 'active',
    deathRecord: normalizeDeathRecord(patient.deathRecord),
    notificationPreferences: normalizeNotificationPreferences(patient.notificationPreferences, patient),
    documents: Array.isArray(patient.documents) ? patient.documents.map(document => ({
      ...document,
      id: document.id || uid('document'),
      organizationId: document.organizationId || null,
      patientId: document.patientId || patient.id || null,
      name: clean(document.name || document.fileName) || 'Documento',
      fileName: clean(document.fileName || document.name) || 'documento',
      category: document.category || 'Otro',
      description: clean(document.description),
      clinicalDate: document.clinicalDate || document.createdAt || nowIso(),
      confidentiality: document.confidentiality || 'Clínico',
      mimeType: document.mimeType || 'application/octet-stream',
      size: Number(document.size) || 0,
      storagePath: clean(document.storagePath),
      dataUrl: document.dataUrl || '',
      uploadedBy: document.uploadedBy || null,
      createdAt: document.createdAt || nowIso(),
      updatedAt: document.updatedAt || document.createdAt || nowIso(),
    })) : [],
    consultations: Array.isArray(patient.consultations) ? patient.consultations.map(consultation => (consultation.signedAt || ['completed','signed'].includes(consultation.status)) ? {...consultation} : ({
      ...consultation,
      id: consultation.id || uid('encounter'),
      appointmentId: consultation.appointmentId || null,
      title: clean(consultation.title) || 'Consulta clínica',
      status: consultation.status || 'draft',
      startedAt: consultation.startedAt || consultation.createdAt || nowIso(),
      endedAt: consultation.endedAt || null,
      durationMinutes: Number(consultation.durationMinutes) || null,
      reason: String(consultation.reason ?? ''),
      freeNotes: String(consultation.freeNotes ?? ''),
      evolution: String(consultation.evolution ?? ''),
      mentalStatus: String(consultation.mentalStatus ?? ''),
      riskAssessment: String(consultation.riskAssessment ?? ''),
      medicationNotes: String(consultation.medicationNotes ?? ''),
      intervention: String(consultation.intervention ?? ''),
      clinicalImpression: String(consultation.clinicalImpression ?? ''),
      plan: String(consultation.plan ?? ''),
      followUp: String(consultation.followUp ?? ''),
      createdBy: consultation.createdBy || null,
      signedBy: consultation.signedBy || null,
      signedAt: consultation.signedAt || null,
      versions: Array.isArray(consultation.versions) ? consultation.versions : [],
      createdAt: consultation.createdAt || nowIso(),
      updatedAt: consultation.updatedAt || consultation.createdAt || nowIso(),
    })) : [],
  };
}

export function patientExtensionDefaults(patient = {}) {
  const extended = normalizePatientV2(patient);
  return {
    preferredName: extended.preferredName,
    pronouns: extended.pronouns,
    sexAssignedAtBirth: extended.sexAssignedAtBirth,
    genderIdentity: extended.genderIdentity,
    sexualOrientation: extended.sexualOrientation,
    relationshipStatus: extended.relationshipStatus,
    significantPeople: extended.significantPeople,
    ideationHistory: extended.safetyHistory.ideationHistory,
    suicideAttemptsCount: extended.safetyHistory.suicideAttemptsCount,
    lastAttemptDate: extended.safetyHistory.lastAttemptDate,
    selfHarmHistory: extended.safetyHistory.selfHarmHistory,
    safetyPlan: extended.safetyHistory.safetyPlan,
    emergencyContact: extended.safetyHistory.emergencyContact,
    safetyHistoryNotes: extended.safetyHistory.notes,
    vitalStatus: extended.vitalStatus,
    deathDate: extended.deathRecord.dateOfDeath,
    deathInformedAt: extended.deathRecord.informedAt,
    deathConfirmedBy: extended.deathRecord.confirmedBy,
    deathSourceType: extended.deathRecord.sourceType,
    deathSourceDocument: extended.deathRecord.sourceDocument,
    deathPlace: extended.deathRecord.place,
    deathManner: extended.deathRecord.manner,
    deathNotes: extended.deathRecord.notes,
    reminderEnabled: extended.notificationPreferences.enabled,
    reminderChannels: [...extended.notificationPreferences.channels],
    reminderHours: [...extended.notificationPreferences.reminderHours],
    reminderEmail: extended.notificationPreferences.email,
    reminderPhone: extended.notificationPreferences.phone,
    reminderConsentStatus: extended.notificationPreferences.consentStatus,
    reminderLanguage: extended.notificationPreferences.language,
  };
}

export function createEncounterDraft(patient, appointment = null, user = null) {
  const startedAt = nowIso();
  return {
    id: uid('encounter'),
    appointmentId: appointment?.id || null,
    title: appointment?.type ? `${appointment.type} · ${patient?.name || 'Paciente'}` : `Consulta · ${patient?.name || 'Paciente'}`,
    status: 'draft',
    startedAt,
    endedAt: null,
    durationMinutes: null,
    reason: appointment?.notes || '',
    freeNotes: '',
    evolution: '',
    mentalStatus: '',
    riskAssessment: patient?.risk ? `Riesgo previo registrado: ${patient.risk}` : '',
    medicationNotes: patient?.medication?.name && patient.medication.name !== 'Sin medicamento'
      ? `${patient.medication.name} ${patient.medication.dose} · ${patient.medication.frequency}`
      : '',
    intervention: '',
    clinicalImpression: '',
    plan: '',
    followUp: '',
    createdBy: user?.id || null,
    signedBy: null,
    signedAt: null,
    versions: [],
    createdAt: startedAt,
    updatedAt: startedAt,
  };
}

export function upsertEncounter(data, patientId, encounter, { finalize = false, user = null } = {}) {
  const timestamp = nowIso();
  const currentPatient = (data.patients || []).find(item => item.id === patientId);
  if (!currentPatient) throw new Error('El paciente ya no está disponible.');
  const previous = (currentPatient.consultations || []).find(item => item.id === encounter.id);
  const completed = finalize ? {
    ...encounter,
    status: 'completed',
    endedAt: timestamp,
    durationMinutes: Math.max(1, Math.round((new Date(timestamp) - new Date(encounter.startedAt || timestamp)) / 60000)),
    signedBy: user?.id || encounter.signedBy || null,
    signedAt: timestamp,
    versions: [
      ...(Array.isArray(previous?.versions) ? previous.versions : []),
      previous ? { ...previous, archivedAt: timestamp } : null,
    ].filter(Boolean),
    updatedAt: timestamp,
  } : { ...encounter, status: encounter.status || 'draft', updatedAt: timestamp };

  const patients = data.patients.map(patient => {
    if (patient.id !== patientId) return patient;
    const consultations = [completed, ...(patient.consultations || []).filter(item => item.id !== completed.id)];
    const timeline = finalize
      ? [{
          date: timestamp,
          type: 'consultation',
          title: `Nota de consulta finalizada`,
          detail: completed.clinicalImpression || completed.plan || completed.freeNotes || 'Consulta documentada y firmada.',
        }, ...(patient.timeline || [])]
      : patient.timeline;
    return { ...patient, consultations, timeline, updatedAt: timestamp };
  });

  const appointments = finalize && completed.appointmentId
    ? (data.appointments || []).map(item => item.id === completed.appointmentId
      ? { ...item, status: 'completed', encounterId: completed.id, updatedAt: timestamp }
      : item)
    : data.appointments;

  return { data: { ...data, patients, appointments }, encounter: completed };
}

export function appointmentReadyForConsultation(data, now = new Date()) {
  const current = now instanceof Date ? now : new Date(now);
  const windowStart = current.getTime() - 30 * 60 * 1000;
  const windowEnd = current.getTime() + 10 * 60 * 1000;
  return (data.appointments || [])
    .filter(appointment => !['completed', 'cancelled', 'no_show'].includes(appointment.status))
    .filter(appointment => {
      const start = new Date(appointment.start).getTime();
      return Number.isFinite(start) && start >= windowStart && start <= windowEnd;
    })
    .sort((left, right) => Math.abs(new Date(left.start) - current) - Math.abs(new Date(right.start) - current))[0] || null;
}

export function annualPlanSnapshot(billing = {}, payments = [], now = new Date()) {
  const paid = [...(payments || [])]
    .filter(item => item.status === 'paid')
    .sort((left, right) => new Date(right.paidAt || right.createdAt) - new Date(left.paidAt || left.createdAt));
  const latestPaid = paid[0] || null;
  const start = billing.currentPeriodStart || latestPaid?.periodStart || latestPaid?.paidAt || latestPaid?.createdAt || null;
  const fallbackEnd = start ? (() => {
    const date = new Date(start);
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString();
  })() : null;
  const end = billing.currentPeriodEnd || billing.nextRenewalAt || latestPaid?.periodEnd || fallbackEnd;
  const endDate = end ? new Date(end) : null;
  const daysLeft = endDate && Number.isFinite(endDate.getTime())
    ? Math.ceil((endDate.getTime() - new Date(now).getTime()) / 86_400_000)
    : null;
  let status = billing.subscriptionStatus || (latestPaid ? 'active' : 'inactive');
  if (daysLeft !== null && daysLeft < 0) status = Math.abs(daysLeft) <= 7 ? 'grace' : 'expired';
  else if (daysLeft !== null && daysLeft <= 30 && status === 'active') status = 'renewing';
  return {
    status,
    statusLabel: ({ active: 'Activo', renewing: 'Próximo a renovar', grace: 'Periodo de gracia', expired: 'Vencido', inactive: 'Sin activar', pending: 'Pago pendiente', cancelled: 'Cancelado' })[status] || status,
    currentPeriodStart: start,
    currentPeriodEnd: end,
    nextRenewalAt: billing.nextRenewalAt || end,
    daysLeft,
    latestPaid,
    renewalPrice: Number(billing.subscriptionPrice) || 400,
    tier: billing.planTier || 'professional',
  };
}

export function reminderChannelLabel(channel) {
  return REMINDER_CHANNELS.find(item => item.value === channel)?.label || channel;
}

function listItems(items = [], render) {
  return items.length ? `<ul>${items.map(render).join('')}</ul>` : '<p class="muted">Sin información registrada.</p>';
}

export function buildPostmortemReportHtml(data, patient) {
  const organization = data.organization || {};
  const death = normalizeDeathRecord(patient.deathRecord);
  const consultations = [...(patient.consultations || [])].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  const medications = patient.medications || [];
  const documents = patient.documents || [];
  const recentTimeline = [...(patient.timeline || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 40);
  const safety = patient.safetyHistory || {};
  const attempts = (patient.notes || []).filter(note => /suicid|autoles|intento/i.test(note.text || ''));
  const riskConsultations = consultations.filter(note => note.riskAssessment);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Resumen post mortem · ${escapeHtml(patient.name)}</title><style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#102d4f;margin:0;background:#fff;line-height:1.45}.sheet{max-width:980px;margin:auto}.header{border-bottom:4px solid #0b3d78;padding:0 0 18px;display:flex;justify-content:space-between;gap:20px}.header h1{margin:0;font-size:26px}.header p{margin:5px 0;color:#5c7086}.badge{display:inline-block;border:1px solid #b8c7d8;border-radius:999px;padding:5px 10px;font-size:11px}.notice{margin:18px 0;padding:14px 16px;background:#fff8e8;border:1px solid #ecd39a;border-radius:12px;font-size:11px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{border:1px solid #dbe4ee;border-radius:14px;padding:15px;margin:12px 0;break-inside:avoid}.card h2{font-size:15px;margin:0 0 10px}.card h3{font-size:12px;margin:12px 0 5px}.facts{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.facts div{background:#f5f8fb;border-radius:9px;padding:9px}.facts span{display:block;font-size:9px;text-transform:uppercase;color:#6e8092}.facts b{font-size:11px}.timeline{border-left:2px solid #8facCB;padding-left:14px}.event{margin:0 0 12px}.event time{font-size:9px;color:#6e8092}.event b{display:block;font-size:11px}.event p{font-size:10px;margin:2px 0;white-space:pre-wrap}.muted{color:#708196;font-size:10px}ul{padding-left:18px;margin:5px 0}li{margin:4px 0;font-size:10px}.footer{margin-top:25px;border-top:1px solid #dbe4ee;padding-top:10px;color:#6e8092;font-size:9px}@media print{.sheet{max-width:none}.no-print{display:none}}
  </style></head><body><main class="sheet"><header class="header"><div><span class="badge">Paquete documental para revisión médico-legal</span><h1>Resumen clínico post mortem</h1><p>${escapeHtml(patient.name)} · ${escapeHtml(patient.diagnosis)} · ${escapeHtml(patient.diagnosisCode)}</p></div><div><b>${escapeHtml(organization.name || 'Linkare')}</b><p>${escapeHtml(organization.clinician || '')}</p><p>Generado: ${escapeHtml(formatDateTime(new Date()))}</p></div></header>
  <div class="notice"><b>Alcance:</b> este documento organiza información registrada en el expediente. No determina causa o manera de muerte, no sustituye una autopsia, investigación oficial, dictamen forense ni autopsia psicológica.</div>
  <section class="card"><h2>Identificación y estado vital</h2><div class="facts"><div><span>Paciente</span><b>${escapeHtml(patient.name)}</b></div><div><span>Edad</span><b>${escapeHtml(patient.age)} años</b></div><div><span>Última consulta</span><b>${escapeHtml(formatDate(patient.lastVisit))}</b></div><div><span>Fecha de fallecimiento</span><b>${escapeHtml(death.dateOfDeath ? formatDate(death.dateOfDeath) : 'No registrada')}</b></div><div><span>Fuente de confirmación</span><b>${escapeHtml(death.sourceType)}</b></div><div><span>Persona que confirmó</span><b>${escapeHtml(death.confirmedBy || 'No registrada')}</b></div><div><span>Manera documentada</span><b>${escapeHtml(death.manner)}</b></div><div><span>Lugar</span><b>${escapeHtml(death.place || 'No registrado')}</b></div></div>${death.notes ? `<p>${escapeHtml(death.notes)}</p>` : ''}</section>
  <div class="grid"><section class="card"><h2>Historia clínica</h2><div class="facts"><div><span>Diagnóstico</span><b>${escapeHtml(patient.diagnosis)}</b></div><div><span>Código</span><b>${escapeHtml(patient.diagnosisCode)}</b></div><div><span>Riesgo más reciente</span><b>${escapeHtml(patient.risk)}</b></div><div><span>Estado clínico</span><b>${escapeHtml(patient.status)}</b></div></div><h3>Red y contexto significativo</h3><p>${escapeHtml(patient.significantPeople || 'No registrado')}</p></section>
  <section class="card"><h2>Identidad y contexto personal</h2><div class="facts"><div><span>Nombre preferido</span><b>${escapeHtml(patient.preferredName || 'No registrado')}</b></div><div><span>Pronombres</span><b>${escapeHtml(patient.pronouns || 'No registrados')}</b></div><div><span>Identidad de género</span><b>${escapeHtml(patient.genderIdentity || 'No registrada')}</b></div><div><span>Orientación sexual</span><b>${escapeHtml(patient.sexualOrientation || 'No registrada')}</b></div></div></section></div>
  <section class="card"><h2>Tratamientos y medicamentos</h2>${listItems(medications, medication => `<li><b>${escapeHtml(medication.name)} ${escapeHtml(medication.dose)}</b> · ${escapeHtml(medication.frequency)} · ${escapeHtml(medication.status)} · inicio ${escapeHtml(formatDate(medication.startDate))}</li>`)}</section>
  <section class="card"><h2>Notas de consulta</h2>${listItems(consultations, note => `<li><b>${escapeHtml(note.title)}</b> · ${escapeHtml(formatDateTime(note.startedAt))} · ${escapeHtml(note.status)}<br>${escapeHtml(note.clinicalImpression || note.plan || note.freeNotes || 'Sin resumen')}</li>`)}</section>
  <section class="card"><h2>Riesgo, autolesiones y seguridad</h2><div class="facts"><div><span>Riesgo más reciente</span><b>${escapeHtml(patient.risk)}</b></div><div><span>Ideación previa</span><b>${escapeHtml(safety.ideationHistory || 'No registrada')}</b></div><div><span>Intentos documentados</span><b>${escapeHtml(safety.suicideAttemptsCount ?? 0)}</b></div><div><span>Último intento documentado</span><b>${escapeHtml(safety.lastAttemptDate ? formatDate(safety.lastAttemptDate) : 'No registrado')}</b></div><div><span>Autolesión sin intención suicida</span><b>${escapeHtml(safety.selfHarmHistory || 'No registrada')}</b></div><div><span>Contacto de emergencia</span><b>${escapeHtml(safety.emergencyContact || 'No registrado')}</b></div></div><h3>Plan de seguridad</h3><p>${escapeHtml(safety.safetyPlan || 'No registrado')}</p><h3>Evaluaciones de riesgo en consultas</h3>${riskConsultations.length ? listItems(riskConsultations, note => `<li><b>${escapeHtml(formatDateTime(note.startedAt))}</b>: ${escapeHtml(note.riskAssessment)}</li>`) : '<p class="muted">Sin evaluaciones estructuradas en notas de consulta.</p>'}<h3>Notas relacionadas</h3>${attempts.length ? listItems(attempts, note => `<li>${escapeHtml(formatDateTime(note.date))}: ${escapeHtml(note.text)}</li>`) : '<p class="muted">No se localizaron notas adicionales con términos de intento suicida o autolesión. Esto no confirma ausencia; revise el expediente completo.</p>'}</section>
  <section class="card"><h2>Documentos vinculados</h2>${listItems(documents, document => `<li><b>${escapeHtml(document.category)}</b> · ${escapeHtml(document.name)} · ${escapeHtml(formatDate(document.clinicalDate || document.createdAt))} · ${escapeHtml(document.confidentiality)}</li>`)}</section>
  <section class="card"><h2>Cronología clínica</h2><div class="timeline">${recentTimeline.length ? recentTimeline.map(item => `<div class="event"><time>${escapeHtml(formatDateTime(item.date))}</time><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.detail)}</p></div>`).join('') : '<p class="muted">Sin eventos registrados.</p>'}</div></section>
  <section class="card"><h2>Calidad y procedencia de la información</h2><p>Las entradas deben interpretarse según su fuente original: relato del paciente, observación profesional, información de terceros, laboratorio, documento oficial u otra fuente. Los datos no confirmados deben permanecer identificados como tales.</p><div class="facts"><div><span>Documento de respaldo</span><b>${escapeHtml(death.sourceDocument || 'No registrado')}</b></div><div><span>Registro creado</span><b>${escapeHtml(death.recordedAt ? formatDateTime(death.recordedAt) : 'No registrado')}</b></div></div></section>
  <footer class="footer">${escapeHtml(organization.name || 'Linkare')} · Documento generado desde el expediente clínico. Conserve control de acceso, trazabilidad y cadena de custodia cuando corresponda.</footer></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script></body></html>`;
}

export function documentIconName(document) {
  if (/image/i.test(document?.mimeType || '')) return 'camera';
  if (/pdf|word|document/i.test(document?.mimeType || '')) return 'file';
  return 'paperclip';
}

export function humanFileSize(bytes = 0) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function defaultAnnualDates(base = new Date()) {
  const start = new Date(base);
  const end = new Date(base);
  end.setFullYear(end.getFullYear() + 1);
  return { currentPeriodStart: start.toISOString(), currentPeriodEnd: end.toISOString(), nextRenewalAt: end.toISOString(), graceUntil: addDays(end, 7) };
}
