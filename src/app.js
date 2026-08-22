import React from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import '../styles.css';
import {
  COMMON_ADVERSE_EFFECTS,
  FREQUENCIES,
  MEDICATION_CLASSES,
  SCALE_CATALOG,
  createSeedData,
  normalizeData,
} from './data.js';
import {
  addMinutes,
  daysBetween,
  downloadAllICS,
  downloadCSV,
  downloadICS,
  downloadJSON,
  formatDate,
  formatDateTime,
  formatLongDate,
  formatTime,
  getAssessmentSummary,
  getPatientPriority,
  googleCalendarUrl,
  isSameDay,
  monthMatrix,
  percent,
  relativeDate,
  severityLabel,
  startOfWeek,
  statusLabel,
  toDateInput,
} from './utils.js';
import {
  addMedication,
  adverseFormDefaults,
  analyticsRows,
  appointmentFormDefaults,
  assessmentFormDefaults,
  buildPatientReport,
  changeAppointmentStatus,
  changeMedicationDose,
  createPatient,
  doseFormDefaults,
  labFormDefaults,
  medicationFormDefaults,
  patientEditFormDefaults,
  patientFormDefaults,
  recordAdverseEvent,
  recordAssessment,
  recordLab,
  recordVitals,
  removeAppointment,
  saveAppointment,
  setAdverseEventStatus,
  setMedicationStatus,
  updateAlertStatus,
  updatePatientProfile,
  validateImportedData,
  vitalsFormDefaults,
} from './clinical.js';
import {
  PERMISSION_CATALOG,
  REMINDER_OPTIONS,
  authenticateLocalUser,
  buildPrescriptionPrintHtml,
  buildReminderMessage,
  clinicProfileDefaults,
  createSecretaryUser,
  getActiveUser,
  getReminderQueue,
  hasPermission,
  markReminderSent,
  optimizeImageFile,
  prescriptionFormDefaults,
  reminderLabel,
  savePatientPhoto,
  savePracticeProfile,
  savePrescription,
  secretaryFormDefaults,
  setActiveUser,
  toggleUserActive,
  updateLocalPassword,
  updateUserPermissions,
  whatsappReminderUrl,
} from './practice.js';
import {
  createWompiPaymentLink,
  fetchWompiAppInfo,
  fetchSubscriptionInvoices,
  supabaseConfigured,
} from './services/wompi.js';
import {
  productionMode,
  signUpProduction,
  signInProduction,
  getProductionSession,
  signOutProduction,
  bootstrapAndLoadState,
  saveProductionState,
  savePlatformBillingSettings,
} from './services/appState.js';

const html = htm.bind(React.createElement);
const STORAGE_KEY = 'nexamind-clinical-demo-v3';
const LEGACY_STORAGE_KEYS = ['nexamind-clinical-demo-v2', 'nexamind-clinical-demo-v1'];
const AUTH_SESSION_KEY = 'nexamind-clinical-auth-v1';
const AUTH_SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

const iconPaths = {
  overview: '<path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z"/>',
  patients: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  analytics: '<path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-7"/>',
  alert: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.4 1.08V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8.6 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.08-.4H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 3.9l.06.06A1.65 1.65 0 0 0 9 4.6c.36-.15.7-.37 1-.6.3-.29.45-.69.4-1.08V3a2 2 0 1 1 4 0v.09c-.05.39.1.79.4 1.08.3.23.64.45 1 .6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.15.36.37.7.6 1 .29.3.69.45 1.08.4H21a2 2 0 1 1 0 4h-.09c-.39-.05-.79.1-1.08.4-.23.3-.45.64-.6 1Z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6 6-6 6" transform="translate(0 -12)"/>',
  arrowUp: '<path d="m18 15-6-6-6 6"/>',
  arrowDown: '<path d="m6 9 6 6 6-6"/>',
  trend: '<path d="M3 3v18h18"/><path d="m7 15 4-4 4 3 5-6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  medication: '<path d="m10.5 20.5-7-7a4.95 4.95 0 0 1 7-7l7 7a4.95 4.95 0 0 1-7 7Z"/><path d="m8.5 8.5 7 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  external: '<path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 2-3 4M12 18h.01"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  refresh: '<path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/>',
  userPlus: '<path d="M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6"/>',
  camera: '<path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3h5Z"/><circle cx="12" cy="13" r="3.5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M17 11h6"/>',
  building: '<path d="M3 21h18M6 21V7l6-4 6 4v14M9 10h1M14 10h1M9 14h1M14 14h1M10 21v-3h4v3"/>',
  message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/><path d="M8 8h8M8 12h5"/>',
  mouse: '<rect x="7" y="2" width="10" height="20" rx="5"/><path d="M12 6v4"/>',
  move: '<path d="M12 2v20M2 12h20"/><path d="m8 6 4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4"/>',
  insurance: '<path d="M12 3 4 6v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-3Z"/><path d="M9 12h6M12 9v6"/>',
  prescription: '<path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h3"/><path d="m15 16 3 3M18 16l-3 3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="m3 3 18 18"/><path d="M10.6 10.6A2 2 0 0 0 13.4 13.4"/><path d="M9.9 4.2A10.5 10.5 0 0 1 12 4c6.5 0 10 8 10 8a18 18 0 0 1-3.2 4.5M6.2 6.2C3.6 8 2 12 2 12s3.5 8 10 8a10 10 0 0 0 4.1-.8"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
};

function Icon({ name, size = 18, className = '' }) {
  return html`<svg className=${`icon ${className}`} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: iconPaths[name] || iconPaths.activity }}></svg>`;
}

function Logo({ organization = {} }) {
  const logo = organization.clinicLogo;
  return html`<div className="brand">${logo ? html`<img className="brand-logo-image" src=${logo} alt=${`Logo de ${organization.name || 'la clínica'}`}/>` : html`<div className="brand-mark"><span></span><span></span><span></span></div>`}<div><strong>${organization.name || 'NEXAMIND'}</strong><small>${organization.specialty || 'Seguimiento clínico'}</small></div></div>`;
}

function Avatar({ patient, size = 'md' }) {
  const photo = patient?.photo;
  return html`<div className=${`avatar avatar-${size} ${photo ? 'avatar-photo' : ''}`} title=${patient?.name || ''}>${photo ? html`<img src=${photo} alt=${patient?.name || 'Paciente'}/>` : patient?.initials || 'NM'}</div>`;
}

function UserAvatar({ user, organization, size = 'sm' }) {
  const photo = user?.avatar || (user?.role === 'doctor' ? organization?.doctorPhoto : '');
  const initials = String(user?.name || 'Usuario').trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'U';
  return html`<div className=${`avatar avatar-${size} ${photo ? 'avatar-photo' : ''}`}>${photo ? html`<img src=${photo} alt=${user?.name || 'Usuario'}/>` : initials}</div>`;
}

function Badge({ tone = 'neutral', children, dot = false }) {
  return html`<span className=${`badge badge-${tone}`}>${dot ? html`<i></i>` : null}${children}</span>`;
}

function Button({ tone = 'primary', icon, children, onClick, className = '', type = 'button', disabled = false, title = '', tour = null }) {
  return html`<button type=${type} title=${title} data-tour=${tour || null} className=${`button button-${tone} ${className}`} onClick=${onClick} disabled=${disabled}>${icon ? html`<${Icon} name=${icon} size=${18}/>` : null}<span>${children}</span></button>`;
}

function Card({ children, className = '', title, subtitle, action, tour = null }) {
  return html`<section className=${`card ${className}`} data-tour=${tour || null}>
    ${title ? html`<div className="card-heading"><div><h3>${title}</h3>${subtitle ? html`<p>${subtitle}</p>` : null}</div>${action || null}</div>` : null}
    ${children}
  </section>`;
}

function Sparkline({ values = [], tone = 'purple' }) {
  if (!values.length) return null;
  const width = 150; const height = 56; const pad = 4;
  const max = Math.max(...values); const min = Math.min(...values); const range = max - min || 1;
  const points = values.map((value, index) => `${pad + index * (width - pad * 2) / Math.max(values.length - 1, 1)},${pad + (max - value) / range * (height - pad * 2)}`).join(' ');
  return html`<svg className=${`sparkline spark-${tone}`} viewBox=${`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true"><polyline points=${points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>`;
}

function LineChart({ series = [], height = 230, showLegend = true }) {
  const filtered = series.filter(item => item?.points?.length);
  if (!filtered.length) return html`<div className="chart-empty">Aún no hay suficientes mediciones para mostrar una tendencia.</div>`;
  const width = 760; const pad = { l: 46, r: 20, t: 24, b: 40 };
  const all = filtered.flatMap(item => item.points.map(point => Number(point.value))).filter(Number.isFinite);
  const min = Math.min(...all, 0); const max = Math.max(...all, 1); const range = max - min || 1;
  const count = Math.max(...filtered.map(item => item.points.length));
  const x = index => pad.l + index * (width - pad.l - pad.r) / Math.max(count - 1, 1);
  const y = value => pad.t + (max - value) / range * (height - pad.t - pad.b);
  const ticks = [0, .25, .5, .75, 1].map(tick => max - tick * range);
  return html`<div className="chart-wrap">
    ${showLegend ? html`<div className="chart-legend">${filtered.map((item, index) => html`<span key=${item.label}><i className=${`legend-${index}`}></i>${item.label}</span>`)}</div>` : null}
    <svg className="line-chart" viewBox=${`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="Tendencia clínica">
      ${ticks.map((tick, index) => html`<g key=${index}><line x1=${pad.l} y1=${y(tick)} x2=${width - pad.r} y2=${y(tick)} className="grid-line"/><text x=${pad.l - 10} y=${y(tick) + 4} textAnchor="end">${Math.round(tick)}</text></g>`)}
      ${filtered.map((item, seriesIndex) => {
        const points = item.points.map((point, index) => `${x(index)},${y(Number(point.value))}`).join(' ');
        return html`<g key=${item.label} className=${`series series-${seriesIndex}`}><polyline points=${points} fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>${item.points.map((point, index) => html`<g key=${index}><circle cx=${x(index)} cy=${y(Number(point.value))} r="5"/><title>${formatDate(point.date)}: ${point.value}</title></g>`)}</g>`;
      })}
      ${filtered[0].points.map((point, index) => html`<text key=${index} x=${x(index)} y=${height - 10} textAnchor="middle" className="x-label">${formatDate(point.date, { year: false, month: 'short', day: '2-digit' })}</text>`)}
    </svg>
  </div>`;
}

function Donut({ value, label, caption, tone = 'purple' }) {
  const radius = 48; const circumference = 2 * Math.PI * radius; const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return html`<div className="donut-card"><div className=${`donut donut-${tone}`}><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r=${radius} className="donut-bg"/><circle cx="60" cy="60" r=${radius} className="donut-value" strokeDasharray=${circumference} strokeDashoffset=${circumference * (1 - safe / 100)}/></svg><strong>${Math.round(safe)}%</strong></div><div><b>${label}</b><small>${caption}</small></div></div>`;
}

function KpiCard({ label, value, hint, icon, tone = 'purple', chart, tour = null }) {
  return html`<${Card} className=${`kpi-card kpi-${tone}`} tour=${tour}><div className="kpi-top"><span>${label}</span><span className="kpi-icon"><${Icon} name=${icon} size=${19}/></span></div><div className="kpi-body"><div><strong>${value}</strong><small>${hint}</small></div>${chart || null}</div></${Card}>`;
}

function Modal({ title, subtitle, children, onClose, size = 'md' }) {
  return html`<div className="modal-backdrop" onMouseDown=${event => event.target === event.currentTarget && onClose()}><div className=${`modal modal-${size}`} role="dialog" aria-modal="true" aria-label=${title}><div className="modal-header"><div><span className="eyebrow">NexaMind Clinical</span><h2>${title}</h2>${subtitle ? html`<p>${subtitle}</p>` : null}</div><button className="icon-button" aria-label="Cerrar" onClick=${onClose}><${Icon} name="close"/></button></div><div className="modal-body">${children}</div></div></div>`;
}

function PageHeader({ eyebrow, title, subtitle, actions }) {
  return html`<div className="page-header"><div><span className="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${subtitle}</p></div><div className="page-actions">${actions}</div></div>`;
}

function EmptyState({ icon = 'file', title, text, action }) {
  return html`<div className="empty-state"><span><${Icon} name=${icon} size=${25}/></span><h3>${title}</h3><p>${text}</p>${action || null}</div>`;
}

function FormField({ label, hint, required = false, className = '', children }) {
  return html`<label className=${`form-field ${className}`}><span>${label}${required ? html`<b aria-hidden="true"> *</b>` : null}</span>${children}${hint ? html`<small>${hint}</small>` : null}</label>`;
}

function FormActions({ onCancel, submitLabel = 'Guardar', dangerAction = null }) {
  return html`<div className="form-actions">${dangerAction ? html`<div>${dangerAction}</div>` : html`<div></div>`}<div><${Button} tone="secondary" onClick=${onCancel}>Cancelar</${Button}><${Button} icon="check" type="submit">${submitLabel}</${Button}></div></div>`;
}

function ImagePicker({ value, label, hint, onChange, onRemove, shape = 'round', disabled = false }) {
  return html`<div className=${`image-picker image-picker-${shape} ${disabled ? 'disabled' : ''}`}><div className="image-picker-preview">${value ? html`<img src=${value} alt=${label}/>` : html`<${Icon} name=${shape === 'logo' ? 'building' : 'camera'} size=${25}/>`}</div><div><b>${label}</b><p>${hint}</p><div className="image-picker-actions"><label className="button button-secondary file-button ${disabled ? 'disabled' : ''}"><${Icon} name="upload" size=${17}/><span>${value ? 'Cambiar imagen' : 'Subir imagen'}</span><input type="file" accept="image/png,image/jpeg,image/webp" disabled=${disabled} onChange=${onChange}/></label>${value && !disabled ? html`<button type="button" className="text-danger-button" onClick=${onRemove}><${Icon} name="trash" size=${15}/> Quitar</button>` : null}</div></div></div>`;
}

function clinicalLabel(status) {
  return ({ responding: 'Mejorando', partial: 'Mejoría parcial', stable: 'Estable', review: 'Requiere revisión' })[status] || statusLabel(status);
}

function riskLabel(risk) {
  return ({ low: 'Bajo', medium: 'Moderado', high: 'Alto' })[risk] || 'Sin registrar';
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
}


const TUTORIAL_STORAGE_KEY = 'linkare-tutorial-v3';
const TUTORIAL_VERSION = 3;

const TOUR_STEPS = [
  { id: 'welcome', chapter: '1 · Bienvenida', title: 'Así funciona el recorrido', description: 'Este tutorial es más general y estable. Le enseña el flujo completo pantalla por pantalla sin depender de localizar cada botón.', view: 'dashboard', quick: true, icon: 'help', items: ['No modifica datos.', 'Puede avanzar, retroceder o cerrar.', 'Cada paso abre una pantalla real.'] },
  { id: 'dashboard', chapter: '2 · Inicio', title: 'Panel principal', description: 'Inicio resume pacientes prioritarios, citas del día y cambios importantes.', view: 'dashboard', quick: true, icon: 'overview', items: ['Revise prioridades.', 'Abra pacientes urgentes.', 'Salte a agenda o alertas.'] },
  { id: 'patients', chapter: '3 · Pacientes', title: 'Listado de expedientes', description: 'En Pacientes puede buscar, filtrar, crear y abrir expedientes.', view: 'patients', quick: true, icon: 'patients', items: ['Buscar por nombre o diagnóstico.', 'Crear pacientes.', 'Abrir la ficha completa.'] },
  { id: 'patient-overview', chapter: '4 · Expediente', title: 'Resumen del paciente', description: 'El expediente reúne diagnóstico, estado, próxima cita y acciones rápidas.', view: 'patient', patientTab: 'overview', quick: true, icon: 'file', items: ['Ver situación actual.', 'Registrar evolución.', 'Agendar cita.'] },
  { id: 'patient-medications', chapter: '5 · Tratamiento', title: 'Medicamentos y dosis', description: 'Aquí se agregan tratamientos, se cambia la dosis y se conserva el historial.', view: 'patient', patientTab: 'medications', quick: true, icon: 'medication', items: ['Agregar medicamento.', 'Cambiar dosis.', 'Pausar o finalizar.'] },
  { id: 'patient-followup', chapter: '6 · Seguimiento', title: 'Escalas y evolución', description: 'Seguimiento registra puntajes, adherencia, funcionamiento y mejoría observada.', view: 'patient', patientTab: 'followup', quick: true, icon: 'analytics', items: ['Comparar valor inicial y actual.', 'Actualizar riesgo.', 'Documentar evolución.'] },
  { id: 'patient-safety', chapter: '7 · Seguridad', title: 'Efectos y controles', description: 'Esta pestaña reúne signos vitales, laboratorios y efectos adversos.', view: 'patient', patientTab: 'safety', quick: false, icon: 'shield', items: ['Efectos activos.', 'Controles físicos.', 'Laboratorios.'] },
  { id: 'patient-timeline', chapter: '8 · Historial', title: 'Historial cronológico', description: 'El historial muestra en orden lo ocurrido con el paciente.', view: 'patient', patientTab: 'timeline', quick: false, icon: 'clock', items: ['Ver secuencia clínica.', 'Filtrar eventos.', 'Entender decisiones previas.'] },
  { id: 'agenda', chapter: '9 · Agenda', title: 'Agenda y recordatorios', description: 'La agenda organiza citas, confirmaciones y recordatorios.', view: 'agenda', quick: true, icon: 'calendar', items: ['Mes, semana o día.', 'Cambiar estado.', 'Preparar recordatorios.'] },
  { id: 'analytics', chapter: '10 · Resultados', title: 'Resultados descriptivos', description: 'Resultados muestra tendencias agregadas de los pacientes.', view: 'analytics', quick: false, icon: 'trend', items: ['Mejoría media.', 'Adherencia promedio.', 'Resumen por clase.'] },
  { id: 'alerts', chapter: '11 · Alertas', title: 'Alertas priorizadas', description: 'Las alertas ayudan a ordenar la revisión clínica.', view: 'alerts', quick: true, icon: 'alert', items: ['Abrir paciente.', 'Marcar revisada.', 'Reabrir si hace falta.'] },
  { id: 'payments', chapter: '12 · Cobros', title: 'Cobros, Wompi y métodos de pago', description: 'Cobros centraliza tarifas, enlace de Wompi y otros métodos.', view: 'payments', quick: true, icon: 'insurance', items: ['Activar Wompi con checkout URL.', 'Configurar transferencia, efectivo y seguro.', 'Ver pagos pendientes y recibidos.'] },
  { id: 'settings', chapter: '13 · Configuración', title: 'Clínica, equipo y respaldo', description: 'Configuración permite editar branding, usuarios y respaldos.', view: 'settings', quick: false, icon: 'settings', items: ['Logo y datos de clínica.', 'Permisos.', 'Respaldos.'] },
  { id: 'finish', chapter: '14 · Listo', title: 'Ya conoce el flujo general', description: 'Este recorrido compacto reduce fallos y mantiene la enseñanza completa.', view: 'dashboard', quick: true, icon: 'check', items: ['Repítalo desde Ayuda.', 'Explore cada módulo.', 'Use Cobros para configurar Wompi.'] },
];

function buildExpandedTourSteps(mode = 'quick') {
  return mode === 'quick' ? TOUR_STEPS.filter(step => step.quick) : TOUR_STEPS;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function readAuthSession(data) {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || 'null');
    if (!session?.userId || Number(session.expiresAt || 0) <= Date.now()) {
      localStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    const user = (data.users || []).find(item => item.id === session.userId && item.active !== false);
    return user?.id || null;
  } catch (_) {
    localStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('NexaMind render error', error, info);
  }

  resetTutorial = () => {
    try {
      localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    } catch (_) { /* Ignore storage restrictions. */ }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return html`<main className="crash-screen"><section className="crash-card"><div className="crash-icon"><${Icon} name="alert" size=${28}/></div><span className="eyebrow">Recuperación segura</span><h1>NexaMind tuvo un problema al mostrar esta pantalla</h1><p>Sus datos locales no se borraron. Puede recargar la aplicación o reiniciar solamente el tutorial.</p><div className="crash-actions"><${Button} icon="refresh" onClick=${() => window.location.reload()}>Recargar aplicación</${Button}><${Button} tone="secondary" icon="help" onClick=${this.resetTutorial}>Reiniciar tutorial</${Button}></div><small>${this.state.error?.message || 'Error de interfaz no identificado.'}</small></section></main>`;
  }
}

