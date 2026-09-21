import { uid } from './utils.js';
import { permissionAllowed } from './domain/permissions.js';

const nowIso = () => new Date().toISOString();
const clean = value => String(value ?? '').trim();






export const PERMISSION_CATALOG = [
  { key: 'patientsView', group: 'Pacientes', label: 'Ver pacientes', description: 'Consultar la lista y la ficha administrativa.' },
  { key: 'patientsCreate', group: 'Pacientes', label: 'Crear pacientes', description: 'Registrar expedientes nuevos.' },
  { key: 'patientsEdit', group: 'Pacientes', label: 'Editar datos administrativos', description: 'Actualizar contacto, seguro y fotografía.' },
  { key: 'appointmentsManage', group: 'Agenda', label: 'Gestionar agenda', description: 'Crear, editar, confirmar o cancelar citas.' },
  { key: 'remindersManage', group: 'Agenda', label: 'Gestionar recordatorios', description: 'Abrir WhatsApp y marcar recordatorios enviados.' },
  { key: 'clinicalView', group: 'Información clínica', label: 'Ver información clínica', description: 'Consultar diagnósticos, escalas, tratamiento y controles.' },
  { key: 'clinicalEdit', group: 'Información clínica', label: 'Registrar evolución y controles', description: 'Agregar escalas, signos vitales, laboratorios y efectos observados.' },
  { key: 'medicationsManage', group: 'Información clínica', label: 'Gestionar medicamentos', description: 'Agregar, pausar, finalizar y cambiar dosis.' },
  { key: 'prescriptionsCreate', group: 'Documentos', label: 'Generar recetas', description: 'Crear e imprimir recetas membretadas.' },
  { key: 'documentsView', group: 'Documentos', label: 'Ver archivos clínicos', description: 'Consultar documentos adjuntos al expediente.' },
  { key: 'documentsManage', group: 'Documentos', label: 'Subir y archivar archivos', description: 'Gestionar recetas externas, cartas, informes y otros documentos.' },
  { key: 'consultationsManage', group: 'Información clínica', label: 'Usar libreta de consulta', description: 'Iniciar y guardar notas; solo un médico puede firmarlas.' },
  { key: 'postmortemExport', group: 'Supervisión', label: 'Exportar resumen post mortem', description: 'Generar el paquete documental para revisión médico-legal.' },
  { key: 'alertsView', group: 'Supervisión', label: 'Ver alertas', description: 'Consultar y marcar señales clínicas revisadas.' },
  { key: 'analyticsView', group: 'Supervisión', label: 'Ver resultados generales', description: 'Consultar analíticas agregadas.' },
  { key: 'exportsManage', group: 'Supervisión', label: 'Exportar información', description: 'Descargar CSV, ICS y respaldos.' },
  { key: 'settingsManage', group: 'Administración', label: 'Configurar clínica', description: 'Editar identidad, recordatorios y apariencia.' },
  { key: 'usersManage', group: 'Administración', label: 'Gestionar usuarios', description: 'Administrar equipo y permisos (solo propietario).' },
];

export const ALL_PERMISSIONS = Object.fromEntries(PERMISSION_CATALOG.map(item => [item.key, true]));

export const DEFAULT_SECRETARY_PERMISSIONS = {
  patientsView: true,
  patientsCreate: true,
  patientsEdit: true,
  appointmentsManage: true,
  remindersManage: true,
  clinicalView: false,
  clinicalEdit: false,
  medicationsManage: false,
  prescriptionsCreate: false,
  documentsView: false,
  documentsManage: false,
  consultationsManage: false,
  postmortemExport: false,
  alertsView: false,
  analyticsView: false,
  exportsManage: false,
  settingsManage: false,
  usersManage: false,
};

export const REMINDER_OPTIONS = [72, 48, 24, 8, 2];

export function getActiveUser(data) {
  const users = Array.isArray(data?.users) ? data.users : [];
  const requested = users.find(user => user.id === data?.settings?.activeUserId && user.active !== false);
  return requested || null;
}

export function hasPermission(data, permission) {
  return permissionAllowed(getActiveUser(data), permission);
}

export function clinicProfileDefaults(data) {
  const organization = data?.organization || {};
  return {
    name: organization.name || 'Linkare',
    clinician: organization.clinician || '',
    specialty: organization.specialty || 'Psiquiatría',
    professionalLicense: organization.professionalLicense || '',
    address: organization.address || '',
    phone: organization.phone || '',
    email: organization.email || '',
    website: organization.website || '',
    clinicLogo: organization.clinicLogo || '',
    doctorPhoto: organization.doctorPhoto || '',
    prescriptionFooter: organization.prescriptionFooter || 'Documento emitido para revisión, firma y sello del profesional tratante.',
  };
}

export function secretaryFormDefaults() {
  return {
    name: '',
    email: '',
    phone: '',
    title: 'Secretaría clínica',
    role: 'secretary',
    password: '',
    confirmPassword: '',
    permissions: { ...DEFAULT_SECRETARY_PERMISSIONS },
  };
}

export function prescriptionFormDefaults(patient, organization = {}) {
  const medication = patient?.medication?.name && patient.medication.name !== 'Sin medicamento' ? patient.medication : null;
  return {
    date: new Date().toISOString().slice(0, 10),
    diagnosis: patient?.diagnosis || '',
    generalInstructions: '',
    observations: '',
    items: [{
      id: uid('rxitem'),
      medication: medication?.name || '',
      strength: medication?.dose || '',
      directions: medication?.frequency || '',
      quantity: '',
      duration: '',
      notes: '',
    }],
    doctorName: organization.clinician || patient?.clinician || '',
  };
}

export async function optimizeImageFile(file, { maxDimension = 640, quality = 0.84, preserveTransparency = false } = {}) {
  if (!file) return '';
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) throw new Error('Use una imagen PNG, JPG o WEBP.');
  if (file.size > 8 * 1024 * 1024) throw new Error('La imagen supera 8 MB. Seleccione una imagen más liviana.');

  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('La imagen no pudo procesarse.'));
    element.src = source;
  });

  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
  const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: preserveTransparency });
  if (!context) throw new Error('El navegador no pudo preparar la imagen.');
  if (!preserveTransparency) {
    context.fillStyle = '#FCFDF6';
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(image, 0, 0, width, height);
  const type = preserveTransparency && file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return canvas.toDataURL(type, type === 'image/png' ? undefined : quality);
}

export function savePracticeProfile(data, draft) {
  const name = clean(draft.name);
  const clinician = clean(draft.clinician);
  if (!name) throw new Error('Escriba el nombre de la clínica o consultorio.');
  if (!clinician) throw new Error('Escriba el nombre del profesional.');
  return {
    ...data,
    organization: {
      ...data.organization,
      name,
      clinician,
      specialty: clean(draft.specialty) || 'Psiquiatría',
      professionalLicense: clean(draft.professionalLicense),
      address: clean(draft.address),
      phone: clean(draft.phone),
      email: clean(draft.email),
      website: clean(draft.website),
      clinicLogo: draft.clinicLogo || '',
      doctorPhoto: draft.doctorPhoto || '',
      prescriptionFooter: clean(draft.prescriptionFooter),
      updatedAt: nowIso(),
    },
    users: (data.users || []).map(user => user.role === 'owner' && user.id===data.settings.activeUserId
      ? { ...user, name: clinician, title: clean(draft.specialty) || 'Psiquiatría', avatar: draft.doctorPhoto || user.avatar || '' }
      : user),
  };
}

export function savePatientPhoto(data, patientId, photo) {
  return {
    ...data,
    patients: data.patients.map(patient => patient.id === patientId
      ? { ...patient, photo: photo || '', updatedAt: nowIso() }
      : patient),
  };
}














export function savePrescription(data, patientId, draft) {
  const patient = data.patients.find(item => item.id === patientId);
  if (!patient) throw new Error('El paciente ya no está disponible.');
  const items = (draft.items || []).map(item => ({
    id: item.id || uid('rxitem'),
    medication: clean(item.medication),
    strength: clean(item.strength),
    directions: clean(item.directions),
    quantity: clean(item.quantity),
    duration: clean(item.duration),
    notes: clean(item.notes),
  })).filter(item => item.medication || item.directions);
  if (!items.length) throw new Error('Agregue al menos un medicamento o indicación.');
  if (items.some(item => !item.medication || !item.directions)) throw new Error('Cada línea debe incluir medicamento e indicaciones.');
  const existing = data.patients.flatMap(item => item.prescriptions || []).length;
  const date = draft.date || new Date().toISOString().slice(0, 10);
  const prescription = {
    id: uid('rx'),
    number: `RX-${date.slice(0, 4)}-${String(existing + 1).padStart(4, '0')}`,
    date: new Date(`${date}T12:00:00`).toISOString(),
    diagnosis: clean(draft.diagnosis),
    generalInstructions: clean(draft.generalInstructions),
    observations: clean(draft.observations),
    items,
    doctorName: clean(draft.doctorName) || data.organization?.clinician || patient.clinician,
    createdBy: getActiveUser(data)?.id || null,
    createdAt: nowIso(),
  };
  const next = {
    ...data,
    patients: data.patients.map(item => item.id === patientId ? {
      ...item,
      prescriptions: [prescription, ...(item.prescriptions || [])],
      timeline: [{ date: prescription.createdAt, type: 'document', title: `Receta ${prescription.number} generada`, detail: `${items.length} indicación(es) registradas para impresión y firma.` }, ...(item.timeline || [])],
      updatedAt: nowIso(),
    } : item),
  };
  return { data: next, prescription };
}