class App extends React.Component {
  constructor(props) {
    super(props);
    let data;
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map(key => localStorage.getItem(key)).find(Boolean);
      data = stored ? normalizeData(JSON.parse(stored)) : createSeedData();
    } catch (_) {
      data = createSeedData();
    }
    const authenticatedUserId = productionMode ? null : readAuthSession(data);
    if (authenticatedUserId) {
      try { data = setActiveUser(data, authenticatedUserId); } catch (_) { /* Session will be ignored below. */ }
    }
    this.state = {
      data,
      authenticatedUserId,
      authView: 'login',
      loginDraft: { email: '', password: '', showPassword: false },
      registerDraft: { fullName: '', clinicName: '', email: '', password: '', confirmPassword: '', showPassword: false },
      authNotice: '',
      loginError: '',
      loginBusy: false,
      productionLoading: productionMode,
      remoteOrganizationId: null,
      remoteReady: false,
      remoteSaveStatus: productionMode ? 'waiting' : 'local',
      wompiBusy: false,
      wompiStatus: { state: supabaseConfigured ? 'idle' : 'not-configured', app: null, error: '' },
      view: 'dashboard',
      selectedPatientId: data.patients[0]?.id || null,
      patientTab: 'overview',
      patientFilter: 'all',
      search: '',
      mobileNav: false,
      modal: null,
      modalError: '',
      appointmentDetails: null,
      calendarDate: new Date(),
      calendarView: 'month',
      chartMode: 'scales',
      timelineFilter: 'all',
      toast: null,
      toastTone: 'success',
      tutorialIntro: false,
      tourActive: false,
      tourMode: 'quick',
      tourIndex: 0,
      tourRect: null,
      tourReady: false,
      tourLayout: 'floating',
      tourDockSide: 'right',
      tourInModal: false,
      tourTargetMissing: false,
      tourCardPosition: null,
      tourCardDragging: false,
      tourCardFit: null,
      tourViewportFitted: false,
      tourPreviewRole: 'doctor',
    };
  }

  scheduleTutorialIntro = () => {
    if (!this.state.authenticatedUserId) return;
    let tutorialSeen = false;
    try {
      const stored = JSON.parse(localStorage.getItem(TUTORIAL_STORAGE_KEY) || 'null');
      tutorialSeen = stored?.version === TUTORIAL_VERSION;
    } catch (_) { /* Ignore malformed preference. */ }
    if (!tutorialSeen) {
      clearTimeout(this.tutorialIntroTimer);
      this.tutorialIntroTimer = setTimeout(() => this.setState({ tutorialIntro: true }), 650);
    }
  };

  applyProductionSession = async (session, requestedOrganizationName = null) => {
    const seed = createSeedData();
    const remote = await bootstrapAndLoadState(seed, requestedOrganizationName);
    let data = normalizeData(remote.payload || seed);
    const email = String(session?.user?.email || '').toLowerCase();
    const mappedRole = remote.memberRole === 'psychiatrist' ? 'doctor' : remote.memberRole;
    let user = (data.users || []).find(item => String(item.email || '').toLowerCase() === email && item.active !== false);
    if (!user && mappedRole) user = (data.users || []).find(item => item.role === mappedRole && item.active !== false);
    if (!user) user = (data.users || []).find(item => item.role === 'owner' && item.active !== false)
      || (data.users || []).find(item => item.role === 'doctor' && item.active !== false)
      || data.users?.[0];
    if (user && email && String(user.email || '').toLowerCase() !== email) {
      data = { ...data, users: data.users.map(item => item.id === user.id ? { ...item, email, name: remote.memberName || item.name } : item) };
      user = data.users.find(item => item.id === user.id) || user;
    }
    if (user) data = setActiveUser(data, user.id);
    this.setState({
      data,
      authenticatedUserId: user?.id || session?.user?.id || null,
      remoteOrganizationId: remote.organizationId,
      remoteReady: true,
      remoteSaveStatus: 'saved',
      productionLoading: false,
      loginBusy: false,
      loginError: '',
      view: 'dashboard',
      selectedPatientId: data.patients?.[0]?.id || null,
      patientTab: 'overview',
      modal: null,
      tutorialIntro: false,
      tourActive: false,
    }, () => {
      this.scheduleTutorialIntro();
      this.loadWompiStatus();
      this.loadSubscriptionInvoices();
    });
  };

  restoreProductionSession = async () => {
    try {
      const session = await getProductionSession();
      if (!session) {
        this.setState({ productionLoading: false, remoteReady: false, authenticatedUserId: null });
        return;
      }
      await this.applyProductionSession(session);
    } catch (error) {
      this.setState({
        productionLoading: false,
        remoteReady: false,
        authenticatedUserId: null,
        loginError: error instanceof Error ? error.message : 'No se pudo recuperar la sesión de producción.',
      });
    }
  };

  componentDidMount() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('resize', this.handleTourViewportChange, { passive: true });
    window.addEventListener('scroll', this.handleTourViewportChange, true);
    if (productionMode) {
      this.restoreProductionSession();
    } else {
      this.schedulePersist();
      this.scheduleTutorialIntro();
      if (supabaseConfigured) this.loadWompiStatus();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('resize', this.handleTourViewportChange);
    window.removeEventListener('scroll', this.handleTourViewportChange, true);
    document.body.style.overflow = '';
    clearTimeout(this.persistTimer);
    clearTimeout(this.toastTimer);
    clearTimeout(this.tutorialIntroTimer);
    clearTimeout(this.tourTargetTimer);
    clearTimeout(this.tourTargetRetryTimer);
    clearTimeout(this.tourCardFitTimer);
    cancelAnimationFrame(this.tourViewportFrame);
    this.endTourCardDrag();
    this.disconnectTourObservers();
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.data !== this.state.data) this.schedulePersist();
    if (!prevState.authenticatedUserId && this.state.authenticatedUserId) this.scheduleTutorialIntro();
    if (prevState.authenticatedUserId && !this.state.authenticatedUserId) clearTimeout(this.tutorialIntroTimer);
    const hadOverlay = Boolean(prevState.modal || prevState.appointmentDetails || prevState.tutorialIntro);
    const hasOverlay = Boolean(this.state.modal || this.state.appointmentDetails || this.state.tutorialIntro);
    if (hadOverlay !== hasOverlay) document.body.style.overflow = hasOverlay ? 'hidden' : '';

    const tourContextChanged = this.state.tourActive && (
      prevState.view !== this.state.view
      || prevState.patientTab !== this.state.patientTab
      || prevState.modal?.type !== this.state.modal?.type
      || prevState.modal?.draft !== this.state.modal?.draft
      || prevState.appointmentDetails?.id !== this.state.appointmentDetails?.id
      || prevState.mobileNav !== this.state.mobileNav
    );
    if (tourContextChanged) {
      window.requestAnimationFrame(() => this.queueTourTarget(false));
    }
    const tourGeometryChanged = this.state.tourActive && (
      prevState.tourIndex !== this.state.tourIndex
      || prevState.tourRect !== this.state.tourRect
      || prevState.tourTargetMissing !== this.state.tourTargetMissing
      || prevState.tourCardPosition !== this.state.tourCardPosition
    );
    if (tourGeometryChanged && !this.state.tourViewportFitted) this.queueTourCardFit();
    if (prevState.tourActive && !this.state.tourActive) this.disconnectTourObservers();
  }

  handleKeyDown = event => {
    if (this.state.tourActive) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.exitTour();
      } else if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault();
        this.nextTourStep();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.previousTourStep();
      }
      return;
    }
    if (this.state.tutorialIntro && event.key === 'Escape') {
      this.dismissTutorialIntro();
      return;
    }
    if (event.key !== 'Escape') return;
    if (this.state.modal) this.closeModal();
    else if (this.state.appointmentDetails) this.setState({ appointmentDetails: null });
  };

  updateLoginDraft = (key, value) => {
    this.setState(prev => ({ loginDraft: { ...prev.loginDraft, [key]: value }, loginError: '' }));
  };

  updateRegisterDraft = (key, value) => {
    this.setState(prev => ({ registerDraft: { ...prev.registerDraft, [key]: value }, loginError: '', authNotice: '' }));
  };

  showRegister = () => {
    this.setState({
      authView: 'register',
      loginError: '',
      authNotice: '',
      registerDraft: { fullName: '', clinicName: '', email: this.state.loginDraft.email || '', password: '', confirmPassword: '', showPassword: false },
    });
  };

  showLogin = () => {
    this.setState({ authView: 'login', loginError: '', authNotice: '' });
  };

  submitRegister = async event => {
    event?.preventDefault?.();
    if (!productionMode) {
      this.setState({ loginError: 'El registro de cuentas está disponible cuando VITE_APP_MODE=production y Supabase está conectado.' });
      return;
    }
    if (this.state.loginBusy) return;
    const draft = this.state.registerDraft;
    if (draft.password !== draft.confirmPassword) {
      this.setState({ loginError: 'Las contraseñas no coinciden.' });
      return;
    }
    this.setState({ loginBusy: true, loginError: '', authNotice: '' });
    try {
      const result = await signUpProduction({
        fullName: draft.fullName,
        clinicName: draft.clinicName,
        email: draft.email,
        password: draft.password,
      });
      if (result?.session) {
        await this.applyProductionSession(result.session, result.clinicName);
        return;
      }
      this.setState({
        authView: 'login',
        loginBusy: false,
        loginDraft: { email: draft.email, password: '', showPassword: false },
        registerDraft: { fullName: '', clinicName: '', email: '', password: '', confirmPassword: '', showPassword: false },
        authNotice: result?.needsEmailConfirmation
          ? 'Cuenta creada. Revise su correo y confirme la cuenta antes de iniciar sesión.'
          : 'Cuenta creada. Ya puede iniciar sesión.',
      });
    } catch (error) {
      this.setState({ loginBusy: false, loginError: error instanceof Error ? error.message : 'No se pudo crear la cuenta.' });
    }
  };

  fillDemoCredentials = role => {
    const user = (this.state.data.users || []).find(item => item.role === role && item.active !== false);
    if (!user) {
      this.setState({ loginError: 'No hay una cuenta activa para este rol.' });
      return;
    }
    this.setState({
      loginDraft: {
        email: user.email || '',
        password: user.password || (role === 'owner' ? 'Linkare2026!' : role === 'doctor' ? 'NexaMind2026!' : 'Agenda2026!'),
        showPassword: false,
      },
      loginError: '',
    });
  };

  submitLogin = async event => {
    event?.preventDefault?.();
    if (this.state.loginBusy) return;
    this.setState({ loginBusy: true, loginError: '' });
    try {
      // Las cuentas demo siguen disponibles incluso cuando VITE_APP_MODE=production.
      // Si las credenciales coinciden con un usuario local, entramos en modo demo
      // sin consultar Supabase y sin guardar nada clínico remotamente.
      const demoUser = (this.state.data.users || []).find(user =>
        user.active !== false &&
        String(user.email || '').trim().toLowerCase() === String(this.state.loginDraft.email || '').trim().toLowerCase()
      );
      if (demoUser) {
        const user = authenticateLocalUser(this.state.data, this.state.loginDraft.email, this.state.loginDraft.password);
        const data = setActiveUser(this.state.data, user.id);
        try {
          localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ userId: user.id, expiresAt: Date.now() + AUTH_SESSION_DURATION_MS, demo: true }));
        } catch (_) { /* Continue in-memory if storage is unavailable. */ }
        this.setState({
          data,
          authenticatedUserId: user.id,
          remoteOrganizationId: null,
          remoteReady: false,
          remoteSaveStatus: 'demo',
          loginBusy: false,
          loginError: '',
          loginDraft: { email: '', password: '', showPassword: false },
          view: 'dashboard',
          patientTab: 'overview',
          modal: null,
          appointmentDetails: null,
          mobileNav: false,
          tutorialIntro: false,
          tourActive: false,
        });
        return;
      }

      if (productionMode) {
        const session = await signInProduction(this.state.loginDraft.email, this.state.loginDraft.password);
        if (!session) throw new Error('Supabase no devolvió una sesión válida.');
        await this.applyProductionSession(session);
        return;
      }

      const user = authenticateLocalUser(this.state.data, this.state.loginDraft.email, this.state.loginDraft.password);
      const data = setActiveUser(this.state.data, user.id);
      try {
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ userId: user.id, expiresAt: Date.now() + AUTH_SESSION_DURATION_MS }));
      } catch (_) { /* The session will continue until the page closes. */ }
      this.setState({
        data,
        authenticatedUserId: user.id,
        loginBusy: false,
        loginError: '',
        loginDraft: { email: '', password: '', showPassword: false },
        view: 'dashboard',
        patientTab: 'overview',
        modal: null,
        appointmentDetails: null,
        mobileNav: false,
        tutorialIntro: false,
        tourActive: false,
      });
    } catch (error) {
      this.setState({ loginBusy: false, productionLoading: false, loginError: error instanceof Error ? error.message : 'No se pudo iniciar sesión.' });
    }
  };

  logoutUser = async () => {
    if (productionMode) {
      try { await signOutProduction(); } catch (_) { /* Continue local logout. */ }
    } else {
      try { localStorage.removeItem(AUTH_SESSION_KEY); } catch (_) { /* Ignore storage restrictions. */ }
    }
    clearTimeout(this.tutorialIntroTimer);
    document.body.style.overflow = '';
    const user = this.activeUser();
    this.setState({
      authenticatedUserId: null,
      remoteOrganizationId: null,
      remoteReady: false,
      remoteSaveStatus: productionMode ? 'waiting' : 'local',
      authView: 'login',
      loginDraft: { email: user?.email || '', password: '', showPassword: false },
      registerDraft: { fullName: '', clinicName: '', email: '', password: '', confirmPassword: '', showPassword: false },
      authNotice: '',
      loginError: '',
      loginBusy: false,
      modal: null,
      modalError: '',
      appointmentDetails: null,
      tutorialIntro: false,
      tourActive: false,
      tourRect: null,
      tourReady: false,
      tourCardFit: null,
      tourViewportFitted: false,
      mobileNav: false,
      view: 'dashboard',
    });
  };

  openAccount = () => {
    const user = this.activeUser();
    this.setState({
      modal: {
        type: 'account',
        draft: { currentPassword: '', newPassword: '', confirmPassword: '', showPasswords: false },
        userId: user?.id || null,
      },
      modalError: '',
    });
  };

  saveAccountPassword = event => {
    event.preventDefault();
    const user = this.activeUser();
    if (!user) return;
    try {
      const draft = this.state.modal.draft;
      const data = updateLocalPassword(this.state.data, user.id, draft.currentPassword, draft.newPassword, draft.confirmPassword);
      this.setState({ data, modal: null, modalError: '' }, () => this.notify('Contraseña actualizada.'));
    } catch (error) {
      this.handleFormError(error);
    }
  };

  getTourSteps = (mode = this.state.tourMode) => buildExpandedTourSteps(mode);

  currentTourStep = () => this.getTourSteps()[this.state.tourIndex] || null;

  rememberTutorial = status => {
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify({ version: TUTORIAL_VERSION, status, updatedAt: new Date().toISOString() }));
    } catch (_) { /* Preferences can still work for this session. */ }
  };

  isTourStepSatisfied = step => {
    if (!step?.waitFor) return true;
    const waitFor = step.waitFor;
    if (waitFor.view && this.state.view !== waitFor.view) return false;
    if (waitFor.patientTab && this.state.patientTab !== waitFor.patientTab) return false;
    if (waitFor.modalType && this.state.modal?.type !== waitFor.modalType) return false;
    if (waitFor.draftField) {
      const actual = this.state.modal?.draft?.[waitFor.draftField];
      if (Object.prototype.hasOwnProperty.call(waitFor, 'equals')) {
        if (actual !== waitFor.equals) return false;
      } else if (!actual) return false;
    }
    return true;
  };

  getTourActionStatus = step => {
    if (!step?.waitFor) return null;
    const complete = this.isTourStepSatisfied(step);
    return {
      complete,
      title: complete ? 'Acción detectada' : 'Acción requerida',
      text: complete ? 'Perfecto. Ya realizó este paso. Puede continuar cuando quiera.' : (step.actionLabel || describeTourWait(step.waitFor)),
      hint: complete ? 'Cuando esté listo, haga clic en Siguiente.' : describeTourWait(step.waitFor),
    };
  };

  describeTourLocation = () => {
    const viewLabels = {
      dashboard: 'Inicio',
      patients: 'Pacientes',
      patient: 'Expediente del paciente',
      agenda: 'Agenda',
      analytics: 'Resultados',
      alerts: 'Alertas',
      settings: 'Configuración',
    };
    const tabLabels = {
      overview: 'Resumen',
      medications: 'Medicamentos',
      followup: 'Seguimiento',
      safety: 'Efectos y controles',
      prescriptions: 'Recetas',
      timeline: 'Historial',
    };
    const modalLabels = {
      patient: 'Nuevo paciente',
      medication: 'Agregar medicamento',
      dose: 'Cambiar dosis',
      assessment: 'Registrar evolución',
      vitals: 'Control físico',
      adverse: 'Efecto observado',
      lab: 'Laboratorio',
      prescription: 'Nueva receta',
      appointment: 'Nueva cita',
      clinicProfile: 'Perfil del consultorio',
      secretary: 'Crear secretaria',
      userPermissions: 'Permisos de usuario',
      userSwitcher: 'Cambiar de usuario',
    };
    const parts = [viewLabels[this.state.view] || 'NexaMind'];
    if (this.state.view === 'patient') parts.push(tabLabels[this.state.patientTab] || this.state.patientTab);
    if (this.state.modal?.type) parts.push(modalLabels[this.state.modal.type] || 'Formulario');
    return parts.join('  ›  ');
  };

  dismissTutorialIntro = () => {
    this.rememberTutorial('dismissed');
    this.setState({ tutorialIntro: false });
  };

  startTour = (mode = 'quick') => {
    clearTimeout(this.tutorialIntroTimer);
    this.setState({
      tutorialIntro: false,
      tourActive: true,
      tourMode: mode,
      tourIndex: 0,
      tourRect: null,
      tourReady: false,
      tourLayout: 'floating',
      tourDockSide: 'right',
      tourInModal: false,
      tourTargetMissing: false,
      tourCardPosition: null,
      tourCardDragging: false,
      tourCardFit: null,
      tourViewportFitted: false,
      tourPreviewRole: 'doctor',
      modal: null,
      appointmentDetails: null,
      mobileNav: false,
    }, () => this.applyTourStep(0, mode));
  };

  launchTourFromHelp = mode => {
    this.setState({ modal: null, modalError: '' }, () => this.startTour(mode));
  };

  buildTourModalPreview = step => {
    const patient = this.selectedPatient();
    if (!step?.modal) return null;
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const futureLocal = new Date(future.getTime() - future.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    if (step.modal === 'patient') {
      return {
        type: 'patient',
        tourPreview: true,
        draft: {
          ...patientFormDefaults(),
          name: 'Paciente de ejemplo', age: 36, sex: 'F', phone: '+503 7000 0000', email: 'paciente@ejemplo.com',
          hasInsurance: false, insuranceProvider: 'Seguro Médico Demo', insurancePlan: 'Plan Ejecutivo',
          insuranceMemberId: 'AF-10293', insurancePolicyNumber: 'POL-2026-018', insuranceCopay: 'US$20',
          insuranceAuthorizationRequired: true, insuranceNotes: 'Confirmar autorización antes de la consulta.',
          diagnosis: 'Trastorno depresivo mayor', diagnosisCode: 'F33.1', risk: 'low', status: 'stable',
          scaleCode: 'PHQ-9', initialScore: 18, nextVisit: futureLocal,
          notes: 'Datos ficticios usados únicamente para explicar el formulario.',
        },
      };
    }
    if (!patient) return null;
    if (step.modal === 'medication') {
      return { type: 'medication', patientId: patient.id, tourPreview: true, draft: {
        ...medicationFormDefaults(patient), name: 'Sertralina', class: 'ISRS', indication: 'Síntomas depresivos',
        doseValue: 50, doseUnit: 'mg', frequency: 'cada mañana', route: 'oral', isPrimary: true,
        notes: 'Ejemplo de registro inicial.',
      } };
    }
    if (step.modal === 'dose') {
      const draft = doseFormDefaults(patient, patient.medications?.find(item => item.status === 'active')?.id || null);
      return { type: 'dose', patientId: patient.id, tourPreview: true, draft: {
        ...draft, newDoseValue: Number(draft.newDoseValue || 100), reason: 'Respuesta parcial observada', notes: 'Ejemplo de ajuste documentado.',
      } };
    }
    if (step.modal === 'assessment') {
      return { type: 'assessment', patientId: patient.id, tourPreview: true, draft: {
        ...assessmentFormDefaults(patient), code: 'PHQ-9', score: 8, adherence: 94, functioningChange: 35,
        sleepCurrent: 7, status: 'responding', risk: 'low', note: 'Mejoría observada con buena tolerabilidad. Datos ficticios.',
      } };
    }
    if (step.modal === 'vitals') {
      return { type: 'vitals', patientId: patient.id, tourPreview: true, draft: {
        ...vitalsFormDefaults(patient), weight: 68.4, height: 165, systolic: 118, diastolic: 76, pulse: 72,
        sleepCurrent: 7, appetite: 'Sin cambios', notes: 'Control de ejemplo.',
      } };
    }
    if (step.modal === 'adverse') {
      return { type: 'adverse', patientId: patient.id, tourPreview: true, draft: {
        ...adverseFormDefaults(patient), medicationId: patient.medications?.[0]?.id || '', name: 'Somnolencia',
        severity: 'mild', status: 'active', relation: 'Apareció cuatro días después del ajuste; causalidad no confirmada.',
        actionTaken: 'Seguimiento y revisión del horario de administración.',
      } };
    }
    if (step.modal === 'lab') {
      return { type: 'lab', patientId: patient.id, tourPreview: true, draft: {
        ...labFormDefaults(patient), name: 'TSH', value: '2.1', unit: 'mUI/L', status: 'normal',
        reference: '0.4–4.0 mUI/L', notes: 'Resultado ficticio para el tutorial.',
      } };
    }
    if (step.modal === 'prescription') {
      const draft = prescriptionFormDefaults(patient, this.state.data.organization);
      draft.items = [{ ...draft.items[0], medication: 'Sertralina', strength: '50 mg', directions: 'Tomar una tableta cada mañana', quantity: '30 tabletas', duration: '30 días', notes: 'Tomar con alimentos si presenta náusea.' }];
      draft.generalInstructions = 'No suspender de forma abrupta. Acudir a control en la fecha indicada.';
      draft.observations = 'Documento de ejemplo para explicar la función.';
      return { type: 'prescription', patientId: patient.id, tourPreview: true, draft };
    }
    if (step.modal === 'appointment') {
      const draft = appointmentFormDefaults(this.state.data, future, null, patient.id);
      return { type: 'appointment', tourPreview: true, draft: { ...draft, duration: 45, type: 'Seguimiento', modality: 'Presencial', status: 'confirmed', notes: 'Revisar escala, adherencia, efectos y controles.' } };
    }
    if (step.modal === 'clinicProfile') {
      return { type: 'clinicProfile', tourPreview: true, draft: {
        ...clinicProfileDefaults(this.state.data),
        name: this.state.data.organization?.name || 'Clínica NexaMind', clinician: this.state.data.organization?.clinician || 'Dra. Adriana Salazar',
        specialty: 'Psiquiatría', professionalLicense: 'JVPM 00000', address: 'San Salvador', phone: '+503 2200 0000',
        email: 'contacto@clinica.com', website: 'www.clinica.com', prescriptionFooter: 'Cita previa y seguimiento según indicación médica.',
      } };
    }
    if (step.modal === 'secretary') {
      return { type: 'secretary', tourPreview: true, draft: {
        ...secretaryFormDefaults(), name: 'María Asistente', title: 'Secretaría clínica', email: 'secretaria@clinica.com', phone: '+503 7000 1111',
      } };
    }
    if (step.modal === 'userPermissions') {
      const secretary = this.state.data.users?.find(user => user.role === 'secretary') || this.state.data.users?.[0];
      return { type: 'userPermissions', userId: secretary?.id, tourPreview: true, draft: {
        name: secretary?.name || 'Secretaría', email: secretary?.email || '', phone: secretary?.phone || '',
        title: secretary?.title || 'Secretaría clínica', permissions: { ...(secretary?.permissions || secretaryFormDefaults().permissions) },
      } };
    }
    if (step.modal === 'userSwitcher') return { type: 'userSwitcher', tourPreview: true, draft: {} };
    return null;
  };

  nextTourChapter = () => {
    const steps = this.getTourSteps();
    const current = steps[this.state.tourIndex];
    if (!current) return;
    const nextIndex = steps.findIndex((item, index) => index > this.state.tourIndex && item.chapterKey !== current.chapterKey);
    if (nextIndex === -1) this.finishTour();
    else this.applyTourStep(nextIndex);
  };

  applyTourStep = (index, mode = this.state.tourMode) => {
    const steps = this.getTourSteps(mode);
    const safeIndex = clamp(index, 0, Math.max(steps.length - 1, 0));
    const step = steps[safeIndex];
    if (!step) return;
    const appointment = step.appointmentDetails
      ? this.state.data.appointments?.find(item => item.status !== 'cancelled') || this.state.data.appointments?.[0] || null
      : null;
    const interactiveStep = Boolean(step.waitFor);
    const previewModal = this.buildTourModalPreview(step);
    const keepExistingModal = step.modal && this.state.modal?.type === step.modal;
    const nextState = {
      tourIndex: safeIndex,
      tourRect: null,
      tourReady: false,
      tourLayout: 'floating',
      tourDockSide: 'right',
      tourInModal: false,
      tourTargetMissing: false,
      tourCardFit: null,
      tourViewportFitted: false,
      tourPreviewRole: step.previewRole || 'doctor',
      appointmentDetails: appointment,
      modal: interactiveStep ? (step.contextModal ? this.buildTourModalPreview({ modal: step.contextModal }) : null) : (keepExistingModal ? this.state.modal : previewModal),
      mobileNav: window.innerWidth <= 880 && (step.id === 'main-navigation' || step.selector === '[data-tour="main-navigation"]'),
    };
    if (interactiveStep) {
      if (step.contextView) nextState.view = step.contextView;
      if (step.contextPatientTab) nextState.patientTab = step.contextPatientTab;
      if (step.contextCalendarView) nextState.calendarView = step.contextCalendarView;
    } else {
      if (step.view) nextState.view = step.view;
      if (step.patientTab) nextState.patientTab = step.patientTab;
      if (step.calendarView) nextState.calendarView = step.calendarView;
      if (step.chartMode) nextState.chartMode = step.chartMode;
    }
    if (step.view === 'patients') {
      nextState.search = '';
      nextState.patientFilter = 'all';
    }
    if (step.view === 'patient') {
      const selectedStillExists = this.state.data.patients.some(patient => patient.id === this.state.selectedPatientId);
      if (!selectedStillExists) nextState.selectedPatientId = this.state.data.patients[0]?.id || null;
    }
    if (step.view === 'agenda') {
      nextState.calendarDate = new Date();
      if (!step.calendarView) nextState.calendarView = 'month';
    }
    if (step.patientTab === 'timeline') nextState.timelineFilter = 'all';
    this.setState(nextState, () => {
      window.requestAnimationFrame(() => this.queueTourTarget(true));
    });
  };

  nextTourStep = () => {
    const steps = this.getTourSteps();
    const current = steps[this.state.tourIndex];
    if (current?.waitFor && !this.isTourStepSatisfied(current)) {
      this.notify('Primero complete la acción indicada en el tutorial.', 'warning');
      return;
    }
    if (this.state.tourIndex >= steps.length - 1) {
      this.finishTour();
      return;
    }
    this.applyTourStep(this.state.tourIndex + 1);
  };

  previousTourStep = () => {
    if (this.state.tourIndex <= 0) return;
    this.applyTourStep(this.state.tourIndex - 1);
  };

  finishTour = () => {
    this.rememberTutorial('completed');
    this.setState({
      tourActive: false,
      tourRect: null,
      tourReady: false,
      tourLayout: 'floating',
      tourDockSide: 'right',
      tourInModal: false,
      tourTargetMissing: false,
      tourCardPosition: null,
      tourCardDragging: false,
      tourCardFit: null,
      tourViewportFitted: false,
      view: 'dashboard',
      patientTab: 'overview',
      mobileNav: false,
      tourPreviewRole: null,
      modal: null,
      appointmentDetails: null,
    }, () => {
      window.scrollTo({ top: 0, behavior: 'auto' });
      this.notify('Tutorial completado. Puede repetirlo desde Ayuda.');
    });
  };

  exitTour = () => {
    this.rememberTutorial('dismissed');
    this.setState({ tourActive: false, tourRect: null, tourReady: false, tourLayout: 'floating', tourDockSide: 'right', tourInModal: false, tourTargetMissing: false, tourCardPosition: null, tourCardDragging: false, tourCardFit: null, tourViewportFitted: false, mobileNav: false, tourPreviewRole: null, modal: null, appointmentDetails: null }, () => this.notify('Tutorial cerrado. Puede abrirlo de nuevo desde Ayuda.', 'neutral'));
  };

  startTourCardDrag = event => {
    if (!this.state.tourActive || event.button !== 0) return;
    if (event.target.closest('button, a, input, select, textarea')) return;
    const card = event.currentTarget.closest('[data-tour-card="true"]');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    this.tourDragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', this.handleTourCardDrag, { passive: false });
    window.addEventListener('pointerup', this.endTourCardDrag);
    window.addEventListener('pointercancel', this.endTourCardDrag);
    document.body.classList.add('tour-panel-dragging');
    this.setState({
      tourCardDragging: true,
      tourCardPosition: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      tourCardFit: null,
      tourViewportFitted: true,
    });
    event.preventDefault();
  };

  handleTourCardDrag = event => {
    const drag = this.tourDragState;
    if (!drag || (drag.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
    event.preventDefault();
    const margin = 10;
    const maxLeft = Math.max(margin, window.innerWidth - drag.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - Math.min(drag.height, window.innerHeight - margin * 2) - margin);
    const left = clamp(event.clientX - drag.offsetX, margin, maxLeft);
    const top = clamp(event.clientY - drag.offsetY, margin, maxTop);
    cancelAnimationFrame(this.tourDragFrame);
    this.tourDragFrame = requestAnimationFrame(() => {
      this.setState({ tourCardPosition: { left, top, width: drag.width, height: drag.height }, tourCardFit: null, tourViewportFitted: true });
    });
  };

  endTourCardDrag = () => {
    if (!this.tourDragState && !this.state?.tourCardDragging) return;
    this.tourDragState = null;
    cancelAnimationFrame(this.tourDragFrame);
    window.removeEventListener('pointermove', this.handleTourCardDrag);
    window.removeEventListener('pointerup', this.endTourCardDrag);
    window.removeEventListener('pointercancel', this.endTourCardDrag);
    document.body.classList.remove('tour-panel-dragging');
    if (this.state?.tourCardDragging) this.setState({ tourCardDragging: false });
  };

  resetTourCardPosition = () => {
    this.endTourCardDrag();
    this.setState({ tourCardPosition: null, tourCardDragging: false, tourCardFit: null, tourViewportFitted: false }, () => this.queueTourTarget(true));
  };

  clampTourCardPosition = position => {
    if (!position) return null;
    const margin = 10;
    const width = Math.min(position.width || 420, Math.max(280, window.innerWidth - margin * 2));
    const height = Math.min(position.height || 620, Math.max(260, window.innerHeight - margin * 2));
    return {
      left: clamp(position.left, margin, Math.max(margin, window.innerWidth - width - margin)),
      top: clamp(position.top, margin, Math.max(margin, window.innerHeight - height - margin)),
      width,
      height,
    };
  };

  retryTourTarget = (scroll, attempt) => {
    clearTimeout(this.tourTargetRetryTimer);
    clearTimeout(this.tourCardFitTimer);
    const delay = Math.min(260, 60 + attempt * 18);
    this.tourTargetRetryTimer = setTimeout(() => this.syncTourTarget(scroll, attempt + 1), delay);
  };

  disconnectTourObservers = () => {
    this.tourResizeObserver?.disconnect();
    this.tourMutationObserver?.disconnect();
    this.tourResizeObserver = null;
    this.tourMutationObserver = null;
    if (this.tourObservedTarget) this.tourObservedTarget.removeAttribute('data-tour-active-target');
    this.tourObservedTarget = null;
  };

  observeTourTarget = target => {
    if (!target || this.tourObservedTarget === target) return;
    this.disconnectTourObservers();
    this.tourObservedTarget = target;
    target.setAttribute('data-tour-active-target', 'true');
    if (typeof ResizeObserver !== 'undefined') {
      this.tourResizeObserver = new ResizeObserver(() => this.queueTourTarget(false));
      this.tourResizeObserver.observe(target);
      const modal = target.closest('.modal');
      if (modal) this.tourResizeObserver.observe(modal);
    }
    if (typeof MutationObserver !== 'undefined') {
      const root = target.closest('.modal-body') || target.parentElement;
      if (root) {
        this.tourMutationObserver = new MutationObserver(() => this.queueTourTarget(false));
        this.tourMutationObserver.observe(root, { childList: true, subtree: true, attributes: true });
      }
    }
  };

  getTourTarget = step => {
    if (!step?.selector) return null;
    const fallbackMap = {
      'patient-photo': ['.patient-hero .patient-photo-control', '.patient-hero .avatar-xl', '.patient-hero .avatar'],
      'patient-badges': ['.patient-hero .patient-hero-main', '.patient-hero .hero-badges'],
      'patient-next-visit': ['.patient-hero .patient-hero-actions'],
      'patient-form-save': ['.modal .form-actions', '.modal .modal-sticky-actions'],
      'patient-form-insurance-toggle': ['.modal .insurance-toggle-card'],
      'patient-form-insurance-details': ['.modal .insurance-form-panel'],
      'medication-form-identity': ['.modal [data-tour="medication-form-identity"]', '.modal form.clinical-form > div:first-of-type'],
      'medication-form-dose': ['.modal [data-tour="medication-form-dose"]'],
      'medication-form-start': ['.modal [data-tour="medication-form-start"]'],
      'settings-button': ['button[aria-label="Configuración"]'],
    };
    const selectors = [step.selector, ...(step.fallbackSelectors || []), ...(fallbackMap[step.id] || [])]
      .filter(Boolean);
    const activeModal = document.querySelector('.modal-backdrop .modal');
    const isVisible = element => {
      if (!element || !element.isConnected) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
    };
    const candidates = [];
    selectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(element => {
          const focused = step.focusSelector ? element.querySelector(step.focusSelector) || element : element;
          if (!candidates.includes(focused)) candidates.push(focused);
        });
      } catch (_) { /* Ignore malformed optional fallback selectors. */ }
    });
    const visible = candidates.filter(isVisible);

    if (step.modal && activeModal) {
      const inModal = visible.find(element => activeModal.contains(element));
      if (inModal) return inModal;
      const modalFallback = activeModal.querySelector('[data-tour="' + step.id + '"]')
        || activeModal.querySelector('form.clinical-form')
        || activeModal.querySelector('.modal-body');
      return isVisible(modalFallback) ? modalFallback : null;
    }

    if (activeModal) {
      const inModal = visible.find(element => activeModal.contains(element));
      if (inModal) return inModal;
    }
    return visible[0] || null;
  };

  getTourScrollContainer = target => {
    let current = target?.parentElement;
    while (current && current !== document.body) {
      const style = window.getComputedStyle(current);
      const overflowY = style.overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight + 2) return current;
      current = current.parentElement;
    }
    return null;
  };

  getVisibleTourRect = target => {
    const bounds = target.getBoundingClientRect();
    let clipTop = 8;
    let clipLeft = 8;
    let clipRight = window.innerWidth - 8;
    let clipBottom = window.innerHeight - 8;
    const scrollContainer = this.getTourScrollContainer(target);
    if (scrollContainer) {
      const scrollBounds = scrollContainer.getBoundingClientRect();
      clipTop = Math.max(clipTop, scrollBounds.top + 4);
      clipLeft = Math.max(clipLeft, scrollBounds.left + 4);
      clipRight = Math.min(clipRight, scrollBounds.right - 4);
      clipBottom = Math.min(clipBottom, scrollBounds.bottom - 4);
    }
    const padding = 9;
    const top = Math.max(clipTop, bounds.top - padding);
    const left = Math.max(clipLeft, bounds.left - padding);
    const right = Math.min(clipRight, bounds.right + padding);
    const bottom = Math.min(clipBottom, bounds.bottom + padding);
    if (right <= left || bottom <= top) return null;
    return {
      top,
      left,
      width: Math.max(24, right - left),
      height: Math.max(24, bottom - top),
    };
  };

  scrollTourTargetIntoView = target => {
    const container = this.getTourScrollContainer(target);
    if (!container) {
      target.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
      return;
    }
    const targetBounds = target.getBoundingClientRect();
    const containerBounds = container.getBoundingClientRect();
    const delta = targetBounds.top - containerBounds.top - (containerBounds.height - Math.min(targetBounds.height, containerBounds.height)) / 2;
    container.scrollTop += delta;
  };

  queueTourTarget = (scroll = false, attempt = 0) => {
    clearTimeout(this.tourTargetTimer);
    clearTimeout(this.tourTargetRetryTimer);
    clearTimeout(this.tourCardFitTimer);
    this.tourTargetTimer = setTimeout(() => this.syncTourTarget(scroll, attempt), 60);
  };

  syncTourTarget = (scroll = false, attempt = 0) => {
    if (!this.state.tourActive) return;
    const step = this.currentTourStep();
    if (!step?.selector) {
      this.disconnectTourObservers();
      this.setState({ tourRect: null, tourReady: true, tourLayout: 'center', tourDockSide: null, tourInModal: false, tourTargetMissing: false, tourCardFit: null, tourViewportFitted: false }, () => this.queueTourCardFit());
      return;
    }
    const target = this.getTourTarget(step);
    const maxAttempts = 24;
    if (!target || !target.isConnected) {
      this.disconnectTourObservers();
      if (attempt < maxAttempts) {
        if (this.state.tourTargetMissing || this.state.tourReady) this.setState({ tourReady: false, tourTargetMissing: false });
        this.retryTourTarget(scroll, attempt);
        return;
      }
      this.setState({ tourRect: null, tourReady: true, tourLayout: 'center', tourDockSide: null, tourInModal: false, tourTargetMissing: true, tourCardFit: null, tourViewportFitted: false }, () => this.queueTourCardFit());
      return;
    }
    this.observeTourTarget(target);
    const measure = () => {
      if (!this.state.tourActive) return;
      const currentStep = this.currentTourStep();
      const currentTarget = this.getTourTarget(currentStep);
      if (currentStep?.id !== step.id || currentTarget !== target) {
        if (attempt < maxAttempts) this.retryTourTarget(false, attempt);
        return;
      }
      const rect = this.getVisibleTourRect(target);
      if (!rect) {
        if (attempt < maxAttempts) {
          this.scrollTourTargetIntoView(target);
          this.retryTourTarget(true, attempt);
          return;
        }
        this.setState({ tourRect: null, tourReady: true, tourTargetMissing: true, tourCardFit: null, tourViewportFitted: false }, () => this.queueTourCardFit());
        return;
      }
      const insideModal = Boolean(target.closest('.modal'));
      const presentation = this.getTourPresentation(step, rect, insideModal);
      this.setState({
        tourRect: rect,
        tourReady: true,
        tourLayout: presentation.layout,
        tourDockSide: presentation.side,
        tourInModal: insideModal,
        tourTargetMissing: false,
        tourCardFit: null,
        tourViewportFitted: false,
      }, () => this.queueTourCardFit());
    };
    if (scroll) this.scrollTourTargetIntoView(target);
    clearTimeout(this.tourTargetTimer);
    this.tourTargetTimer = setTimeout(() => {
      requestAnimationFrame(() => requestAnimationFrame(measure));
    }, scroll ? 260 : 50);
  };

  handleTourViewportChange = () => {
    if (!this.state.tourActive) return;
    cancelAnimationFrame(this.tourViewportFrame);
    this.tourViewportFrame = requestAnimationFrame(() => {
      if (this.state.tourCardPosition) {
        const clamped = this.clampTourCardPosition(this.state.tourCardPosition);
        if (clamped && (clamped.left !== this.state.tourCardPosition.left || clamped.top !== this.state.tourCardPosition.top || clamped.width !== this.state.tourCardPosition.width)) {
          this.setState({ tourCardPosition: clamped });
        }
      }
      this.setState({ tourCardFit: null, tourViewportFitted: false }, () => this.syncTourTarget(false));
    });
  };

  queueTourCardFit = (attempt = 0) => {
    clearTimeout(this.tourCardFitTimer);
    this.tourCardFitTimer = setTimeout(() => {
      requestAnimationFrame(() => this.fitTourCardToViewport(attempt));
    }, attempt ? 35 : 0);
  };

  fitTourCardToViewport = (attempt = 0) => {
    if (!this.state.tourActive) return;
    const card = document.querySelector('[data-tour-card="true"]');
    if (!card) {
      if (attempt < 8) this.queueTourCardFit(attempt + 1);
      return;
    }
    const viewportWidth = Math.max(320, window.visualViewport?.width || window.innerWidth);
    const viewportHeight = Math.max(320, window.visualViewport?.height || window.innerHeight);
    const margin = viewportWidth <= 720 ? 10 : 12;
    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      if (attempt < 8) this.queueTourCardFit(attempt + 1);
      return;
    }

    const width = Math.min(rect.width, viewportWidth - margin * 2);
    let left = rect.left;
    let top = rect.top;
    if (rect.right > viewportWidth - margin) left -= rect.right - (viewportWidth - margin);
    if (left < margin) left = margin;
    if (rect.bottom > viewportHeight - margin) top -= rect.bottom - (viewportHeight - margin);
    if (top < margin) top = margin;

    const maxHeight = Math.max(220, viewportHeight - top - margin);
    const maxWidth = Math.max(260, viewportWidth - left - margin);
    const fit = {
      left: `${Math.round(left * 10) / 10}px`,
      top: `${Math.round(top * 10) / 10}px`,
      right: 'auto',
      bottom: 'auto',
      width: `${Math.round(width * 10) / 10}px`,
      maxWidth: `${Math.round(maxWidth * 10) / 10}px`,
      maxHeight: `${Math.round(maxHeight * 10) / 10}px`,
      transform: 'none',
      boxSizing: 'border-box',
    };

    const current = this.state.tourCardFit || {};
    const changed = Object.keys(fit).some(key => current[key] !== fit[key]);
    if (changed || !this.state.tourViewportFitted) {
      this.setState({ tourCardFit: fit, tourViewportFitted: true }, () => {
        if (attempt < 2) this.queueTourCardFit(attempt + 1);
      });
    }
  };

  getTourEstimatedHeight = step => Math.min(
    Math.max(420, window.innerHeight - 32),
    620
      + (((step?.description || '').length > 160) ? 36 : 0)
      + (step?.fields?.length || 0) * 48
      + (step?.items?.length || 0) * 30
      + (step?.tip ? 64 : 0),
  );

  rectanglesOverlap = (a, b, padding = 12) => !(
    a.right + padding < b.left
    || a.left - padding > b.right
    || a.bottom + padding < b.top
    || a.top - padding > b.bottom
  );

  getTourPresentation = (step, rect, insideModal = this.state.tourInModal) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    if (viewportWidth <= 720) {
      return {
        style: {
          left: '10px',
          right: '10px',
          bottom: '10px',
          top: 'auto',
          width: 'calc(100vw - 20px)',
          maxWidth: 'calc(100vw - 20px)',
          maxHeight: 'calc(100dvh - 20px)',
          boxSizing: 'border-box',
        },
        className: 'tour-card-mobile',
        layout: 'mobile',
        side: 'bottom',
      };
    }
    const manual = this.clampTourCardPosition(this.state.tourCardPosition);
    if (manual) {
      return {
        style: { left: `${manual.left}px`, top: `${manual.top}px`, width: `${manual.width}px`, right: 'auto', bottom: 'auto', maxHeight: `${manual.height}px`, boxSizing: 'border-box' },
        className: `tour-card-manual ${this.state.tourCardDragging ? 'is-dragging' : ''}`,
        layout: 'manual',
        side: null,
      };
    }
    if (!rect) {
      return {
        style: {
          left: '50%',
          top: '50%',
          width: 'min(520px, calc(100vw - 32px))',
          maxHeight: 'calc(100dvh - 32px)',
          boxSizing: 'border-box',
        },
        className: 'tour-card-centered',
        layout: 'center',
        side: null,
      };
    }

    const targetRect = { top: rect.top, left: rect.left, right: rect.left + rect.width, bottom: rect.top + rect.height };
    if (insideModal && viewportWidth >= 1060) {
      const activeModal = document.querySelector('.modal-backdrop .modal');
      const modalRect = activeModal?.getBoundingClientRect();
      if (modalRect) {
        const gap = 18;
        const leftSpace = Math.max(0, modalRect.left - gap - 12);
        const rightSpace = Math.max(0, viewportWidth - modalRect.right - gap - 12);
        const side = rightSpace >= leftSpace ? 'right' : 'left';
        const available = side === 'right' ? rightSpace : leftSpace;
        if (available >= 300) {
          const width = Math.min(380, available);
          const left = side === 'right'
            ? clamp(modalRect.right + gap, 12, viewportWidth - width - 12)
            : clamp(modalRect.left - gap - width, 12, viewportWidth - width - 12);
          return {
            style: { left: `${left}px`, right: 'auto', top: '12px', width: `${width}px`, maxHeight: `${viewportHeight - 24}px`, boxSizing: 'border-box' },
            className: `tour-card-docked tour-card-docked-${side}`,
            layout: 'docked',
            side,
          };
        }
      }
    }
    const cardWidth = Math.min(440, viewportWidth - 32);
    const estimatedHeight = Math.min(this.getTourEstimatedHeight(step), viewportHeight - 32);
    const gap = 22;
    const preferred = step.placement || 'auto';
    const candidates = [];
    const pushCandidate = (side, left, top) => {
      const safeLeft = clamp(left, 16, viewportWidth - cardWidth - 16);
      const safeTop = clamp(top, 16, Math.max(16, viewportHeight - estimatedHeight - 16));
      const box = { top: safeTop, left: safeLeft, right: safeLeft + cardWidth, bottom: safeTop + estimatedHeight };
      const overlap = this.rectanglesOverlap(box, targetRect, 16);
      const clipped = Math.abs(left - safeLeft) + Math.abs(top - safeTop);
      const preferredBonus = preferred === side ? -120 : 0;
      const distance = side === 'left' || side === 'right'
        ? Math.abs((safeTop + estimatedHeight / 2) - (rect.top + rect.height / 2))
        : Math.abs((safeLeft + cardWidth / 2) - (rect.left + rect.width / 2));
      candidates.push({
        side,
        style: {
          left: `${safeLeft}px`,
          top: `${safeTop}px`,
          width: `${cardWidth}px`,
          maxHeight: `${Math.max(240, viewportHeight - safeTop - 16)}px`,
          boxSizing: 'border-box',
        },
        className: `tour-card-floating tour-card-${side}`,
        layout: 'floating',
        score: (overlap ? 10000 : 0) + clipped * 3 + distance / 10 + preferredBonus,
      });
    };

    pushCandidate('right', rect.left + rect.width + gap, rect.top + rect.height / 2 - estimatedHeight / 2);
    pushCandidate('left', rect.left - cardWidth - gap, rect.top + rect.height / 2 - estimatedHeight / 2);
    pushCandidate('bottom', rect.left + rect.width / 2 - cardWidth / 2, rect.top + rect.height + gap);
    pushCandidate('top', rect.left + rect.width / 2 - cardWidth / 2, rect.top - estimatedHeight - gap);
    candidates.sort((a, b) => a.score - b.score);
    const best = candidates[0];
    if (best && best.score < 10000) return best;

    const rightSpace = viewportWidth - targetRect.right;
    const leftSpace = targetRect.left;
    const side = rightSpace >= leftSpace ? 'right' : 'left';
    return {
      style: side === 'right'
        ? { right: '16px', top: '16px', width: `${Math.min(420, viewportWidth - 32)}px`, maxHeight: `${viewportHeight - 32}px`, boxSizing: 'border-box' }
        : { left: '16px', top: '16px', width: `${Math.min(420, viewportWidth - 32)}px`, maxHeight: `${viewportHeight - 32}px`, boxSizing: 'border-box' },
      className: `tour-card-docked tour-card-docked-${side}`,
      layout: 'docked',
      side,
    };
  };

  tourCardStyle = (step, rect) => this.getTourPresentation(step, rect).style;

  schedulePersist = () => {
    clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(async () => {
      if (productionMode) {
        if (!this.state.remoteReady || !this.state.remoteOrganizationId) return;
        this.setState({ remoteSaveStatus: 'saving' });
        try {
          await saveProductionState(this.state.remoteOrganizationId, this.state.data);
          this.setState({ remoteSaveStatus: 'saved' });
        } catch (error) {
          console.error('Supabase save error', error);
          this.setState({ remoteSaveStatus: 'error' });
          this.notify('No se pudo guardar en Supabase. Revise la conexión.', 'danger');
        }
        return;
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state.data)); } catch (_) { /* Browser storage can be unavailable. */ }
    }, productionMode ? 650 : 180);
  };

  notify = (message, tone = 'success') => {
    this.setState({ toast: message, toastTone: tone });
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.setState({ toast: null }), 3200);
  };

  setView = view => {
    this.setState({ view, mobileNav: false, appointmentDetails: null });
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  };

  selectedPatient = () => this.state.data.patients.find(item => item.id === this.state.selectedPatientId) || this.state.data.patients[0] || null;

  activeUser = () => {
    if (this.state.tourActive && this.state.tourPreviewRole) {
      return this.state.data.users?.find(user => user.role === this.state.tourPreviewRole && user.active !== false)
        || getActiveUser(this.state.data);
    }
    return getActiveUser(this.state.data);
  };

  can = permission => {
    if (!this.state.tourActive) return hasPermission(this.state.data, permission);
    const previewUser = this.activeUser();
    if (previewUser?.role === 'doctor') return true;
    return Boolean(previewUser?.permissions?.[permission]);
  };

  permissionDenied = () => {
    this.notify('Su usuario no tiene permiso para realizar esta acción. El médico puede cambiarlo en Configuración.', 'danger');
    return false;
  };

  openPatient = patientId => {
    if (!this.can('patientsView')) return this.permissionDenied();
    this.setState({ selectedPatientId: patientId, view: 'patient', patientTab: 'overview', chartMode: 'scales', timelineFilter: 'all', mobileNav: false, appointmentDetails: null });
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  };

  closeModal = () => this.setState({ modal: null, modalError: '' });

  updateDraft = (key, value) => {
    this.setState(prev => ({ modal: prev.modal ? { ...prev.modal, draft: { ...prev.modal.draft, [key]: value } } : null, modalError: '' }));
  };

  updateDraftPermission = (key, value) => {
    this.setState(prev => ({
      modal: prev.modal ? {
        ...prev.modal,
        draft: {
          ...prev.modal.draft,
          permissions: { ...(prev.modal.draft.permissions || {}), [key]: value },
        },
      } : null,
      modalError: '',
    }));
  };

  openNewPatient = () => {
    if (!this.can('patientsCreate')) return this.permissionDenied();
    const draft = patientFormDefaults();
    if (!this.can('clinicalView')) {
      draft.diagnosis = 'Pendiente de valoración médica';
      draft.diagnosisCode = 'Pendiente';
      draft.initialScore = '';
    }
    this.setState({ modal: { type: 'patient', draft }, modalError: '' });
  };

  openEditPatient = patient => {
    if (!this.can('patientsEdit')) return this.permissionDenied();
    this.setState({ modal: { type: 'patientEdit', patientId: patient.id, draft: patientEditFormDefaults(patient) }, modalError: '' });
  };

  openMedication = patient => {
    if (!this.can('medicationsManage')) return this.permissionDenied();
    this.setState({ modal: { type: 'medication', patientId: patient.id, draft: medicationFormDefaults(patient) }, modalError: '' });
  };

  openDose = (patient, medicationId = null) => {
    if (!this.can('medicationsManage')) return this.permissionDenied();
    this.setState({ modal: { type: 'dose', patientId: patient.id, draft: doseFormDefaults(patient, medicationId) }, modalError: '' });
  };

  openMedicationStatus = (patient, medication, status) => {
    if (!this.can('medicationsManage')) return this.permissionDenied();
    this.setState({
      modal: {
        type: 'medicationStatus',
        patientId: patient.id,
        draft: { medicationId: medication.id, medicationName: medication.name, currentStatus: medication.status, status, reason: '' },
      },
      modalError: '',
    });
  };

  openAssessment = patient => {
    if (!this.can('clinicalEdit')) return this.permissionDenied();
    this.setState({ modal: { type: 'assessment', patientId: patient.id, draft: assessmentFormDefaults(patient) }, modalError: '' });
  };

  openVitals = patient => {
    if (!this.can('clinicalEdit')) return this.permissionDenied();
    this.setState({ modal: { type: 'vitals', patientId: patient.id, draft: vitalsFormDefaults(patient) }, modalError: '' });
  };

  openAdverse = patient => {
    if (!this.can('clinicalEdit')) return this.permissionDenied();
    this.setState({ modal: { type: 'adverse', patientId: patient.id, draft: adverseFormDefaults(patient) }, modalError: '' });
  };

  openLab = patient => {
    if (!this.can('clinicalEdit')) return this.permissionDenied();
    this.setState({ modal: { type: 'lab', patientId: patient.id, draft: labFormDefaults(patient) }, modalError: '' });
  };

  openReport = patient => {
    if (!this.can('clinicalView')) return this.permissionDenied();
    this.setState({ modal: { type: 'report', patientId: patient.id, draft: {} }, modalError: '' });
  };

  openPrescription = patient => {
    if (!this.can('prescriptionsCreate')) return this.permissionDenied();
    this.setState({ modal: { type: 'prescription', patientId: patient.id, draft: prescriptionFormDefaults(patient, this.state.data.organization) }, modalError: '' });
  };

  openClinicProfile = () => {
    if (!this.can('settingsManage')) return this.permissionDenied();
    this.setState({ modal: { type: 'clinicProfile', draft: clinicProfileDefaults(this.state.data) }, modalError: '' });
  };

  openBillingSettings = () => {
    if (this.activeUser()?.role !== 'owner') return this.permissionDenied();
    const billing = this.state.data.billing || {};
    this.setState({ modal: { type: 'billingSettings', draft: {
      planName: billing.planName || 'Plan Profesional Linkare',
      planDescription: billing.planDescription || 'Licencia mensual de la plataforma Linkare para gestión clínica.',
      subscriptionPrice: Number(billing.subscriptionPrice) || 40,
      billingCycle: billing.billingCycle || 'mensual',
      currency: billing.currency || 'USD',
      payerName: billing.payerName || this.state.data.organization?.clinician || '',
      payerEmail: billing.payerEmail || this.state.data.organization?.email || '',
      wompiEnabled: Boolean(billing.wompiEnabled),
      manualCheckoutUrl: billing.manualCheckoutUrl || '',
      note: billing.note || '',
    } }, modalError: '' });
  };

  saveBillingSettingsForm = async event => {
    event.preventDefault();
    if (this.activeUser()?.role !== 'owner') return this.permissionDenied();
    const draft = this.state.modal?.draft || {};
    const price = Number(draft.subscriptionPrice);
    if (!Number.isFinite(price) || price < 0.01) return this.setState({ modalError: 'Ingrese un precio mayor o igual a US$0.01.' });
    const billing = {
      planName: String(draft.planName || '').trim() || 'Plan Profesional Linkare',
      planDescription: String(draft.planDescription || '').trim() || 'Licencia de la plataforma Linkare.',
      subscriptionPrice: price,
      billingCycle: String(draft.billingCycle || 'mensual').trim(),
      currency: String(draft.currency || 'USD').trim().toUpperCase() || 'USD',
      payerName: String(draft.payerName || '').trim(),
      payerEmail: String(draft.payerEmail || '').trim(),
      wompiEnabled: Boolean(draft.wompiEnabled),
      manualCheckoutUrl: String(draft.manualCheckoutUrl || '').trim(),
      note: String(draft.note || '').trim(),
      active: true,
    };
    try {
      if (productionMode && this.state.remoteOrganizationId) {
        await savePlatformBillingSettings(this.state.remoteOrganizationId, billing);
      }
      const data = { ...this.state.data, billing };
      this.setState({ data, modal: null, modalError: '' }, () => this.notify('Precio y plan de Linkare actualizados.'));
    } catch (error) {
      this.setState({ modalError: error instanceof Error ? error.message : 'No se pudo guardar el precio en Supabase.' });
    }
  };

  openPaymentLink = url => {
    if (!url) return this.notify('Primero genere o configure un enlace de Wompi.', 'danger');
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  loadSubscriptionInvoices = async () => {
    if (!productionMode || !this.state.remoteOrganizationId || !supabaseConfigured) return;
    try {
      const payments = await fetchSubscriptionInvoices(this.state.remoteOrganizationId);
      this.setState(prev => ({ data: { ...prev.data, payments } }));
    } catch (error) {
      console.error('Invoice refresh error', error);
      this.notify('No se pudo actualizar el historial de facturación.', 'danger');
    }
  };

  loadWompiStatus = async () => {
    if (!supabaseConfigured) {
      this.setState({ wompiStatus: { state: 'not-configured', app: null, error: 'Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.' } });
      return;
    }
    this.setState({ wompiStatus: { state: 'loading', app: null, error: '' } });
    try {
      const app = await fetchWompiAppInfo();
      this.setState({ wompiStatus: { state: 'ready', app, error: '' } }, () => this.loadSubscriptionInvoices());
    } catch (error) {
      this.setState({ wompiStatus: { state: 'error', app: null, error: error instanceof Error ? error.message : 'No se pudo verificar Wompi.' } });
    }
  };

  openWompiPaymentRequest = () => {
    if (this.activeUser()?.role !== 'owner') return this.permissionDenied();
    const billing = this.state.data.billing || {};
    const period = new Date().toISOString().slice(0, 7);
    this.setState({
      modal: {
        type: 'paymentRequest',
        draft: {
          planName: billing.planName || 'Plan Profesional Linkare',
          description: `${billing.planName || 'Plan Profesional Linkare'} · ${period}`,
          amount: Number(billing.subscriptionPrice) || 40,
          payerName: billing.payerName || this.state.data.organization?.clinician || '',
          customerEmail: billing.payerEmail || this.state.data.organization?.email || '',
          billingPeriod: period,
        },
      },
      modalError: '',
    });
  };

  submitWompiPaymentRequest = async event => {
    event.preventDefault();
    if (this.state.wompiBusy) return;
    if (this.activeUser()?.role !== 'owner') return this.permissionDenied();
    const draft = this.state.modal?.draft || {};
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount < 0.01) return this.setState({ modalError: 'Ingrese un monto válido.' });
    if (!String(draft.description || '').trim()) return this.setState({ modalError: 'Escriba el concepto del cobro.' });
    if (!String(draft.customerEmail || '').trim()) return this.setState({ modalError: 'Escriba el correo del psiquiatra que pagará.' });

    this.setState({ wompiBusy: true, modalError: '' });
    try {
      const result = await createWompiPaymentLink({
        organizationId: this.state.remoteOrganizationId || null,
        description: String(draft.description).trim(),
        amount,
        customerEmail: String(draft.customerEmail || '').trim(),
        payerName: String(draft.payerName || '').trim(),
        billingPeriod: String(draft.billingPeriod || '').trim(),
        planName: String(draft.planName || '').trim(),
        purpose: 'linkare_subscription',
      });
      const serverAmount = Number(result.payment?.amount) || amount;
      const payment = {
        id: `subscription_${Date.now()}`,
        description: String(draft.description).trim(),
        amount: serverAmount,
        method: 'wompi',
        status: 'pending',
        payerName: String(draft.payerName || '').trim(),
        payerEmail: String(draft.customerEmail || '').trim(),
        billingPeriod: String(draft.billingPeriod || '').trim(),
        externalReference: result.reference,
        paymentUrl: result.payment?.url || '',
        qrUrl: result.payment?.qrUrl || '',
        isTest: result.payment?.productive === false,
        createdAt: new Date().toISOString(),
      };
      this.setState(prev => ({
        data: { ...prev.data, payments: [payment, ...(prev.data.payments || [])] },
        modal: null,
        modalError: '',
        wompiBusy: false,
      }), () => {
        this.notify(result.payment?.productive === false ? 'Enlace de prueba creado para el psiquiatra.' : 'Enlace de pago creado para el psiquiatra.');
        if (result.payment?.url) window.open(result.payment.url, '_blank', 'noopener,noreferrer');
      });
    } catch (error) {
      this.setState({ wompiBusy: false, modalError: error instanceof Error ? error.message : 'No se pudo crear el enlace.' });
    }
  };

  copyPaymentLink = async url => {
    if (!url) return this.notify('Primero genere un enlace de Wompi.', 'danger');
    try { await navigator.clipboard.writeText(url); this.notify('Enlace de pago copiado.'); }
    catch (_) { this.notify('No se pudo copiar el enlace.', 'danger'); }
  };

  openSecretary = () => {
    if (!this.can('usersManage')) return this.permissionDenied();
    this.setState({ modal: { type: 'secretary', draft: secretaryFormDefaults() }, modalError: '' });
  };

  openUserPermissions = user => {
    if (!this.can('usersManage')) return this.permissionDenied();
    this.setState({ modal: { type: 'userPermissions', userId: user.id, draft: { name: user.name, email: user.email, phone: user.phone || '', title: user.title || '', password: '', confirmPassword: '', permissions: { ...(user.permissions || {}) } } }, modalError: '' });
  };

  openUserSwitcher = () => this.setState({ modal: { type: 'userSwitcher', draft: {} }, modalError: '' });

  openHelp = () => this.setState({ modal: { type: 'help', draft: {} }, modalError: '' });

  openNewAppointment = (date = new Date(), patientId = null) => {
    if (!this.can('appointmentsManage')) return this.permissionDenied();
    this.setState({ modal: { type: 'appointment', draft: appointmentFormDefaults(this.state.data, date, null, patientId) }, modalError: '' });
  };

  openEditAppointment = appointment => {
    if (!this.can('appointmentsManage')) return this.permissionDenied();
    this.setState({ appointmentDetails: null, modal: { type: 'appointment', draft: appointmentFormDefaults(this.state.data, new Date(appointment.start), appointment) }, modalError: '' });
  };

  handleDraftImage = async (event, key, options = {}) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const value = await optimizeImageFile(file, options);
      this.updateDraft(key, value);
      this.notify('Imagen preparada y optimizada.');
    } catch (error) {
      this.handleFormError(error);
    }
  };

  handlePatientPhotoUpload = async (patientId, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!this.can('patientsEdit')) return this.permissionDenied();
    try {
      const photo = await optimizeImageFile(file, { maxDimension: 560, quality: 0.82 });
      this.setState(prev => ({ data: savePatientPhoto(prev.data, patientId, photo) }), () => this.notify('Fotografía del paciente actualizada.'));
    } catch (error) {
      this.notify(error instanceof Error ? error.message : 'No se pudo guardar la fotografía.', 'danger');
    }
  };

  removePatientPhoto = patientId => {
    if (!this.can('patientsEdit')) return this.permissionDenied();
    this.setState(prev => ({ data: savePatientPhoto(prev.data, patientId, '') }), () => this.notify('Fotografía eliminada.'));
  };

  updatePrescriptionItem = (itemId, key, value) => {
    this.setState(prev => ({
      modal: prev.modal ? {
        ...prev.modal,
        draft: {
          ...prev.modal.draft,
          items: (prev.modal.draft.items || []).map(item => item.id === itemId ? { ...item, [key]: value } : item),
        },
      } : null,
      modalError: '',
    }));
  };

  addPrescriptionItem = () => {
    this.setState(prev => ({
      modal: prev.modal ? { ...prev.modal, draft: { ...prev.modal.draft, items: [...(prev.modal.draft.items || []), { id: `rxitem_${Date.now()}`, medication: '', strength: '', directions: '', quantity: '', duration: '', notes: '' }] } } : null,
    }));
  };

  removePrescriptionItem = itemId => {
    this.setState(prev => ({
      modal: prev.modal ? { ...prev.modal, draft: { ...prev.modal.draft, items: (prev.modal.draft.items || []).filter(item => item.id !== itemId) } } : null,
    }));
  };

  handleFormError = error => this.setState({ modalError: error instanceof Error ? error.message : 'No fue posible guardar el registro.' });

  savePatientForm = event => {
    event.preventDefault();
    try {
      const result = createPatient(this.state.data, this.state.modal.draft);
      this.setState({ data: result.data, selectedPatientId: result.patientId, view: 'patient', patientTab: 'overview', modal: null, modalError: '' }, () => this.notify('Paciente registrado correctamente.'));
    } catch (error) { this.handleFormError(error); }
  };

  savePatientEditForm = event => {
    event.preventDefault();
    try {
      const { patientId, draft } = this.state.modal;
      const result = updatePatientProfile(this.state.data, patientId, draft);
      this.setState({ data: result.data, modal: null, modalError: '' }, () => this.notify('Datos del paciente actualizados.'));
    } catch (error) { this.handleFormError(error); }
  };

  saveMedicationForm = event => {
    event.preventDefault();
    try {
      const patientId = this.state.modal.patientId;
      const result = addMedication(this.state.data, patientId, this.state.modal.draft);
      this.setState({ data: result.data, patientTab: 'medications', modal: null, modalError: '' }, () => this.notify('Medicamento agregado al tratamiento.'));
    } catch (error) { this.handleFormError(error); }
  };

  saveDoseForm = event => {
    event.preventDefault();
    try {
      const patientId = this.state.modal.patientId;
      const result = changeMedicationDose(this.state.data, patientId, this.state.modal.draft);
      this.setState({ data: result.data, patientTab: 'medications', modal: null, modalError: '' }, () => this.notify('Cambio de dosis registrado.'));
    } catch (error) { this.handleFormError(error); }
  };

  saveAssessmentForm = event => {
    event.preventDefault();
    try {
      const patientId = this.state.modal.patientId;
      const result = recordAssessment(this.state.data, patientId, this.state.modal.draft);
      this.setState({ data: result.data, patientTab: 'followup', modal: null, modalError: '' }, () => this.notify('Evolución clínica registrada.'));
    } catch (error) { this.handleFormError(error); }
  };

  saveVitalsForm = event => {
    event.preventDefault();
    try {
      const patientId = this.state.modal.patientId;
      const result = recordVitals(this.state.data, patientId, this.state.modal.draft);
      this.setState({ data: result.data, patientTab: 'followup', modal: null, modalError: '' }, () => this.notify('Control físico registrado.'));
    } catch (error) { this.handleFormError(error); }
  };

  saveAdverseForm = event => {
    event.preventDefault();
    try {
      const patientId = this.state.modal.patientId;
      const result = recordAdverseEvent(this.state.data, patientId, this.state.modal.draft);
      this.setState({ data: result.data, patientTab: 'safety', modal: null, modalError: '' }, () => this.notify('Efecto observado registrado.'));
    } catch (error) { this.handleFormError(error); }
  };

  saveLabForm = event => {
    event.preventDefault();
    try {
      const patientId = this.state.modal.patientId;
      const result = recordLab(this.state.data, patientId, this.state.modal.draft);
      this.setState({ data: result.data, patientTab: 'safety', modal: null, modalError: '' }, () => this.notify('Resultado de laboratorio agregado.'));
    } catch (error) { this.handleFormError(error); }
  };

  saveAppointmentForm = event => {
    event.preventDefault();
    try {
      const editing = Boolean(this.state.modal.draft.id);
      const result = saveAppointment(this.state.data, this.state.modal.draft);
      this.setState({ data: result.data, modal: null, modalError: '', appointmentDetails: result.appointment }, () => this.notify(editing ? 'Cita actualizada.' : 'Cita creada correctamente.'));
    } catch (error) { this.handleFormError(error); }
  };

  saveMedicationStatusForm = event => {
    event.preventDefault();
    try {
      const { patientId, draft } = this.state.modal;
      const result = setMedicationStatus(this.state.data, patientId, draft.medicationId, draft.status, draft.reason);
      const label = draft.status === 'held' ? 'puesto en pausa' : draft.status === 'active' ? 'reactivado' : 'finalizado';
      this.setState({ data: result.data, patientTab: 'medications', modal: null, modalError: '' }, () => this.notify(`Medicamento ${label}.`));
    } catch (error) { this.handleFormError(error); }
  };

  saveClinicProfileForm = event => {
    event.preventDefault();
    try {
      const data = savePracticeProfile(this.state.data, this.state.modal.draft);
      this.setState({ data, modal: null, modalError: '' }, () => this.notify('Identidad de la clínica actualizada.'));
    } catch (error) { this.handleFormError(error); }
  };

  saveSecretaryForm = event => {
    event.preventDefault();
    try {
      const result = createSecretaryUser(this.state.data, this.state.modal.draft);
      this.setState({ data: result.data, modal: null, modalError: '' }, () => this.notify('Usuario de secretaría creado.'));
    } catch (error) { this.handleFormError(error); }
  };

  saveUserPermissionsForm = event => {
    event.preventDefault();
    try {
      const data = updateUserPermissions(this.state.data, this.state.modal.userId, this.state.modal.draft);
      this.setState({ data, modal: null, modalError: '' }, () => this.notify('Permisos actualizados.'));
    } catch (error) { this.handleFormError(error); }
  };

  savePrescriptionForm = event => {
    event.preventDefault();
    try {
      const { patientId, draft } = this.state.modal;
      const result = savePrescription(this.state.data, patientId, draft);
      const patient = this.state.data.patients.find(item => item.id === patientId);
      const printWindow = window.open('', '_blank', 'width=920,height=980');
      if (printWindow && patient) {
        printWindow.document.open();
        printWindow.document.write(buildPrescriptionPrintHtml(this.state.data, patient, result.prescription));
        printWindow.document.close();
      }
      this.setState({ data: result.data, patientTab: 'prescriptions', modal: null, modalError: '' }, () => {
        this.notify(printWindow ? 'Receta guardada y abierta para impresión.' : 'Receta guardada. Use Imprimir en la pestaña Recetas.');
      });
    } catch (error) { this.handleFormError(error); }
  };

  switchSession = userId => {
    try {
      const data = setActiveUser(this.state.data, userId);
      const user = getActiveUser(data);
      this.setState({ data, modal: null, view: 'dashboard', patientTab: 'overview', appointmentDetails: null }, () => this.notify(`Vista activa: ${user?.name || 'usuario'}.`));
    } catch (error) {
      this.handleFormError(error);
    }
  };

  toggleTeamUser = userId => {
    try {
      const data = toggleUserActive(this.state.data, userId);
      this.setState({ data }, () => this.notify('Estado del usuario actualizado.'));
    } catch (error) {
      this.notify(error instanceof Error ? error.message : 'No se pudo actualizar el usuario.', 'danger');
    }
  };

  toggleReminderHour = hours => {
    if (!this.can('settingsManage')) return this.permissionDenied();
    const current = new Set((this.state.data.settings?.reminderHours || []).map(Number));
    if (current.has(Number(hours))) current.delete(Number(hours));
    else current.add(Number(hours));
    const reminderHours = [...current].sort((a, b) => b - a);
    if (!reminderHours.length) return this.notify('Seleccione al menos un momento de recordatorio.', 'danger');
    this.updateSetting('reminderHours', reminderHours);
  };

  sendReminderWhatsApp = reminder => {
    if (!this.can('remindersManage')) return this.permissionDenied();
    const url = whatsappReminderUrl(this.state.data, reminder.patient, reminder.appointment);
    if (!url) return this.notify('El paciente no tiene un teléfono registrado.', 'danger');
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  copyReminderMessage = async reminder => {
    if (!this.can('remindersManage')) return this.permissionDenied();
    const text = buildReminderMessage(this.state.data, reminder.patient, reminder.appointment);
    try {
      await navigator.clipboard.writeText(text);
      this.notify('Mensaje de recordatorio copiado.');
    } catch (_) {
      this.notify('No se pudo copiar automáticamente. Use el botón de WhatsApp.', 'danger');
    }
  };

  completeReminder = (reminder, channel = 'manual') => {
    if (!this.can('remindersManage')) return this.permissionDenied();
    const data = markReminderSent(this.state.data, reminder.appointment.id, reminder.hours, channel);
    this.setState({ data }, () => this.notify('Recordatorio marcado como enviado.'));
  };

  printPrescription = (prescription, patientId = this.state.selectedPatientId) => {
    const patient = this.state.data.patients.find(item => item.id === patientId);
    if (!patient || !prescription) return this.notify('No se encontró la receta para imprimir.', 'danger');
    const printWindow = window.open('', '_blank', 'width=920,height=980');
    if (!printWindow) return this.notify('El navegador bloqueó la ventana de impresión. Permita ventanas emergentes.', 'danger');
    printWindow.document.open();
    printWindow.document.write(buildPrescriptionPrintHtml(this.state.data, patient, prescription));
    printWindow.document.close();
  };

  updateAppointmentStatus = (appointmentId, status) => {
    if (!this.can('appointmentsManage')) return this.permissionDenied();
    const next = changeAppointmentStatus(this.state.data, appointmentId, status);
    this.setState(prev => ({
      data: next,
      appointmentDetails: prev.appointmentDetails?.id === appointmentId ? { ...prev.appointmentDetails, status } : prev.appointmentDetails,
    }), () => this.notify(`Cita marcada como ${statusLabel(status).toLowerCase()}.`));
  };

  deleteAppointment = appointmentId => {
    if (!this.can('appointmentsManage')) return this.permissionDenied();
    if (!window.confirm('¿Eliminar esta cita? Esta acción no modifica el expediente clínico.')) return;
    this.setState({ data: removeAppointment(this.state.data, appointmentId), appointmentDetails: null }, () => this.notify('Cita eliminada.'));
  };

  acknowledgeAlert = alertId => {
    if (!this.can('alertsView')) return this.permissionDenied();
    return this.setState({ data: updateAlertStatus(this.state.data, alertId, 'acknowledged') }, () => this.notify('Alerta marcada como revisada.'));
  };

  reopenAlert = alertId => {
    if (!this.can('alertsView')) return this.permissionDenied();
    return this.setState({ data: updateAlertStatus(this.state.data, alertId, 'open') }, () => this.notify('Alerta reabierta.'));
  };

  changeMedicationStatus = (patient, medication, status) => this.openMedicationStatus(patient, medication, status);

  updateAdverseStatus = (patientId, eventId, status) => {
    if (!this.can('clinicalEdit')) return this.permissionDenied();
    const result = setAdverseEventStatus(this.state.data, patientId, eventId, status);
    this.setState({ data: result.data }, () => this.notify(status === 'resolved' ? 'Efecto marcado como resuelto.' : 'Efecto reabierto.'));
  };

  exportAnalytics = () => {
    if (!this.can('exportsManage')) return this.permissionDenied();
    downloadCSV('nexamind-resultados.csv', analyticsRows(this.state.data));
    this.notify('Resultados exportados en CSV.');
  };

  exportBackup = () => {
    if (!this.can('exportsManage')) return this.permissionDenied();
    downloadJSON(`nexamind-respaldo-${new Date().toISOString().slice(0, 10)}.json`, this.state.data);
    this.notify('Respaldo descargado.');
  };

  importBackup = async event => {
    if (!this.can('settingsManage')) return this.permissionDenied();
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const validated = validateImportedData(parsed);
      const data = normalizeData(validated);
      this.setState({ data, selectedPatientId: data.patients[0]?.id || null, view: 'dashboard' }, () => this.notify('Respaldo importado correctamente.'));
    } catch (error) {
      this.notify(error instanceof Error ? error.message : 'No se pudo importar el respaldo.', 'danger');
    }
  };

  resetDemo = () => {
    if (!this.can('settingsManage')) return this.permissionDenied();
    if (!window.confirm('¿Restaurar los datos de demostración? Se reemplazarán los cambios guardados en este navegador.')) return;
    const data = createSeedData();
    this.setState({ data, selectedPatientId: data.patients[0]?.id || null, view: 'dashboard', modal: null }, () => this.notify('Datos de demostración restaurados.'));
  };

  printReport = () => window.print();

  renderRegistrationForm() {
    const register = this.state.registerDraft;
    return html`<div className="auth-form-stack">
      <div className="login-panel-head">
        <span className="login-icon"><${Icon} name="userPlus" size=${24}/></span>
        <div><span className="eyebrow">Nuevo consultorio</span><h2>Crear cuenta</h2><p>Registre al médico responsable y su clínica.</p></div>
      </div>
      <form className="login-form" onSubmit=${this.submitRegister}>
        ${this.state.loginError ? html`<div className="login-error" role="alert"><${Icon} name="alert" size=${17}/><span>${this.state.loginError}</span></div>` : null}
        <label><span>Nombre completo</span><div className="login-input"><${Icon} name="patients" size=${18}/><input type="text" autoComplete="name" autoFocus value=${register.fullName} onChange=${event => this.updateRegisterDraft('fullName', event.target.value)} placeholder="Dra. Ana Martínez" required/></div></label>
        <label><span>Clínica o consultorio</span><div className="login-input"><${Icon} name="building" size=${18}/><input type="text" value=${register.clinicName} onChange=${event => this.updateRegisterDraft('clinicName', event.target.value)} placeholder="Clínica Martínez" required/></div></label>
        <label><span>Correo</span><div className="login-input"><${Icon} name="mail" size=${18}/><input type="email" autoComplete="email" value=${register.email} onChange=${event => this.updateRegisterDraft('email', event.target.value)} placeholder="doctor@clinica.com" required/></div></label>
        <label><span>Contraseña</span><div className="login-input"><${Icon} name="lock" size=${18}/><input type=${register.showPassword ? 'text' : 'password'} autoComplete="new-password" minLength="8" value=${register.password} onChange=${event => this.updateRegisterDraft('password', event.target.value)} placeholder="Mínimo 8 caracteres" required/><button type="button" className="password-toggle" aria-label=${register.showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick=${() => this.updateRegisterDraft('showPassword', !register.showPassword)}><${Icon} name=${register.showPassword ? 'eyeOff' : 'eye'} size=${18}/></button></div></label>
        <label><span>Confirmar contraseña</span><div className="login-input"><${Icon} name="lock" size=${18}/><input type=${register.showPassword ? 'text' : 'password'} autoComplete="new-password" minLength="8" value=${register.confirmPassword} onChange=${event => this.updateRegisterDraft('confirmPassword', event.target.value)} placeholder="Repita la contraseña" required/></div></label>
        <${Button} type="submit" icon="userPlus" className="login-submit" disabled=${this.state.loginBusy}>${this.state.loginBusy ? 'Creando cuenta…' : 'Crear mi cuenta Linkare'}</${Button}>
        <small className="signup-terms">Al registrarse, se crea una organización propia y aislada mediante las políticas de Supabase.</small>
      </form>
    </div>`;
  }

  renderDemoAccounts(owner, doctor, secretary, organization) {
    return html`<div>
      ${productionMode ? html`<div className="production-login-note"><${Icon} name="shield" size=${18}/><div><b>¿Aún no tiene cuenta?</b><button type="button" className="inline-auth-link" onClick=${this.showRegister}>Crear una cuenta nueva</button></div></div>` : null}
      <div className="login-divider"><span>Accesos de demostración</span></div>
      <div className="demo-login-warning"><${Icon} name="help" size=${16}/><span>Estos accesos usan datos ficticios y no guardan información clínica en Supabase.</span></div>
      <div className="login-demo-accounts">
      ${owner ? html`<button type="button" onClick=${() => this.fillDemoCredentials('owner')}><${UserAvatar} user=${owner} organization=${organization} size="md"/><div><b>Administración Linkare</b><span>${owner.email}</span><small>Contraseña: ${owner.password || 'Linkare2026!'}</small></div><${Icon} name="chevronRight" size=${17}/></button>` : null}
      ${doctor ? html`<button type="button" onClick=${() => this.fillDemoCredentials('doctor')}><${UserAvatar} user=${doctor} organization=${organization} size="md"/><div><b>Cuenta médica</b><span>${doctor.email}</span><small>Contraseña: ${doctor.password || 'NexaMind2026!'}</small></div><${Icon} name="chevronRight" size=${17}/></button>` : null}
      ${secretary ? html`<button type="button" onClick=${() => this.fillDemoCredentials('secretary')}><${UserAvatar} user=${secretary} organization=${organization} size="md"/><div><b>Cuenta de secretaría</b><span>${secretary.email}</span><small>Contraseña: ${secretary.password || 'Agenda2026!'}</small></div><${Icon} name="chevronRight" size=${17}/></button>` : null}
    </div></div>`;
  }

  renderSignInForm(owner, doctor, secretary, organization) {
    const login = this.state.loginDraft;
    return html`<div className="auth-form-stack">
      <div className="login-panel-head"><span className="login-icon"><${Icon} name="lock" size=${24}/></span><div><span className="eyebrow">${productionMode ? 'Acceso seguro' : 'Acceso de demostración'}</span><h2>Iniciar sesión</h2><p>Use su correo y contraseña.</p></div></div>
      ${this.state.authNotice ? html`<div className="auth-notice"><${Icon} name="check" size=${18}/><span>${this.state.authNotice}</span></div>` : null}
      <form className="login-form" onSubmit=${this.submitLogin}>
        ${this.state.loginError ? html`<div className="login-error" role="alert"><${Icon} name="alert" size=${17}/><span>${this.state.loginError}</span></div>` : null}
        <label><span>Correo</span><div className="login-input"><${Icon} name="mail" size=${18}/><input type="email" autoComplete="username" autoFocus value=${login.email} onChange=${event => this.updateLoginDraft('email', event.target.value)} placeholder="usuario@clinica.com" required/></div></label>
        <label><span>Contraseña</span><div className="login-input"><${Icon} name="lock" size=${18}/><input type=${login.showPassword ? 'text' : 'password'} autoComplete="current-password" value=${login.password} onChange=${event => this.updateLoginDraft('password', event.target.value)} placeholder="Escriba su contraseña" required/><button type="button" className="password-toggle" aria-label=${login.showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick=${() => this.updateLoginDraft('showPassword', !login.showPassword)}><${Icon} name=${login.showPassword ? 'eyeOff' : 'eye'} size=${18}/></button></div></label>
        <${Button} type="submit" icon="lock" className="login-submit" disabled=${this.state.loginBusy}>${this.state.loginBusy ? 'Verificando…' : 'Ingresar a Linkare'}</${Button}>
      </form>
      ${this.renderDemoAccounts(owner, doctor, secretary, organization)}
    </div>`;
  }

  renderLogin() {
    const organization = this.state.data.organization || {};
    const users = Array.isArray(this.state.data.users) ? this.state.data.users : [];
    const owner = users.find(user => user.role === 'owner' && user.active !== false);
    const doctor = users.find(user => user.role === 'doctor' && user.active !== false);
    const secretary = users.find(user => user.role === 'secretary' && user.active !== false);
    const registering = productionMode && this.state.authView === 'register';
    const authContent = registering
      ? this.renderRegistrationForm()
      : this.renderSignInForm(owner, doctor, secretary, organization);

    return html`<main className="login-shell">
      <div className="login-ambient login-ambient-one"></div>
      <div className="login-ambient login-ambient-two"></div>
      <section className="login-card">
        <aside className="login-intro">
          <${Logo} organization=${organization}/>
          <div className="login-copy"><span className="login-kicker">Gestión psiquiátrica sencilla</span><h1>Su clínica, pacientes, agenda y recetas en un solo lugar</h1><p>${productionMode ? 'Cree su cuenta o inicie sesión. Cada profesional tendrá su propia organización en Supabase.' : 'Ingrese con una cuenta de demostración para explorar Linkare.'}</p></div>
          <div className="login-benefits"><div><span><${Icon} name="patients" size=${18}/></span><b>Expedientes</b><small>Pacientes, tratamientos y seguimiento.</small></div><div><span><${Icon} name="prescription" size=${18}/></span><b>Recetas</b><small>Documentos listos para imprimir.</small></div><div><span><${Icon} name="calendar" size=${18}/></span><b>Agenda</b><small>Citas y recordatorios.</small></div><div><span><${Icon} name="shield" size=${18}/></span><b>Supabase</b><small>${productionMode ? 'Auth, RLS y persistencia remota.' : 'Datos ficticios en modo demo.'}</small></div></div>
          <div className="login-demo-note"><${Icon} name="shield" size=${17}/><span>${productionMode ? 'Use un correo real al registrarse para poder confirmar su cuenta si Supabase lo solicita.' : 'No use datos reales de pacientes en la demostración.'}</span></div>
        </aside>
        <section className="login-panel">
          ${productionMode ? html`<div className="auth-tabs"><button type="button" className=${!registering ? 'active' : ''} onClick=${this.showLogin}>Iniciar sesión</button><button type="button" className=${registering ? 'active' : ''} onClick=${this.showRegister}>Crear cuenta</button></div>` : null}
          ${authContent}
        </section>
      </section>
    </main>`;
  }

  renderTopbar() {
    const user = this.activeUser();
    const nav = [
      ['dashboard', 'overview', 'Inicio', true],
      ['patients', 'patients', 'Pacientes', this.can('patientsView')],
      ['agenda', 'calendar', 'Agenda', this.can('appointmentsManage')],
      ['payments', 'insurance', 'Mi plan', user?.role === 'owner' || user?.role === 'doctor'],
      ['analytics', 'analytics', 'Resultados', this.can('analyticsView')],
      ['alerts', 'alert', 'Alertas', this.can('alertsView')],
    ].filter(item => item[3]);
    const active = this.state.view === 'patient' ? 'patients' : this.state.view;
    const openAlerts = this.state.data.alerts.filter(item => item.status === 'open').length;
    const canConfigure = this.can('settingsManage') || this.can('usersManage');
    return html`<header className="topbar">
      <${Logo} organization=${this.state.data.organization}/>
      <nav data-tour="main-navigation" className=${`nav-pill ${this.state.mobileNav ? 'nav-open' : ''}`} aria-label="Navegación principal">
        ${nav.map(([key, icon, label]) => html`<button key=${key} className=${active === key ? 'active' : ''} onClick=${() => this.setView(key)}><${Icon} name=${icon} size=${17}/><span>${label}</span>${key === 'alerts' && openAlerts ? html`<b>${openAlerts}</b>` : null}</button>`)}
      </nav>
      <div className="top-actions">
        <button className="help-button" data-tour="help-button" onClick=${this.openHelp}><${Icon} name="help" size=${17}/><span>Ayuda</span></button>
        ${this.can('alertsView') ? html`<button className="icon-button notification-button" aria-label="Ver alertas" onClick=${() => this.setView('alerts')}><${Icon} name="alert"/>${openAlerts ? html`<i></i>` : null}</button>` : null}
        ${canConfigure ? html`<button className="icon-button" data-tour="settings-button" aria-label="Configuración" onClick=${() => this.setView('settings')}><${Icon} name="settings"/></button>` : null}
        <button className="profile-chip profile-chip-button" onClick=${this.openAccount} title="Cuenta y cierre de sesión"><${UserAvatar} user=${user} organization=${this.state.data.organization} size="sm"/><div><b>${user?.name || 'Usuario'}</b><small>${user?.title || (user?.role === 'secretary' ? 'Secretaría' : 'Psiquiatría')}</small></div><${Icon} name="arrowDown" size=${14}/></button>
        <button className="mobile-account icon-button" aria-label="Cuenta y cierre de sesión" onClick=${this.openAccount}><${Icon} name="lock"/></button>
        <button className="mobile-menu icon-button" aria-label="Abrir menú" onClick=${() => this.setState({ mobileNav: !this.state.mobileNav })}><${Icon} name="menu"/></button>
      </div>
    </header>`;
  }

  renderSecretaryDashboard() {
    const { patients, appointments } = this.state.data;
    const user = this.activeUser();
    const today = new Date();
    const todayAppointments = appointments.filter(item => isSameDay(item.start, today) && item.status !== 'cancelled').sort((left, right) => new Date(left.start) - new Date(right.start));
    const pending = appointments.filter(item => item.status === 'pending' && new Date(item.start) >= today).length;
    const reminders = getReminderQueue(this.state.data, today);
    const due = reminders.filter(item => item.status === 'due' || item.status === 'overdue');
    const upcoming = reminders.filter(item => item.status === 'upcoming').slice(0, 6);
    return html`<div className="view-enter secretary-view" data-tour="secretary-dashboard">
      <${PageHeader}
        eyebrow="Vista de secretaría"
        title=${`${greeting()}, ${user?.name?.split(' ')[0] || 'Secretaría'}`}
        subtitle="Aquí están las citas, confirmaciones y recordatorios. La información clínica permanece protegida según los permisos asignados."
        actions=${html`<div className="tour-actions-group">${this.can('patientsCreate') ? html`<${Button} tone="secondary" icon="userPlus" onClick=${this.openNewPatient}>Nuevo paciente</${Button}>` : null}${this.can('appointmentsManage') ? html`<${Button} icon="plus" onClick=${() => this.openNewAppointment()}>Nueva cita</${Button}>` : null}</div>`}
      />
      <div className="simple-help administrative-help"><${Icon} name="shield" size=${18}/><p><b>Vista administrativa.</b> Solo muestra contacto, seguro, agenda y recordatorios. El médico decide qué información clínica puede consultar o editar este usuario.</p></div>
      <div className="kpi-grid secretary-kpis">
        <${KpiCard} label="Citas de hoy" value=${todayAppointments.length} hint="programadas para hoy" icon="calendar" tone="blue"/>
        <${KpiCard} label="Por confirmar" value=${pending} hint="citas futuras pendientes" icon="clock" tone="purple"/>
        <${KpiCard} label="Recordatorios listos" value=${due.length} hint="requieren envío o revisión" icon="message" tone=${due.length ? 'coral' : 'teal'}/>
        <${KpiCard} label="Pacientes" value=${patients.length} hint="expedientes administrativos" icon="patients" tone="blue"/>
      </div>
      <div className="dashboard-grid">
        <${Card} className="span-7" title="Agenda de hoy" action=${html`<button className="text-button" onClick=${() => this.setView('agenda')}>Abrir calendario <${Icon} name="chevronRight" size=${16}/></button>`}>
          <div className="secretary-agenda-list">${todayAppointments.length ? todayAppointments.map(appointment => {
            const patient = patients.find(item => item.id === appointment.patientId);
            return html`<button key=${appointment.id} className="secretary-agenda-row" onClick=${() => this.setState({ appointmentDetails: appointment })}><time>${formatTime(appointment.start)}</time><${Avatar} patient=${patient}/><div><b>${patient?.name || appointment.title}</b><small>${appointment.type} · ${appointment.modality}</small></div><${Badge} tone=${appointment.status === 'confirmed' ? 'success' : 'warning'}>${statusLabel(appointment.status)}</${Badge}><${Icon} name="chevronRight" size=${16}/></button>`;
          }) : html`<${EmptyState} icon="calendar" title="No hay citas hoy" text="Puede crear una cita con el botón superior."/>`}</div>
        </${Card}>
        <${Card} tour="secretary-reminders" className="span-5" title="Recordatorios" subtitle="Se calculan con los tiempos configurados por el médico.">
          <div className="reminder-mini-list">${[...due, ...upcoming].slice(0, 7).length ? [...due, ...upcoming].slice(0, 7).map(reminder => html`<div key=${reminder.id} className=${`reminder-mini reminder-${reminder.status}`}><span><${Icon} name="message" size=${16}/></span><div><b>${reminder.patient?.name || reminder.appointment.title}</b><small>${reminderLabel(reminder.hours)} · ${formatDateTime(reminder.appointment.start)}</small></div><${Badge} tone=${reminder.status === 'due' || reminder.status === 'overdue' ? 'warning' : 'neutral'}>${reminder.status === 'due' ? 'Enviar' : reminder.status === 'overdue' ? 'Vencido' : 'Próximo'}</${Badge}></div>`) : html`<${EmptyState} icon="check" title="Sin recordatorios pendientes" text="La cola se actualizará según las próximas citas."/>`}</div>
          <${Button} tone="secondary" onClick=${() => this.setView('agenda')}>Gestionar recordatorios</${Button}>
        </${Card}>
      </div>
    </div>`;
  }

  renderDashboard() {
    if (this.activeUser()?.role === 'secretary') return this.renderSecretaryDashboard();
    const { patients, appointments, alerts } = this.state.data;
    const summaries = patients.map(patient => getAssessmentSummary(patient)).filter(Boolean);
    const responseRate = summaries.length ? summaries.filter(summary => summary.improvement >= 50).length / summaries.length * 100 : 0;
    const meanImprovement = summaries.length ? summaries.reduce((total, summary) => total + summary.improvement, 0) / summaries.length : 0;
    const avgAdherence = patients.length ? patients.reduce((total, patient) => total + (Number(patient.adherence) || 0), 0) / patients.length : 0;
    const openAlerts = alerts.filter(item => item.status === 'open');
    const needReview = patients.filter(patient => getPatientPriority(patient, alerts).score >= 2).length;
    const todayAppointments = appointments.filter(item => isSameDay(item.start, new Date()) && item.status !== 'cancelled').sort((left, right) => new Date(left.start) - new Date(right.start));
    const weekStart = startOfWeek(new Date());
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
    const weekAppointments = appointments.filter(item => new Date(item.start) >= weekStart && new Date(item.start) < weekEnd && item.status !== 'cancelled');
    const priority = [...patients].sort((left, right) => getPatientPriority(right, alerts).score - getPatientPriority(left, alerts).score || new Date(left.nextVisit || '2999-01-01') - new Date(right.nextVisit || '2999-01-01'));
    const seriesLength = 5;
    const symptomPoints = Array.from({ length: seriesLength }, (_, index) => {
      const normalized = patients.map(patient => {
        const points = patient.assessments?.[0]?.points || [];
        if (!points.length || !Number(points[0].value)) return null;
        const point = points[Math.min(index, points.length - 1)];
        return Number(point.value) / Number(points[0].value) * 100;
      }).filter(Number.isFinite);
      return {
        date: new Date(Date.now() - (seriesLength - 1 - index) * 21 * 86_400_000).toISOString(),
        value: normalized.length ? Math.round(normalized.reduce((total, value) => total + value, 0) / normalized.length) : 0,
      };
    });
    return html`<div className="view-enter">
      <${PageHeader}
        eyebrow="Vista principal"
        title=${`${greeting()}, ${this.state.data.organization?.clinician || 'Doctor'}`}
        subtitle="Aquí encontrará pacientes que requieren atención, citas del día y cambios clínicos importantes."
        actions=${html`<div className="tour-actions-group" data-tour="dashboard-actions"><${Button} tone="secondary" icon="userPlus" onClick=${this.openNewPatient}>Nuevo paciente</${Button}><${Button} icon="plus" onClick=${() => this.openNewAppointment()}>Nueva cita</${Button}></div>`}
      />
      <div className="simple-help"><${Icon} name="help" size=${18}/><p><b>Empiece por “Requieren revisión”.</b> El sistema ordena señales de evolución, adherencia, efectos y controles. La decisión final siempre corresponde al psiquiatra.</p></div>
      <div className="kpi-grid">
        <${KpiCard} label="Pacientes activos" value=${patients.length} hint="con expediente en seguimiento" icon="patients" tone="purple" chart=${html`<${Sparkline} values=${[Math.max(1, patients.length - 3), patients.length - 2, patients.length - 2, patients.length - 1, patients.length]} />`}/>
        <${KpiCard} tour="dashboard-review" label="Requieren revisión" value=${needReview} hint="ordenados por prioridad clínica" icon="alert" tone="coral" chart=${html`<div className="mini-stack"><span style=${{ height: '35%' }}></span><span style=${{ height: '48%' }}></span><span style=${{ height: '60%' }}></span><span style=${{ height: '52%' }}></span><span style=${{ height: '78%' }}></span></div>`}/>
        <${KpiCard} label="Con mejoría importante" value=${percent(responseRate)} hint="cambio favorable ≥50% en su escala principal" icon="trend" tone="teal" chart=${html`<${Sparkline} values=${[42, 48, 51, 56, responseRate]} tone="teal"/>`}/>
        <${KpiCard} label="Citas esta semana" value=${weekAppointments.length} hint=${`${todayAppointments.length} programadas hoy`} icon="calendar" tone="blue" chart=${html`<${Sparkline} values=${[2, 1, 3, 2, weekAppointments.length]} tone="blue"/>`}/>
      </div>

      <div className="dashboard-grid">
        <${Card} className="span-8" title="Evolución general de los pacientes" subtitle="Promedio relativo de la escala principal. 100 representa el valor inicial." action=${html`<${Badge} tone="success" dot=${true}>Mejoría media ${percent(meanImprovement)}</${Badge}>`}>
          <div className="chart-summary"><div><strong>${percent(meanImprovement)}</strong><span>mejoría media observada</span></div><div><b>${percent(avgAdherence)}</b><span>adherencia media</span></div><div><b>${patients.filter(patient => patient.adverseEvents.some(event => event.status === 'active')).length}</b><span>con efecto activo</span></div></div>
          <${LineChart} series=${[{ label: 'Síntomas relativos', points: symptomPoints }]}/>
          <div className="clinical-footnote"><${Icon} name="shield" size=${17}/> Muestra cambios registrados durante el tratamiento. No demuestra que un medicamento sea la causa del cambio.</div>
        </${Card}>
        <${Card} tour="dashboard-agenda" className="span-4 agenda-preview" title="Agenda de hoy" action=${html`<button className="text-button" onClick=${() => this.setView('agenda')}>Abrir agenda <${Icon} name="chevronRight" size=${16}/></button>`}>
          <div className="date-hero"><span>${new Intl.DateTimeFormat('es-SV', { weekday: 'long' }).format(new Date())}</span><strong>${new Date().getDate()}</strong><small>${new Intl.DateTimeFormat('es-SV', { month: 'long', year: 'numeric' }).format(new Date())}</small></div>
          <div className="today-list">
            ${todayAppointments.length ? todayAppointments.map(appointment => {
              const patient = patients.find(item => item.id === appointment.patientId);
              return html`<button key=${appointment.id} className="today-item" onClick=${() => this.setState({ appointmentDetails: appointment })}><time>${formatTime(appointment.start)}</time><span className="event-line"></span><div><b>${appointment.title}</b><small>${appointment.type} · ${appointment.modality}</small></div><${Avatar} patient=${patient} size="sm"/></button>`;
            }) : html`<${EmptyState} icon="calendar" title="Sin citas hoy" text="Puede crear una cita desde aquí." action=${html`<${Button} tone="soft" icon="plus" onClick=${() => this.openNewAppointment()}>Agregar cita</${Button}>`}/>`}
          </div>
          ${todayAppointments.length ? html`<${Button} tone="soft" icon="plus" onClick=${() => this.openNewAppointment()}>Agregar cita</${Button}>` : null}
        </${Card}>
      </div>

      <div className="dashboard-grid lower-grid">
        <${Card} tour="dashboard-priority" className="span-8" title="Pacientes que conviene revisar primero" action=${html`<button className="text-button" onClick=${() => this.setView('patients')}>Ver todos <${Icon} name="chevronRight" size=${16}/></button>`}>
          <div className="priority-list">
            ${priority.slice(0, 6).map(patient => {
              const summary = getAssessmentSummary(patient);
              const patientPriority = getPatientPriority(patient, alerts);
              return html`<button key=${patient.id} className="priority-row" onClick=${() => this.openPatient(patient.id)}><${Avatar} patient=${patient}/><div className="priority-main"><b>${patient.name}</b><small>${patient.diagnosis}</small></div><div><span>Tratamiento</span><b>${patient.medication?.name || 'Sin medicamento'}</b><small>${patient.medication?.dose || '—'}</small></div><div><span>Evolución</span><b className=${summary?.improvement >= 25 ? 'good-text' : ''}>${summary ? percent(summary.improvement) : 'Sin escala'}</b><small>${summary ? `${summary.primary.code}: ${summary.baseline} → ${summary.current}` : 'Registrar evaluación'}</small></div><div><${Badge} tone=${patientPriority.tone} dot=${true}>${patientPriority.label}</${Badge}></div><${Icon} name="chevronRight" size=${17}/></button>`;
            })}
          </div>
        </${Card}>
        <${Card} className="span-4" title="Alertas pendientes" action=${html`<${Badge} tone="danger">${openAlerts.length} abiertas</${Badge}>`}>
          <div className="alert-list compact">
            ${openAlerts.slice(0, 4).map(alert => {
              const patient = patients.find(item => item.id === alert.patientId);
              return html`<button key=${alert.id} className="alert-row" onClick=${() => this.openPatient(alert.patientId)}><span className=${`alert-indicator alert-${alert.severity}`}></span><div><b>${alert.title}</b><small>${patient?.name} · ${relativeDate(alert.createdAt)}</small></div><${Icon} name="chevronRight" size=${16}/></button>`;
            })}
          </div>
          <${Button} tone="secondary" onClick=${() => this.setView('alerts')}>Revisar alertas</${Button}>
        </${Card}>
      </div>
    </div>`;
  }

  renderPatients() {
    if (!this.can('patientsView')) return html`<${EmptyState} icon="shield" title="Acceso restringido" text="Este usuario no tiene permiso para consultar pacientes."/>`;
    const { patients, alerts } = this.state.data;
    const clinicalVisible = this.can('clinicalView');
    const query = this.state.search.trim().toLowerCase();
    const filtered = patients.filter(patient => {
      const searchable = clinicalVisible
        ? [patient.name, patient.diagnosis, patient.medication?.name, patient.diagnosisCode, patient.insurance?.provider]
        : [patient.name, patient.phone, patient.email, patient.insurance?.provider, patient.insurance?.memberId];
      const matchesSearch = !query || searchable.join(' ').toLowerCase().includes(query);
      if (!matchesSearch) return false;
      if (this.state.patientFilter === 'active') return patient.status !== 'inactive';
      if (this.state.patientFilter === 'review') return clinicalVisible ? getPatientPriority(patient, alerts).score >= 2 : !patient.nextVisit;
      return true;
    });
    return html`<div className="view-enter">
      <${PageHeader}
        eyebrow=${clinicalVisible ? 'Expedientes clínicos' : 'Expedientes administrativos'}
        title="Pacientes"
        subtitle=${clinicalVisible ? 'Busque un paciente o cree un expediente nuevo. Las tarjetas resumen el seguimiento.' : 'Consulte contacto, cobertura y próxima cita sin mostrar información clínica restringida.'}
        actions=${html`<div className="tour-actions-group" data-tour="patients-tools"><div className="search-box"><${Icon} name="search"/><input value=${this.state.search} onChange=${event => this.setState({ search: event.target.value })} placeholder=${clinicalVisible ? 'Buscar por nombre, diagnóstico o medicamento' : 'Buscar por nombre, teléfono o seguro'}/></div>${this.can('patientsCreate') ? html`<${Button} icon="userPlus" onClick=${this.openNewPatient}>Nuevo paciente</${Button}>` : null}</div>`}
      />
      <div className="patients-toolbar"><div><${Badge} tone="blue">${filtered.length} pacientes</${Badge}>${clinicalVisible ? html`<${Badge} tone="warning">${patients.filter(patient => getPatientPriority(patient, alerts).score >= 2).length} por revisar</${Badge}>` : html`<${Badge} tone="neutral">${patients.filter(patient => patient.insurance?.hasInsurance).length} con seguro</${Badge}>`}</div><div className="segmented" aria-label="Filtrar pacientes">${[['all', 'Todos'], ['active', 'Activos'], ['review', clinicalVisible ? 'Por revisar' : 'Sin próxima cita']].map(([key, label]) => html`<button key=${key} className=${this.state.patientFilter === key ? 'active' : ''} onClick=${() => this.setState({ patientFilter: key })}>${label}</button>`)}</div></div>
      ${filtered.length ? html`<div className="patient-grid">${filtered.map(patient => {
        const summary = getAssessmentSummary(patient);
        const priority = clinicalVisible ? getPatientPriority(patient, alerts) : null;
        return html`<button key=${patient.id} data-tour=${patient.id === filtered[0]?.id ? 'patient-card' : null} className="patient-card" onClick=${() => this.openPatient(patient.id)}><div className="patient-card-top"><div className="patient-identity"><${Avatar} patient=${patient} size="lg"/><div><h3>${patient.name}</h3><span>${patient.age} años${clinicalVisible ? ` · ${patient.diagnosisCode}` : patient.phone ? ` · ${patient.phone}` : ''}</span></div></div>${clinicalVisible ? html`<${Badge} tone=${priority.tone} dot=${true}>${priority.label}</${Badge}>` : html`<${Badge} tone=${patient.insurance?.hasInsurance ? 'blue' : 'neutral'}>${patient.insurance?.hasInsurance ? 'Con seguro' : 'Particular'}</${Badge}>`}</div><p>${clinicalVisible ? patient.diagnosis : patient.insurance?.hasInsurance ? `${patient.insurance.provider || 'Seguro médico'} · ${patient.insurance.plan || 'Plan sin registrar'}` : 'Atención particular'}</p>${clinicalVisible ? html`<div className="patient-metrics"><div><span>Medicamento principal</span><b>${patient.medication?.name || 'Sin medicamento'}</b><small>${patient.medication?.dose || 'Agregue el tratamiento'}</small></div><div><span>${summary?.primary.code || 'Escala'}</span><b>${summary?.current ?? '—'}</b><small>${summary ? `Inicial ${summary.baseline}` : 'Sin medición'}</small></div><div><span>Mejoría observada</span><b className=${summary?.improvement >= 25 ? 'good-text' : ''}>${summary ? percent(summary.improvement) : '—'}</b><small>${summary?.label || 'Registrar evolución'}</small></div></div>` : html`<div className="patient-metrics admin-metrics"><div><span>Teléfono</span><b>${patient.phone || 'No registrado'}</b><small>${patient.email || 'Sin correo'}</small></div><div><span>Seguro</span><b>${patient.insurance?.hasInsurance ? patient.insurance.provider || 'Sí' : 'Particular'}</b><small>${patient.insurance?.memberId || 'Sin afiliación'}</small></div><div><span>Próxima cita</span><b>${patient.nextVisit ? relativeDate(patient.nextVisit) : 'Sin agendar'}</b><small>${patient.nextVisit ? formatDateTime(patient.nextVisit) : 'Requiere coordinación'}</small></div></div>`}<div className="patient-card-footer"><div><${Icon} name="calendar" size=${16}/><span>${patient.nextVisit ? `${relativeDate(patient.nextVisit)} · ${formatTime(patient.nextVisit)}` : 'Sin próxima cita'}</span></div><span>Abrir expediente <${Icon} name="chevronRight" size=${16}/></span></div></button>`;
      })}</div>` : html`<${EmptyState} icon="search" title="No encontramos pacientes" text="Cambie el filtro o cree un expediente nuevo." action=${this.can('patientsCreate') ? html`<${Button} icon="userPlus" onClick=${this.openNewPatient}>Nuevo paciente</${Button}>` : null}/>`}
    </div>`;
  }

  renderAdministrativePatient(patient) {
    const appointments = this.state.data.appointments
      .filter(item => item.patientId === patient.id)
      .sort((left, right) => new Date(right.start) - new Date(left.start));
    const upcoming = appointments.filter(item => new Date(item.start) >= new Date() && !['cancelled', 'completed', 'no_show'].includes(item.status));
    const reminders = getReminderQueue(this.state.data).filter(item => item.patient?.id === patient.id && item.status !== 'sent').slice(0, 5);
    const insurance = patient.insurance || {};
    return html`<div className="view-enter administrative-patient">
      <div className="patient-hero administrative-hero">
        <button className="back-button" aria-label="Volver a pacientes" onClick=${() => this.setView('patients')}><${Icon} name="chevronLeft"/></button>
        <div className="patient-photo-control" data-tour="patient-photo"><${Avatar} patient=${patient} size="xl"/>${this.can('patientsEdit') ? html`<label className="photo-fab" title="Cambiar fotografía"><${Icon} name="camera" size=${16}/><input type="file" accept="image/png,image/jpeg,image/webp" onChange=${event => this.handlePatientPhotoUpload(patient.id, event)}/></label>` : null}</div>
        <div className="patient-hero-main" data-tour="patient-badges"><span className="eyebrow">Ficha administrativa</span><h1>${patient.name}</h1><p>${patient.age} años · ${patient.phone || 'Sin teléfono'} · ${patient.email || 'Sin correo'}</p><div className="hero-badges"><${Badge} tone=${insurance.hasInsurance ? 'blue' : 'neutral'}>${insurance.hasInsurance ? 'Con seguro médico' : 'Paciente particular'}</${Badge}><${Badge} tone=${upcoming.length ? 'success' : 'warning'}>${upcoming.length ? 'Cita programada' : 'Sin próxima cita'}</${Badge}></div></div>
        <div className="patient-hero-actions" data-tour="patient-next-visit">${this.can('patientsEdit') ? html`<${Button} tone="secondary" icon="edit" onClick=${() => this.openEditPatient(patient)}>Editar datos</${Button}>` : null}${this.can('appointmentsManage') ? html`<${Button} icon="calendar" onClick=${() => this.openNewAppointment(patient.nextVisit ? new Date(patient.nextVisit) : new Date(), patient.id)}>Agendar</${Button}>` : null}</div>
      </div>
      <div className="simple-help administrative-help"><${Icon} name="shield" size=${18}/><p><b>Información protegida.</b> Esta vista no muestra diagnóstico, medicamentos, escalas ni notas clínicas porque el usuario activo no tiene ese permiso.</p></div>
      <div className="dashboard-grid">
        <${Card} className="span-5" title="Datos de contacto" action=${this.can('patientsEdit') ? html`<button className="text-button" onClick=${() => this.openEditPatient(patient)}>Editar</button>` : null}>
          <div className="admin-detail-list"><div><span>Nombre</span><b>${patient.name}</b></div><div><span>Edad</span><b>${patient.age} años</b></div><div><span>Teléfono</span><b>${patient.phone || 'No registrado'}</b></div><div><span>Correo</span><b>${patient.email || 'No registrado'}</b></div></div>
        </${Card}>
        <${Card} className="span-7" title="Seguro médico" action=${html`<${Badge} tone=${insurance.hasInsurance ? 'blue' : 'neutral'}>${insurance.hasInsurance ? 'Activo en expediente' : 'Particular'}</${Badge}>`}>
          ${insurance.hasInsurance ? html`<div className="insurance-grid"><div><span>Aseguradora</span><b>${insurance.provider || 'No registrada'}</b></div><div><span>Plan</span><b>${insurance.plan || 'No registrado'}</b></div><div><span>N.º de afiliado</span><b>${insurance.memberId || 'No registrado'}</b></div><div><span>Póliza</span><b>${insurance.policyNumber || 'No registrada'}</b></div><div><span>Autorización</span><b>${insurance.authorizationRequired ? 'Requerida' : 'No requerida'}</b></div><div><span>Copago</span><b>${insurance.copay || 'No registrado'}</b></div>${insurance.notes ? html`<div className="insurance-notes"><span>Notas</span><p>${insurance.notes}</p></div>` : null}</div>` : html`<${EmptyState} icon="insurance" title="Atención particular" text="No se ha registrado una póliza o plan médico."/>`}
        </${Card}>
        <${Card} className="span-7" title="Citas del paciente" action=${this.can('appointmentsManage') ? html`<${Button} tone="soft" icon="plus" onClick=${() => this.openNewAppointment(new Date(), patient.id)}>Nueva cita</${Button}>` : null}>
          ${appointments.length ? html`<div className="admin-appointment-list">${appointments.slice(0, 8).map(appointment => html`<button key=${appointment.id} onClick=${() => this.setState({ appointmentDetails: appointment })}><time>${formatDate(appointment.start)}<small>${formatTime(appointment.start)}</small></time><div><b>${appointment.type}</b><small>${appointment.modality}</small></div><${Badge} tone=${appointment.status === 'confirmed' ? 'success' : appointment.status === 'pending' ? 'warning' : 'neutral'}>${statusLabel(appointment.status)}</${Badge}><${Icon} name="chevronRight" size=${16}/></button>`)}</div>` : html`<${EmptyState} icon="calendar" title="Sin citas registradas" text="Cree la primera cita desde el botón superior."/>`}
        </${Card}>
        <${Card} className="span-5" title="Recordatorios próximos">
          ${reminders.length ? html`<div className="reminder-mini-list">${reminders.map(reminder => html`<div key=${reminder.id} className=${`reminder-mini reminder-${reminder.status}`}><span><${Icon} name="message" size=${16}/></span><div><b>${reminderLabel(reminder.hours)}</b><small>${formatDateTime(reminder.appointment.start)}</small></div>${this.can('remindersManage') && reminder.status === 'due' ? html`<button className="text-button" onClick=${() => this.sendReminderWhatsApp(reminder)}>Enviar</button>` : null}</div>`)}</div>` : html`<${EmptyState} icon="check" title="Sin recordatorios pendientes" text="Se crearán según la configuración de la clínica."/>`}
        </${Card}>
      </div>
    </div>`;
  }

  renderPatient() {
    const { patients, alerts, appointments } = this.state.data;
    const patient = patients.find(item => item.id === this.state.selectedPatientId) || patients[0];
    if (!patient) return html`<${EmptyState} icon="patients" title="Sin pacientes" text="Cree el primer expediente para comenzar." action=${html`<${Button} icon="userPlus" onClick=${this.openNewPatient}>Nuevo paciente</${Button}>`}/>`;
    if (!this.can('clinicalView')) return this.renderAdministrativePatient(patient);
    const summary = getAssessmentSummary(patient);
    const priority = getPatientPriority(patient, alerts);
    const patientAlerts = alerts.filter(item => item.patientId === patient.id && item.status === 'open');
    const patientAppointments = appointments.filter(item => item.patientId === patient.id).sort((left, right) => new Date(right.start) - new Date(left.start));
    const primaryMedication = patient.medication;
    const exposureDays = primaryMedication?.status === 'active' ? daysBetween(primaryMedication.startDate) : 0;
    const activeAdverse = patient.adverseEvents.filter(item => item.status === 'active');
    const tabs = [
      ['overview', 'Resumen'],
      ['medications', 'Medicamentos'],
      ['followup', 'Seguimiento'],
      ['safety', 'Efectos y controles'],
      ['prescriptions', 'Recetas'],
      ['timeline', 'Historial'],
    ];
    const doseSeries = primaryMedication?.doseHistory?.length ? [{
      label: `${primaryMedication.name} (${primaryMedication.doseUnit || 'mg'})`,
      points: [...primaryMedication.doseHistory].sort((left, right) => new Date(left.date) - new Date(right.date)).map(item => ({ date: item.date, value: Number(item.doseValue) || 0 })),
    }] : [];
    const weightChange = patient.vitals?.baselineWeight && patient.vitals?.weight
      ? ((Number(patient.vitals.weight) - Number(patient.vitals.baselineWeight)) / Number(patient.vitals.baselineWeight)) * 100
      : null;

    return html`<div className="view-enter">
      <div className="patient-hero" data-tour="patient-summary">
        <button className="back-button" aria-label="Volver a pacientes" onClick=${() => this.setView('patients')}><${Icon} name="chevronLeft"/></button>
        <div className="patient-photo-control" data-tour="patient-photo"><${Avatar} patient=${patient} size="xl"/>${this.can('patientsEdit') ? html`<label className="photo-fab" title="Cambiar fotografía"><${Icon} name="camera" size=${16}/><input type="file" accept="image/png,image/jpeg,image/webp" onChange=${event => this.handlePatientPhotoUpload(patient.id, event)}/></label>` : null}</div>
        <div className="patient-hero-main" data-tour="patient-badges"><span className="eyebrow">Expediente del paciente · Datos sintéticos</span><h1>${patient.name}</h1><p>${patient.age} años · ${patient.diagnosis} · ${patient.diagnosisCode}</p><div className="hero-badges"><${Badge} tone=${priority.tone} dot=${true}>${priority.label}</${Badge}><${Badge} tone="neutral">Riesgo ${riskLabel(patient.risk).toLowerCase()}</${Badge}><${Badge} tone=${patient.insurance?.hasInsurance ? 'blue' : 'neutral'}>${patient.insurance?.hasInsurance ? patient.insurance.provider || 'Con seguro' : 'Particular'}</${Badge}>${primaryMedication?.name && primaryMedication.name !== 'Sin medicamento' ? html`<${Badge} tone="purple">${primaryMedication.name} ${primaryMedication.dose}</${Badge}>` : html`<${Badge} tone="warning">Sin medicamento principal</${Badge}>`}</div></div>
        <div className="patient-hero-actions" data-tour="patient-next-visit"><div><span>Próxima cita</span><b>${patient.nextVisit ? relativeDate(patient.nextVisit) : 'Sin agendar'}</b><small>${patient.nextVisit ? formatDateTime(patient.nextVisit) : 'Cree una cita desde el botón'}</small></div><${Button} icon="calendar" onClick=${() => this.openNewAppointment(patient.nextVisit ? new Date(patient.nextVisit) : new Date(), patient.id)}>Agendar</${Button}></div>
      </div>

      <div className="patient-action-bar" data-tour="patient-actions" aria-label="Acciones rápidas del paciente">
        <div><b>Acciones frecuentes</b><small>Registre lo ocurrido durante o después de la consulta.</small></div>
        ${this.can('clinicalEdit') ? html`<${Button} tour="action-evolution" icon="analytics" onClick=${() => this.openAssessment(patient)}>Registrar evolución</${Button}>` : null}
        ${this.can('medicationsManage') ? html`<${Button} tour="action-medication" tone="secondary" icon="medication" onClick=${() => this.openMedication(patient)}>Agregar medicamento</${Button}>` : null}
        ${this.can('medicationsManage') ? html`<${Button} tour="action-dose" tone="secondary" icon="edit" disabled=${!patient.medications.some(item => item.status === 'active')} onClick=${() => this.openDose(patient)}>Cambiar dosis</${Button}>` : null}
        ${this.can('prescriptionsCreate') ? html`<${Button} tour="action-prescription" tone="secondary" icon="prescription" onClick=${() => this.openPrescription(patient)}>Nueva receta</${Button}>` : null}
        ${this.can('patientsEdit') ? html`<${Button} tour="action-patient-data" tone="secondary" icon="edit" onClick=${() => this.openEditPatient(patient)}>Datos y seguro</${Button}>` : null}
      </div>

      <div className="patient-tabs" data-tour="patient-tabs" role="tablist">${tabs.map(([key, label]) => html`<button key=${key} role="tab" data-tour=${`patient-tab-${key}`} className=${this.state.patientTab === key ? 'active' : ''} onClick=${() => this.setState({ patientTab: key })}>${label}${key === 'safety' && patientAlerts.length ? html`<b>${patientAlerts.length}</b>` : null}</button>`)}</div>

      ${this.state.patientTab === 'overview' ? html`<div>
        <div className="patient-kpis" data-tour="patient-overview-kpis">
          <${Card} className="patient-kpi"><span>Mejoría en síntomas</span><strong className=${summary?.improvement >= 0 ? 'good-text' : 'danger-text'}>${summary ? percent(summary.improvement) : '—'}</strong><small>${summary ? `${summary.primary.code}: ${summary.baseline} → ${summary.current}` : 'Registre una escala para calcular el cambio'}</small><div className="meter"><i style=${{ width: `${Math.min(100, Math.max(0, summary?.improvement || 0))}%` }}></i></div></${Card}>
          <${Card} className="patient-kpi"><span>Funcionamiento diario</span><strong className=${patient.functioningChange >= 0 ? 'good-text' : 'danger-text'}>${patient.functioningChange >= 0 ? '+' : ''}${patient.functioningChange || 0}%</strong><small>Cambio reportado desde el valor inicial</small><${Sparkline} values=${[0, Math.round((patient.functioningChange || 0) * .2), Math.round((patient.functioningChange || 0) * .45), Math.round((patient.functioningChange || 0) * .7), patient.functioningChange || 0]} tone="teal"/></${Card}>
          <${Card} className="patient-kpi"><span>Adherencia al tratamiento</span><strong>${patient.adherence}%</strong><small>Estimación de cuánto cumple la indicación</small><div className="meter purple"><i style=${{ width: `${Math.max(0, Math.min(100, patient.adherence))}%` }}></i></div></${Card}>
          <${Card} className="patient-kpi"><span>Efectos y seguridad</span><strong>${activeAdverse.length}</strong><small>efectos observados activos</small><${Badge} tone=${patientAlerts.length ? 'warning' : 'success'} dot=${true}>${patientAlerts.length ? `${patientAlerts.length} pendiente(s)` : 'Sin alertas abiertas'}</${Badge}></${Card}>
        </div>

        <div className="dashboard-grid">
          <${Card} tour="patient-trend" className="span-8" title="Cómo ha cambiado el paciente" subtitle="Compare mediciones clínicas o cambios de dosis a lo largo del tiempo." action=${html`<div className="segmented small"><button className=${this.state.chartMode === 'scales' ? 'active' : ''} onClick=${() => this.setState({ chartMode: 'scales' })}>Síntomas</button><button className=${this.state.chartMode === 'dose' ? 'active' : ''} onClick=${() => this.setState({ chartMode: 'dose' })}>Dosis</button></div>`}>
            ${this.state.chartMode === 'scales' ? html`<div><div className="chart-summary patient-chart-summary"><div><span>Puntaje inicial</span><strong>${summary?.baseline ?? '—'}</strong></div><div><span>Puntaje actual</span><strong>${summary?.current ?? '—'}</strong></div><div><span>Cambio</span><strong>${summary ? summary.absoluteChange : '—'}</strong></div><div><span>Lectura</span><b>${summary?.label || 'Sin suficientes datos'}</b></div></div><${LineChart} series=${patient.assessments.slice(0, 3).map(item => ({ label: item.code, points: item.points }))}/></div>` : html`<div><div className="chart-summary patient-chart-summary"><div><span>Medicamento</span><strong>${primaryMedication?.name || '—'}</strong></div><div><span>Dosis inicial</span><strong>${primaryMedication?.doseHistory?.[0]?.dose || '—'}</strong></div><div><span>Dosis actual</span><strong>${primaryMedication?.dose || '—'}</strong></div><div><span>Días con tratamiento</span><b>${exposureDays}</b></div></div><${LineChart} series=${doseSeries}/></div>`}
            <div className="clinical-footnote"><${Icon} name="shield" size=${17}/> La gráfica ayuda a ver coincidencias temporales. Por sí sola no confirma que el medicamento produjo la mejoría o el efecto.</div>
          </${Card}>

          <${Card} tour="patient-treatment-summary" className="span-4 treatment-analysis" title="Resumen del tratamiento">
            <div className="treatment-name"><span className="medication-icon"><${Icon} name="medication"/></span><div><h3>${primaryMedication?.name || 'Sin medicamento'}</h3><p>${primaryMedication?.dose || '—'} · ${primaryMedication?.frequency || 'Sin frecuencia'}</p></div></div>
            <dl><div><dt>Días con tratamiento</dt><dd>${exposureDays}</dd></div><div><dt>Motivo del medicamento</dt><dd>${primaryMedication?.indication || 'Sin registrar'}</dd></div><div><dt>Adherencia</dt><dd>${patient.adherence}%</dd></div><div><dt>Efectos activos</dt><dd>${activeAdverse.length}</dd></div></dl>
            <div className=${`analysis-conclusion ${patientAlerts.length ? 'attention' : ''}`}><${Icon} name=${patientAlerts.length ? 'alert' : 'shield'} size=${21}/><div><b>${clinicalLabel(patient.status)}</b><p>${patientAlerts.length ? 'Hay información que conviene revisar antes de tomar una decisión terapéutica.' : 'Los datos muestran una evolución estable o favorable durante el periodo registrado.'}</p></div></div>
            <button className="text-button full" onClick=${() => this.openReport(patient)}>Abrir resumen imprimible <${Icon} name="chevronRight" size=${16}/></button>
          </${Card}>
        </div>

        <div className="dashboard-grid lower-grid">
          <${Card} tour="patient-wellbeing" className="span-7" title="Sueño, peso y estado diario">
            <div className="wellbeing-grid"><div><span>Sueño inicial</span><b>${patient.sleepBaseline ?? '—'}${patient.sleepBaseline !== null ? ' h' : ''}</b></div><div><span>Sueño actual</span><b>${patient.sleepCurrent ?? '—'}${patient.sleepCurrent !== null ? ' h' : ''}</b></div><div><span>Peso</span><b>${patient.vitals?.weight ?? '—'}${patient.vitals?.weight ? ' kg' : ''}</b><small>${weightChange === null ? 'Sin comparación inicial' : `${weightChange >= 0 ? '+' : ''}${weightChange.toFixed(1)}% desde el valor inicial`}</small></div><div><span>Presión y pulso</span><b>${patient.vitals?.bp || '—'}</b><small>${patient.vitals?.pulse ? `Pulso ${patient.vitals.pulse} bpm` : 'Sin pulso registrado'}</small></div></div>
            <div className="mini-insight"><${Icon} name="activity"/><p>Estos datos ayudan a distinguir entre <b>mejoría de síntomas</b>, funcionamiento y posibles efectos físicos del tratamiento.</p></div>
          </${Card}>
          <${Card} tour="patient-next-review" className="span-5" title="Qué revisar después" action=${html`<${Badge} tone=${patientAlerts.length ? 'warning' : 'success'}>${patientAlerts.length ? `${patientAlerts.length} pendiente(s)` : 'Al día'}</${Badge}>`}>
            <div className="task-list">${patientAlerts.slice(0, 3).map(alert => html`<div key=${alert.id} className="task-row"><span className=${`task-icon task-${alert.severity}`}><${Icon} name="alert" size=${17}/></span><div><b>${alert.title}</b><small>${alert.detail}</small></div><button aria-label="Marcar alerta revisada" onClick=${() => this.acknowledgeAlert(alert.id)}><${Icon} name="check" size=${17}/></button></div>`)}<div className="task-row"><span className="task-icon task-low"><${Icon} name="calendar" size=${17}/></span><div><b>Próxima consulta</b><small>${patient.nextVisit ? formatDateTime(patient.nextVisit) : 'No programada'}</small></div><button aria-label="Agendar cita" onClick=${() => this.openNewAppointment(patient.nextVisit ? new Date(patient.nextVisit) : new Date(), patient.id)}><${Icon} name="chevronRight" size=${17}/></button></div></div>
          </${Card}>
        </div>
      </div>` : null}

      ${this.state.patientTab === 'medications' ? html`<div className="dashboard-grid" data-tour="medication-section">
        <${Card} className="span-12" title="Medicamentos del paciente" subtitle="Agregue tratamientos, registre cambios de dosis o marque un medicamento como pausado o finalizado." action=${html`<${Button} icon="plus" onClick=${() => this.openMedication(patient)}>Agregar medicamento</${Button}>`}>
          ${patient.medications.length ? html`<div className="medication-list">${patient.medications.map(medication => html`<article key=${medication.id} className=${`medication-card ${medication.status !== 'active' ? 'medication-inactive' : ''}`}><div className="medication-card-head"><div className="inline-title"><span className="medication-icon"><${Icon} name="medication"/></span><div><span className="eyebrow">${medication.class}</span><h3>${medication.name}</h3><p>${medication.indication}</p></div></div><div>${medication.isPrimary ? html`<${Badge} tone="purple">Principal</${Badge}>` : null}<${Badge} tone=${medication.status === 'active' ? 'success' : medication.status === 'held' ? 'warning' : 'neutral'} dot=${true}>${medication.status === 'active' ? 'Activo' : medication.status === 'held' ? 'En pausa' : 'Finalizado'}</${Badge}></div></div><div className="medication-main-dose"><span>Dosis actual</span><strong>${medication.dose}</strong><small>${medication.frequency} · vía ${medication.route}</small></div><div className="medication-info-grid"><div><span>Inicio</span><b>${formatDate(medication.startDate)}</b></div><div><span>Días registrados</span><b>${daysBetween(medication.startDate)}</b></div><div><span>Uso según necesidad</span><b>${medication.isPrn ? 'Sí' : 'No'}</b></div><div><span>Cambios de dosis</span><b>${medication.doseHistory?.length || 0}</b></div></div><div className="dose-history-mini"><span>Historial de dosis</span><div>${[...(medication.doseHistory || [])].sort((left, right) => new Date(left.date) - new Date(right.date)).map(item => html`<div key=${item.id}><time>${formatDate(item.date)}</time><b>${item.dose}</b><small>${item.reason}</small></div>`)}</div></div><div className="medication-actions" data-tour="medication-status">${medication.status === 'active' ? html`<${Button} tone="secondary" icon="edit" onClick=${() => this.openDose(patient, medication.id)}>Cambiar dosis</${Button}><${Button} tone="soft" onClick=${() => this.changeMedicationStatus(patient, medication, 'held')}>Pausar</${Button}><${Button} tone="secondary" onClick=${() => this.changeMedicationStatus(patient, medication, 'stopped')}>Finalizar</${Button}>` : medication.status === 'held' ? html`<${Button} tone="secondary" icon="refresh" onClick=${() => this.changeMedicationStatus(patient, medication, 'active')}>Reactivar</${Button}><${Button} tone="secondary" onClick=${() => this.changeMedicationStatus(patient, medication, 'stopped')}>Finalizar</${Button}>` : null}</div></article>`)}</div>` : html`<${EmptyState} icon="medication" title="Sin medicamentos registrados" text="Agregue el primer medicamento para comenzar a relacionar dosis, evolución y controles." action=${html`<${Button} icon="plus" onClick=${() => this.openMedication(patient)}>Agregar medicamento</${Button}>`}/>`}
        </${Card}>
        <${Card} className="span-7" title="Cambio de dosis del medicamento principal" subtitle="Cada cambio conserva la dosis anterior, la fecha y el motivo."><${LineChart} series=${doseSeries}/></${Card}>
        <${Card} className="span-5" title="Cómo leer esta sección"><div className="glossary compact"><div><b>Dosis actual</b><p>La cantidad que el paciente tiene indicada en este momento.</p></div><div><b>Historial de dosis</b><p>Permite ver cuándo se inició, aumentó, redujo, pausó o finalizó un tratamiento.</p></div><div><b>Medicamento principal</b><p>Es el tratamiento que el dashboard usa como referencia visual principal. Puede haber otros medicamentos activos.</p></div></div></${Card}>
      </div>` : null}

      ${this.state.patientTab === 'followup' ? html`<div className="dashboard-grid" data-tour="followup-section">
        <${Card} className="span-8" title="Escalas y evolución clínica" subtitle="Cada fila compara el primer valor con el más reciente." action=${html`<${Button} icon="plus" onClick=${() => this.openAssessment(patient)}>Registrar evolución</${Button}>`}>
          ${patient.assessments.length ? html`<div className="assessment-list">${patient.assessments.map(assessment => {
            const points = [...assessment.points].sort((left, right) => new Date(left.date) - new Date(right.date));
            const baseline = Number(points[0]?.value);
            const current = Number(points.at(-1)?.value);
            const improvement = baseline ? (assessment.direction === 'higher' ? current - baseline : baseline - current) / Math.abs(baseline) * 100 : 0;
            return html`<div key=${assessment.code} className="assessment-row"><div className="scale-code">${assessment.code}</div><div><b>${assessment.label}</b><small>Última medición: ${formatDate(points.at(-1)?.date)}</small></div><div><span>Inicial</span><b>${baseline}</b></div><div><span>Actual</span><b>${current}</b></div><div><span>Cambio favorable</span><b className=${improvement >= 25 ? 'good-text' : ''}>${percent(improvement)}</b></div><${Sparkline} values=${points.map(point => Number(point.value))} tone="teal"/></div>`;
          })}</div>` : html`<${EmptyState} icon="analytics" title="Sin escalas registradas" text="Registre una evaluación para calcular la evolución." action=${html`<${Button} icon="plus" onClick=${() => this.openAssessment(patient)}>Registrar evolución</${Button}>`}/>`}
        </${Card}>
        <${Card} className="span-4" title="Estado actual"><div className="control-summary"><div><span>Estado clínico</span><b>${clinicalLabel(patient.status)}</b></div><div><span>Riesgo registrado</span><b>${riskLabel(patient.risk)}</b></div><div><span>Adherencia</span><b>${patient.adherence}%</b></div><div><span>Funcionamiento</span><b>${patient.functioningChange >= 0 ? '+' : ''}${patient.functioningChange}%</b></div></div><${Button} tone="secondary" icon="analytics" onClick=${() => this.openAssessment(patient)}>Actualizar evolución</${Button}></${Card}>
        <${Card} className="span-12" title="Controles físicos" subtitle="Peso, presión, pulso, sueño y apetito ayudan a vigilar tolerabilidad y salud general." action=${html`<${Button} tone="soft" icon="plus" onClick=${() => this.openVitals(patient)}>Nuevo control</${Button}>`}>
          ${patient.vitalsHistory?.length ? html`<div className="table-wrap"><table className="data-table"><thead><tr><th>Fecha</th><th>Peso</th><th>IMC</th><th>Presión</th><th>Pulso</th><th>Sueño</th></tr></thead><tbody>${[...patient.vitalsHistory].sort((left, right) => new Date(right.date) - new Date(left.date)).map(record => html`<tr key=${record.id}><td>${formatDate(record.date)}</td><td><b>${record.weight ?? '—'}${record.weight ? ' kg' : ''}</b></td><td>${record.bmi ?? '—'}</td><td>${record.bp || '—'}</td><td>${record.pulse ? `${record.pulse} bpm` : '—'}</td><td>${record.sleepCurrent !== null && record.sleepCurrent !== undefined ? `${record.sleepCurrent} h` : '—'}</td></tr>`)}</tbody></table></div>` : html`<${EmptyState} icon="activity" title="Sin controles físicos" text="Registre el primer control para crear una tendencia."/>`}
        </${Card}>
      </div>` : null}

      ${this.state.patientTab === 'safety' ? html`<div className="dashboard-grid" data-tour="safety-section">
        <${Card} className="span-7" title="Efectos observados" subtitle="Registre qué apareció, cuándo y qué relación temporal nota. El sistema no confirma causalidad." action=${html`<${Button} tone="soft" icon="plus" onClick=${() => this.openAdverse(patient)}>Registrar efecto</${Button}>`}>
          ${patient.adverseEvents.length ? html`<div className="adverse-list">${patient.adverseEvents.map(event => html`<div key=${event.id} className="adverse-card"><span className=${`adverse-icon adverse-${event.severity}`}><${Icon} name="alert"/></span><div><div><h4>${event.name}</h4><${Badge} tone=${event.severity === 'moderate' || event.severity === 'severe' ? 'warning' : 'neutral'}>${severityLabel(event.severity)}</${Badge}><${Badge} tone=${event.status === 'resolved' ? 'success' : 'purple'}>${statusLabel(event.status)}</${Badge}></div><p>${event.relation}</p><small>Inicio: ${formatDate(event.onset)}${event.actionTaken ? ` · Acción: ${event.actionTaken}` : ''}</small><div className="adverse-actions"><${Button} tone="secondary" icon=${event.status === 'resolved' ? 'refresh' : 'check'} onClick=${() => this.updateAdverseStatus(patient.id, event.id, event.status === 'resolved' ? 'active' : 'resolved')}>${event.status === 'resolved' ? 'Reabrir' : 'Marcar resuelto'}</${Button}></div></div></div>`)}</div>` : html`<${EmptyState} icon="shield" title="Sin efectos observados" text="No hay efectos adversos registrados en el periodo mostrado." action=${html`<${Button} tone="soft" icon="plus" onClick=${() => this.openAdverse(patient)}>Registrar efecto</${Button}>`}/>`}
        </${Card}>
        <${Card} className="span-5" title="Datos físicos actuales"><div className="safety-stats"><div><span>Peso actual</span><b>${patient.vitals?.weight ?? '—'}${patient.vitals?.weight ? ' kg' : ''}</b><small>${weightChange === null ? 'Sin comparación' : `${weightChange >= 0 ? '+' : ''}${weightChange.toFixed(1)}% desde el valor inicial`}</small></div><div><span>IMC</span><b>${patient.vitals?.bmi ?? '—'}</b><small>Interpretar según contexto individual</small></div><div><span>Presión arterial</span><b>${patient.vitals?.bp || '—'}</b><small>${patient.vitals?.pulse ? `Pulso ${patient.vitals.pulse} bpm` : 'Pulso no registrado'}</small></div><div><span>Sueño</span><b>${patient.sleepCurrent ?? '—'}${patient.sleepCurrent !== null ? ' h' : ''}</b><small>${patient.sleepBaseline !== null ? `Inicial ${patient.sleepBaseline} h` : 'Sin valor inicial'}</small></div></div><${Button} tone="secondary" icon="activity" onClick=${() => this.openVitals(patient)}>Actualizar control físico</${Button}></${Card}>
        <${Card} className="span-8" title="Laboratorios" subtitle="Guarde resultados y marque si el laboratorio los reporta fuera de rango." action=${html`<${Button} tone="soft" icon="plus" onClick=${() => this.openLab(patient)}>Nuevo resultado</${Button}>`}>
          ${patient.labs.length ? html`<div className="table-wrap"><table className="data-table"><thead><tr><th>Prueba</th><th>Resultado</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>${[...patient.labs].sort((left, right) => new Date(right.date) - new Date(left.date)).map(lab => html`<tr key=${lab.id}><td><b>${lab.name}</b></td><td><strong>${lab.value}</strong> <small>${lab.unit}</small></td><td>${formatDate(lab.date)}</td><td><${Badge} tone=${lab.status === 'normal' ? 'success' : 'warning'} dot=${true}>${lab.status === 'normal' ? 'En rango' : 'Revisar'}</${Badge}></td></tr>`)}</tbody></table></div>` : html`<${EmptyState} icon="file" title="Sin resultados" text="Agregue un laboratorio cuando sea pertinente para el tratamiento."/>`}
        </${Card}>
        <${Card} tour="patient-alerts" className="span-4" title="Alertas del paciente" action=${html`<${Badge} tone=${patientAlerts.length ? 'danger' : 'success'}>${patientAlerts.length} abiertas</${Badge}>`}><div className="alert-list">${patientAlerts.length ? patientAlerts.map(alert => html`<div className="alert-detail compact-detail" key=${alert.id}><span className=${`alert-indicator alert-${alert.severity}`}></span><div><span>${alert.category}</span><h4>${alert.title}</h4><p>${alert.detail}</p><small>${formatDateTime(alert.createdAt)}</small></div><${Button} tone="secondary" icon="check" onClick=${() => this.acknowledgeAlert(alert.id)}>Revisada</${Button}></div>`) : html`<${EmptyState} icon="shield" title="Sin alertas abiertas" text="No hay señales pendientes en este momento."/>`}</div></${Card}>
      </div>` : null}

      ${this.state.patientTab === 'prescriptions' ? html`<div className="dashboard-grid prescriptions-view">
        <${Card} tour="prescriptions-section" className="span-12" title="Recetas del paciente" subtitle="Genere una receta membretada, guárdela en el expediente y ábrala para imprimir o guardar como PDF." action=${this.can('prescriptionsCreate') ? html`<${Button} icon="prescription" onClick=${() => this.openPrescription(patient)}>Nueva receta</${Button}>` : null}>
          ${(patient.prescriptions || []).length ? html`<div className="prescription-list">${patient.prescriptions.map(prescription => html`<article key=${prescription.id} className="prescription-card"><div className="prescription-card-icon"><${Icon} name="prescription" size=${22}/></div><div><span>${prescription.number}</span><h4>${formatLongDate(prescription.date)}</h4><p>${prescription.items.length} indicación(es) · ${prescription.diagnosis || patient.diagnosis}</p><small>Emitida por ${prescription.doctorName || this.state.data.organization.clinician}</small></div><div className="prescription-card-items">${prescription.items.slice(0, 3).map(item => html`<span key=${item.id}><b>${item.medication}</b> ${item.strength}</span>`)}</div><${Button} tone="secondary" icon="print" onClick=${() => this.printPrescription(prescription, patient.id)}>Imprimir</${Button}></article>`)}</div>` : html`<${EmptyState} icon="prescription" title="Aún no hay recetas" text="La receta se genera con el membrete configurado por el médico." action=${this.can('prescriptionsCreate') ? html`<${Button} icon="plus" onClick=${() => this.openPrescription(patient)}>Crear primera receta</${Button}>` : null}/>`}
        </${Card}>
      </div>` : null}

      ${this.state.patientTab === 'timeline' ? this.renderPatientTimeline(patient, patientAppointments) : null}
    </div>`;
  }

  renderPatientTimeline(patient, patientAppointments) {
    const allEvents = [
      ...(patient.timeline || []),
      ...patientAppointments.map(appointment => ({ date: appointment.start, type: 'appointment', title: `Consulta ${statusLabel(appointment.status).toLowerCase()}`, detail: `${appointment.type} · ${appointment.modality}. ${appointment.notes || ''}` })),
    ].sort((left, right) => new Date(right.date) - new Date(left.date));
    const filterMap = { medications: 'medication', assessments: 'assessment', effects: 'alert', vitals: 'vital', labs: 'lab', documents: 'document', appointments: 'appointment' };
    const filtered = this.state.timelineFilter === 'all' ? allEvents : allEvents.filter(item => item.type === filterMap[this.state.timelineFilter]);
    const filters = [['all', 'Todo'], ['medications', 'Medicamentos'], ['assessments', 'Escalas'], ['effects', 'Efectos'], ['vitals', 'Controles'], ['labs', 'Laboratorios'], ['documents', 'Recetas'], ['appointments', 'Citas']];
    return html`<${Card} tour="timeline-section" className="timeline-full" title="Historial completo" subtitle="Una sola secuencia con medicamentos, mediciones, laboratorios, efectos y citas." action=${html`<div className="segmented small timeline-filter">${filters.map(([key, label]) => html`<button key=${key} className=${this.state.timelineFilter === key ? 'active' : ''} onClick=${() => this.setState({ timelineFilter: key })}>${label}</button>`)}</div>`}><div className="timeline-list large">${filtered.length ? filtered.map((item, index) => html`<div key=${`${item.date}_${index}`} className="timeline-row"><time>${formatDate(item.date)}<small>${formatTime(item.date)}</small></time><span className=${`timeline-icon timeline-${item.type}`}><${Icon} name=${item.type === 'medication' ? 'medication' : item.type === 'assessment' ? 'analytics' : item.type === 'lab' ? 'file' : item.type === 'appointment' ? 'calendar' : item.type === 'document' ? 'prescription' : item.type === 'vital' ? 'activity' : 'alert'} size=${18}/></span><div><b>${item.title}</b><p>${item.detail}</p></div></div>`) : html`<${EmptyState} icon="file" title="Sin eventos en este filtro" text="Seleccione “Todo” para ver el historial completo."/>`}</div></${Card}>`;
  }

  updateSetting = (key, value) => {
    this.setState(prev => ({
      data: {
        ...prev.data,
        settings: { ...prev.data.settings, [key]: value },
      },
    }), () => this.notify('Preferencia actualizada.'));
  };

  renderAgenda() {
    if (!this.can('appointmentsManage')) return html`<${EmptyState} icon="shield" title="Acceso restringido" text="Este usuario no tiene permiso para gestionar la agenda."/>`;
    const { appointments, patients } = this.state.data;
    const cursor = new Date(this.state.calendarDate);
    const view = this.state.calendarView;
    const now = new Date();
    const upcoming = appointments
      .filter(item => new Date(item.start) >= now && item.status !== 'cancelled')
      .sort((left, right) => new Date(left.start) - new Date(right.start))
      .slice(0, 8);
    const reminderQueue = getReminderQueue(this.state.data, now);
    const reminderVisible = reminderQueue
      .filter(item => item.status !== 'sent' || new Date(item.sentAt) >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
      .slice(0, 14);
    const reminderDue = reminderQueue.filter(item => item.status === 'due' || item.status === 'overdue').length;
    const reminderSent = reminderQueue.filter(item => item.status === 'sent').length;
    const move = direction => {
      const next = new Date(cursor);
      if (view === 'month') next.setMonth(next.getMonth() + direction);
      else if (view === 'week') next.setDate(next.getDate() + direction * 7);
      else next.setDate(next.getDate() + direction);
      this.setState({ calendarDate: next });
    };
    const heading = view === 'month'
      ? new Intl.DateTimeFormat('es-SV', { month: 'long', year: 'numeric' }).format(cursor)
      : view === 'week'
        ? `Semana del ${formatDate(startOfWeek(cursor), { year: false })}`
        : formatLongDate(cursor);

    return html`<div className="view-enter">
      <${PageHeader}
        eyebrow="Agenda y recordatorios"
        title="Citas"
        subtitle="Organice consultas y prepare recordatorios desde una sola pantalla."
        actions=${html`<div className="tour-actions-group">${this.can('exportsManage') ? html`<${Button} tone="secondary" icon="download" onClick=${() => downloadAllICS(appointments.filter(item => item.status !== 'cancelled'))}>Exportar agenda</${Button}>` : null}<${Button} icon="plus" onClick=${() => this.openNewAppointment(cursor)}>Nueva cita</${Button}></div>`}
      />
      <div className="calendar-layout">
        <${Card} tour="agenda-calendar" className="calendar-main">
          <div className="calendar-toolbar">
            <div className="calendar-nav" data-tour="agenda-views"><button className="icon-button" aria-label="Periodo anterior" onClick=${() => move(-1)}><${Icon} name="chevronLeft"/></button><button className="today-button" onClick=${() => this.setState({ calendarDate: new Date() })}>Hoy</button><button className="icon-button" aria-label="Periodo siguiente" onClick=${() => move(1)}><${Icon} name="chevronRight"/></button><h2>${heading}</h2></div>
            <div className="segmented">${[['month', 'Mes'], ['week', 'Semana'], ['day', 'Día']].map(([key, label]) => html`<button key=${key} className=${view === key ? 'active' : ''} onClick=${() => this.setState({ calendarView: key })}>${label}</button>`)}</div>
          </div>
          ${view === 'month' ? this.renderMonthCalendar(cursor, appointments) : view === 'week' ? this.renderWeekCalendar(cursor, appointments) : this.renderDayCalendar(cursor, appointments)}
          <div className="calendar-tip"><${Icon} name="help" size=${16}/><span>Seleccione un día para crear una cita. Abra una cita para editarla, cambiar su estado o preparar el recordatorio.</span></div>
        </${Card}>
        <${Card} className="upcoming-card" title="Próximas citas" action=${html`<${Badge} tone="blue">${upcoming.length}</${Badge}>`}>
          <div className="upcoming-list">${upcoming.length ? upcoming.map(appointment => {
            const patient = patients.find(item => item.id === appointment.patientId);
            return html`<button key=${appointment.id} onClick=${() => this.setState({ appointmentDetails: appointment })}><div className="date-box"><b>${new Date(appointment.start).getDate()}</b><span>${new Intl.DateTimeFormat('es-SV', { month: 'short' }).format(new Date(appointment.start))}</span></div><div><b>${appointment.title}</b><small>${formatTime(appointment.start)} · ${appointment.type}</small></div><${Avatar} patient=${patient} size="sm"/></button>`;
          }) : html`<${EmptyState} icon="calendar" title="Sin citas próximas" text="Cree una cita para comenzar."/>`}</div>
          <a className="button button-secondary full-width" href="https://calendar.google.com/calendar/u/0/r" target="_blank" rel="noreferrer"><${Icon} name="external" size=${18}/><span>Abrir Google Calendar</span></a>
        </${Card}>
      </div>

      <${Card}
        tour="appointment-reminders"
        className="reminder-workspace"
        title="Recordatorios de citas"
        subtitle="La aplicación calcula cuándo corresponde recordar cada cita según la configuración del médico."
        action=${html`<div className="reminder-heading-badges"><${Badge} tone=${reminderDue ? 'warning' : 'success'}>${reminderDue} por enviar</${Badge}><${Badge} tone="neutral">${reminderSent} enviados</${Badge}></div>`}
      >
        <div className="reminder-config-summary"><span><${Icon} name="clock" size=${17}/> Momentos configurados:</span><div>${(this.state.data.settings?.reminderHours || [24, 8]).map(hours => html`<${Badge} key=${hours} tone="blue">${reminderLabel(hours)}</${Badge}>`)}</div>${this.can('settingsManage') ? html`<button className="text-button" onClick=${() => this.setView('settings')}>Cambiar tiempos <${Icon} name="chevronRight" size=${15}/></button>` : null}</div>
        <div className="reminder-table">
          ${reminderVisible.length ? reminderVisible.map(reminder => {
            const patient = reminder.patient;
            const statusText = reminder.status === 'due' ? 'Listo para enviar' : reminder.status === 'overdue' ? 'Pendiente' : reminder.status === 'sent' ? 'Enviado' : 'Programado';
            const tone = reminder.status === 'due' || reminder.status === 'overdue' ? 'warning' : reminder.status === 'sent' ? 'success' : 'neutral';
            return html`<article key=${reminder.id} className=${`reminder-row reminder-row-${reminder.status}`}>
              <${Avatar} patient=${patient}/>
              <div className="reminder-person"><b>${patient?.name || reminder.appointment.title}</b><small>${patient?.phone || 'Sin teléfono registrado'}</small></div>
              <div><span>Cita</span><b>${formatDateTime(reminder.appointment.start)}</b><small>${reminder.appointment.type} · ${reminder.appointment.modality}</small></div>
              <div><span>Recordatorio</span><b>${reminderLabel(reminder.hours)}</b><small>${reminder.status === 'sent' ? `Enviado ${formatDateTime(reminder.sentAt)}` : `Disponible ${formatDateTime(reminder.dueAt)}`}</small></div>
              <${Badge} tone=${tone}>${statusText}</${Badge}>
              <div className="reminder-actions">${reminder.status !== 'sent' && this.can('remindersManage') ? html`<${Button} tone="soft" icon="message" onClick=${() => this.sendReminderWhatsApp(reminder)}>WhatsApp</${Button}><${Button} tone="secondary" onClick=${() => this.copyReminderMessage(reminder)}>Copiar</${Button}><button className="reminder-done" title="Marcar como enviado" onClick=${() => this.completeReminder(reminder, 'manual')}><${Icon} name="check" size=${17}/></button>` : html`<span className="reminder-complete"><${Icon} name="check" size=${16}/> Registrado</span>`}</div>
            </article>`;
          }) : html`<${EmptyState} icon="message" title="Sin recordatorios en cola" text="Los recordatorios aparecerán cuando se acerquen las próximas citas."/>`}
        </div>
        <div className="clinical-footnote"><${Icon} name="shield" size=${17}/> En esta versión, WhatsApp abre un mensaje preparado y el usuario confirma el envío. El sistema no envía mensajes automáticamente sin autorización.</div>
      </${Card}>
    </div>`;
  }

  renderMonthCalendar(cursor, appointments) {
    const days = monthMatrix(cursor.getFullYear(), cursor.getMonth());
    const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return html`<div className="month-calendar"><div className="weekday-row">${weekdays.map(day => html`<div key=${day}>${day}</div>`)}</div><div className="month-grid">${days.map(day => {
      const events = appointments.filter(item => isSameDay(item.start, day) && item.status !== 'cancelled').sort((left, right) => new Date(left.start) - new Date(right.start));
      const outside = day.getMonth() !== cursor.getMonth();
      const today = isSameDay(day, new Date());
      return html`<div key=${day.toISOString()} className=${`calendar-day ${outside ? 'outside' : ''} ${today ? 'today' : ''}`}><button className="day-number" aria-label=${`Crear cita el ${formatDate(day)}`} onClick=${() => this.openNewAppointment(day)}>${day.getDate()}</button><div className="day-events">${events.slice(0, 3).map(appointment => html`<button key=${appointment.id} className=${`calendar-event event-status-${appointment.status}`} onClick=${() => this.setState({ appointmentDetails: appointment })}><span>${formatTime(appointment.start)}</span><b>${appointment.title.split(' ')[0]}</b></button>`)}${events.length > 3 ? html`<small>+${events.length - 3} más</small>` : null}</div></div>`;
    })}</div></div>`;
  }

  renderWeekCalendar(cursor, appointments) {
    const start = startOfWeek(cursor);
    const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date; });
    return html`<div className="week-calendar"><div className="week-head"><div></div>${days.map(day => html`<button key=${day.toISOString()} className=${isSameDay(day, new Date()) ? 'today' : ''} onClick=${() => this.setState({ calendarDate: day, calendarView: 'day' })}><span>${new Intl.DateTimeFormat('es-SV', { weekday: 'short' }).format(day)}</span><b>${day.getDate()}</b></button>`)}</div><div className="week-body"><div className="time-axis">${Array.from({ length: 10 }, (_, index) => html`<span key=${index}>${8 + index}:00</span>`)}</div>${days.map(day => html`<div key=${day.toISOString()} className="week-column" onDoubleClick=${() => this.openNewAppointment(day)}>${Array.from({ length: 10 }, (_, index) => html`<i key=${index}></i>`)}${appointments.filter(item => isSameDay(item.start, day) && item.status !== 'cancelled').map(appointment => {
      const date = new Date(appointment.start);
      const top = Math.max(0, (date.getHours() - 8) * 70 + date.getMinutes() / 60 * 70);
      const height = Math.max(44, (new Date(appointment.end) - date) / 60000 / 60 * 70);
      return html`<button key=${appointment.id} className="week-event" style=${{ top: `${top}px`, height: `${height}px` }} onClick=${() => this.setState({ appointmentDetails: appointment })}><b>${formatTime(appointment.start)}</b><span>${appointment.title}</span><small>${appointment.type}</small></button>`;
    })}</div>`)}</div></div>`;
  }

  renderDayCalendar(cursor, appointments) {
    const events = appointments.filter(item => isSameDay(item.start, cursor) && item.status !== 'cancelled').sort((left, right) => new Date(left.start) - new Date(right.start));
    return html`<div className="day-view"><div className="day-view-header"><div className=${isSameDay(cursor, new Date()) ? 'today' : ''}><span>${new Intl.DateTimeFormat('es-SV', { weekday: 'long' }).format(cursor)}</span><strong>${cursor.getDate()}</strong><small>${new Intl.DateTimeFormat('es-SV', { month: 'long' }).format(cursor)}</small></div><p>${events.length} cita${events.length === 1 ? '' : 's'} programada${events.length === 1 ? '' : 's'}</p><${Button} tone="soft" icon="plus" onClick=${() => this.openNewAppointment(cursor)}>Agregar cita</${Button}></div><div className="day-schedule">${events.length ? events.map(appointment => {
      const patient = this.state.data.patients.find(item => item.id === appointment.patientId);
      return html`<button key=${appointment.id} onClick=${() => this.setState({ appointmentDetails: appointment })}><time>${formatTime(appointment.start)}<small>${Math.round((new Date(appointment.end) - new Date(appointment.start)) / 60000)} min</small></time><span className="schedule-line"></span><${Avatar} patient=${patient}/><div><h3>${appointment.title}</h3><p>${appointment.type} · ${appointment.modality}</p><small>${appointment.notes || 'Sin notas de preparación.'}</small></div><${Badge} tone=${appointment.status === 'confirmed' ? 'success' : appointment.status === 'pending' ? 'warning' : 'neutral'}>${statusLabel(appointment.status)}</${Badge}></button>`;
    }) : html`<${EmptyState} icon="calendar" title="Agenda libre" text="Cree una cita para este día." action=${html`<${Button} icon="plus" onClick=${() => this.openNewAppointment(cursor)}>Nueva cita</${Button}>`}/>`}</div></div>`;
  }

  renderAnalytics() {
    if (!this.can('analyticsView')) return html`<${EmptyState} icon="shield" title="Acceso restringido" text="Este usuario no tiene permiso para consultar resultados generales."/>`;
    const { patients } = this.state.data;
    const summaries = patients.map(patient => ({ patient, summary: getAssessmentSummary(patient) })).filter(item => item.summary);
    const response = summaries.filter(item => item.summary.improvement >= 50).length;
    const partial = summaries.filter(item => item.summary.improvement >= 25 && item.summary.improvement < 50).length;
    const limited = summaries.filter(item => item.summary.improvement < 25).length;
    const avgImprovement = summaries.length ? summaries.reduce((total, item) => total + item.summary.improvement, 0) / summaries.length : 0;
    const avgAdherence = patients.length ? patients.reduce((total, patient) => total + (Number(patient.adherence) || 0), 0) / patients.length : 0;
    const classes = {};
    patients.forEach(patient => {
      const name = patient.medication?.class || 'Sin clase';
      const summary = getAssessmentSummary(patient);
      if (!classes[name]) classes[name] = { count: 0, improvement: 0, adherence: 0 };
      classes[name].count += 1;
      classes[name].improvement += summary?.improvement || 0;
      classes[name].adherence += Number(patient.adherence) || 0;
    });
    return html`<div className="view-enter"><${PageHeader} eyebrow="Resultados descriptivos" title="Evolución de los pacientes" subtitle="Estos datos resumen cambios observados. No comparan causalmente medicamentos ni reemplazan una evaluación clínica." actions=${html`<${Button} tone="secondary" icon="download" onClick=${this.exportAnalytics}>Exportar CSV</${Button}>`}/>
      <div className="analytics-grid" data-tour="results-overview">
        <${Card} className="analytics-highlight"><div><span>Mejoría media observada</span><strong>${percent(avgImprovement)}</strong><p>Promedio de la escala principal de cada paciente.</p></div><${Sparkline} values=${[18, 24, 31, 39, avgImprovement]} tone="teal"/></${Card}>
        <${Card} className="analytics-highlight"><div><span>Adherencia media</span><strong>${percent(avgAdherence)}</strong><p>Estimación autorreportada registrada en seguimiento.</p></div><${Sparkline} values=${[78, 81, 85, 88, avgAdherence]} tone="purple"/></${Card}>
      </div>
      <div className="dashboard-grid">
        <${Card} className="span-7" title="Distribución de respuesta" subtitle="La interpretación se basa en la escala principal de cada expediente."><div className="response-donuts" data-tour="results-interpretation"><${Donut} value=${summaries.length ? response / summaries.length * 100 : 0} label="Respuesta significativa" caption=${response + ' pacientes'} tone="teal"/><${Donut} value=${summaries.length ? partial / summaries.length * 100 : 0} label="Respuesta parcial" caption=${partial + ' pacientes'} tone="purple"/><${Donut} value=${summaries.length ? limited / summaries.length * 100 : 0} label="Cambio limitado" caption=${limited + ' pacientes'} tone="coral"/></div><div className="clinical-footnote"><${Icon} name="shield" size=${17}/> Los umbrales son descriptivos y deben validarse por escala, diagnóstico y contexto clínico.</div></${Card}>
        <${Card} className="span-5" title="Seguridad y seguimiento"><div className="safety-overview"><div><strong>${patients.filter(patient => patient.adverseEvents.some(event => event.status === 'active')).length}</strong><span>con efecto activo</span></div><div><strong>${patients.filter(patient => patient.labs.some(lab => lab.status !== 'normal')).length}</strong><span>con laboratorio a revisar</span></div><div><strong>${patients.filter(patient => patient.adherence < 80).length}</strong><span>con adherencia menor de 80%</span></div></div></${Card}>
        <${Card} className="span-12" title="Resumen por clase de medicamento" subtitle="Se muestra el cambio observado en esta base sintética, no la efectividad comparativa de la clase."><div className="table-wrap"><table className="data-table"><thead><tr><th>Clase</th><th>Pacientes</th><th>Mejoría media</th><th>Adherencia media</th></tr></thead><tbody>${Object.entries(classes).map(([name, values]) => html`<tr key=${name}><td><b>${name}</b></td><td>${values.count}</td><td><div className="progress-inline wide"><span><i style=${{ width: `${Math.max(0, Math.min(100, values.improvement / values.count))}%` }}></i></span><b>${percent(values.improvement / values.count)}</b></div></td><td>${percent(values.adherence / values.count)}</td></tr>`)}</tbody></table></div></${Card}>
      </div>
    </div>`;
  }

  renderAlerts() {
    if (!this.can('alertsView')) return html`<${EmptyState} icon="shield" title="Acceso restringido" text="Este usuario no tiene permiso para consultar alertas clínicas."/>`;
    const { alerts, patients } = this.state.data;
    const open = alerts.filter(item => item.status === 'open');
    const reviewed = alerts.filter(item => item.status !== 'open');
    return html`<div className="view-enter"><${PageHeader} eyebrow="Revisión priorizada" title="Alertas" subtitle="Las alertas llaman la atención del profesional. No cambian un tratamiento automáticamente." actions=${html`<${Badge} tone=${open.length ? 'danger' : 'success'}>${open.length} abiertas</${Badge}>`}/>
      <div className="alert-summary"><div><span className="alert-indicator alert-high"></span><strong>${open.filter(item => item.severity === 'high' || item.severity === 'critical').length}</strong><p>Alta prioridad</p></div><div><span className="alert-indicator alert-medium"></span><strong>${open.filter(item => item.severity === 'medium').length}</strong><p>Prioridad media</p></div><div><span className="alert-indicator alert-low"></span><strong>${open.filter(item => item.severity === 'low').length}</strong><p>Seguimiento</p></div><div><${Icon} name="check"/><strong>${reviewed.length}</strong><p>Revisadas</p></div></div>
      <${Card} tour="alerts-worklist" title="Pendientes de revisión"><div className="alert-list full">${open.length ? open.map(alert => {
        const patient = patients.find(item => item.id === alert.patientId);
        return html`<div key=${alert.id} className="alert-detail"><span className=${`alert-indicator alert-${alert.severity}`}></span><div><span>${alert.category} · ${severityLabel(alert.severity)}</span><h4>${alert.title}</h4><p>${alert.detail}</p><small>${patient?.name || 'Paciente no disponible'} · ${formatDateTime(alert.createdAt)}</small></div><div className="alert-actions"><${Button} tone="secondary" onClick=${() => this.openPatient(alert.patientId)}>Abrir paciente</${Button}><${Button} tone="soft" icon="check" onClick=${() => this.acknowledgeAlert(alert.id)}>Marcar revisada</${Button}></div></div>`;
      }) : html`<${EmptyState} icon="shield" title="Sin alertas abiertas" text="No hay señales pendientes en este momento."/>`}</div></${Card}>
      ${reviewed.length ? html`<${Card} className="reviewed-alerts" title="Historial de alertas revisadas"><div className="alert-list compact">${reviewed.slice(0, 12).map(alert => { const patient = patients.find(item => item.id === alert.patientId); return html`<div key=${alert.id} className="alert-row passive"><span className="alert-indicator alert-reviewed"></span><div><b>${alert.title}</b><small>${patient?.name || 'Paciente'} · ${formatDate(alert.createdAt)}</small></div><${Button} tone="secondary" onClick=${() => this.reopenAlert(alert.id)}>Reabrir</${Button}></div>`; })}</div></${Card}>` : null}
    </div>`;
  }

  renderPayments() {
    const user = this.activeUser();
    const isOwner = user?.role === 'owner';
    const isDoctor = user?.role === 'doctor';
    if (!isOwner && !isDoctor) return html`<${EmptyState} icon="shield" title="Acceso restringido" text="La suscripción Linkare solo está disponible para administración y el médico titular."/>`;

    const billing = this.state.data.billing || {};
    const payments = Array.isArray(this.state.data.payments) ? this.state.data.payments : [];
    const currency = billing.currency || 'USD';
    const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value) || 0);
    const pending = payments.filter(item => item.status === 'pending');
    const paid = payments.filter(item => item.status === 'paid');
    const latestPending = pending[0] || null;
    const latestPaid = paid[0] || null;
    const wompiStatus = this.state.wompiStatus || { state: 'idle', app: null, error: '' };
    const appInfo = wompiStatus.app || {};
    const wompiStatusText = wompiStatus.state === 'ready'
      ? (appInfo.estaProductivo ? 'Conectado · Producción' : 'Conectado · Prueba')
      : wompiStatus.state === 'loading' ? 'Verificando…'
        : wompiStatus.state === 'not-configured' ? 'Falta Supabase'
          : wompiStatus.state === 'error' ? 'Error de conexión' : 'Sin verificar';

    return html`<div className="view-enter"><${PageHeader}
      eyebrow="Suscripción de la plataforma"
      title="Mi plan Linkare"
      subtitle=${isOwner ? 'Administre el precio que pagará el psiquiatra y genere un enlace único de Wompi.' : 'Revise el precio de su licencia y pague mediante el enlace seguro de Wompi.'}
      actions=${html`<div className="tour-actions-group">${isOwner ? html`<${Button} tone="secondary" icon="settings" onClick=${this.openBillingSettings}>Editar precio</${Button}><${Button} icon="plus" onClick=${this.openWompiPaymentRequest} disabled=${!supabaseConfigured}>Generar enlace Wompi</${Button}>` : latestPending?.paymentUrl ? html`<${Button} icon="external" onClick=${() => this.openPaymentLink(latestPending.paymentUrl)}>Pagar con Wompi</${Button}>` : null}<${Button} tone="secondary" icon="refresh" onClick=${this.loadWompiStatus} disabled=${wompiStatus.state === 'loading'}>Verificar Wompi</${Button}></div>`}
    />

      <div className="subscription-hero">
        <div className="subscription-plan-copy"><span className="eyebrow">Plan actual</span><h2>${billing.planName || 'Plan Profesional Linkare'}</h2><p>${billing.planDescription || 'Licencia de la plataforma Linkare.'}</p><div className="subscription-price"><strong>${money(billing.subscriptionPrice)}</strong><span>/ ${billing.billingCycle || 'mes'}</span></div></div>
        <div className="subscription-status-card"><span>Estado de la licencia</span><b>${latestPaid ? 'Pago registrado' : latestPending ? 'Pago pendiente' : 'Sin factura generada'}</b><small>${latestPaid ? `Último pago: ${formatDateTime(latestPaid.paidAt || latestPaid.createdAt)}` : latestPending ? `Periodo: ${latestPending.billingPeriod || 'actual'}` : 'Administración debe generar el enlace.'}</small>${isDoctor && latestPending?.paymentUrl ? html`<${Button} icon="external" onClick=${() => this.openPaymentLink(latestPending.paymentUrl)}>Abrir pago seguro</${Button}>` : null}</div>
      </div>

      <div className="kpi-grid"><${KpiCard} label="Precio actual" value=${money(billing.subscriptionPrice)} hint=${billing.billingCycle || 'mensual'} icon="file" tone="blue"/><${KpiCard} label="Facturas pendientes" value=${pending.length} hint="por pagar" icon="clock" tone=${pending.length ? 'coral' : 'teal'}/><${KpiCard} label="Pagos registrados" value=${paid.length} hint="historial" icon="check" tone="teal"/><${KpiCard} label="Wompi" value=${wompiStatusText} hint=${wompiStatus.state === 'ready' ? (appInfo.nombre || 'Aplicativo conectado') : (wompiStatus.error || 'Use Verificar Wompi')} icon="insurance" tone="purple"/></div>

      <div className="dashboard-grid"><${Card} className="span-7" title="Cómo funciona el cobro" subtitle="Este módulo es para que el psiquiatra pague la licencia de Linkare, no para cobrarle a pacientes."><div className="subscription-flow"><div><b>1</b><span>Administración edita el precio</span></div><i></i><div><b>2</b><span>Linkare crea un enlace único</span></div><i></i><div><b>3</b><span>El psiquiatra paga en Wompi</span></div><i></i><div><b>4</b><span>Webhook confirma en Supabase</span></div></div><div className="clinical-footnote"><${Icon} name="shield" size=${17}/> App ID y API Secret se guardan únicamente en Supabase Secrets. La tarjeta nunca se captura dentro de Linkare.</div></${Card}><${Card} className="span-5" title="Datos del pagador"><div className="billing-summary-grid"><div className="billing-summary-card"><span>Nombre</span><strong>${billing.payerName || this.state.data.organization?.clinician || 'Psiquiatra'}</strong><small>Cliente de Linkare</small></div><div className="billing-summary-card"><span>Correo</span><strong>${billing.payerEmail || 'Sin correo'}</strong><small>Recibe confirmación de Wompi</small></div><div className="billing-summary-card"><span>Modo Wompi</span><strong>${appInfo.estaProductivo ? 'Producción' : 'Prueba'}</strong><small>${wompiStatus.state === 'ready' ? 'Determinado por el aplicativo Wompi' : 'Pendiente de verificar'}</small></div></div>${isOwner ? html`<${Button} tone="secondary" icon="edit" onClick=${this.openBillingSettings}>Modificar plan y precio</${Button}>` : null}</${Card}>

        <${Card} className="span-12" title="Historial de facturación" subtitle="Los enlaces generados se guardan en Supabase y se actualizan por webhook."><div className="table-wrap"><table className="data-table"><thead><tr><th>Periodo</th><th>Concepto</th><th>Pagador</th><th>Monto</th><th>Modo</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${payments.length ? payments.map(item => html`<tr key=${item.id}><td><b>${item.billingPeriod || '—'}</b><small>${formatDate(item.createdAt)}</small></td><td>${item.description || billing.planName}</td><td>${item.payerName || billing.payerName || 'Psiquiatra'}<small>${item.payerEmail || billing.payerEmail || ''}</small></td><td>${money(item.amount)}</td><td>${item.isTest ? html`<${Badge} tone="warning">Prueba</${Badge}>` : html`<${Badge} tone="success">Producción</${Badge}>`}</td><td><${Badge} tone=${item.status === 'paid' ? 'success' : item.status === 'pending' ? 'warning' : 'neutral'}>${item.status === 'paid' ? 'Pagado' : item.status === 'pending' ? 'Pendiente' : 'Cancelado'}</${Badge}></td><td>${item.paymentUrl ? html`<button className="text-button" onClick=${() => this.openPaymentLink(item.paymentUrl)}>Abrir enlace <${Icon} name="external" size=${14}/></button>` : '—'}</td></tr>`) : html`<tr><td colSpan="7">Todavía no hay facturas.</td></tr>`}</tbody></table></div></${Card}>
      </div>
    </div>`;
  }

  renderSettings() {
    const settings = this.state.data.settings || {};
    const organization = this.state.data.organization || {};
    const users = this.state.data.users || [];
    const canSettings = this.can('settingsManage');
    const canUsers = this.can('usersManage');
    if (!canSettings && !canUsers) return html`<${EmptyState} icon="shield" title="Acceso restringido" text="Este usuario no tiene permiso para modificar la configuración."/>`;
    return html`<div className="view-enter"><${PageHeader} eyebrow="Configuración del consultorio" title="Clínica, recordatorios y equipo" subtitle="Personalice el membrete, defina cuándo recordar citas y controle lo que puede hacer cada usuario."/>
      <div className="settings-grid settings-grid-practice" data-tour="settings-options">
        <${Card} tour="clinic-branding" className="settings-wide practice-profile-card" title="Identidad del consultorio" subtitle="Estos datos aparecen en la cabecera y en las recetas.">
          <div className="practice-profile-summary">
            <div className="practice-logo-preview">${organization.clinicLogo ? html`<img src=${organization.clinicLogo} alt="Logo de la clínica"/>` : html`<${Icon} name="building" size=${30}/>`}</div>
            <div className="practice-profile-copy"><span className="eyebrow">Membrete activo</span><h3>${organization.name || 'NexaMind Clinical'}</h3><p><b>${organization.clinician || 'Profesional sin configurar'}</b> · ${organization.specialty || 'Psiquiatría'}</p><small>${[organization.professionalLicense, organization.phone, organization.email].filter(Boolean).join(' · ') || 'Agregue licencia, teléfono y correo.'}</small></div>
            <${UserAvatar} user=${users.find(user => user.role === 'doctor')} organization=${organization} size="xl"/>
          </div>
          ${canSettings ? html`<${Button} icon="edit" onClick=${this.openClinicProfile}>Editar clínica, logo y fotografía</${Button}>` : null}
        </${Card}>

        <${Card} tour="reminder-settings" className="settings-wide" title="Recordatorios de citas" subtitle="Seleccione uno o varios momentos. Se crearán para todas las citas futuras.">
          <div className="reminder-settings-grid">
            ${REMINDER_OPTIONS.map(hours => {
              const active = (settings.reminderHours || []).map(Number).includes(Number(hours));
              return html`<button key=${hours} type="button" className=${`reminder-option ${active ? 'active' : ''}`} disabled=${!canSettings} onClick=${() => this.toggleReminderHour(hours)}><span className="reminder-check"><${Icon} name=${active ? 'check' : 'clock'} size=${17}/></span><b>${reminderLabel(hours)}</b><small>${hours >= 24 ? 'Aviso anticipado' : 'Confirmación cercana'}</small></button>`;
            })}
          </div>
          <div className="reminder-explanation"><${Icon} name="message" size=${19}/><div><b>¿Cómo funciona en esta versión?</b><p>La agenda prepara la cola de recordatorios. El personal abre WhatsApp con el mensaje listo, confirma el envío y lo marca como enviado. El envío automático por WhatsApp, SMS o correo se conecta después mediante un proveedor autorizado.</p></div></div>
        </${Card}>

        ${canUsers ? html`<${Card} tour="team-permissions" className="settings-wide team-card" title="Usuarios y permisos" subtitle="La vista de secretaría oculta información clínica salvo que el médico conceda acceso." action=${html`<${Button} icon="userPlus" onClick=${this.openSecretary}>Crear secretaria</${Button}>`}>
          <div className="team-list">${users.map(user => {
            const permissionsCount = Object.values(user.permissions || {}).filter(Boolean).length;
            return html`<article key=${user.id} className=${`team-member ${user.active === false ? 'team-member-inactive' : ''}`}><${UserAvatar} user=${user} organization=${organization}/><div className="team-member-main"><b>${user.name}</b><small>${user.title || (user.role === 'secretary' ? 'Secretaría clínica' : 'Psiquiatría')} · ${user.email || 'Sin correo'}</small></div><${Badge} tone=${user.active === false ? 'neutral' : 'success'} dot=${true}>${user.active === false ? 'Inactivo' : 'Activo'}</${Badge}><div className="team-permission-summary"><span>${user.role === 'doctor' ? 'Acceso completo' : `${permissionsCount} permisos activos`}</span><small>${user.role === 'doctor' ? 'Médico responsable' : 'Vista administrativa configurable'}</small></div><div className="team-actions">${user.role !== 'doctor' ? html`<${Button} tone="secondary" icon="settings" onClick=${() => this.openUserPermissions(user)}>Permisos</${Button}><button type="button" className=${`user-status-button ${user.active === false ? 'activate' : ''}`} onClick=${() => this.toggleTeamUser(user.id)}>${user.active === false ? 'Activar' : 'Desactivar'}</button>` : html`<${Badge} tone="blue">Administrador</${Badge}>`}</div></article>`;
          })}</div>
          <div className="clinical-footnote"><${Icon} name="shield" size=${17}/> En esta demostración, “cambiar usuario” simula la vista y sus permisos en el mismo navegador. En producción, cada persona iniciará sesión con Supabase Auth y su propia contraseña.</div>
        </${Card}>` : null}

        ${canSettings ? html`<${Card} tour="settings-accessibility" title="Interfaz sencilla"><div className="setting-row"><span className="setting-icon blue"><${Icon} name="help"/></span><div><h4>Texto grande</h4><p>Aumenta letras y controles para facilitar la lectura.</p></div><label className="switch"><input type="checkbox" checked=${Boolean(settings.largeText)} onChange=${event => this.updateSetting('largeText', event.target.checked)}/><span></span></label></div><div className="setting-row"><span className="setting-icon blue"><${Icon} name="activity"/></span><div><h4>Reducir movimiento</h4><p>Desactiva transiciones y animaciones de entrada.</p></div><label className="switch"><input type="checkbox" checked=${Boolean(settings.reducedMotion)} onChange=${event => this.updateSetting('reducedMotion', event.target.checked)}/><span></span></label></div></${Card}>` : null}

        ${canSettings ? html`<${Card} tour="settings-backup" title="Respaldo local"><div className="setting-row"><span className="setting-icon green"><${Icon} name="download"/></span><div><h4>Guardar una copia</h4><p>Descarga pacientes, citas, recetas y configuración en JSON.</p></div></div><div className="settings-actions"><${Button} tone="secondary" icon="download" onClick=${this.exportBackup}>Descargar respaldo</${Button}><label className="button button-secondary file-button"><${Icon} name="upload" size=${18}/><span>Importar respaldo</span><input type="file" accept="application/json" onChange=${this.importBackup}/></label></div></${Card}>` : null}

        <${Card} tour="settings-tutorial" title="Tutorial guiado"><div className="setting-row"><span className="setting-icon blue"><${Icon} name="help"/></span><div><h4>Repasar el sistema paso a paso</h4><p>El recorrido completo explica cada pantalla, formulario, campo, receta, seguro, recordatorio y permiso.</p></div></div><div className="settings-actions"><${Button} tone="secondary" icon="activity" onClick=${() => this.startTour('quick')}>Recorrido esencial</${Button}><${Button} icon="overview" onClick=${() => this.startTour('full')}>Recorrido completo</${Button}></div></${Card}>

        ${canSettings ? html`<${Card} title="Datos de demostración"><div className="setting-row"><span className="setting-icon coral"><${Icon} name="refresh"/></span><div><h4>Restaurar información inicial</h4><p>Reemplaza cambios locales por los pacientes sintéticos originales.</p></div></div><${Button} tone="secondary" icon="refresh" onClick=${this.resetDemo}>Restaurar demo</${Button}></${Card}>` : null}

        <${Card} tour="settings-storage" title="Estado de almacenamiento"><div className="setting-row"><span className="setting-icon blue"><${Icon} name="file"/></span><div><h4>Modo local activo</h4><p>La demostración guarda datos e imágenes optimizadas en este navegador.</p></div><${Badge} tone="success" dot=${true}>Funcionando</${Badge}></div></${Card}>
      </div>
      <${Card} className="terms-card" title="Términos técnicos en palabras sencillas"><div className="term-grid"><div><b>Usuario y permisos</b><p>Definen qué pantallas y acciones puede utilizar cada persona.</p></div><div><b>Recordatorio local</b><p>La aplicación avisa cuándo corresponde enviar el mensaje, pero no lo envía sola.</p></div><div><b>Imagen optimizada</b><p>La fotografía se reduce para que cargue más rápido y ocupe menos espacio.</p></div><div><b>Receta PDF</b><p>Se abre una hoja lista para imprimir o guardar como PDF desde el navegador.</p></div><div><b>Supabase Auth</b><p>Será el inicio de sesión real y seguro cuando conectemos la base de datos.</p></div><div><b>RLS</b><p>Reglas que impiden que un usuario consulte datos que no tiene autorizados.</p></div></div></${Card}>
    </div>`;
  }

  renderModalError() {
    return this.state.modalError ? html`<div className="form-error" role="alert"><${Icon} name="alert" size=${18}/><span>${this.state.modalError}</span></div>` : null;
  }

  renderModal() {
    const modal = this.state.modal;
    if (!modal) return null;
    if (modal.type === 'patient') return this.renderPatientFormModal();
    if (modal.type === 'patientEdit') return this.renderPatientEditFormModal();
    if (modal.type === 'clinicProfile') return this.renderClinicProfileModal();
    if (modal.type === 'secretary') return this.renderSecretaryModal();
    if (modal.type === 'userPermissions') return this.renderUserPermissionsModal();
    if (modal.type === 'account') return this.renderAccountModal();
    if (modal.type === 'userSwitcher') return this.renderUserSwitcherModal();
    if (modal.type === 'billingSettings') return this.renderBillingSettingsModal();
    if (modal.type === 'paymentRequest') return this.renderPaymentRequestModal();
    if (modal.type === 'prescription') return this.renderPrescriptionModal();
    if (modal.type === 'medication') return this.renderMedicationFormModal();
    if (modal.type === 'dose') return this.renderDoseFormModal();
    if (modal.type === 'medicationStatus') return this.renderMedicationStatusFormModal();
    if (modal.type === 'assessment') return this.renderAssessmentFormModal();
    if (modal.type === 'vitals') return this.renderVitalsFormModal();
    if (modal.type === 'adverse') return this.renderAdverseFormModal();
    if (modal.type === 'lab') return this.renderLabFormModal();
    if (modal.type === 'appointment') return this.renderAppointmentFormModal();
    if (modal.type === 'report') return this.renderReportModal();
    if (modal.type === 'help') return this.renderHelpModal();
    return null;
  }

  renderPaymentRequestModal() {
    const draft = this.state.modal?.draft || {};
    return html`<${Modal} title="Generar enlace de pago Linkare" subtitle="Linkare usará el precio que administración guardó en Mi plan y generará un enlace único de Wompi para el psiquiatra." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.submitWompiPaymentRequest}>${this.renderModalError()}<fieldset><legend>Factura de la licencia</legend><div className="form-grid"><${FormField} label="Plan"><input value=${draft.planName} readOnly/></${FormField}><${FormField} label="Periodo"><input type="month" value=${draft.billingPeriod} onChange=${event => this.updateDraft('billingPeriod', event.target.value)}/></${FormField}></div><${FormField} label="Concepto" required=${true}><input value=${draft.description} onChange=${event => this.updateDraft('description', event.target.value)} placeholder="Licencia mensual Linkare" required/></${FormField}><div className="form-grid"><${FormField} label="Monto a cobrar (USD)" required=${true} hint="Este monto viene del precio guardado por administración. Para cambiarlo, cierre y use Editar precio."><input autoFocus type="number" min="0.01" step="0.01" value=${draft.amount} readOnly required/></${FormField}><${FormField} label="Nombre del psiquiatra"><input value=${draft.payerName} onChange=${event => this.updateDraft('payerName', event.target.value)} placeholder="Dra. / Dr."/></${FormField}></div><${FormField} label="Correo del psiquiatra" required=${true}><input type="email" value=${draft.customerEmail} onChange=${event => this.updateDraft('customerEmail', event.target.value)} placeholder="doctor@clinica.com" required/></${FormField}></fieldset><div className="form-information"><${Icon} name="shield" size=${19}/><div><b>Pago seguro administrado por Wompi</b><p>Linkare no recibe datos de tarjeta. El API Secret vive en Supabase, Wompi genera el checkout y el webhook confirma el pago. El servidor vuelve a leer el precio guardado para evitar modificaciones desde el navegador.</p></div></div><${FormActions} onCancel=${this.closeModal} submitLabel=${this.state.wompiBusy ? 'Generando enlace…' : 'Generar enlace Wompi'}/></form></${Modal}>`;
  }

  renderBillingSettingsModal() {
    const draft = this.state.modal?.draft || {};
    const status = this.state.wompiStatus || { state: 'idle', app: null, error: '' };
    return html`<${Modal} title="Precio y plan de Linkare" subtitle="Solo administración puede cambiar el precio que pagará el psiquiatra." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveBillingSettingsForm}>${this.renderModalError()}<fieldset><legend>Plan comercial</legend><div className="form-grid"><${FormField} label="Nombre del plan" required=${true}><input autoFocus value=${draft.planName} onChange=${event => this.updateDraft('planName', event.target.value)} required/></${FormField}><${FormField} label="Ciclo"><select value=${draft.billingCycle} onChange=${event => this.updateDraft('billingCycle', event.target.value)}><option value="mensual">Mensual</option><option value="trimestral">Trimestral</option><option value="semestral">Semestral</option><option value="anual">Anual</option><option value="único">Pago único</option></select></${FormField}></div><${FormField} label="Descripción"><textarea rows="3" value=${draft.planDescription} onChange=${event => this.updateDraft('planDescription', event.target.value)}></textarea></${FormField}><div className="form-grid"><${FormField} label="Precio" required=${true}><input type="number" step="0.01" min="0.01" value=${draft.subscriptionPrice} onChange=${event => this.updateDraft('subscriptionPrice', event.target.value)} required/></${FormField}><${FormField} label="Moneda"><input value=${draft.currency} onChange=${event => this.updateDraft('currency', event.target.value)} placeholder="USD"/></${FormField}></div></fieldset><fieldset><legend>Quién pagará</legend><div className="form-grid"><${FormField} label="Nombre del psiquiatra"><input value=${draft.payerName} onChange=${event => this.updateDraft('payerName', event.target.value)}/></${FormField}><${FormField} label="Correo"><input type="email" value=${draft.payerEmail} onChange=${event => this.updateDraft('payerEmail', event.target.value)}/></${FormField}></div></fieldset><fieldset><legend>Conexión Wompi</legend><div className="form-information"><${Icon} name="shield" size=${19}/><div><b>${status.state === 'ready' ? (status.app?.estaProductivo ? 'Wompi en producción' : 'Wompi en modo de prueba') : 'Wompi pendiente de verificar'}</b><p>${status.state === 'ready' ? `${status.app?.nombre || 'Aplicativo'} · ${status.app?.numeroCuenta || 'Cuenta pendiente'}` : (status.error || 'App ID y API Secret se guardan en Supabase Secrets.')}</p></div></div><div className="settings-actions"><${Button} tone="secondary" icon="refresh" onClick=${this.loadWompiStatus}>Verificar API</${Button}></div><${FormField} label="Enlace manual de respaldo" hint="Opcional. Puede pegar el enlace genérico que ya creó en Wompi."><input value=${draft.manualCheckoutUrl} onChange=${event => this.updateDraft('manualCheckoutUrl', event.target.value)} placeholder="https://s.wompi.sv/..."/></${FormField}><label className="form-checkbox-card"><input type="checkbox" checked=${Boolean(draft.wompiEnabled)} onChange=${event => this.updateDraft('wompiEnabled', event.target.checked)}/><span><b>Habilitar Wompi</b><small>Permite generar enlaces únicos desde la API.</small></span></label></fieldset><${FormField} label="Nota interna"><textarea rows="2" value=${draft.note} onChange=${event => this.updateDraft('note', event.target.value)}></textarea></${FormField}><div className="clinical-footnote"><${Icon} name="shield" size=${17}/> No existe VITE_WOMPI_PUBLIC_KEY en esta integración de Wompi El Salvador. App ID y API Secret son credenciales del backend.</div><${FormActions} onCancel=${this.closeModal} submitLabel="Guardar plan y precio"/></form></${Modal}>`;
  }

  renderPatientFormModal() {
    const draft = this.state.modal.draft;
    const scale = SCALE_CATALOG.find(item => item.code === draft.scaleCode) || SCALE_CATALOG[0];
    const clinicalFields = this.can('clinicalView');
    return html`<${Modal} title="Nuevo paciente" subtitle=${clinicalFields ? 'Registre lo esencial, la cobertura y una medición inicial.' : 'Registre datos administrativos. El médico completará la información clínica.'} onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.savePatientForm}>${this.renderModalError()}
      <fieldset data-tour="patient-form-identification"><legend>Identificación</legend><${ImagePicker} value=${draft.photo} label="Fotografía del paciente" hint="PNG, JPG o WEBP. Se optimiza para cargar rápidamente." onChange=${event => this.handleDraftImage(event, 'photo', { maxDimension: 560, quality: 0.82 })} onRemove=${() => this.updateDraft('photo', '')}/><div className="form-grid"><${FormField} label="Nombre completo" required=${true}><input autoFocus value=${draft.name} onChange=${event => this.updateDraft('name', event.target.value)} placeholder="Ej. Ana Martínez" required/></${FormField}><${FormField} label="Edad" required=${true}><input type="number" min="0" max="120" value=${draft.age} onChange=${event => this.updateDraft('age', event.target.value)} required/></${FormField}></div><div className="form-grid"><${FormField} label="Sexo registrado"><select value=${draft.sex} onChange=${event => this.updateDraft('sex', event.target.value)}><option>No registrado</option><option value="F">Femenino</option><option value="M">Masculino</option><option>Otro</option></select></${FormField}><${FormField} label="Teléfono"><input value=${draft.phone} onChange=${event => this.updateDraft('phone', event.target.value)} placeholder="Ej. +503 7000 0000"/></${FormField}></div><${FormField} label="Correo"><input type="email" value=${draft.email} onChange=${event => this.updateDraft('email', event.target.value)} placeholder="paciente@correo.com"/></${FormField}></fieldset>

      <fieldset data-tour="patient-form-insurance-section"><legend>Seguro médico</legend><label data-tour="patient-form-insurance-toggle" className=${`insurance-toggle-card ${draft.hasInsurance ? 'active' : ''}`}><input type="checkbox" checked=${Boolean(draft.hasInsurance)} onChange=${event => this.updateDraft('hasInsurance', event.target.checked)}/><span className="insurance-toggle-icon"><${Icon} name="insurance" size=${22}/></span><span><b>${draft.hasInsurance ? 'Paciente con seguro médico' : 'Atención particular'}</b><small>Active esta opción para guardar aseguradora, plan y datos de autorización.</small></span><i><${Icon} name=${draft.hasInsurance ? 'check' : 'plus'} size=${17}/></i></label>${draft.hasInsurance ? html`<div className="insurance-form-panel" data-tour="patient-form-insurance-details"><div className="form-grid"><${FormField} label="Aseguradora" required=${true}><input value=${draft.insuranceProvider} onChange=${event => this.updateDraft('insuranceProvider', event.target.value)} placeholder="Ej. Aseguradora Médica" required/></${FormField}><${FormField} label="Plan"><input value=${draft.insurancePlan} onChange=${event => this.updateDraft('insurancePlan', event.target.value)} placeholder="Ej. Ejecutivo Plus"/></${FormField}></div><div className="form-grid"><${FormField} label="N.º de afiliado"><input value=${draft.insuranceMemberId} onChange=${event => this.updateDraft('insuranceMemberId', event.target.value)}/></${FormField}><${FormField} label="N.º de póliza"><input value=${draft.insurancePolicyNumber} onChange=${event => this.updateDraft('insurancePolicyNumber', event.target.value)}/></${FormField}></div><div className="form-grid"><${FormField} label="Copago"><input value=${draft.insuranceCopay} onChange=${event => this.updateDraft('insuranceCopay', event.target.value)} placeholder="Ej. $20 o 20%"/></${FormField}><label className="form-checkbox-card"><input type="checkbox" checked=${Boolean(draft.insuranceAuthorizationRequired)} onChange=${event => this.updateDraft('insuranceAuthorizationRequired', event.target.checked)}/><span><b>Requiere autorización</b><small>La secretaria podrá verlo antes de confirmar la cita.</small></span></label></div><${FormField} label="Notas del seguro"><textarea rows="2" value=${draft.insuranceNotes} onChange=${event => this.updateDraft('insuranceNotes', event.target.value)} placeholder="Cobertura, vigencia o requisitos importantes"></textarea></${FormField}></div>` : null}</fieldset>

      ${clinicalFields ? html`<fieldset data-tour="patient-form-clinical"><legend>Información clínica inicial</legend><div className="form-grid"><${FormField} label="Diagnóstico principal" required=${true}><input value=${draft.diagnosis} onChange=${event => this.updateDraft('diagnosis', event.target.value)} placeholder="Ej. Trastorno depresivo mayor" required/></${FormField}><${FormField} label="Código diagnóstico"><input value=${draft.diagnosisCode} onChange=${event => this.updateDraft('diagnosisCode', event.target.value)} placeholder="Ej. F33.1"/></${FormField}></div><div className="form-grid"><${FormField} label="Riesgo actual"><select value=${draft.risk} onChange=${event => this.updateDraft('risk', event.target.value)}><option value="low">Bajo</option><option value="medium">Moderado</option><option value="high">Alto</option></select></${FormField}><${FormField} label="Estado clínico"><select value=${draft.status} onChange=${event => this.updateDraft('status', event.target.value)}><option value="stable">Estable</option><option value="responding">Mejorando</option><option value="partial">Mejoría parcial</option><option value="review">Requiere revisión</option></select></${FormField}></div><div className="form-grid"><${FormField} label="Escala"><select value=${draft.scaleCode} onChange=${event => this.updateDraft('scaleCode', event.target.value)}>${SCALE_CATALOG.map(item => html`<option key=${item.code} value=${item.code}>${item.code} · ${item.label}</option>`)}</select></${FormField}><${FormField} label="Puntaje inicial" hint=${`Rango permitido: ${scale.min} a ${scale.max}`}><input type="number" min=${scale.min} max=${scale.max} value=${draft.initialScore} onChange=${event => this.updateDraft('initialScore', event.target.value)}/></${FormField}></div></fieldset>` : html`<div className="form-information"><${Icon} name="shield" size=${19}/><div><b>Información clínica pendiente</b><p>El expediente se creará con “Pendiente de valoración médica”. El diagnóstico, tratamiento y escalas solo serán visibles para usuarios autorizados.</p></div></div>`}

      <fieldset data-tour="patient-form-followup"><legend>Seguimiento</legend><div className="form-grid"><${FormField} label="Próxima cita"><input type="datetime-local" value=${draft.nextVisit} onChange=${event => this.updateDraft('nextVisit', event.target.value)}/></${FormField}><${FormField} label="Nota inicial"><textarea rows="2" value=${draft.notes} onChange=${event => this.updateDraft('notes', event.target.value)} placeholder="Contexto importante"></textarea></${FormField}></div></fieldset><div data-tour="patient-form-save"><${FormActions} onCancel=${this.closeModal} submitLabel="Crear paciente"/></div></form></${Modal}>`;
  }

  renderPatientEditFormModal() {
    const { draft, patientId } = this.state.modal;
    const patient = this.state.data.patients.find(item => item.id === patientId);
    const clinicalFields = this.can('clinicalView');
    return html`<${Modal} title="Editar paciente" subtitle=${`Actualice datos, fotografía y cobertura de ${patient?.name || 'este paciente'}.`} onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.savePatientEditForm}>${this.renderModalError()}
      <fieldset><legend>Identificación y contacto</legend><${ImagePicker} value=${draft.photo} label="Fotografía del paciente" hint="La imagen se guarda optimizada en este navegador." onChange=${event => this.handleDraftImage(event, 'photo', { maxDimension: 560, quality: 0.82 })} onRemove=${() => this.updateDraft('photo', '')}/><div className="form-grid"><${FormField} label="Nombre completo" required=${true}><input autoFocus value=${draft.name} onChange=${event => this.updateDraft('name', event.target.value)} required/></${FormField}><${FormField} label="Edad" required=${true}><input type="number" min="0" max="120" value=${draft.age} onChange=${event => this.updateDraft('age', event.target.value)} required/></${FormField}></div><div className="form-grid"><${FormField} label="Sexo registrado"><select value=${draft.sex} onChange=${event => this.updateDraft('sex', event.target.value)}><option>No registrado</option><option value="F">Femenino</option><option value="M">Masculino</option><option>Otro</option></select></${FormField}><${FormField} label="Teléfono"><input value=${draft.phone} onChange=${event => this.updateDraft('phone', event.target.value)}/></${FormField}></div><${FormField} label="Correo"><input type="email" value=${draft.email} onChange=${event => this.updateDraft('email', event.target.value)}/></${FormField}></fieldset>
      <fieldset><legend>Seguro médico</legend><label data-tour="patient-edit-insurance-toggle" className=${`insurance-toggle-card ${draft.hasInsurance ? 'active' : ''}`}><input type="checkbox" checked=${Boolean(draft.hasInsurance)} onChange=${event => this.updateDraft('hasInsurance', event.target.checked)}/><span className="insurance-toggle-icon"><${Icon} name="insurance" size=${22}/></span><span><b>${draft.hasInsurance ? 'Paciente con seguro médico' : 'Atención particular'}</b><small>La cobertura se muestra en la ficha administrativa y en la agenda.</small></span><i><${Icon} name=${draft.hasInsurance ? 'check' : 'plus'} size=${17}/></i></label>${draft.hasInsurance ? html`<div className="insurance-form-panel" data-tour="patient-edit-insurance-details"><div className="form-grid"><${FormField} label="Aseguradora" required=${true}><input value=${draft.insuranceProvider} onChange=${event => this.updateDraft('insuranceProvider', event.target.value)} required/></${FormField}><${FormField} label="Plan"><input value=${draft.insurancePlan} onChange=${event => this.updateDraft('insurancePlan', event.target.value)}/></${FormField}></div><div className="form-grid"><${FormField} label="N.º de afiliado"><input value=${draft.insuranceMemberId} onChange=${event => this.updateDraft('insuranceMemberId', event.target.value)}/></${FormField}><${FormField} label="N.º de póliza"><input value=${draft.insurancePolicyNumber} onChange=${event => this.updateDraft('insurancePolicyNumber', event.target.value)}/></${FormField}></div><div className="form-grid"><${FormField} label="Copago"><input value=${draft.insuranceCopay} onChange=${event => this.updateDraft('insuranceCopay', event.target.value)}/></${FormField}><label className="form-checkbox-card"><input type="checkbox" checked=${Boolean(draft.insuranceAuthorizationRequired)} onChange=${event => this.updateDraft('insuranceAuthorizationRequired', event.target.checked)}/><span><b>Requiere autorización</b><small>Mostrar advertencia administrativa.</small></span></label></div><${FormField} label="Notas del seguro"><textarea rows="2" value=${draft.insuranceNotes} onChange=${event => this.updateDraft('insuranceNotes', event.target.value)}></textarea></${FormField}></div>` : null}</fieldset>
      ${clinicalFields ? html`<fieldset><legend>Datos clínicos básicos</legend><div className="form-grid"><${FormField} label="Diagnóstico principal" required=${true}><input value=${draft.diagnosis} onChange=${event => this.updateDraft('diagnosis', event.target.value)} required/></${FormField}><${FormField} label="Código"><input value=${draft.diagnosisCode} onChange=${event => this.updateDraft('diagnosisCode', event.target.value)}/></${FormField}></div><div className="form-grid"><${FormField} label="Riesgo"><select value=${draft.risk} onChange=${event => this.updateDraft('risk', event.target.value)}><option value="low">Bajo</option><option value="medium">Moderado</option><option value="high">Alto</option></select></${FormField}><${FormField} label="Estado"><select value=${draft.status} onChange=${event => this.updateDraft('status', event.target.value)}><option value="stable">Estable</option><option value="responding">Mejorando</option><option value="partial">Mejoría parcial</option><option value="review">Requiere revisión</option></select></${FormField}></div></fieldset>` : null}<${FormField} label="Nota de actualización"><textarea rows="3" value=${draft.notes} onChange=${event => this.updateDraft('notes', event.target.value)} placeholder="Opcional. Se agregará al historial de notas."></textarea></${FormField}><${FormActions} onCancel=${this.closeModal} submitLabel="Guardar cambios"/></form></${Modal}>`;
  }

  renderClinicProfileModal() {
    const draft = this.state.modal.draft;
    return html`<${Modal} title="Identidad del consultorio" subtitle="Configure logo, fotografía profesional y datos del membrete." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveClinicProfileForm}>${this.renderModalError()}
      <div className="practice-image-grid" data-tour="clinic-profile-images"><${ImagePicker} value=${draft.clinicLogo} label="Logo de la clínica" hint="Se recomienda PNG con fondo transparente." shape="logo" onChange=${event => this.handleDraftImage(event, 'clinicLogo', { maxDimension: 900, quality: 0.9, preserveTransparency: true })} onRemove=${() => this.updateDraft('clinicLogo', '')}/><${ImagePicker} value=${draft.doctorPhoto} label="Fotografía del médico" hint="Se mostrará en el perfil y la vista de usuario." onChange=${event => this.handleDraftImage(event, 'doctorPhoto', { maxDimension: 640, quality: 0.84 })} onRemove=${() => this.updateDraft('doctorPhoto', '')}/></div>
      <fieldset data-tour="clinic-profile-identity"><legend>Datos del consultorio</legend><div className="form-grid"><${FormField} label="Nombre de la clínica" required=${true}><input autoFocus value=${draft.name} onChange=${event => this.updateDraft('name', event.target.value)} required/></${FormField}><${FormField} label="Especialidad"><input value=${draft.specialty} onChange=${event => this.updateDraft('specialty', event.target.value)} placeholder="Psiquiatría"/></${FormField}></div><div className="form-grid" data-tour="clinic-profile-doctor"><${FormField} label="Nombre del profesional" required=${true}><input value=${draft.clinician} onChange=${event => this.updateDraft('clinician', event.target.value)} required/></${FormField}><${FormField} label="N.º de junta o licencia"><input value=${draft.professionalLicense} onChange=${event => this.updateDraft('professionalLicense', event.target.value)} placeholder="Ej. JVPM 0000"/></${FormField}></div><${FormField} label="Dirección"><input value=${draft.address} onChange=${event => this.updateDraft('address', event.target.value)} placeholder="Dirección del consultorio"/></${FormField}><div className="form-grid"><${FormField} label="Teléfono"><input value=${draft.phone} onChange=${event => this.updateDraft('phone', event.target.value)}/></${FormField}><${FormField} label="Correo"><input type="email" value=${draft.email} onChange=${event => this.updateDraft('email', event.target.value)}/></${FormField}></div><${FormField} label="Sitio web"><input value=${draft.website} onChange=${event => this.updateDraft('website', event.target.value)} placeholder="https://..."/></${FormField}></fieldset><div data-tour="clinic-profile-footer"><${FormField} label="Texto al pie de la receta" hint="Aparecerá en todas las recetas impresas."><textarea rows="3" value=${draft.prescriptionFooter} onChange=${event => this.updateDraft('prescriptionFooter', event.target.value)}></textarea></${FormField}><div className="letterhead-preview"><div className="letterhead-preview-logo">${draft.clinicLogo ? html`<img src=${draft.clinicLogo} alt="Logo"/>` : html`<${Icon} name="building" size=${26}/>`}</div><div><span>Vista previa del membrete</span><b>${draft.name || 'Nombre de la clínica'}</b><small>${draft.clinician || 'Nombre del profesional'} · ${draft.specialty || 'Especialidad'}</small></div></div></div><${FormActions} onCancel=${this.closeModal} submitLabel="Guardar identidad"/></form></${Modal}>`;
  }

  renderPermissionGroups(draft) {
    const groups = [...new Set(PERMISSION_CATALOG.map(item => item.group))];
    return html`<div className="permission-groups" data-tour="permissions-form">${groups.map(group => html`<section key=${group} className="permission-group"><h4>${group}</h4><div>${PERMISSION_CATALOG.filter(item => item.group === group).map(permission => html`<label key=${permission.key} className=${`permission-row ${draft.permissions?.[permission.key] ? 'active' : ''}`}><input type="checkbox" checked=${Boolean(draft.permissions?.[permission.key])} onChange=${event => this.updateDraftPermission(permission.key, event.target.checked)}/><span className="permission-check"><${Icon} name=${draft.permissions?.[permission.key] ? 'check' : 'close'} size=${15}/></span><span><b>${permission.label}</b><small>${permission.description}</small></span></label>`)}</div></section>`)}</div>`;
  }

  renderSecretaryModal() {
    const draft = this.state.modal.draft;
    return html`<${Modal} title="Crear usuario de secretaría" subtitle="Defina sus datos y exactamente qué podrá consultar o modificar." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveSecretaryForm}>${this.renderModalError()}<fieldset data-tour="secretary-form-identity"><legend>Datos del usuario</legend><div className="form-grid"><${FormField} label="Nombre completo" required=${true}><input autoFocus value=${draft.name} onChange=${event => this.updateDraft('name', event.target.value)} required/></${FormField}><${FormField} label="Cargo"><input value=${draft.title} onChange=${event => this.updateDraft('title', event.target.value)} placeholder="Secretaría clínica"/></${FormField}></div><div className="form-grid"><${FormField} label="Correo" required=${true}><input type="email" value=${draft.email} onChange=${event => this.updateDraft('email', event.target.value)} required/></${FormField}><${FormField} label="Teléfono"><input value=${draft.phone} onChange=${event => this.updateDraft('phone', event.target.value)}/></${FormField}></div><div className="form-grid"><${FormField} label="Contraseña temporal" required=${true} hint="Mínimo 8 caracteres."><input type="password" minLength="8" value=${draft.password} onChange=${event => this.updateDraft('password', event.target.value)} autoComplete="new-password" required/></${FormField}><${FormField} label="Confirmar contraseña" required=${true}><input type="password" minLength="8" value=${draft.confirmPassword} onChange=${event => this.updateDraft('confirmPassword', event.target.value)} autoComplete="new-password" required/></${FormField}></div></fieldset><div className="permissions-intro"><${Icon} name="shield" size=${20}/><div><b>Permisos recomendados para secretaría</b><p>Por defecto puede administrar pacientes, seguro, agenda y recordatorios, sin ver diagnósticos, medicamentos, escalas ni notas clínicas.</p></div></div><div data-tour="secretary-form-permissions">${this.renderPermissionGroups(draft)}</div><${FormActions} onCancel=${this.closeModal} submitLabel="Crear usuario"/></form></${Modal}>`;
  }

  renderUserPermissionsModal() {
    const draft = this.state.modal.draft;
    return html`<${Modal} title="Editar usuario y permisos" subtitle="Los cambios se aplican inmediatamente a su vista." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveUserPermissionsForm}>${this.renderModalError()}<fieldset><legend>Datos del usuario</legend><div className="form-grid"><${FormField} label="Nombre" required=${true}><input value=${draft.name} onChange=${event => this.updateDraft('name', event.target.value)} required/></${FormField}><${FormField} label="Cargo"><input value=${draft.title} onChange=${event => this.updateDraft('title', event.target.value)}/></${FormField}></div><div className="form-grid"><${FormField} label="Correo" required=${true}><input type="email" value=${draft.email} onChange=${event => this.updateDraft('email', event.target.value)} required/></${FormField}><${FormField} label="Teléfono"><input value=${draft.phone} onChange=${event => this.updateDraft('phone', event.target.value)}/></${FormField}></div><div className="form-grid"><${FormField} label="Nueva contraseña" hint="Opcional. Déjela vacía para conservar la actual."><input type="password" minLength="8" value=${draft.password || ''} onChange=${event => this.updateDraft('password', event.target.value)} autoComplete="new-password"/></${FormField}><${FormField} label="Confirmar nueva contraseña"><input type="password" minLength="8" value=${draft.confirmPassword || ''} onChange=${event => this.updateDraft('confirmPassword', event.target.value)} autoComplete="new-password"/></${FormField}></div></fieldset>${this.renderPermissionGroups(draft)}<${FormActions} onCancel=${this.closeModal} submitLabel="Guardar permisos"/></form></${Modal}>`;
  }

  renderAccountModal() {
    const user = this.activeUser();
    const draft = this.state.modal.draft;
    if (!user) return null;
    return html`<${Modal} title="Mi cuenta" subtitle="Revise su sesión, cambie la contraseña o cierre el acceso actual." onClose=${this.closeModal} size="md"><div className="account-summary"><${UserAvatar} user=${user} organization=${this.state.data.organization} size="xl"/><div><span>${user.role === 'doctor' ? 'Médico administrador' : 'Secretaría clínica'}</span><h3>${user.name}</h3><p>${user.email}</p><${Badge} tone=${user.role === 'doctor' ? 'blue' : 'success'} dot=${true}>${user.role === 'doctor' ? 'Acceso clínico completo' : 'Permisos asignados'}</${Badge}></div></div><form className="clinical-form account-password-form" onSubmit=${this.saveAccountPassword}>${this.renderModalError()}<fieldset><legend>Cambiar contraseña</legend><${FormField} label="Contraseña actual"><div className="password-field"><input type=${draft.showPasswords ? 'text' : 'password'} value=${draft.currentPassword} onChange=${event => this.updateDraft('currentPassword', event.target.value)} autoComplete="current-password"/><button type="button" onClick=${() => this.updateDraft('showPasswords', !draft.showPasswords)} aria-label=${draft.showPasswords ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}><${Icon} name=${draft.showPasswords ? 'eyeOff' : 'eye'} size=${18}/></button></div></${FormField}><div className="form-grid"><${FormField} label="Nueva contraseña"><input type=${draft.showPasswords ? 'text' : 'password'} minLength="8" value=${draft.newPassword} onChange=${event => this.updateDraft('newPassword', event.target.value)} autoComplete="new-password"/></${FormField}><${FormField} label="Confirmar contraseña"><input type=${draft.showPasswords ? 'text' : 'password'} minLength="8" value=${draft.confirmPassword} onChange=${event => this.updateDraft('confirmPassword', event.target.value)} autoComplete="new-password"/></${FormField}></div><small className="field-note">Use al menos 8 caracteres. En producción esta función se conectará a Supabase Auth.</small></fieldset><div className="account-actions"><${Button} tone="secondary" type="submit" icon="lock">Actualizar contraseña</${Button}><${Button} tone="secondary" icon="settings" onClick=${() => this.setState({ modal: null, view: 'settings' })} disabled=${!this.can('settingsManage') && !this.can('usersManage')}>Configuración</${Button}><button type="button" className="logout-button" onClick=${this.logoutUser}><${Icon} name="logout" size=${18}/> Cerrar sesión</button></div></form></${Modal}>`;
  }

  renderUserSwitcherModal() {
    const users = (this.state.data.users || []).filter(user => user.active !== false);
    const active = this.activeUser();
    return html`<${Modal} title="Cambiar vista de usuario" subtitle="Pruebe cómo se ve el sistema con los permisos del médico o de secretaría." onClose=${this.closeModal} size="md"><div className="user-switch-list" data-tour="user-switcher">${users.map(user => html`<button key=${user.id} className=${`user-switch-card ${active?.id === user.id ? 'active' : ''}`} onClick=${() => this.switchSession(user.id)}><${UserAvatar} user=${user} organization=${this.state.data.organization} size="lg"/><div><span>${user.role === 'doctor' ? 'Médico administrador' : 'Vista de secretaría'}</span><b>${user.name}</b><small>${user.title || user.email}</small></div>${active?.id === user.id ? html`<${Badge} tone="success" dot=${true}>Vista activa</${Badge}>` : html`<${Icon} name="chevronRight" size=${18}/>`}</button>`)}</div><div className="form-information"><${Icon} name="shield" size=${19}/><div><b>Demostración local</b><p>Este selector simula las vistas. Cuando conectemos Supabase, cada usuario tendrá inicio de sesión, contraseña y sesión independiente.</p></div></div><div className="modal-sticky-actions"><${Button} tone="secondary" onClick=${this.closeModal}>Cerrar</${Button}></div></${Modal}>`;
  }

  renderPrescriptionModal() {
    const { draft, patientId } = this.state.modal;
    const patient = this.state.data.patients.find(item => item.id === patientId);
    const items = draft.items || [];
    return html`<${Modal} title="Nueva receta" subtitle=${`Paciente: ${patient?.name || ''}. Se guardará en el expediente y se abrirá para imprimir o guardar como PDF.`} onClose=${this.closeModal} size="xl"><form className="clinical-form prescription-form" onSubmit=${this.savePrescriptionForm}>${this.renderModalError()}<div className="prescription-form-head" data-tour="prescription-form-header"><div className="prescription-patient"><${Avatar} patient=${patient} size="lg"/><div><span>Paciente</span><b>${patient?.name}</b><small>${patient?.age} años · ${patient?.diagnosis}</small></div></div><div className="letterhead-mini">${this.state.data.organization.clinicLogo ? html`<img src=${this.state.data.organization.clinicLogo} alt="Logo"/>` : html`<${Icon} name="building" size=${23}/>`}<div><b>${this.state.data.organization.name}</b><small>${this.state.data.organization.clinician}</small></div></div></div><div className="form-grid" data-tour="prescription-form-header"><${FormField} label="Fecha" required=${true}><input type="date" value=${draft.date} onChange=${event => this.updateDraft('date', event.target.value)} required/></${FormField}><${FormField} label="Diagnóstico"><input value=${draft.diagnosis} onChange=${event => this.updateDraft('diagnosis', event.target.value)}/></${FormField}></div><${FormField} label="Profesional que emite"><input value=${draft.doctorName} onChange=${event => this.updateDraft('doctorName', event.target.value)} required/></${FormField}><fieldset className="prescription-items-fieldset" data-tour="prescription-form-items"><legend>Medicamentos e indicaciones</legend><div className="prescription-item-list">${items.map((item, index) => html`<article key=${item.id} className="prescription-item-editor"><header><span>${index + 1}</span><b>Indicación</b>${items.length > 1 ? html`<button type="button" aria-label="Quitar medicamento" onClick=${() => this.removePrescriptionItem(item.id)}><${Icon} name="trash" size=${16}/></button>` : null}</header><div className="form-grid" data-tour="prescription-form-item-identity"><${FormField} label="Medicamento" required=${true}><input value=${item.medication} onChange=${event => this.updatePrescriptionItem(item.id, 'medication', event.target.value)} placeholder="Ej. Sertralina" required/></${FormField}><${FormField} label="Presentación o dosis"><input value=${item.strength} onChange=${event => this.updatePrescriptionItem(item.id, 'strength', event.target.value)} placeholder="Ej. 50 mg"/></${FormField}></div><div className="form-grid"><${FormField} label="Cómo tomarlo" required=${true}><input value=${item.directions} onChange=${event => this.updatePrescriptionItem(item.id, 'directions', event.target.value)} placeholder="Ej. 1 tableta cada mañana" required/></${FormField}><${FormField} label="Cantidad"><input value=${item.quantity} onChange=${event => this.updatePrescriptionItem(item.id, 'quantity', event.target.value)} placeholder="Ej. 30 tabletas"/></${FormField}></div><div className="form-grid"><${FormField} label="Duración"><input value=${item.duration} onChange=${event => this.updatePrescriptionItem(item.id, 'duration', event.target.value)} placeholder="Ej. 30 días"/></${FormField}><${FormField} label="Nota de la indicación"><input value=${item.notes} onChange=${event => this.updatePrescriptionItem(item.id, 'notes', event.target.value)} placeholder="Ej. tomar con alimentos"/></${FormField}></div></article>`)}</div><div data-tour="prescription-form-more"><${Button} tone="secondary" icon="plus" onClick=${this.addPrescriptionItem}>Agregar otro medicamento</${Button}></div></fieldset><div data-tour="prescription-form-observations"><${FormField} label="Indicaciones generales"><textarea rows="3" value=${draft.generalInstructions} onChange=${event => this.updateDraft('generalInstructions', event.target.value)} placeholder="Recomendaciones generales para el paciente"></textarea></${FormField}><${FormField} label="Observaciones"><textarea rows="2" value=${draft.observations} onChange=${event => this.updateDraft('observations', event.target.value)} placeholder="Información adicional para la receta"></textarea></${FormField}></div><div className="form-information"><${Icon} name="print" size=${19}/><div><b>Lista para papel membretado</b><p>Al guardar se abrirá la hoja A4. Desde el cuadro de impresión puede seleccionar “Guardar como PDF”. Revise, firme y selle antes de entregar.</p></div></div><div data-tour="prescription-form-save"><${FormActions} onCancel=${this.closeModal} submitLabel="Guardar y abrir receta"/></div></form></${Modal}>`;
  }

  renderMedicationFormModal() {
    const draft = this.state.modal.draft;
    const patient = this.state.data.patients.find(item => item.id === this.state.modal.patientId);
    return html`<${Modal} title="Agregar medicamento" subtitle=${`Paciente: ${patient?.name || ''}`} onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveMedicationForm}>${this.renderModalError()}<div data-tour="medication-form-identity"><div className="form-grid"><${FormField} label="Medicamento" required=${true}><input autoFocus value=${draft.name} onChange=${event => this.updateDraft('name', event.target.value)} placeholder="Ej. Sertralina" required/></${FormField}><${FormField} label="Clase"><select value=${draft.class} onChange=${event => this.updateDraft('class', event.target.value)}>${MEDICATION_CLASSES.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}></div><${FormField} label="Indicación"><input value=${draft.indication} onChange=${event => this.updateDraft('indication', event.target.value)} placeholder="Motivo clínico del tratamiento"/></${FormField}></div><div className="form-grid form-grid-three" data-tour="medication-form-dose"><${FormField} label="Dosis" required=${true}><input type="number" min="0" step="0.01" value=${draft.doseValue} onChange=${event => this.updateDraft('doseValue', event.target.value)} required/></${FormField}><${FormField} label="Unidad"><select value=${draft.doseUnit} onChange=${event => this.updateDraft('doseUnit', event.target.value)}><option>mg</option><option>mcg</option><option>g</option><option>mL</option><option>tableta(s)</option><option>gota(s)</option></select></${FormField}><${FormField} label="Frecuencia"><select value=${draft.frequency} onChange=${event => this.updateDraft('frequency', event.target.value)}>${FREQUENCIES.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}></div><div className="form-grid" data-tour="medication-form-start"><${FormField} label="Vía"><select value=${draft.route} onChange=${event => this.updateDraft('route', event.target.value)}><option>oral</option><option>sublingual</option><option>intramuscular</option><option>transdérmica</option><option>otra</option></select></${FormField}><${FormField} label="Fecha de inicio"><input type="date" value=${draft.startDate} onChange=${event => this.updateDraft('startDate', event.target.value)} required/></${FormField}></div><div className="check-grid" data-tour="medication-form-start"><label><input type="checkbox" checked=${Boolean(draft.isPrimary)} onChange=${event => this.updateDraft('isPrimary', event.target.checked)}/><span><b>Medicamento principal</b><small>Se mostrará como referencia principal del dashboard.</small></span></label><label><input type="checkbox" checked=${Boolean(draft.isPrn)} onChange=${event => this.updateDraft('isPrn', event.target.checked)}/><span><b>Uso según necesidad</b><small>Marque si la indicación es PRN.</small></span></label></div><${FormField} label="Notas"><textarea rows="3" value=${draft.notes} onChange=${event => this.updateDraft('notes', event.target.value)}></textarea></${FormField}><${FormActions} onCancel=${this.closeModal} submitLabel="Agregar medicamento"/></form></${Modal}>`;
  }

  renderDoseFormModal() {
    const draft = this.state.modal.draft;
    const patient = this.state.data.patients.find(item => item.id === this.state.modal.patientId);
    const active = patient?.medications?.filter(item => item.status === 'active') || [];
    const selected = active.find(item => item.id === draft.medicationId) || active[0];
    return html`<${Modal} title="Cambiar dosis" subtitle="El valor anterior se conservará en el historial." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveDoseForm}>${this.renderModalError()}<div data-tour="dose-form-current"><${FormField} label="Medicamento"><select value=${draft.medicationId} onChange=${event => { const medication = active.find(item => item.id === event.target.value); this.setState(prev => ({ modal: { ...prev.modal, draft: { ...prev.modal.draft, medicationId: event.target.value, currentDose: medication?.dose || '', newDoseValue: medication?.doseValue ?? '', doseUnit: medication?.doseUnit || 'mg', frequency: medication?.frequency || 'una vez al día' } } })); }}>${active.map(item => html`<option key=${item.id} value=${item.id}>${item.name} · ${item.dose}</option>`)}</select></${FormField}><div className="dose-change-panel"><div><span>Dosis actual</span><strong>${selected?.dose || draft.currentDose}</strong></div><${Icon} name="chevronRight"/><div><span>Nueva dosis</span><strong>${draft.newDoseValue || '—'} ${draft.doseUnit}</strong></div></div><div className="form-grid form-grid-three" data-tour="dose-form-current"><${FormField} label="Nueva dosis" required=${true}><input autoFocus type="number" min="0" step="0.01" value=${draft.newDoseValue} onChange=${event => this.updateDraft('newDoseValue', event.target.value)} required/></${FormField}><${FormField} label="Unidad"><select value=${draft.doseUnit} onChange=${event => this.updateDraft('doseUnit', event.target.value)}><option>mg</option><option>mcg</option><option>g</option><option>mL</option><option>tableta(s)</option><option>gota(s)</option></select></${FormField}><${FormField} label="Frecuencia"><select value=${draft.frequency} onChange=${event => this.updateDraft('frequency', event.target.value)}>${FREQUENCIES.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}></div></div><div className="form-grid" data-tour="dose-form-context"><${FormField} label="Fecha efectiva"><input type="date" value=${draft.effectiveDate} onChange=${event => this.updateDraft('effectiveDate', event.target.value)} required/></${FormField}><${FormField} label="Motivo"><input value=${draft.reason} onChange=${event => this.updateDraft('reason', event.target.value)} placeholder="Ej. respuesta parcial"/></${FormField}></div><${FormField} label="Notas"><textarea rows="3" value=${draft.notes} onChange=${event => this.updateDraft('notes', event.target.value)}></textarea></${FormField}><${FormActions} onCancel=${this.closeModal} submitLabel="Guardar cambio de dosis"/></form></${Modal}>`;
  }

  renderMedicationStatusFormModal() {
    const draft = this.state.modal.draft;
    const action = draft.status === 'held' ? 'Pausar medicamento' : draft.status === 'active' ? 'Reactivar medicamento' : 'Finalizar medicamento';
    const explanation = draft.status === 'held'
      ? 'La pausa queda registrada y el medicamento podrá reactivarse después.'
      : draft.status === 'active'
        ? 'El medicamento volverá a mostrarse como activo.'
        : 'El medicamento quedará en el historial, pero dejará de mostrarse como tratamiento activo.';
    return html`<${Modal} title=${action} subtitle=${draft.medicationName} onClose=${this.closeModal} size="md"><form className="clinical-form" onSubmit=${this.saveMedicationStatusForm}>${this.renderModalError()}<div className="form-note"><${Icon} name="medication" size=${18}/><span>${explanation}</span></div><${FormField} label="Motivo del cambio" hint="Opcional, pero útil para interpretar la línea de tiempo."><textarea autoFocus rows="4" value=${draft.reason} onChange=${event => this.updateDraft('reason', event.target.value)} placeholder="Ej. respuesta insuficiente, efecto observado, fin de esquema o decisión compartida"></textarea></${FormField}><${FormActions} onCancel=${this.closeModal} submitLabel=${action}/></form></${Modal}>`;
  }

  renderAssessmentFormModal() {
    const draft = this.state.modal.draft;
    const patient = this.state.data.patients.find(item => item.id === this.state.modal.patientId);
    const scale = SCALE_CATALOG.find(item => item.code === draft.code) || SCALE_CATALOG[0];
    return html`<${Modal} title="Registrar evolución" subtitle=${`Paciente: ${patient?.name || ''}`} onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveAssessmentForm}>${this.renderModalError()}<div className="form-grid" data-tour="assessment-form-score"><${FormField} label="Escala clínica"><select value=${draft.code} onChange=${event => this.updateDraft('code', event.target.value)}>${SCALE_CATALOG.map(item => html`<option key=${item.code} value=${item.code}>${item.code} · ${item.label}</option>`)}</select></${FormField}><${FormField} label="Puntaje" required=${true} hint=${`Rango: ${scale.min} a ${scale.max}`}><input autoFocus type="number" min=${scale.min} max=${scale.max} value=${draft.score} onChange=${event => this.updateDraft('score', event.target.value)} required/></${FormField}></div><div data-tour="assessment-form-context"><div className="form-grid form-grid-three"><${FormField} label="Fecha"><input type="date" value=${draft.date} onChange=${event => this.updateDraft('date', event.target.value)} required/></${FormField}><${FormField} label="Adherencia %"><input type="number" min="0" max="100" value=${draft.adherence} onChange=${event => this.updateDraft('adherence', event.target.value)}/></${FormField}><${FormField} label="Sueño promedio (h)"><input type="number" min="0" max="24" step="0.1" value=${draft.sleepCurrent} onChange=${event => this.updateDraft('sleepCurrent', event.target.value)}/></${FormField}></div><div className="form-grid form-grid-three"><${FormField} label="Cambio en funcionamiento %"><input type="number" min="-100" max="100" value=${draft.functioningChange} onChange=${event => this.updateDraft('functioningChange', event.target.value)}/></${FormField}><${FormField} label="Estado clínico"><select value=${draft.status} onChange=${event => this.updateDraft('status', event.target.value)}><option value="responding">Mejorando</option><option value="partial">Mejoría parcial</option><option value="stable">Estable</option><option value="review">Requiere revisión</option></select></${FormField}><${FormField} label="Riesgo actual"><select value=${draft.risk} onChange=${event => this.updateDraft('risk', event.target.value)}><option value="low">Bajo</option><option value="medium">Moderado</option><option value="high">Alto</option></select></${FormField}></div></div><div data-tour="assessment-form-note"><${FormField} label="Nota clínica"><textarea rows="4" value=${draft.note} onChange=${event => this.updateDraft('note', event.target.value)} placeholder="Cambios observados, contexto, adherencia, tolerabilidad y plan"></textarea></${FormField}></div><div className="form-note"><${Icon} name="shield" size=${17}/><span>El porcentaje de mejoría se recalculará contra el primer puntaje registrado de esta escala.</span></div><${FormActions} onCancel=${this.closeModal} submitLabel="Guardar evolución"/></form></${Modal}>`;
  }

  renderVitalsFormModal() {
    const draft = this.state.modal.draft;
    return html`<${Modal} title="Control físico" subtitle="Registre solo los datos disponibles durante esta consulta." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveVitalsForm}>${this.renderModalError()}<div className="form-grid form-grid-three" data-tour="vitals-form-body"><${FormField} label="Fecha"><input type="date" value=${draft.date} onChange=${event => this.updateDraft('date', event.target.value)} required/></${FormField}><${FormField} label="Peso (kg)"><input type="number" min="0" step="0.1" value=${draft.weight} onChange=${event => this.updateDraft('weight', event.target.value)}/></${FormField}><${FormField} label="Estatura (cm)"><input type="number" min="0" step="0.1" value=${draft.height} onChange=${event => this.updateDraft('height', event.target.value)}/></${FormField}></div><div className="form-grid form-grid-three" data-tour="vitals-form-cardio"><${FormField} label="Presión sistólica"><input type="number" min="0" value=${draft.systolic} onChange=${event => this.updateDraft('systolic', event.target.value)}/></${FormField}><${FormField} label="Presión diastólica"><input type="number" min="0" value=${draft.diastolic} onChange=${event => this.updateDraft('diastolic', event.target.value)}/></${FormField}><${FormField} label="Pulso (bpm)"><input type="number" min="0" value=${draft.pulse} onChange=${event => this.updateDraft('pulse', event.target.value)}/></${FormField}></div><div className="form-grid" data-tour="vitals-form-wellbeing"><${FormField} label="Sueño promedio (horas)"><input type="number" min="0" max="24" step="0.1" value=${draft.sleepCurrent} onChange=${event => this.updateDraft('sleepCurrent', event.target.value)}/></${FormField}><${FormField} label="Apetito"><select value=${draft.appetite} onChange=${event => this.updateDraft('appetite', event.target.value)}><option>No registrado</option><option>Sin cambios</option><option>Disminuido</option><option>Aumentado</option></select></${FormField}></div><${FormField} label="Notas"><textarea rows="3" value=${draft.notes} onChange=${event => this.updateDraft('notes', event.target.value)}></textarea></${FormField}><${FormActions} onCancel=${this.closeModal} submitLabel="Guardar control"/></form></${Modal}>`;
  }

  renderAdverseFormModal() {
    const draft = this.state.modal.draft;
    const patient = this.state.data.patients.find(item => item.id === this.state.modal.patientId);
    return html`<${Modal} title="Registrar efecto observado" subtitle="Describa temporalidad sin asumir causalidad automática." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveAdverseForm}>${this.renderModalError()}<div className="form-grid" data-tour="adverse-form-identification"><${FormField} label="Medicamento relacionado"><select value=${draft.medicationId} onChange=${event => this.updateDraft('medicationId', event.target.value)}><option value="">No definido</option>${patient?.medications?.map(item => html`<option key=${item.id} value=${item.id}>${item.name} · ${item.dose}</option>`)}</select></${FormField}><${FormField} label="Efecto observado"><select value=${draft.name} onChange=${event => this.updateDraft('name', event.target.value)}>${COMMON_ADVERSE_EFFECTS.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}></div>${draft.name === 'Otro' ? html`<${FormField} label="Nombre del efecto" required=${true}><input autoFocus value=${draft.customName} onChange=${event => this.updateDraft('customName', event.target.value)} required/></${FormField}>` : null}<div className="form-grid form-grid-three" data-tour="adverse-form-identification"><${FormField} label="Severidad"><select value=${draft.severity} onChange=${event => this.updateDraft('severity', event.target.value)}><option value="mild">Leve</option><option value="moderate">Moderada</option><option value="severe">Severa</option><option value="critical">Crítica</option></select></${FormField}><${FormField} label="Estado"><select value=${draft.status} onChange=${event => this.updateDraft('status', event.target.value)}><option value="active">Activo</option><option value="resolved">Resuelto</option><option value="unknown">Sin confirmar</option></select></${FormField}><${FormField} label="Fecha de aparición"><input type="date" value=${draft.onset} onChange=${event => this.updateDraft('onset', event.target.value)} required/></${FormField}></div><div data-tour="adverse-form-clinical"><${FormField} label="Relación temporal"><textarea rows="3" value=${draft.relation} onChange=${event => this.updateDraft('relation', event.target.value)} placeholder="Ej. apareció cuatro días después del aumento de dosis"></textarea></${FormField}><${FormField} label="Acción tomada"><input value=${draft.actionTaken} onChange=${event => this.updateDraft('actionTaken', event.target.value)} placeholder="Ej. observación, cambio de horario, evaluación adicional"/></${FormField}></div><${FormActions} onCancel=${this.closeModal} submitLabel="Guardar efecto"/></form></${Modal}>`;
  }

  renderLabFormModal() {
    const draft = this.state.modal.draft;
    return html`<${Modal} title="Nuevo resultado de laboratorio" subtitle="Use el rango y la bandera reportados por el laboratorio." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveLabForm}>${this.renderModalError()}<div className="form-grid" data-tour="lab-form-identification"><${FormField} label="Prueba" required=${true}><input autoFocus value=${draft.name} onChange=${event => this.updateDraft('name', event.target.value)} placeholder="Ej. TSH, HbA1c o litio sérico" required/></${FormField}><${FormField} label="Fecha"><input type="date" value=${draft.date} onChange=${event => this.updateDraft('date', event.target.value)} required/></${FormField}></div><div className="form-grid form-grid-three" data-tour="lab-form-identification"><${FormField} label="Resultado" required=${true}><input value=${draft.value} onChange=${event => this.updateDraft('value', event.target.value)} required/></${FormField}><${FormField} label="Unidad"><input value=${draft.unit} onChange=${event => this.updateDraft('unit', event.target.value)} placeholder="mg/dL"/></${FormField}><${FormField} label="Estado"><select value=${draft.status} onChange=${event => this.updateDraft('status', event.target.value)}><option value="normal">En rango</option><option value="low">Bajo</option><option value="high">Alto</option><option value="abnormal">Fuera de rango</option><option value="critical_low">Críticamente bajo</option><option value="critical_high">Críticamente alto</option></select></${FormField}></div><div data-tour="lab-form-interpretation"><${FormField} label="Rango de referencia"><input value=${draft.reference} onChange=${event => this.updateDraft('reference', event.target.value)} placeholder="Ej. 0.4–4.0 mUI/L"/></${FormField}><${FormField} label="Notas"><textarea rows="3" value=${draft.notes} onChange=${event => this.updateDraft('notes', event.target.value)}></textarea></${FormField}></div><${FormActions} onCancel=${this.closeModal} submitLabel="Guardar resultado"/></form></${Modal}>`;
  }

  renderAppointmentFormModal() {
    const draft = this.state.modal.draft;
    const patients = this.state.data.patients;
    return html`<${Modal} title=${draft.id ? 'Editar cita' : 'Nueva cita'} subtitle="La cita quedará guardada en la agenda local." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveAppointmentForm}>${this.renderModalError()}<div data-tour="appointment-form-who-when"><${FormField} label="Paciente" required=${true}><select value=${draft.patientId} onChange=${event => this.updateDraft('patientId', event.target.value)}>${patients.map(patient => html`<option key=${patient.id} value=${patient.id}>${patient.name} · ${patient.diagnosis}</option>`)}</select></${FormField}><div className="form-grid"><${FormField} label="Fecha y hora" required=${true}><input type="datetime-local" value=${draft.start} onChange=${event => this.updateDraft('start', event.target.value)} required/></${FormField}><${FormField} label="Duración"><select value=${draft.duration} onChange=${event => this.updateDraft('duration', event.target.value)}><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60">60 minutos</option><option value="90">90 minutos</option></select></${FormField}></div></div><div data-tour="appointment-form-details"><div className="form-grid form-grid-three"><${FormField} label="Tipo"><select value=${draft.type} onChange=${event => this.updateDraft('type', event.target.value)}><option>Seguimiento</option><option>Primera consulta</option><option>Prioritaria</option><option>Seguridad</option><option>Laboratorios</option></select></${FormField}><${FormField} label="Modalidad"><select value=${draft.modality} onChange=${event => this.updateDraft('modality', event.target.value)}><option>Presencial</option><option>Videollamada</option></select></${FormField}><${FormField} label="Estado"><select value=${draft.status} onChange=${event => this.updateDraft('status', event.target.value)}><option value="confirmed">Confirmada</option><option value="pending">Pendiente</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option><option value="no_show">No asistió</option></select></${FormField}></div><${FormField} label="Notas de preparación"><textarea rows="4" value=${draft.notes} onChange=${event => this.updateDraft('notes', event.target.value)} placeholder="Ej. revisar escala, adherencia, efectos y controles"></textarea></${FormField}></div><${FormActions} onCancel=${this.closeModal} submitLabel=${draft.id ? 'Guardar cambios' : 'Crear cita'}/></form></${Modal}>`;
  }

  renderReportModal() {
    const patient = this.state.data.patients.find(item => item.id === this.state.modal.patientId);
    if (!patient) return null;
    const report = buildPatientReport(patient, this.state.data.alerts);
    return html`<${Modal} title="Resumen del paciente" subtitle="Documento descriptivo para revisar o imprimir." onClose=${this.closeModal} size="xl"><div className="report-sheet"><div className="report-head"><${Logo} organization=${this.state.data.organization}/><div><span>Generado</span><b>${formatDateTime(report.generatedAt)}</b></div></div><div className="report-patient"><${Avatar} patient=${patient} size="lg"/><div><h2>${patient.name}</h2><p>${patient.age} años · ${patient.diagnosis} · ${patient.diagnosisCode}</p></div></div><div className="report-grid"><div><span>Medicamento principal</span><b>${report.medication?.name || 'Sin medicamento'}</b><small>${report.medication?.dose || '—'} · ${report.medication?.frequency || '—'}</small></div><div><span>Escala principal</span><b>${report.primary?.code || 'Sin escala'}</b><small>${report.baseline ?? '—'} → ${report.current ?? '—'}</small></div><div><span>Mejoría observada</span><b>${report.improvement === null ? '—' : percent(report.improvement)}</b><small>No implica causalidad automática.</small></div><div><span>Adherencia</span><b>${patient.adherence}%</b><small>Estimación registrada.</small></div></div><h3>Situación actual</h3><div className="report-list"><p><b>Estado clínico:</b> ${clinicalLabel(patient.status)}.</p><p><b>Riesgo registrado:</b> ${riskLabel(patient.risk)}.</p><p><b>Efectos activos:</b> ${report.activeAdverse.length ? report.activeAdverse.map(item => `${item.name} (${severityLabel(item.severity)})`).join(', ') : 'Ninguno registrado'}.</p><p><b>Alertas abiertas:</b> ${report.openAlerts.length ? report.openAlerts.map(item => item.title).join('; ') : 'Ninguna'}.</p><p><b>Próxima cita:</b> ${patient.nextVisit ? formatDateTime(patient.nextVisit) : 'Sin agendar'}.</p></div><div className="clinical-footnote"><${Icon} name="shield" size=${17}/> Este resumen apoya la revisión clínica. No diagnostica ni indica cambios terapéuticos.</div></div><div className="modal-sticky-actions"><${Button} tone="secondary" onClick=${this.closeModal}>Cerrar</${Button}><${Button} icon="print" onClick=${this.printReport}>Imprimir</${Button}></div></${Modal}>`;
  }

  renderHelpModal() {
    return html`<${Modal} title="Ayuda y tutorial" subtitle="Aprenda el sistema a su ritmo o consulte los conceptos esenciales." onClose=${this.closeModal} size="lg"><div className="help-content"><div className="help-tour-banner"><div className="guide-orb small"><span></span><span></span><span></span></div><div><span className="eyebrow">Recorrido guiado</span><h3>Le mostramos cada función directamente en la pantalla</h3><p>No modifica pacientes, medicamentos ni citas.</p></div></div><div className="help-tour-actions"><${Button} tone="secondary" icon="activity" onClick=${() => this.launchTourFromHelp('quick')}>Esencial · 6 min</${Button}><${Button} icon="overview" onClick=${() => this.launchTourFromHelp('full')}>Completo · 15 min</${Button}></div><div className="help-module-grid"><div className="help-step"><b>1</b><div><h3>Pacientes y seguro</h3><p>Registro, fotografía, contacto, cobertura, diagnóstico, escala inicial y próxima cita.</p></div></div><div className="help-step"><b>2</b><div><h3>Tratamiento y evolución</h3><p>Medicamentos, cambios de dosis, escalas, adherencia, funcionamiento, sueño y riesgo.</p></div></div><div className="help-step"><b>3</b><div><h3>Seguridad clínica</h3><p>Efectos observados, controles físicos, laboratorios y alertas.</p></div></div><div className="help-step"><b>4</b><div><h3>Recetas</h3><p>Indicaciones, membrete, varios medicamentos, impresión y PDF.</p></div></div><div className="help-step"><b>5</b><div><h3>Agenda y recordatorios</h3><p>Citas, estados, Google Calendar, archivo ICS y confirmaciones por WhatsApp.</p></div></div><div className="help-step"><b>6</b><div><h3>Clínica y equipo</h3><p>Logo, médico, pie de receta, secretaría, roles, permisos y accesibilidad.</p></div></div></div><div className="help-terms"><h3>Términos clínicos</h3><dl><div><dt>Valor inicial</dt><dd>Primera medición usada para comparar.</dd></div><div><dt>Mejoría observada</dt><dd>Cambio favorable durante el seguimiento, sin atribuir automáticamente la causa.</dd></div><div><dt>Adherencia</dt><dd>Estimación de cuánto sigue el paciente la indicación.</dd></div><div><dt>Relación temporal</dt><dd>Un evento ocurrió cerca del inicio o ajuste de un tratamiento.</dd></div></dl></div></div><div className="modal-sticky-actions"><${Button} onClick=${this.closeModal}>Cerrar</${Button}></div></${Modal}>`;
  }

  renderTutorialIntro() {
    if (!this.state.tutorialIntro) return null;
    return html`<div className="tutorial-intro-backdrop" role="dialog" aria-modal="true"><section className="tutorial-intro-card compact-intro"><button className="tutorial-close" onClick=${this.dismissTutorialIntro}><${Icon} name="close"/></button><span className="tutorial-kicker">Bienvenido a Linkare</span><h2>Tutorial más pequeño y estable</h2><p>Le mostraremos el flujo por pantallas, incluyendo Cobros y Wompi. No modifica datos.</p><div className="tutorial-mode-grid"><button className="tutorial-mode recommended" onClick=${() => this.startTour('quick')}><span>Recomendado</span><h3>Recorrido esencial</h3><p>Operación general en pocos pasos.</p><b>${buildExpandedTourSteps('quick').length} pasos</b></button><button className="tutorial-mode" onClick=${() => this.startTour('full')}><span>Completo</span><h3>Recorrido extendido</h3><p>Incluye seguridad, historial y configuración.</p><b>${buildExpandedTourSteps('full').length} pasos</b></button></div><button className="tutorial-explore" onClick=${this.dismissTutorialIntro}>Explorar por mi cuenta</button></section></div>`;
  }

  renderGuidedTour() {
    if (!this.state.tourActive) return null;
    const steps = this.getTourSteps();
    const step = steps[this.state.tourIndex];
    if (!step) return null;
    const isLast = this.state.tourIndex === steps.length - 1;
    const progress = ((this.state.tourIndex + 1) / steps.length) * 100;
    return html`<div className="guided-tour compact-guided-tour visible-background-tour" role="complementary" aria-label="Tutorial de Linkare" aria-live="polite"><aside className="tour-card compact-card"><header className="tour-card-head"><div className="tour-guide"><div className="guide-orb tiny"><span></span><span></span><span></span></div><div><span>${step.chapter}</span><b>Paso ${this.state.tourIndex + 1} de ${steps.length}</b></div></div><button className="tutorial-close" aria-label="Cerrar tutorial" onClick=${this.exitTour}><${Icon} name="close"/></button></header><div className="tour-progress"><i style=${{ width: `${progress}%` }}></i></div><div className="tour-card-body"><div className="tour-look-at-screen"><${Icon} name="overview" size=${17}/><span><b>Mire la pantalla.</b> El fondo permanece visible para que identifique dónde está y qué contiene esta sección.</span></div><span className="tour-step-icon"><${Icon} name=${step.icon || 'help'} size=${20}/></span><h2>${step.title}</h2><p>${step.description}</p><div className="tour-context-chip">Pantalla actual: <b>${step.view === 'payments' ? 'Cobros' : step.view === 'patient' ? 'Expediente' : step.view === 'analytics' ? 'Resultados' : step.view === 'dashboard' ? 'Inicio' : step.view === 'settings' ? 'Configuración' : step.view === 'alerts' ? 'Alertas' : step.view === 'agenda' ? 'Agenda' : step.view === 'patients' ? 'Pacientes' : step.view}</b></div>${step.items?.length ? html`<ul>${step.items.map(item => html`<li key=${item}><${Icon} name="check" size=${15}/><span>${item}</span></li>`)}</ul>` : null}</div><footer className="tour-card-footer"><button className="tour-exit" onClick=${this.exitTour}>Salir</button><div><${Button} tone="secondary" disabled=${this.state.tourIndex === 0} onClick=${this.previousTourStep}>Anterior</${Button}><${Button} icon=${isLast ? 'check' : 'chevronRight'} onClick=${this.nextTourStep}>${isLast ? 'Finalizar' : 'Siguiente'}</${Button}></div></footer></aside></div>`;
  }

  renderAppointmentDetails() {
    const appointment = this.state.appointmentDetails;
    if (!appointment) return null;
    const patient = this.state.data.patients.find(item => item.id === appointment.patientId);
    const reminders = getReminderQueue(this.state.data).filter(item => item.appointment.id === appointment.id);
    const insurance = patient?.insurance || {};
    return html`<${Modal} title="Detalle de la cita" subtitle="Revise datos administrativos, recordatorios y estado." onClose=${() => this.setState({ appointmentDetails: null })} size="lg"><div className="appointment-detail-hero" data-tour="appointment-detail-summary"><${Avatar} patient=${patient} size="lg"/><div><span className="eyebrow">${appointment.type}</span><h3>${appointment.title}</h3><p>${this.can('clinicalView') ? patient?.diagnosis || '' : patient?.phone || 'Sin teléfono registrado'}</p></div><${Badge} tone=${appointment.status === 'confirmed' ? 'success' : appointment.status === 'pending' ? 'warning' : appointment.status === 'cancelled' || appointment.status === 'no_show' ? 'danger' : 'neutral'}>${statusLabel(appointment.status)}</${Badge}></div>
      <div className="appointment-info"><div><${Icon} name="calendar"/><span>Fecha</span><b>${formatLongDate(appointment.start)}</b></div><div><${Icon} name="clock"/><span>Hora</span><b>${formatTime(appointment.start)} – ${formatTime(appointment.end)}</b></div><div><${Icon} name="activity"/><span>Modalidad</span><b>${appointment.modality}</b></div><div><${Icon} name="insurance"/><span>Cobertura</span><b>${insurance.hasInsurance ? insurance.provider || 'Seguro médico' : 'Particular'}</b></div></div>
      ${insurance.hasInsurance && insurance.authorizationRequired ? html`<div className="appointment-insurance-warning"><${Icon} name="insurance" size=${18}/><div><b>Autorización de seguro requerida</b><p>${insurance.plan || 'Plan sin registrar'}${insurance.memberId ? ` · Afiliado ${insurance.memberId}` : ''}${insurance.copay ? ` · Copago ${insurance.copay}` : ''}</p></div></div>` : null}
      <div className="notes-box"><span>Notas de preparación</span><p>${appointment.notes || 'Sin notas.'}</p></div>
      <section className="appointment-reminder-section"><header><div><span className="eyebrow">Confirmación de cita</span><h3>Recordatorios</h3></div><div>${reminders.map(reminder => html`<${Badge} key=${reminder.id} tone=${reminder.status === 'sent' ? 'success' : reminder.status === 'due' || reminder.status === 'overdue' ? 'warning' : 'neutral'}>${reminderLabel(reminder.hours)} · ${reminder.status === 'sent' ? 'Enviado' : reminder.status === 'due' ? 'Listo' : reminder.status === 'overdue' ? 'Pendiente' : 'Programado'}</${Badge}>`)}</div></header>${this.can('remindersManage') ? html`<div className="appointment-reminder-actions">${reminders.filter(reminder => reminder.status !== 'sent').slice(0, 3).map(reminder => html`<div key=${reminder.id}><span>${reminderLabel(reminder.hours)}</span><${Button} tone="soft" icon="message" onClick=${() => this.sendReminderWhatsApp(reminder)}>WhatsApp</${Button}><${Button} tone="secondary" onClick=${() => this.copyReminderMessage(reminder)}>Copiar</${Button}><button className="reminder-done" title="Marcar como enviado" onClick=${() => this.completeReminder(reminder)}><${Icon} name="check" size=${17}/></button></div>`)}</div>` : null}</section>
      <div className="appointment-actions-grid" data-tour="appointment-detail-actions">${this.can('appointmentsManage') ? html`<${Button} tone="secondary" icon="edit" onClick=${() => this.openEditAppointment(appointment)}>Editar cita</${Button}>` : null}<a className="button button-secondary" href=${googleCalendarUrl(appointment)} target="_blank" rel="noreferrer"><${Icon} name="external" size=${18}/><span>Abrir en Google</span></a>${this.can('exportsManage') ? html`<${Button} tone="secondary" icon="download" onClick=${() => downloadICS(appointment)}>Descargar ICS</${Button}>` : null}<${Button} tone="soft" onClick=${() => this.openPatient(appointment.patientId)}>Abrir paciente</${Button}></div>
      ${this.can('appointmentsManage') ? html`<div className="status-actions"><span>Cambiar estado:</span>${[['confirmed', 'Confirmada'], ['pending', 'Pendiente'], ['completed', 'Completada'], ['cancelled', 'Cancelada'], ['no_show', 'No asistió']].map(([key, label]) => html`<button key=${key} className=${appointment.status === key ? 'active' : ''} onClick=${() => this.updateAppointmentStatus(appointment.id, key)}>${label}</button>`)}</div><div className="danger-zone"><button onClick=${() => this.deleteAppointment(appointment.id)}><${Icon} name="trash" size=${17}/> Eliminar cita</button></div>` : null}
    </${Modal}>`;
  }

  render() {
    if (productionMode && this.state.productionLoading) return html`<main className="production-loading"><section><div className="guide-orb small"><span></span><span></span><span></span></div><h1>Conectando Linkare</h1><p>Verificando sesión y cargando la base de datos de Supabase…</p></section></main>`;
    if (!this.state.authenticatedUserId) return this.renderLogin();
    const view = this.state.view;
    const settings = this.state.data.settings || {};
    const body = view === 'dashboard' ? this.renderDashboard()
      : view === 'patients' ? this.renderPatients()
        : view === 'patient' ? this.renderPatient()
          : view === 'agenda' ? this.renderAgenda()
            : view === 'payments' ? this.renderPayments()
              : view === 'analytics' ? this.renderAnalytics()
                : view === 'alerts' ? this.renderAlerts()
                  : this.renderSettings();
    return html`<div className=${`app-shell ${settings.largeText ? 'large-text-mode' : ''} ${settings.reducedMotion ? 'reduced-motion-mode' : ''} ${this.state.tourActive ? 'tour-visible-layout' : ''}`}><div className="ambient ambient-one"></div><div className="ambient ambient-two"></div><div className="app-frame">${this.renderTopbar()}<main className="main-content">${body}</main><footer><span>Linkare · Apoyo al seguimiento</span><span>${productionMode ? (this.state.remoteSaveStatus === 'saving' ? 'Guardando en Supabase…' : this.state.remoteSaveStatus === 'error' ? 'Error de guardado' : 'Supabase conectado') : 'Modo demo · Datos sintéticos'}</span></footer></div>${this.renderModal()}${this.renderAppointmentDetails()}${this.renderTutorialIntro()}${this.renderGuidedTour()}${this.state.toast ? html`<div className=${`toast toast-${this.state.toastTone}`}><${Icon} name=${this.state.toastTone === 'danger' ? 'alert' : 'check'} size=${18}/>${this.state.toast}</div>` : null}</div>`;
  }
}

export { App };

createRoot(document.getElementById('root')).render(html`<${AppErrorBoundary}><${App}/></${AppErrorBoundary}>`);