export function getReminderQueue(data, now = new Date()) {
  const fallbackHours = [...new Set((data.settings?.reminderHours || [24, 8]).map(Number).filter(value => value > 0))].sort((a, b) => b - a);
  const queue = [];
  (data.appointments || []).forEach(appointment => {
    if (['cancelled', 'completed', 'no_show'].includes(appointment.status)) return;
    const start = new Date(appointment.start);
    if (!Number.isFinite(start.getTime())) return;
    const patient = data.patients.find(item => item.id === appointment.patientId);
    if (!patient || patient.vitalStatus === 'deceased' || patient.notificationPreferences?.enabled === false) return;
    const preferences = patient.notificationPreferences || {};
    const hours = [...new Set((preferences.reminderHours?.length ? preferences.reminderHours : fallbackHours).map(Number).filter(value => value > 0))].sort((a, b) => b - a);
    const channels = Array.isArray(preferences.channels) && preferences.channels.length ? preferences.channels : (data.settings?.reminderChannels || ['whatsapp']);
    hours.forEach(reminderHours => {
      const dueAt = new Date(start.getTime() - reminderHours * 60 * 60 * 1000);
      const log = (appointment.reminderLog || []).find(item => Number(item.hours) === reminderHours);
      let status = 'upcoming';
      if (log?.sentAt) status = 'sent';
      else if (now >= start) status = 'overdue';
      else if (now >= dueAt) status = 'due';
      queue.push({
        id: `${appointment.id}_${reminderHours}`,
        appointment,
        patient,
        hours: reminderHours,
        dueAt: dueAt.toISOString(),
        status,
        sentAt: log?.sentAt || null,
        channel: log?.channel || null,
        channels,
        consentStatus: preferences.consentStatus || 'pending',
      });
    });
  });
  const order = { due: 0, overdue: 1, upcoming: 2, sent: 3 };
  return queue.sort((left, right) => order[left.status] - order[right.status] || new Date(left.dueAt) - new Date(right.dueAt));
}

export function markReminderSent(data, appointmentId, hours, channel = 'manual') {
  return {
    ...data,
    appointments: data.appointments.map(appointment => {
      if (appointment.id !== appointmentId) return appointment;
      const remaining = (appointment.reminderLog || []).filter(item => Number(item.hours) !== Number(hours));
      return {
        ...appointment,
        reminderLog: [...remaining, { hours: Number(hours), channel, sentAt: nowIso(), sentBy: getActiveUser(data)?.id || null }],
        updatedAt: nowIso(),
      };
    }),
  };
}

export function reminderLabel(hours) {
  const value = Number(hours);
  if (value % 24 === 0) return `${value / 24} día${value / 24 === 1 ? '' : 's'} antes`;
  return `${value} hora${value === 1 ? '' : 's'} antes`;
}

export function buildReminderMessage(data, patient, appointment) {
  const clinic = data.organization?.name || 'su clínica';
  const date = new Intl.DateTimeFormat('es-SV', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(appointment.start));
  return `Hola ${patient?.preferredName || patient?.name || ''}. Le recordamos una cita privada en ${clinic}, programada para ${date}. Responda 1 para confirmar, 2 para reprogramar o 3 para cancelar.`;
}

export function whatsappReminderUrl(data, patient, appointment) {
  const digits = String(patient?.notificationPreferences?.phone || patient?.phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(buildReminderMessage(data, patient, appointment))}`;
}

export function emailReminderUrl(data, patient, appointment) {
  const email = String(patient?.notificationPreferences?.email || patient?.email || '').trim();
  if (!email) return '';
  const subject = `Recordatorio de cita · ${data.organization?.name || 'su clínica'}`;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildReminderMessage(data, patient, appointment))}`;
}

export function smsReminderUrl(data, patient, appointment) {
  const phone = String(patient?.notificationPreferences?.phone || patient?.phone || '').trim();
  if (!phone) return '';
  return `sms:${encodeURIComponent(phone)}?body=${encodeURIComponent(buildReminderMessage(data, patient, appointment))}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeImage(value) {
  return /^data:image\/(png|jpe?g|webp);base64,/i.test(String(value || '')) ? value : '';
}

export function buildPrescriptionPrintHtml(data, patient, prescription) {
  const organization = data.organization || {};
  const logo = safeImage(organization.clinicLogo);
  const items = (prescription.items || []).map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(item.medication)}</strong>${item.strength ? `<div>${escapeHtml(item.strength)}</div>` : ''}</td>
      <td>${escapeHtml(item.directions)}${item.duration ? `<div class="muted">Duración: ${escapeHtml(item.duration)}</div>` : ''}${item.notes ? `<div class="muted">${escapeHtml(item.notes)}</div>` : ''}</td>
      <td>${escapeHtml(item.quantity || '—')}</td>
    </tr>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(prescription.number)}</title><style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#05316E;margin:0;background:#fff}.sheet{min-height:267mm;border:1px solid #d7e1eb;padding:20mm 16mm 15mm;position:relative}.header{display:flex;align-items:center;gap:18px;border-bottom:3px solid #05316E;padding-bottom:16px}.logo{width:84px;height:64px;object-fit:contain}.clinic{flex:1}.clinic h1{font-size:24px;margin:0 0 4px}.clinic p{margin:2px 0;color:#52677d;font-size:11px}.rx-meta{text-align:right}.rx-meta strong{display:block;font-size:17px}.rx-meta span{font-size:11px;color:#52677d}.patient{margin:20px 0 15px;padding:14px;background:#FCFDF6;border:1px solid #d8e3ed;border-radius:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px 25px}.patient div{font-size:11px;color:#52677d}.patient b{display:block;color:#05316E;font-size:13px;margin-top:2px}.rx{font-size:35px;font-weight:700;margin:10px 0;color:#05316E}table{width:100%;border-collapse:collapse}th{background:#05316E;color:white;text-align:left;padding:10px;font-size:11px}td{border-bottom:1px solid #d8e3ed;padding:12px 10px;vertical-align:top;font-size:12px;line-height:1.45}td:first-child{width:35px}td:last-child{width:80px}.muted{color:#64788c;font-size:10px;margin-top:4px}.instructions{margin-top:18px;border-left:4px solid #8FACCB;padding:10px 14px;background:#f4f8fb}.instructions h3{font-size:12px;margin:0 0 6px}.instructions p{font-size:11px;white-space:pre-wrap;margin:0;line-height:1.5}.signature{margin-top:55px;display:flex;justify-content:flex-end}.signature-box{width:260px;text-align:center;border-top:1px solid #05316E;padding-top:8px}.signature-box strong{display:block}.signature-box span{font-size:10px;color:#52677d}.footer{position:absolute;left:16mm;right:16mm;bottom:12mm;border-top:1px solid #d8e3ed;padding-top:8px;font-size:9px;color:#65798c;display:flex;justify-content:space-between;gap:15px}.footer span:last-child{text-align:right}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.sheet{border:0;padding:8mm 4mm 2mm;min-height:auto}.footer{left:4mm;right:4mm;bottom:0}}
  </style></head><body><section class="sheet"><header class="header">${logo ? `<img class="logo" src="${logo}" alt="Logo">` : ''}<div class="clinic"><h1>${escapeHtml(organization.name || 'Consultorio de Psiquiatría')}</h1><p><strong>${escapeHtml(organization.clinician || prescription.doctorName || '')}</strong> · ${escapeHtml(organization.specialty || 'Psiquiatría')}</p><p>${escapeHtml([organization.professionalLicense, organization.address].filter(Boolean).join(' · '))}</p><p>${escapeHtml([organization.phone, organization.email].filter(Boolean).join(' · '))}</p></div><div class="rx-meta"><strong>${escapeHtml(prescription.number)}</strong><span>${new Intl.DateTimeFormat('es-SV', { dateStyle: 'long' }).format(new Date(prescription.date))}</span></div></header><section class="patient"><div>Paciente<b>${escapeHtml(patient.name)}</b></div><div>Edad<b>${escapeHtml(patient.age)} años</b></div><div>Diagnóstico<b>${escapeHtml(prescription.diagnosis || patient.diagnosis || 'No consignado')}</b></div><div>Seguro médico<b>${patient.insurance?.hasInsurance ? escapeHtml(patient.insurance.provider || 'Sí') : 'No registrado'}</b></div></section><div class="rx">℞</div><table><thead><tr><th>#</th><th>Medicamento</th><th>Indicación</th><th>Cantidad</th></tr></thead><tbody>${items}</tbody></table>${prescription.generalInstructions || prescription.observations ? `<section class="instructions"><h3>Indicaciones generales</h3><p>${escapeHtml([prescription.generalInstructions, prescription.observations].filter(Boolean).join('\n\n'))}</p></section>` : ''}<div class="signature"><div class="signature-box"><strong>${escapeHtml(prescription.doctorName || organization.clinician || '')}</strong><span>${escapeHtml([organization.specialty, organization.professionalLicense].filter(Boolean).join(' · '))}</span><span>Firma y sello</span></div></div><footer class="footer"><span>${escapeHtml(organization.prescriptionFooter || 'Documento para revisión y firma del profesional tratante.')}</span><span>${escapeHtml(organization.name || '')}</span></footer></section><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),180));</script></body></html>`;
}
