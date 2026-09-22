import { permissionAllowed, PERMISSION_KEYS, ROLE_LABELS, OWNER_ONLY, defaultPermissions, changePermission } from './domain/permissions.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import '../styles.css';
import {
  COMMON_ADVERSE_EFFECTS,
  FREQUENCIES,
  MEDICATION_CLASSES,
  SCALE_CATALOG,
  createEmptyData,
  normalizeData,
} from './data.js';
import {
  addDays,
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
  archiveClinicalRecord,
  approveCapturedMedication,
  adverseFormDefaults,
  analyticsRows,
  appointmentFormDefaults,
  assessmentFormDefaults,
  buildPatientReport,
  changeAppointmentStatus,
  changeAppointmentReviewStatus,
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
  updateMedication,
  updateAlertStatus,
  updatePatientDocumentMetadata,
  updatePatientProfile,
  validateImportedData,
  vitalsFormDefaults,
} from './clinical.js';
import {
  PERMISSION_CATALOG,
  REMINDER_OPTIONS,
  buildPrescriptionPrintHtml,
  buildReminderMessage,
  emailReminderUrl,
  clinicProfileDefaults,
  getActiveUser,
  getReminderQueue,
  hasPermission,
  markReminderSent,
  optimizeImageFile,
  prescriptionFormDefaults,
  prescriptionItemFromMedication,
  reminderLabel,
  savePatientPhoto,
  savePracticeProfile,
  savePrescription,
  secretaryFormDefaults,
  sortMedicationsBySchedule,
  smsReminderUrl,
  whatsappReminderUrl,
  voidPrescription,
} from './practice.js';
import {
  createWompiPaymentLink,
  fetchWompiAppInfo,
  fetchSubscriptionInvoices, fetchBilling,
  supabaseConfigured,
} from './services/wompi.js';
import {
  productionMode,
  signUpProduction,
  signInProduction,
  getProductionSession,
  signOutProduction,
  bootstrapAndLoadState,
  archiveMedication,
  archivePatient,
  captureReportedMedication,
  loadDailyAgenda,
  saveProductionState,
  setPersistenceBaseline, resetPersistence, readableError, onAuthChange, checkProductionAccess,
  requestPasswordReset, resendConfirmation, setAccountPassword, changeAccountPassword,
} from './services/appState.js';
import {
  CONFIDENTIALITY_LEVELS,
  DEATH_MANNER_OPTIONS,
  DOCUMENT_CATEGORIES,
  GENDER_IDENTITY_OPTIONS,
  RELATIONSHIP_STATUS_OPTIONS,
  REMINDER_CHANNELS,
  SEX_ASSIGNED_AT_BIRTH_OPTIONS,
  SEXUAL_ORIENTATION_OPTIONS,
  VITAL_STATUS_OPTIONS,
  annualPlanSnapshot,
  appointmentReadyForConsultation,
  buildPostmortemReportHtml,
  createEncounterDraft,
  createEncounterCorrection,
  documentIconName,
  humanFileSize,
  reminderChannelLabel,
  upsertEncounter,
} from './v2features.js';
import {
  createPatientDocument,
  deletePatientDocumentFile,
  downloadPatientDocument,
  openPatientDocument,
} from './services/documents.js';
import { fetchReminderProviderStatus, sendDailyAgendaToWhatsApp, sendReminderThroughProvider } from './services/reminders.js';
import {
  createAppleCalendarFeed,
  fetchCalendarIntegrationStatus,
  listCalendarFeeds,
  requestGoogleCalendarConnection,
  syncAppointmentToGoogle,
} from './services/calendar.js';

import { manageTeam } from './services/team.js';
import { generateDocumentFromTemplate, listDocumentTemplates } from './services/templates.js';
import {listFamilyReminderRecipients,removeFamilyReminderRecipient,saveFamilyReminderRecipient} from './services/familyReminders.js';
import { SECRETARY_PERMISSIONS } from './domain/records.js';
import { PLAN_OPTIONS, subscriptionView } from './domain/plans.js';
const html = htm.bind(React.createElement);
const SUPPORT_WHATSAPP_NUMBER=String(import.meta.env.VITE_SUPPORT_WHATSAPP_NUMBER||'').replace(/\D/g,'');
const TUTORIAL_URL=/^https:\/\//.test(String(import.meta.env.VITE_TUTORIAL_URL||''))?String(import.meta.env.VITE_TUTORIAL_URL):'';
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
  notebook: '<path d="M4 3h13a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V3Z"/><path d="M8 7h7M8 11h7M8 15h5M4 6H2M4 10H2M4 14H2M4 18H2"/>',
  folder: '<path d="M3 5h6l2 2h10v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z"/>',
  paperclip: '<path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 1 1-2.8-2.8l8.9-8.9"/>',
  play: '<path d="m7 4 13 8-13 8V4Z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>',
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

function ElapsedClock({start}) {
  const [now,setNow]=React.useState(Date.now());
  React.useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const sec=Math.max(0,Math.floor((now-new Date(start).getTime())/1000));
  return html`<span className="notebook-timer">${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}</span>`;
}

function KpiCard({ label, value, hint, icon, tone = 'purple', chart, tour = null }) {
  return html`<${Card} className=${`kpi-card kpi-${tone}`} tour=${tour}><div className="kpi-top"><span>${label}</span><span className="kpi-icon"><${Icon} name=${icon} size=${19}/></span></div><div className="kpi-body"><div><strong>${value}</strong><small>${hint}</small></div>${chart || null}</div></${Card}>`;
}

function Modal({ title, subtitle, children, onClose, size = 'md' }) {
  return html`<div className="modal-backdrop" onMouseDown=${event => event.target === event.currentTarget && onClose()}><div className=${`modal modal-${size}`} role="dialog" aria-modal="true" aria-label=${title}><div className="modal-header"><div><span className="eyebrow">Linkare</span><h2>${title}</h2>${subtitle ? html`<p>${subtitle}</p>` : null}</div><button className="icon-button" aria-label="Cerrar" onClick=${onClose}><${Icon} name="close"/></button></div><div className="modal-body">${children}</div></div></div>`;
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

function FormActions({ onCancel, submitLabel = 'Guardar', dangerAction = null, disabled = false }) {
  return html`<div className="form-actions">${dangerAction ? html`<div>${dangerAction}</div>` : html`<div></div>`}<div><${Button} tone="secondary" disabled=${disabled} onClick=${onCancel}>Cancelar</${Button}><${Button} icon="check" type="submit" disabled=${disabled}>${disabled?'Guardando…':submitLabel}</${Button}></div></div>`;
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

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) { console.error('Linkare UI error', error?.name || 'Error'); }


  render() {
    if(!this.state.error)return this.props.children;
    return html`<main className="state-screen"><section className="state-card" role="alert"><img className="state-brand" src="/assets/linkare-wordmark.png" alt="Linkare"/><span className="state-symbol"><${Icon} name="alert" size=${36}/></span><h1>No pudimos mostrar esta pantalla</h1><p>Recargue para recuperar los registros ya guardados. Las anotaciones que todavía no se sincronizaron podrían no recuperarse.</p><${Button} onClick=${()=>location.reload()}>Recargar aplicación</${Button}></section></main>`;
  }
}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.authEpoch=0; this.mounted=false; this.persistTask=null;
    const data=createEmptyData();
    this.state={
      data,authenticatedUserId:null,authView:'login',
      loginDraft:{email:'',password:'',showPassword:false},
      registerDraft:{fullName:'',clinicName:'',email:'',password:'',confirmPassword:'',showPassword:false},
      passwordDraft:{password:'',confirmPassword:''},authNotice:'',loginError:'',loginBusy:false,
      productionLoading:true,loadingSlow:false,networkOffline:!navigator.onLine,
      remoteOrganizationId:null,remoteReady:false,subscriptionWritable:false,complimentaryAccess:false,remoteSaveStatus:'waiting',saveError:'',
      wompiBusy:false,wompiStatus:{state:'idle',app:null,error:''},billingData:{plans:[],subscription:null,orders:[]},billingError:'',billingLoading:false,
      teamInvites:[],teamBusy:false,view:'dashboard',selectedPatientId:null,patientTab:'overview',patientFilter:'all',search:'',mobileNav:false,
      modal:null,modalError:'',appointmentDetails:null,appointmentPrompt:null,promptDismissedFor:null,
      activeEncounter:null,encounterAutosaveStatus:'saved',documentBusy:false,
      reminderProviders:{email:false,sms:false,whatsapp:false},calendarStatus:{google:{connected:false},apple:{connected:false,feedUrl:''}},integrationBusy:false,
      dailyAgenda:{date:toDateInput(new Date()),timezone:'America/El_Salvador',items:[]},dailyAgendaLoading:false,
      calendarDate:new Date(),calendarView:'month',appointmentFilter:'all',chartMode:'scales',timelineFilter:'all',toast:null,toastTone:'success',
      tutorialIntro:false,tourActive:false,tourMode:'quick',tourIndex:0,tourPreviewRole:null,
    };
  }

  scheduleTutorialIntro = () => {};

  applyProductionSession = async (session, requestedOrganizationName=null) => {
    const epoch=++this.authEpoch;
    const remote=await bootstrapAndLoadState(null,requestedOrganizationName);
    if(epoch!==this.authEpoch || !this.mounted)return;
    const data=normalizeData(remote.payload);
    const user=data.users.find(u=>u.id===session.user.id && u.active);
    if(!user || !['owner','doctor','nurse','secretary'].includes(user.role))throw new Error('Su cuenta no tiene acceso habilitado.');
    data.settings.activeUserId=user.id;
    this.persistedData=data;
    setPersistenceBaseline(remote.organizationId,data,remote.revisions,Object.fromEntries(PERMISSION_KEYS.map(k=>[k,permissionAllowed(user,k)])));
    clearTimeout(this.loadingTimer);
    this.setState({data,authenticatedUserId:user.id,remoteOrganizationId:remote.organizationId,remoteReady:true,subscriptionWritable:remote.entitled===true,complimentaryAccess:remote.complimentaryAccess===true,remoteSaveStatus:'saved',saveError:'',
      productionLoading:false,loginBusy:false,loginError:'',authNotice:'',loginDraft:{email:'',password:'',showPassword:false},
      registerDraft:{fullName:'',clinicName:'',email:'',password:'',confirmPassword:'',showPassword:false},
      selectedPatientId:null,view:'dashboard',modal:null,patientTab:'overview',activeEncounter:null},()=>{
        if(user.role==='owner'){this.loadSubscriptionInvoices();this.refreshTeam();}
        this.loadIntegrationStatus();this.refreshDailyAgenda();this.checkConsultationPrompt();
      });
  };

  refreshDailyAgenda = async (date=toDateInput(new Date())) => {
    if(!this.state.remoteOrganizationId||!this.can('clinicalView')||!this.can('appointmentsManage'))return;
    const epoch=this.authEpoch;this.setState({dailyAgendaLoading:true});
    try{const agenda=await loadDailyAgenda(this.state.remoteOrganizationId,date);if(epoch===this.authEpoch)this.setState({dailyAgenda:agenda,dailyAgendaLoading:false});}
    catch(_){if(epoch===this.authEpoch)this.setState({dailyAgendaLoading:false});}
  };

  printDailyAgenda = () => {
    const agenda=this.state.dailyAgenda||{items:[]};const popup=window.open('','_blank','width=900,height=980');
    if(!popup)return this.notify('El navegador bloqueó la ventana de impresión.','danger');popup.opener=null;
    const rows=(agenda.items||[]).map(item=>`<tr><td>${formatTime(item.start)}</td><td>${String(item.patientName||'').replace(/[<>&]/g,'')}</td><td>${item.currentMedication?`${String(item.currentMedication.name||'').replace(/[<>&]/g,'')} ${String(item.currentMedication.dose||'').replace(/[<>&]/g,'')}`:'Sin tratamiento activo'}</td><td>${String(item.relevantNote||'Sin cambio reciente').replace(/[<>&]/g,'')}</td></tr>`).join('');
    popup.document.write(`<!doctype html><html lang="es"><meta charset="utf-8"><title>Agenda del día</title><style>body{font:14px Arial;color:#17324d;padding:30px}h1{color:#05316e}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #ccd8e3;text-align:left}th{background:#05316e;color:#fff}</style><h1>Agenda del día</h1><p>${formatLongDate(agenda.date)}</p><table><thead><tr><th>Hora</th><th>Paciente</th><th>Medicamento actual</th><th>Último cambio relevante</th></tr></thead><tbody>${rows}</tbody></table><script>print()</script></html>`);popup.document.close();
  };

  sendDailyAgenda = async () => {
    if(!this.state.reminderProviders.whatsapp)return this.notify('WhatsApp aún no está configurado para envíos reales.','danger');
    this.setState({integrationBusy:true});
    try{const result=await sendDailyAgendaToWhatsApp(this.state.remoteOrganizationId,this.state.dailyAgenda.date);this.setState({integrationBusy:false});this.notify(result.duplicate?'La agenda ya había sido procesada.':'Agenda aceptada por WhatsApp.');}
    catch(error){this.setState({integrationBusy:false});this.notify(error.message||'No se pudo enviar la agenda.','danger');}
  };

  restoreProductionSession = async () => {
    if(this.restoring)return;this.restoring=true;
    this.setState({productionLoading:true,loadingSlow:false});
    clearTimeout(this.loadingTimer);
    this.loadingTimer=setTimeout(()=>{if(this.mounted)this.setState({loadingSlow:true});},15000);
    try{
      const session=await getProductionSession();
      const action=new URLSearchParams(location.search).get('auth');
      if(['reset','invite'].includes(action)){
        if(!session)throw new Error('Este enlace venció o no es válido. Solicite un nuevo correo de acceso.');
        this.setState({authView:'set-password',productionLoading:false,loginBusy:false});return;
      }
      if(!session){this.setState({productionLoading:false,authenticatedUserId:null});return;}
      await this.applyProductionSession(session);
    }catch(error){this.setState({productionLoading:false,authenticatedUserId:null,remoteReady:false,loginError:readableError(error)});}
    finally{clearTimeout(this.loadingTimer);this.restoring=false;}
  };

  componentDidMount() {
    this.mounted=true;
    window.addEventListener('keydown',this.handleKeyDown);
    window.addEventListener('online',this.handleOnline);
    window.addEventListener('offline',this.handleOffline);
    window.addEventListener('beforeunload',this.warnUnsaved);
    this.consultationPromptTimer=setInterval(this.checkConsultationPrompt,30000);
    this.accessTimer=setInterval(this.validateSessionAccess,30000);
    window.addEventListener('focus',this.validateSessionAccess);
    this.authSubscription=onAuthChange((event,session)=>{
      // Do not await SDK calls inside this callback: Supabase holds its auth lock.
      const eventEpoch=this.authEpoch;
      setTimeout(()=>{
        if(!this.mounted || eventEpoch!==this.authEpoch)return;
        if(event==='SIGNED_OUT')this.clearSessionView();
        if(event==='SIGNED_IN' && this.state.authenticatedUserId && session?.user?.id!==this.state.authenticatedUserId){this.clearSessionView();this.restoreProductionSession();}
        if(event==='PASSWORD_RECOVERY')this.setState({authenticatedUserId:null,authView:'set-password',productionLoading:false});
      },0);
    });
    this.restoreProductionSession();
  }

  componentWillUnmount() {
    this.mounted=false;this.authEpoch++;
    window.removeEventListener('keydown',this.handleKeyDown);
    window.removeEventListener('online',this.handleOnline);window.removeEventListener('offline',this.handleOffline);window.removeEventListener('beforeunload',this.warnUnsaved);
    this.authSubscription?.unsubscribe();
    clearInterval(this.accessTimer);window.removeEventListener('focus',this.validateSessionAccess);
    for(const timer of [this.persistTimer,this.toastTimer,this.loadingTimer,this.encounterSaveIndicatorTimer])clearTimeout(timer);
    clearInterval(this.consultationPromptTimer);clearInterval(this.encounterTimer);document.body.style.overflow='';
  }

  componentDidUpdate(prevProps,prevState) {
    if(prevState.data!==this.state.data && this.state.data!==this.persistedData && this.state.remoteReady)this.schedulePersist();
    const overlay=Boolean(this.state.modal||this.state.appointmentDetails);
    if(overlay!==Boolean(prevState.modal||prevState.appointmentDetails))document.body.style.overflow=overlay?'hidden':'';
  }

  handleKeyDown = event => {if(event.key==='Escape'){if(this.state.modal)this.closeModal();else if(this.state.appointmentDetails)this.setState({appointmentDetails:null});}};

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

  submitLogin = async event => {
    event?.preventDefault();if(this.state.loginBusy)return;
    this.setState({loginBusy:true,loginError:'',authNotice:''});
    try{const session=await signInProduction(this.state.loginDraft.email,this.state.loginDraft.password);await this.applyProductionSession(session);}
    catch(error){this.setState({loginBusy:false,productionLoading:false,loginError:readableError(error)});}
  };

  validateSessionAccess = async () => {
    if(!this.state.remoteReady||!navigator.onLine||this.checkingAccess)return;
    const epoch=this.authEpoch;this.checkingAccess=true;
    try {
      const access=await checkProductionAccess(this.state.remoteOrganizationId);
      if(epoch!==this.authEpoch)return;
      const user=this.activeUser();
      if(user && (access.role!==user.role || JSON.stringify(access.permissions)!==JSON.stringify(user.permissions))){
        this.clearSessionView();await this.restoreProductionSession();
      }
    } catch(error) {
      if(epoch===this.authEpoch && /ACCOUNT_DISABLED|ACCESS_DENIED/.test(error.original||'')){
        this.clearSessionView();await signOutProduction().catch(()=>{});
        this.setState({authNotice:'El propietario cambió o desactivó su acceso. Inicie sesión nuevamente.'});
      }
    } finally {this.checkingAccess=false;}
  };

  logoutUser = async () => {
    if(this.loggingOut)return;this.loggingOut=true;
    let notice='';
    try { if(['dirty','saving','error','offline'].includes(this.state.remoteSaveStatus))await this.flushChanges(); }
    catch(error) { notice='No fue posible guardar los últimos cambios. '+readableError(error); }
    try { await signOutProduction(); } catch(error) { notice=notice||readableError(error); }
    finally { this.clearSessionView();this.loggingOut=false;if(notice)this.setState({authNotice:notice}); }
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

  saveAccountPassword = async event => {
    event.preventDefault();if(this.state.loginBusy)return;const d=this.state.modal.draft;
    if(d.newPassword!==d.confirmPassword)return this.setState({modalError:'Las contraseñas no coinciden.'});
    this.setState({loginBusy:true});
    try{await changeAccountPassword(this.activeUser().email,d.currentPassword,d.newPassword);this.setState({modal:null,loginBusy:false});this.notify('Contraseña actualizada.');}
    catch(error){this.setState({loginBusy:false,modalError:readableError(error)});}
  };

  getTourSteps = () => [
    {title:'Inicio',text:'Revise la agenda del día. Puede abrir un expediente o iniciar una consulta desde una cita.'},
    {title:'Pacientes',text:'Busque un paciente o registre uno nuevo. La secretaría utiliza únicamente los datos administrativos autorizados.'},
    ...(this.can('clinicalView')?[{title:'Expediente',text:'Medicamentos, dosis, evolución, documentos y consultas están reunidos en la ficha. Las notas firmadas se abren con Ver nota.'},{title:'Libreta',text:'Durante la consulta, escriba sus anotaciones. Compruebe el estado de guardado antes de cerrar. Una nota firmada no puede reemplazarse.'}]:[]),
    {title:'Agenda',text:'Cree, confirme o reprograme citas. Prepare recordatorios según las preferencias autorizadas por el paciente.'},
    ...(this.can('settingsManage')?[{title:'Equipo y plan',text:'Agregue doctores, enfermería y secretaría desde Configuración. El plan gratuito habilita todos los módulos según los permisos asignados.'}]:[])
  ];

  startTour = () => this.openHelp();

  schedulePersist = () => {
    clearTimeout(this.persistTimer);
    if(!this.state.remoteReady)return;
    this.setState({remoteSaveStatus:'dirty'});
    this.persistTimer=setTimeout(()=>this.flushChanges().catch(()=>{}),900);
  };

  notify = (message, tone = 'success') => {
    this.setState({ toast: message, toastTone: tone });
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.setState({ toast: null }), 3200);
  };

  setView = view => {
    const required={patients:'patientsView',patient:'patientsView',agenda:'appointmentsManage',payments:'settingsManage',analytics:'analyticsView',alerts:'alertsView',settings:'settingsManage',notebook:'consultationsManage'};
    if(required[view]&&!this.can(required[view]))return this.permissionDenied();
    this.setState({view,mobileNav:false,appointmentDetails:null});
    if(view==='payments')this.loadSubscriptionInvoices();
    if(view==='settings')this.refreshTeam();
    requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'auto'}));
  };

  selectedPatient = () => this.state.data.patients.find(p=>p.id===this.state.selectedPatientId)||null;

  activeUser = () => (this.state.data.users||[]).find(u=>u.id===this.state.authenticatedUserId && u.active!==false)||null;

  can = permission => {
    const user=this.activeUser();
    const allowed=permissionAllowed(user,permission);
    return allowed;
  };

  permissionDenied = () => {
    this.notify('Su cuenta no tiene permiso para esta acción. Contacte al responsable del consultorio.', 'danger');
    return false;
  };

  openPatient = patientId => {
    if (!this.can('patientsView')) return this.permissionDenied();
    this.setState({ selectedPatientId: patientId, view: 'patient', patientTab: 'overview', chartMode: 'scales', timelineFilter: 'all', mobileNav: false, appointmentDetails: null });
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  };

  closeModal = () => {if(!this.state.formSaving&&!this.state.documentBusy)this.setState({ modal: null, modalError: '' });};

  updateDraft = (key, value) => {
    this.setState(prev => ({ modal: prev.modal ? { ...prev.modal, draft: { ...prev.modal.draft, [key]: value } } : null, modalError: '' }));
  };

  updateClinicPhone = (phoneId, key, value) => {
    this.setState(prev => ({ modal: prev.modal ? { ...prev.modal, draft: { ...prev.modal.draft, phones: (prev.modal.draft.phones || []).map(item => item.id === phoneId ? { ...item, [key]: value } : item) } } : null, modalError: '' }));
  };

  addClinicPhone = () => {
    this.setState(prev => ({ modal: prev.modal ? { ...prev.modal, draft: { ...prev.modal.draft, phones: [...(prev.modal.draft.phones || []), { id: `phone_${Date.now()}`, label: 'Otro teléfono', number: '' }] } } : null, modalError: '' }));
  };

  removeClinicPhone = phoneId => {
    this.setState(prev => ({ modal: prev.modal ? { ...prev.modal, draft: { ...prev.modal.draft, phones: (prev.modal.draft.phones || []).filter(item => item.id !== phoneId) } } : null, modalError: '' }));
  };

  updateDocumentVariable = (key, value) => {
    this.setState(prev => ({ modal: prev.modal ? { ...prev.modal, draft: { ...prev.modal.draft, variables: { ...(prev.modal.draft.variables || {}), [key]: value } } } : null, modalError: '' }));
  };

  updateDraftPermission = (key, value) => {
    this.setState(prev => ({
      modal: prev.modal ? {
        ...prev.modal,
        draft: {
          ...prev.modal.draft,
          permissions: changePermission(prev.modal.draft.permissions || {},key,value),
        },
      } : null,
      modalError: '',
    }));
  };

  openNewPatient = () => {
    if (!this.can('patientsCreate')) return this.permissionDenied();
    const draft = patientFormDefaults();
    if (!this.can('clinicalEdit')) {
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

  openMedication = (patient, medication = null) => {
    if (!this.can('medicationsManage') && !this.can('medicationsCapture')) return this.permissionDenied();
    if (medication && !this.can('medicationsManage')) return this.permissionDenied();
    this.setState({ modal: { type: 'medication', patientId: patient.id, draft: medicationFormDefaults(patient, medication) }, modalError: '' });
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

  openAssessment = (patient, assessment = null, point = null) => {
    if (!this.can('clinicalEdit')) return this.permissionDenied();
    this.setState({ modal: { type: 'assessment', patientId: patient.id, draft: assessmentFormDefaults(patient, assessment, point) }, modalError: '' });
  };

  openVitals = (patient, record = null) => {
    if (!this.can('clinicalEdit')) return this.permissionDenied();
    this.setState({ modal: { type: 'vitals', patientId: patient.id, draft: vitalsFormDefaults(patient, record) }, modalError: '' });
  };

  openAdverse = (patient, adverseEvent = null) => {
    if (!this.can('clinicalEdit')) return this.permissionDenied();
    this.setState({ modal: { type: 'adverse', patientId: patient.id, draft: adverseFormDefaults(patient, adverseEvent) }, modalError: '' });
  };

  openLab = (patient, lab = null) => {
    if (!this.can('clinicalEdit')) return this.permissionDenied();
    this.setState({ modal: { type: 'lab', patientId: patient.id, draft: labFormDefaults(patient, lab) }, modalError: '' });
  };

  openClinicalArchive = (patient, resource, recordId, label, patientTab) => {
    const permission = resource === 'patient' ? 'patientsEdit' : resource === 'document' ? 'documentsManage' : resource === 'consultation' ? 'consultationsManage' : 'clinicalEdit';
    if (!this.can(permission)) return this.permissionDenied();
    this.setState({ modal: { type: 'clinicalArchive', patientId: patient.id, resource, recordId, patientTab, draft: { label, reason: '' } }, modalError: '' });
  };

  openDocumentEdit = (patient, document) => {
    if (!this.can('documentsManage')) return this.permissionDenied();
    this.setState({ modal: { type: 'documentEdit', patientId: patient.id, draft: { id: document.id, name: document.name, category: document.category, description: document.description || '', clinicalDate: String(document.clinicalDate || document.createdAt).slice(0, 10), confidentiality: document.confidentiality || 'Clínico' } }, modalError: '' });
  };

  openReport = patient => {
    if (!this.can('clinicalView')) return this.permissionDenied();
    this.setState({ modal: { type: 'report', patientId: patient.id, draft: {} }, modalError: '' });
  };

  openPrescription = patient => {
    if (!this.can('prescriptionsCreate')) return this.permissionDenied();
    this.setState({ modal: { type: 'prescription', patientId: patient.id, draft: prescriptionFormDefaults(patient, this.state.data.organization) }, modalError: '' });
  };

  editPrescription = (patient,prescription) => {
    if(!this.can('prescriptionsEdit'))return this.permissionDenied();
    if(prescription.status==='voided'||prescription.archivedAt)return this.notify('La receta anulada permanece en el historial y no puede editarse.','danger');
    this.setState({modal:{type:'prescription',patientId:patient.id,draft:{...prescription,date:String(prescription.date||'').slice(0,10),items:prescription.items.map(item=>({...item}))}},modalError:''});
  };

  openMedicationArchive = (patient,medication) => {
    if(!this.can('medicationsManage'))return this.permissionDenied();
    this.setState({modal:{type:'medicationArchive',patientId:patient.id,draft:{medicationId:medication.id,medicationName:medication.name,reason:''}},modalError:''});
  };

  openDocumentGenerator = async patient => {
    if(!this.can('documentsGenerateAdministrative')&&!this.can('documentsGenerateClinical'))return this.permissionDenied();
    this.setState({documentBusy:true});
    try{const templates=await listDocumentTemplates(this.state.remoteOrganizationId);const first=templates[0];this.setState({documentBusy:false,modal:{type:'documentGenerate',patientId:patient.id,templates,draft:{templateId:first?.id||'',title:first?.name||'',variables:{}}},modalError:''});}
    catch(error){this.setState({documentBusy:false});this.notify(error.message||'No se pudieron cargar las plantillas.','danger');}
  };

  saveGeneratedDocument = async event => {
    event.preventDefault();const {patientId,draft}=this.state.modal;this.setState({formSaving:true,modalError:''});
    try{const result=await generateDocumentFromTemplate({organizationId:this.state.remoteOrganizationId,patientId,templateId:draft.templateId,title:draft.title,variables:draft.variables});const session=await getProductionSession();await this.applyProductionSession(session);this.setState({view:'patient',selectedPatientId:patientId,patientTab:'documents',formSaving:false,modal:null});if(result.url)window.open(result.url,'_blank','noopener,noreferrer');this.notify('Documento generado y guardado como PDF privado.');}
    catch(error){this.setState({formSaving:false,modalError:error.message||'No se pudo generar el documento.'});}
  };

  openVoidPrescription = (patient, prescription) => {
    if (!this.can('prescriptionsEdit')) return this.permissionDenied();
    if(prescription.status==='voided'||prescription.archivedAt)return;
    this.setState({modal:{type:'prescriptionVoid',patientId:patient.id,prescriptionId:prescription.id,draft:{reason:''}},modalError:''});
  };

  saveVoidPrescription = async event => {
    event.preventDefault();
    try {
      const {patientId,prescriptionId,draft}=this.state.modal;
      const result = voidPrescription(this.state.data, patientId, prescriptionId, draft.reason);
      await this.persistDataUpdate({ data: result.data, patientTab: 'prescriptions', modal:null, modalError:'' }, 'Receta anulada y conservada en el historial.');
    } catch (error) {
      this.handleFormError(error);
    }
  };

  openClinicProfile = () => {
    if (!this.can('settingsManage')) return this.permissionDenied();
    this.setState({ modal: { type: 'clinicProfile', draft: clinicProfileDefaults(this.state.data) }, modalError: '' });
  };

  openBillingSettings = () => this.openPlanComparison();

  saveBillingSettingsForm = event => {event.preventDefault();this.notify('Seleccione una modalidad en Mi plan.','neutral');};

  checkConsultationPrompt = () => {
    const user = this.activeUser();
    if (!this.state.authenticatedUserId || !user || !this.can('consultationsManage') || this.state.activeEncounter) return;
    const appointment = appointmentReadyForConsultation(this.state.data, new Date());
    if (!appointment || appointment.id === this.state.promptDismissedFor) {
      if (!appointment && this.state.appointmentPrompt) this.setState({ appointmentPrompt: null });
      return;
    }
    if (this.state.appointmentPrompt?.id !== appointment.id) this.setState({ appointmentPrompt: appointment });
  };

  dismissConsultationPrompt = () => {
    this.setState(prev => ({ promptDismissedFor: prev.appointmentPrompt?.id || null, appointmentPrompt: null }));
  };

  startConsultation = appointment => {
    if (!this.can('consultationsManage')) return this.permissionDenied();
    const patient = this.state.data.patients.find(item => item.id === appointment?.patientId) || this.selectedPatient();
    if (!patient) return this.notify('No se encontró el paciente de esta consulta.', 'danger');
    if (patient.vitalStatus === 'deceased') return this.notify('El expediente está en modo post mortem y no admite nuevas consultas.', 'danger');
    const encounter = createEncounterDraft(patient, appointment, this.activeUser());
    const result = upsertEncounter(this.state.data, patient.id, encounter);
    clearInterval(this.encounterTimer);
    this.encounterTimer = null;
    this.setState({
      data: result.data,
      activeEncounter: { ...result.encounter, patientId: patient.id },
      appointmentPrompt: null,
      appointmentDetails: null,
      selectedPatientId: patient.id,
      view: 'notebook',
      encounterAutosaveStatus: 'saved',
      mobileNav: false,
    });
  };

  startConsultationForSelectedPatient = () => {
    const patient = this.selectedPatient();
    if (!patient) return;
    const next = (this.state.data.appointments || [])
      .filter(item => item.patientId === patient.id && !['cancelled', 'completed', 'no_show'].includes(item.status))
      .sort((a, b) => Math.abs(new Date(a.start) - new Date()) - Math.abs(new Date(b.start) - new Date()))[0] || null;
    this.startConsultation(next || { patientId: patient.id, type: 'Consulta clínica', notes: '' });
  };

  openConsultationNote = (patient, note) => {
    if (!this.can('clinicalView') || !patient || !note) return;
    clearInterval(this.encounterTimer);
    const signed = ['completed', 'signed'].includes(String(note.status || '').toLowerCase()) || Boolean(note.signedAt);
    const readOnly = signed || !this.can('consultationsManage');
    if (!readOnly) this.encounterTimer = null;
    this.setState({
      selectedPatientId: patient.id,
      activeEncounter: { ...note, patientId: patient.id, __readOnly: readOnly },
      view: 'notebook',
      encounterAutosaveStatus: signed ? 'signed' : 'saved',
      mobileNav: false,
    });
  };

  correctConsultationNote = (patient, note) => {
    if (!this.can('consultationsManage') || !['owner', 'doctor'].includes(this.activeUser()?.role)) return this.permissionDenied();
    const encounter = createEncounterCorrection(patient, note, this.activeUser());
    const result = upsertEncounter(this.state.data, patient.id, encounter);
    this.setState({
      data: result.data,
      selectedPatientId: patient.id,
      activeEncounter: { ...result.encounter, patientId: patient.id },
      view: 'notebook',
      encounterAutosaveStatus: 'saving',
      mobileNav: false,
    });
  };

  updateEncounterField = (key,value) => {
    const current=this.state.activeEncounter;if(!current)return;
    const signed=['completed','signed'].includes(current.status)||Boolean(current.signedAt);
    if(signed||current.__readOnly)return;
    const result=upsertEncounter(this.state.data,current.patientId,{...current,[key]:value});
    this.setState({data:result.data,activeEncounter:{...result.encounter,patientId:current.patientId},encounterAutosaveStatus:'saving'});
  };

  finishConsultation = async () => {
    if(!this.can('consultationsManage') || !['owner','doctor'].includes(this.activeUser()?.role))return this.permissionDenied();
    const epoch=this.authEpoch;
    if(this.state.signing)return;const current=this.state.activeEncounter;if(!current)return;
    if(current.__readOnly||current.signedAt)return;
    if(![current.freeNotes,current.evolution,current.mentalStatus,current.clinicalImpression,current.plan].some(v=>String(v||'').trim()))return this.notify('Escriba al menos una anotación antes de finalizar.','danger');
    const result=upsertEncounter(this.state.data,current.patientId,current,{finalize:true,user:this.activeUser()});
    this.setState({data:result.data,signing:true},async()=>{
      try{await this.flushChanges();if(epoch!==this.authEpoch)return;clearInterval(this.encounterTimer);this.setState({activeEncounter:null,signing:false,view:'patient',selectedPatientId:current.patientId,patientTab:'consultations'});this.notify('Nota firmada y guardada.');}
      catch(e){this.setState({signing:false});this.notify('La firma no pudo confirmarse. No cierre la ventana. '+readableError(e),'danger');}
    });
  };

  closeConsultationNotebook = () => {
    const epoch=this.authEpoch;
    const encounter = this.state.activeEncounter;
    if (!encounter) return this.setView('dashboard');
    const signed = ['completed', 'signed'].includes(String(encounter.status || '').toLowerCase()) || Boolean(encounter.signedAt);
    clearInterval(this.encounterTimer);
    this.setState({
      activeEncounter: null,
      view: 'patient',
      selectedPatientId: encounter.patientId,
      patientTab: 'consultations',
      encounterAutosaveStatus: 'saved',
    }, () => {
      if (!signed && !encounter.__readOnly) this.flushChanges().then(()=>{if(epoch===this.authEpoch)this.notify('La nota quedó guardada como borrador.');}).catch(()=>{if(epoch===this.authEpoch)this.notify('La nota aún no se guardó. Revise el aviso de sincronización.','danger');});
    });
  };

  openDocumentUpload = patient => {
    if (!this.can('documentsManage')) return this.permissionDenied();
    this.setState({
      modal: {
        type: 'documentUpload',
        patientId: patient.id,
        draft: {
          file: null,
          category: 'Otro',
          description: '',
          clinicalDate: new Date().toISOString().slice(0, 10),
          confidentiality: 'Clínico',
        },
      },
      modalError: '',
    });
  };

  savePatientDocumentForm = async event => {
    event.preventDefault();
    if (this.state.documentBusy) return;
    const epoch=this.authEpoch;const organizationId=this.state.remoteOrganizationId;
    const modal = this.state.modal;
    const patient = this.state.data.patients.find(item => item.id === modal?.patientId);
    if (!patient) return this.setState({ modalError: 'El paciente ya no está disponible.' });
    if (!modal?.draft?.file) return this.setState({ modalError: 'Seleccione un archivo.' });
    this.setState({ documentBusy: true, modalError: '' });
    try {
      if (!this.can('documentsManage')) throw new Error('Acceso restringido.');
      await this.flushChanges();
      if(epoch!==this.authEpoch)return;
      const document = await createPatientDocument({
        file: modal.draft.file,
        organizationId,
        patientId: patient.id,
        uploadedBy: this.activeUser()?.id,
        category: modal.draft.category,
        description: modal.draft.description,
        clinicalDate: modal.draft.clinicalDate,
        confidentiality: modal.draft.confidentiality,
      });
      if(epoch!==this.authEpoch)return;
      const timestamp = new Date().toISOString();
      const data = {
        ...this.state.data,
        patients: this.state.data.patients.map(item => item.id === patient.id ? {
          ...item,
          documents: [document, ...(item.documents || [])],
          timeline: [{ date: timestamp, type: 'document', title: `${document.category}: ${document.name}`, detail: document.description || 'Documento agregado al expediente.' }, ...(item.timeline || [])],
          updatedAt: timestamp,
        } : item),
      };
      this.setState({ data, documentBusy: false, modal: null, modalError: '', patientTab: 'documents' }, async () => { try { await this.flushChanges(); this.notify('Documento guardado en el expediente.'); } catch (_) { this.notify('El archivo se subió, pero sus datos aún no se guardaron. No cierre esta pantalla.','danger'); } });
    } catch (error) {
      this.setState({ documentBusy: false, modalError: error instanceof Error ? error.message : 'No se pudo subir el documento.' });
    }
  };

  openStoredDocument = async document => {
    try { await openPatientDocument(document); }
    catch (error) { this.notify(error instanceof Error ? error.message : 'No se pudo abrir el documento.', 'danger'); }
  };

  downloadStoredDocument = async document => {
    try { await downloadPatientDocument(document); }
    catch (error) { this.notify(error instanceof Error ? error.message : 'No se pudo descargar el documento.', 'danger'); }
  };

  deleteStoredDocument = (patientId, document) => {
    const patient = this.state.data.patients.find(item => item.id === patientId);
    if (patient) this.openClinicalArchive(patient, 'document', document.id, document.name, 'documents');
  };

  saveDocumentEdit = event => {
    event.preventDefault();
    try {
      const { patientId, draft } = this.state.modal;
      const result = updatePatientDocumentMetadata(this.state.data, patientId, draft);
      this.persistDataUpdate({ data: result.data, patientTab: 'documents', modal: null, modalError: '' }, 'Datos del documento actualizados.');
    } catch (error) { this.setState({formSaving:false});this.handleFormError(error); }
  };

  printPostmortemReport = patient => {
    if (!this.can('postmortemExport')) return this.permissionDenied();
    const popup = window.open('', '_blank');
    if (popup) popup.opener = null;
    if (!popup) return this.notify('El navegador bloqueó la ventana del informe.', 'danger');
    popup.document.open();
    popup.document.write(buildPostmortemReportHtml(this.state.data, patient));
    popup.document.close();
  };

  openPlanComparison = () => this.setState({ modal: { type: 'planCompare', draft: {} }, modalError: '' });

  loadIntegrationStatus = async () => {
    if (!productionMode || !this.state.remoteOrganizationId || !supabaseConfigured) return;
    const epoch=this.authEpoch;
    try {
      const [calendarStatus, reminderProviders] = await Promise.all([
        this.can('appointmentsManage')?fetchCalendarIntegrationStatus(this.state.remoteOrganizationId).catch(() => null):Promise.resolve(null),
        this.can('remindersManage')?fetchReminderProviderStatus(this.state.remoteOrganizationId).catch(() => null):Promise.resolve(null),
      ]);
      if(epoch!==this.authEpoch)return;
      this.setState({ calendarStatus: calendarStatus || this.state.calendarStatus, reminderProviders: reminderProviders || this.state.reminderProviders });
    } catch (_) { /* Integrations remain optional. */ }
  };

  connectGoogleCalendar = async () => {
    if (!this.state.remoteOrganizationId) return this.notify('Inicie sesión con una cuenta real para conectar Google Calendar.', 'danger');
    this.setState({ integrationBusy: true });
    try { await requestGoogleCalendarConnection(this.state.remoteOrganizationId); }
    catch (error) { this.setState({ integrationBusy: false }); this.notify(error instanceof Error ? error.message : 'No se pudo conectar Google Calendar.', 'danger'); }
  };

  createAppleFeed = async () => {
    const epoch=this.authEpoch;
    if (!this.state.remoteOrganizationId) return this.notify('Inicie sesión con una cuenta real para crear el calendario privado.', 'danger');
    this.setState({ integrationBusy: true });
    try {
      const result = await createAppleCalendarFeed(this.state.remoteOrganizationId);
      if(epoch!==this.authEpoch)return;
      await navigator.clipboard.writeText(result.feedUrl);
      this.setState(prev => ({ integrationBusy: false, calendarStatus: { ...prev.calendarStatus, apple: { connected: true, feedUrl: result.feedUrl } } }));
      this.notify('Enlace privado copiado. Péguelo en Apple Calendar como calendario suscrito.');
    } catch (error) {
      this.setState({ integrationBusy: false });
      this.notify(error instanceof Error ? error.message : 'No se pudo crear el calendario para Apple.', 'danger');
    }
  };

  syncGoogleAppointment = async appointment => {
    const epoch=this.authEpoch;const organizationId=this.state.remoteOrganizationId;
    if (!this.state.remoteOrganizationId) return window.open(googleCalendarUrl(appointment), '_blank', 'noopener,noreferrer');
    this.setState({ integrationBusy: true });
    try {
      await this.flushChanges();
      if(epoch!==this.authEpoch)return;
      const result = await syncAppointmentToGoogle(organizationId, appointment);
      if(epoch!==this.authEpoch)return;
      const data = {
        ...this.state.data,
        appointments: this.state.data.appointments.map(item => item.id === appointment.id ? { ...item, googleEventId: result.event?.id || item.googleEventId, googleEventUrl: result.event?.htmlLink || item.googleEventUrl, updatedAt: new Date().toISOString() } : item),
      };
      this.persistDataUpdate({ data, integrationBusy: false }, 'Cita sincronizada con Google Calendar.');
      if (result.event?.htmlLink) window.open(result.event.htmlLink, '_blank', 'noopener,noreferrer');
    } catch (error) {
      this.setState({ integrationBusy: false });
      this.notify(error instanceof Error ? error.message : 'No se pudo sincronizar Google Calendar.', 'danger');
    }
  };

  sendReminderChannel = async (reminder, channel) => {
    if (!this.can('remindersManage')) return this.permissionDenied();
    const patient = reminder.patient;
    if (patient?.notificationPreferences?.consentStatus !== 'granted') return this.notify('Registre primero el consentimiento para recordatorios.','danger');
    const message = buildReminderMessage(this.state.data, patient, reminder.appointment);
    const destination = channel === 'email'
      ? patient?.notificationPreferences?.email || patient?.email
      : patient?.notificationPreferences?.phone || patient?.phone;
    if (!destination) return this.notify(`El paciente no tiene ${channel === 'email' ? 'correo' : 'teléfono'} registrado.`, 'danger');
    const providerReady = Boolean(this.state.reminderProviders?.[channel]);
    if (productionMode && this.state.remoteOrganizationId && providerReady) {
      try {
        await sendReminderThroughProvider({
          organizationId: this.state.remoteOrganizationId,
          patientId: patient.id,
          appointmentId: reminder.appointment.id,
          channel,
          hours: reminder.hours,
          destination,
          message,
          subject: `Recordatorio de cita · ${this.state.data.organization?.name || 'Linkare'}`,
        });
        this.completeReminder(reminder, channel);
        this.notify(`Recordatorio aceptado por ${reminderChannelLabel(channel)}. La entrega depende del proveedor.`);
        return;
      } catch (error) {
        this.notify(error instanceof Error ? error.message : 'No se pudo enviar automáticamente.', 'danger');
        return;
      }
    }
    const url = channel === 'email'
      ? emailReminderUrl(this.state.data, patient, reminder.appointment)
      : channel === 'sms'
        ? smsReminderUrl(this.state.data, patient, reminder.appointment)
        : whatsappReminderUrl(this.state.data, patient, reminder.appointment);
    if (!url) return this.notify('No se pudo preparar el mensaje manual.', 'danger');
    window.open(url, '_blank', 'noopener,noreferrer');
    this.notify('Se abrió la aplicación de mensajes. Marque Enviado solamente después de enviarlo.');
  };

  renderConsultationPrompt() {
    const appointment = this.state.appointmentPrompt;
    if (!appointment) return null;
    const patient = this.state.data.patients.find(item => item.id === appointment.patientId);
    return html`<aside className="consultation-prompt" role="alert"><div className="consultation-prompt-icon"><${Icon} name="notebook" size=${23}/></div><div><span>Consulta programada</span><b>${patient?.name || appointment.title}</b><small>${formatTime(appointment.start)} · ${appointment.type} · ${appointment.modality}</small></div><${Button} icon="play" onClick=${() => this.startConsultation(appointment)}>¿Ya está con el paciente?</${Button}><button className="prompt-later" onClick=${this.dismissConsultationPrompt}>Recordarme después</button></aside>`;
  }

  renderConsultationNotebook() {
    const encounter = this.state.activeEncounter;
    if (!encounter) return html`<${EmptyState} icon="notebook" title="No hay una consulta abierta" text="Inicie una consulta desde una cita o desde el expediente del paciente." action=${html`<${Button} onClick=${() => this.setView('agenda')}>Ir a agenda</${Button}>`}/>`;
    const patient = this.state.data.patients.find(item => item.id === encounter.patientId);
    if (!patient) return html`<${EmptyState} icon="alert" title="Paciente no disponible" text="Cierre esta libreta y vuelva al expediente."/>`;

    const signed = ['completed', 'signed'].includes(String(encounter.status || '').toLowerCase()) || Boolean(encounter.signedAt);
    const readOnly = signed || Boolean(encounter.__readOnly);
    const elapsedMs = Math.max(0, Date.now() - new Date(encounter.startedAt).getTime());
    const minutes = Math.max(0, Math.floor(elapsedMs / 60000));
    const seconds = Math.max(0, Math.floor(elapsedMs / 1000) % 60);
    const durationMinutes = Number(encounter.durationMinutes)
      || (encounter.endedAt ? Math.max(1, Math.round((new Date(encounter.endedAt) - new Date(encounter.startedAt)) / 60000)) : Math.max(1, minutes));
    const signer = (this.state.data.users || []).find(item => item.id === encounter.signedBy || item.id === encounter.createdBy);
    const version = Math.max(1, Number(encounter.version || 0), (encounter.versions || []).length + 1);
    const valueFor = key => String(encounter[key] || '').trim();
    const field = (key, label, placeholder, rows = 4) => {
      if (readOnly) {
        const value = valueFor(key);
        return html`<section className="notebook-readonly-field"><span>${label}</span><div className=${`notebook-readonly-value ${value ? '' : 'is-empty'}`}>${value || 'No registrado en esta consulta.'}</div></section>`;
      }
      return html`<label className="notebook-field"><span>${label}</span><textarea id=${`encounter-${key}`} aria-label=${label} rows=${rows} value=${encounter[key] || ''} onChange=${event => this.updateEncounterField(key, event.target.value)} placeholder=${placeholder}></textarea></label>`;
    };

    return html`<div className=${`consultation-notebook-view view-enter ${readOnly ? 'notebook-readonly' : ''}`}>
      <header className="notebook-toolbar">
        <div><button className="back-button" onClick=${this.closeConsultationNotebook}><${Icon} name="chevronLeft"/></button><span className=${`notebook-badge ${signed ? 'signed' : ''}`}><${Icon} name=${signed ? 'lock' : 'notebook'} size=${18}/> ${signed ? 'Nota firmada' : readOnly ? 'Vista de consulta' : 'Libreta de consulta'}</span><div><h1>${patient.preferredName || patient.name}</h1><p>${encounter.title}</p></div></div>
        <div className="notebook-toolbar-actions">
          <span>${signed || readOnly ? html`<span className="notebook-timer">${durationMinutes} min</span>` : html`<${ElapsedClock} start=${encounter.startedAt}/>`}</span>
          <span role="status" className=${`autosave-state ${signed ? 'signed' : this.state.remoteSaveStatus}`}><${Icon} name=${signed ? 'lock' : this.state.remoteSaveStatus === 'error' ? 'alert' : 'check'} size=${15}/>${signed ? `Firmada ${formatDateTime(encounter.signedAt || encounter.endedAt)}` : readOnly ? 'Solo lectura' : this.state.remoteSaveStatus === 'error' ? 'Sin guardar: revise el aviso' : ['dirty','saving'].includes(this.state.remoteSaveStatus) ? 'Guardando…' : this.state.networkOffline ? 'Sin conexión: no cierre la página' : 'Guardado en el servidor'}</span>
          ${!readOnly ? html`<${Button} tone="secondary" icon="paperclip" onClick=${() => this.openDocumentUpload(patient)}>Adjuntar</${Button}>` : null}
          ${!readOnly && ['owner','doctor'].includes(this.activeUser()?.role) ? html`<${Button} icon="check" onClick=${this.finishConsultation}>Firmar y finalizar</${Button}>` : html`<${Button} tone="secondary" icon="chevronLeft" onClick=${this.closeConsultationNotebook}>Volver al expediente</${Button}>`}
        </div>
      </header>
      <div className="notebook-layout">
        <aside className="notebook-patient-panel"><${Avatar} patient=${patient} size="xl"/><h2>${patient.name}</h2><p>${patient.age} años · ${patient.diagnosisCode}</p><div className="notebook-facts"><div><span>Diagnóstico</span><b>${patient.diagnosis}</b></div><div><span>Riesgo actual</span><b>${riskLabel(patient.risk)}</b></div><div><span>Medicamento principal</span><b>${patient.medication?.name || 'Sin medicamento'}</b><small>${patient.medication?.dose || ''}</small></div><div><span>Última consulta</span><b>${formatDate(patient.lastVisit)}</b></div></div><div className="notebook-alert-box"><${Icon} name="shield" size=${18}/><span>${patient.adverseEvents?.filter(item => item.status === 'active').length || 0} efecto(s) activo(s) · ${this.state.data.alerts.filter(item => item.patientId === patient.id && item.status === 'open').length} alerta(s)</span></div></aside>
        <main className="notebook-paper">
          <div className="paper-heading"><div><span>${formatLongDate(encounter.startedAt)}</span><h2>Notas de la consulta</h2></div><span>${signed ? `Nota firmada · v${version}` : readOnly ? 'Solo lectura' : 'Borrador clínico'}</span></div>
          ${signed ? html`<div className="notebook-signed-banner"><${Icon} name="lock" size=${18}/><div><b>Nota clínica firmada y cerrada</b><p>Puede consultar todo el contenido. Esta versión no se modifica desde esta pantalla.</p></div></div>` : null}
          ${field('freeNotes', 'Notas libres', 'Escriba libremente durante la conversación…', 10)}
          <div className="notebook-two-columns">${field('reason', 'Motivo y temas principales', 'Motivo de consulta y temas abordados…', 5)}${field('evolution', 'Evolución desde la última visita', 'Cambios, contexto, adherencia y funcionamiento…', 5)}</div>
          <div className="notebook-two-columns">${field('mentalStatus', 'Estado mental', 'Apariencia, conducta, habla, afecto, pensamiento, cognición, juicio…', 6)}${field('riskAssessment', 'Riesgo y seguridad', 'Ideación, intención, plan, medios, factores protectores y plan de seguridad…', 6)}</div>
          <div className="notebook-two-columns">${field('medicationNotes', 'Medicamentos y tolerabilidad', 'Adherencia, efectos, cambios considerados…', 5)}${field('intervention', 'Intervención realizada', 'Psicoeducación, apoyo, decisiones compartidas, coordinación…', 5)}</div>
          ${field('clinicalImpression', 'Impresión clínica', 'Síntesis profesional de la consulta…', 5)}
          ${field('plan', 'Plan', 'Tratamiento, estudios, derivaciones, indicaciones y tareas…', 5)}
          ${field('followUp', 'Seguimiento', 'Próxima cita, señales de alarma y acuerdos…', 3)}
          <footer className="notebook-paper-footer"><span>${signed ? 'Nota firmada conservada en el expediente. Para documentar información posterior, abra una nueva consulta.' : readOnly ? 'Contenido mostrado en modo solo lectura.' : 'La nota se guarda automáticamente. Al finalizar quedará firmada y cualquier cambio posterior deberá registrarse como una nueva versión.'}</span></footer>
        </main>
        ${readOnly ? html`<aside className="notebook-tools-panel notebook-readonly-tools"><h3>Información de la nota</h3><div className="notebook-meta-list"><div><span>Estado</span><b>${signed ? 'Firmada' : 'Solo lectura'}</b></div><div><span>Profesional</span><b>${signer?.name || patient.clinician || 'Profesional tratante'}</b></div><div><span>Inicio</span><b>${formatDateTime(encounter.startedAt)}</b></div><div><span>Finalización</span><b>${encounter.endedAt ? formatDateTime(encounter.endedAt) : 'No registrada'}</b></div><div><span>Duración</span><b>${durationMinutes} minutos</b></div><div><span>Versión</span><b>${version}</b></div></div><button onClick=${this.closeConsultationNotebook}><${Icon} name="chevronLeft"/><span>Volver a consultas</span></button><button onClick=${() => { clearInterval(this.encounterTimer); this.setState({ activeEncounter: null, view: 'patient', selectedPatientId: patient.id, patientTab: 'documents' }); }}><${Icon} name="folder"/><span>Ver documentos</span></button><div className="notebook-side-note"><b>Solo lectura</b><p>La nota firmada permanece íntegra. Las nuevas observaciones deben registrarse en otra consulta.</p></div></aside>` : html`<aside className="notebook-tools-panel"><h3>Acciones rápidas</h3><button onClick=${() => this.openAssessment(patient)}><${Icon} name="analytics"/><span>Registrar escala</span></button><button onClick=${() => this.openVitals(patient)}><${Icon} name="activity"/><span>Control físico</span></button><button onClick=${() => this.openMedication(patient)}><${Icon} name="medication"/><span>Medicamento</span></button><button onClick=${() => this.openPrescription(patient)}><${Icon} name="prescription"/><span>Nueva receta</span></button><button onClick=${() => this.openDocumentUpload(patient)}><${Icon} name="folder"/><span>Subir documento</span></button><div className="notebook-side-note"><b>Privacidad</b><p>Evite incluir información innecesaria. Diferencie lo referido por el paciente, lo observado y la información de terceros.</p></div></aside>`}
      </div>
    </div>`;
  }

  renderDocumentsTab(patient) {
    if(!this.can('documentsView'))return this.renderStatePage('lock','Acceso restringido','Esta cuenta no puede consultar documentos clínicos.');
    const documents = (patient.documents || []).filter(d=>!d.archived);
    const archivedDocuments = (patient.documents || []).filter(d=>d.archived);
    const canGenerate=this.can('documentsGenerateAdministrative')||this.can('documentsGenerateClinical');
    const actions=html`<div className="settings-actions">${canGenerate?html`<${Button} icon="file" disabled=${this.state.documentBusy} onClick=${()=>this.openDocumentGenerator(patient)}>Nuevo documento</${Button}>`:null}${this.can('documentsManage')?html`<${Button} tone="secondary" icon="upload" onClick=${()=>this.openDocumentUpload(patient)}>Subir archivo</${Button}>`:null}</div>`;
    return html`<div className="dashboard-grid documents-view"><${Card} className="span-12" title="Documentos y archivos" subtitle="Recetas externas, cartas, resultados, consentimientos e informes vinculados al expediente." action=${actions}>${documents.length ? html`<div className="document-grid">${documents.map(document => html`<article key=${document.id} className="document-card"><span className="document-icon"><${Icon} name=${documentIconName(document)} size=${23}/></span><div className="document-card-main"><span>${document.category}</span><h4>${document.name}</h4><p>${document.description || 'Sin descripción.'}</p><small>${formatDate(document.clinicalDate || document.createdAt)} · ${humanFileSize(document.size)} · ${document.confidentiality}</small></div><div className="document-actions"><${Button} tone="secondary" icon="external" onClick=${() => this.openStoredDocument(document)}>Abrir</${Button}><${Button} tone="soft" icon="download" onClick=${() => this.downloadStoredDocument(document)}>Descargar</${Button}>${this.can('documentsManage') ? html`<${Button} tone="secondary" icon="edit" onClick=${() => this.openDocumentEdit(patient, document)}>Editar</${Button}><button className="document-delete" onClick=${() => this.deleteStoredDocument(patient.id, document)} title="Eliminar del expediente activo"><${Icon} name="trash" size=${17}/></button>` : null}</div></article>`)}</div>` : html`<${EmptyState} icon="folder" title="Sin documentos adjuntos" text="Genere un documento o suba el primer archivo para conservarlo junto al expediente." action=${canGenerate?html`<${Button} icon="file" onClick=${()=>this.openDocumentGenerator(patient)}>Generar documento</${Button}>`:this.can('documentsManage')?html`<${Button} icon="upload" onClick=${()=>this.openDocumentUpload(patient)}>Subir documento</${Button}>`:null}/>`}</${Card}>${archivedDocuments.length?html`<${Card} className="span-12" title="Documentos eliminados" subtitle="El archivo y su auditoría se conservan en el historial."><div className="admin-appointment-list">${archivedDocuments.map(document=>html`<div key=${document.id}><div><b>${document.name}</b><small>${document.category} · eliminado ${formatDateTime(document.archivedAt)}</small><small>Motivo: ${document.archiveReason||'No registrado'}</small></div><${Badge} tone="neutral">Eliminado</${Badge}></div>`)}</div></${Card}>`:null}</div>`;
  }

  renderConsultationsTab(patient) {
    const retractions = new Map((patient.consultationRetractions || []).map(item => [item.resourceId, item]));
    const allConsultations = [...(patient.consultations || [])].sort((left, right) => new Date(right.startedAt || right.updatedAt || 0) - new Date(left.startedAt || left.updatedAt || 0));
    const consultations = allConsultations.filter(note => !note.archivedAt && !retractions.has(note.id));
    const archivedConsultations = allConsultations.filter(note => note.archivedAt || retractions.has(note.id));
    const canManage = this.can('consultationsManage');
    const isSignedNote = note => ['completed', 'signed'].includes(String(note.status || '').toLowerCase()) || Boolean(note.signedAt);
    return html`<div className="dashboard-grid consultations-view"><${Card} className="span-12" title="Notas de consulta" subtitle="Abra cualquier nota para consultar todo lo registrado. Los borradores pueden continuarse y las notas firmadas se muestran en modo solo lectura." action=${canManage && patient.vitalStatus !== 'deceased' ? html`<${Button} icon="notebook" onClick=${this.startConsultationForSelectedPatient}>Iniciar consulta</${Button}>` : null}>${consultations.length ? html`<div className="consultation-list">${consultations.map(note => {
      const signed = isSignedNote(note);
      return html`<article key=${note.id} className=${`consultation-note-card ${signed ? 'completed' : 'draft'}`}><div className="consultation-note-date"><b>${formatDate(note.startedAt)}</b><span>${formatTime(note.startedAt)}</span></div><div><span>${signed ? 'Firmada' : 'Borrador'}</span><h4>${note.title}</h4><p>${note.clinicalImpression || note.plan || note.freeNotes || 'Nota sin resumen.'}</p><small>${note.durationMinutes ? `${note.durationMinutes} minutos · ` : ''}${signed ? `Finalizada ${formatDateTime(note.endedAt || note.signedAt)}` : `Actualizada ${formatDateTime(note.updatedAt)}`}</small></div><div className="consultation-note-actions"><${Badge} tone=${signed ? 'success' : 'warning'}><${Icon} name=${signed ? 'lock' : 'edit'} size=${13}/> ${signed ? 'Firmada' : 'Borrador'}</${Badge}><${Button} tone="secondary" icon=${signed ? 'eye' : 'edit'} onClick=${() => this.openConsultationNote(patient, note)}>${signed ? 'Ver nota' : canManage ? 'Continuar' : 'Ver borrador'}</${Button}>${canManage&&signed&&['owner','doctor'].includes(this.activeUser()?.role)?html`<${Button} tone="secondary" icon="edit" onClick=${()=>this.correctConsultationNote(patient,note)}>Crear corrección</${Button}>`:null}${canManage?html`<button type="button" className="text-danger-button" onClick=${()=>this.openClinicalArchive(patient,'consultation',note.id,note.title,'consultations')}><${Icon} name="trash" size=${16}/> ${signed?'Anular nota':'Eliminar borrador'}</button>`:null}</div></article>`;
    })}</div>` : html`<${EmptyState} icon="notebook" title="Sin notas de consulta" text="Inicie una consulta para abrir la libreta virtual y guardar la primera nota." action=${canManage ? html`<${Button} icon="notebook" onClick=${this.startConsultationForSelectedPatient}>Abrir libreta</${Button}>` : null}/>`}</${Card}>${archivedConsultations.length?html`<${Card} className="span-12" title="Consultas anuladas o retiradas" subtitle="Se conserva el contenido original y el motivo para auditoría."><div className="admin-appointment-list">${archivedConsultations.map(note=>{const audit=retractions.get(note.id)||note;return html`<div key=${note.id}><div><b>${note.title}</b><small>${formatDateTime(note.startedAt)} · ${isSignedNote(note)?'nota firmada anulada':'borrador eliminado'}</small><small>Motivo: ${audit.archiveReason||'No registrado'}</small></div>${isSignedNote(note)?html`<${Button} tone="secondary" icon="eye" onClick=${()=>this.openConsultationNote(patient,note)}>Ver original</${Button}>`:html`<${Badge} tone="neutral">Eliminado</${Badge}>`}</div>`;})}</div></${Card}>`:null}</div>`;
  }

  openPaymentLink = value => {
    try{const url=new URL(value);if(url.protocol!=='https:'||!(url.hostname==='wompi.sv'||url.hostname.endsWith('.wompi.sv')))throw new Error();window.open(url.href,'_blank','noopener,noreferrer');}
    catch{this.notify('El enlace no es un checkout válido de Wompi.','danger');}
  };

  loadSubscriptionInvoices = async () => {
    if(!this.state.remoteOrganizationId||!this.can('settingsManage'))return;
    const epoch=this.authEpoch;
    this.setState({billingLoading:true,billingError:''});
    try{const billingData=await fetchBilling(this.state.remoteOrganizationId);if(epoch!==this.authEpoch)return;this.setState({billingData,billingLoading:false,subscriptionWritable:subscriptionView(billingData.subscription).active,complimentaryAccess:billingData.subscription?.complimentary_access===true});}
    catch(e){this.setState({billingError:readableError(e),billingLoading:false});}
  };

  loadWompiStatus = async () => {
    if(!this.can('settingsManage')||!this.state.remoteOrganizationId)return;
    this.setState({wompiStatus:{state:'loading',app:null,error:''}});
    try{const app=await fetchWompiAppInfo(this.state.remoteOrganizationId);this.setState({wompiStatus:{state:'ready',app,error:''}});}
    catch(e){this.setState({wompiStatus:{state:'error',app:null,error:readableError(e)}});}
  };

  openWompiPaymentRequest = (planCode='annual') => {
    if(!this.can('settingsManage'))return this.permissionDenied();
    const plan=this.state.billingData.plans.find(p=>p.code===planCode);
    if(!plan)return this.notify('Espere a que se cargue el catálogo del servidor.','danger');
    this.setState({modal:{type:'paymentRequest',draft:{planCode:plan.code}},modalError:''});
  };

  submitWompiPaymentRequest = async event => {
    event.preventDefault();if(this.state.wompiBusy||!this.can('settingsManage'))return;
    const planCode=this.state.modal?.draft?.planCode;
    this.setState({wompiBusy:true,modalError:''});
    try{
      const result=await createWompiPaymentLink({organizationId:this.state.remoteOrganizationId,planCode});
      await this.loadSubscriptionInvoices();
      this.setState({wompiBusy:false,modal:{type:'checkoutReady',payment:result.payment}});
    }catch(e){this.setState({wompiBusy:false,modalError:readableError(e)});}
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
    this.setState({ modal: { type: 'userPermissions', userId: user.id, draft: { name: user.name, email: user.email, phone: user.phone || '', title: user.title || '', role: user.role, password: '', confirmPassword: '', permissions: { ...(user.permissions || {}) } } }, modalError: '' });
  };

  openHelp = () => this.setState({modal:{type:'help',draft:{}},modalError:'',tourIndex:0});

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
    const epoch=this.authEpoch;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!this.can('patientsEdit')) return this.permissionDenied();
    try {
      const photo = await optimizeImageFile(file, { maxDimension: 560, quality: 0.82 });
      if(epoch!==this.authEpoch)return;
      await this.persistDataUpdate({data:savePatientPhoto(this.state.data,patientId,photo)},'Fotografía del paciente actualizada.');
    } catch (error) {
      this.notify(error instanceof Error ? error.message : 'No se pudo guardar la fotografía.', 'danger');
    }
  };

  removePatientPhoto = patientId => {
    if (!this.can('patientsEdit')) return this.permissionDenied();
    this.persistDataUpdate({data:savePatientPhoto(this.state.data,patientId,'')},'Fotografía eliminada.');
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
      modal: prev.modal ? { ...prev.modal, draft: { ...prev.modal.draft, items: [...(prev.modal.draft.items || []), { id: `rxitem_${Date.now()}`, medication: '', strength: '', directions: '', quantity: '', duration: '', notes: '', sourceMedicationId:null, addToTreatment:false }] } } : null,
    }));
  };

  copyScopedCalendar = async (scope,patientId=null) => {
    const epoch=this.authEpoch;if(!this.state.remoteOrganizationId)return this.notify('Inicie sesión para crear el calendario privado.','danger');this.setState({integrationBusy:true});
    try{const result=await createAppleCalendarFeed(this.state.remoteOrganizationId,scope,patientId);if(epoch!==this.authEpoch)return;await navigator.clipboard.writeText(result.feedUrl);this.setState({integrationBusy:false});this.notify(`Enlace privado copiado. Caduca ${formatDate(result.expiresAt)}.`);}
    catch(error){this.setState({integrationBusy:false});this.notify(error instanceof Error?error.message:'No se pudo crear el calendario.','danger');}
  };

  openCalendarFeeds = async () => {
    this.setState({integrationBusy:true});try{const feeds=await listCalendarFeeds(this.state.remoteOrganizationId);this.setState({integrationBusy:false,modal:{type:'calendarFeeds',feeds},modalError:''});}catch(error){this.setState({integrationBusy:false});this.notify(error.message||'No se pudieron consultar los calendarios.','danger');}
  };

  revokeCalendarFeed = async id => {
    this.setState({integrationBusy:true});try{await createAppleCalendarFeed(this.state.remoteOrganizationId,'staff_busy',null,'revoke',id);const feeds=await listCalendarFeeds(this.state.remoteOrganizationId);this.setState(prev=>({integrationBusy:false,modal:{...prev.modal,feeds}}));this.notify('Enlace revocado.');}catch(error){this.setState({integrationBusy:false,modalError:error.message||'No se pudo revocar.'});}
  };

  openFamilyReminders = async () => {
    this.setState({integrationBusy:true});try{const recipients=await listFamilyReminderRecipients(this.state.remoteOrganizationId);this.setState({integrationBusy:false,modal:{type:'familyReminders',recipients,draft:{name:'',destination:'',channel:'whatsapp',enabled:true}},modalError:''});}catch(error){this.setState({integrationBusy:false});this.notify(error.message||'No se pudieron consultar los contactos.','danger');}
  };

  saveFamilyReminder = async event => {
    event.preventDefault();this.setState({formSaving:true,modalError:''});try{await saveFamilyReminderRecipient(this.state.remoteOrganizationId,this.state.modal.draft);const recipients=await listFamilyReminderRecipients(this.state.remoteOrganizationId);this.setState(prev=>({formSaving:false,modal:{...prev.modal,recipients,draft:{name:'',destination:'',channel:'whatsapp',enabled:true}}}));this.notify('Contacto personal guardado.');}catch(error){this.setState({formSaving:false,modalError:error.message||'No se pudo guardar el contacto.'});}
  };

  removeFamilyReminder = async id => {
    this.setState({formSaving:true});try{await removeFamilyReminderRecipient(this.state.remoteOrganizationId,id);const recipients=await listFamilyReminderRecipients(this.state.remoteOrganizationId);this.setState(prev=>({formSaving:false,modal:{...prev.modal,recipients}}));this.notify('Contacto eliminado.');}catch(error){this.setState({formSaving:false,modalError:error.message||'No se pudo eliminar.'});}
  };

  addCurrentMedicationToPrescription = medicationId => {
    const patient=this.state.data.patients.find(item=>item.id===this.state.modal?.patientId);
    const medication=(patient?.medications||[]).find(item=>item.id===medicationId&&item.status==='active');
    if(!medication)return;
    this.setState(prev=>({modal:{...prev.modal,draft:{...prev.modal.draft,items:[...(prev.modal.draft.items||[]),prescriptionItemFromMedication(medication)]}}}));
  };

  removePrescriptionItem = itemId => {
    this.setState(prev => ({
      modal: prev.modal ? { ...prev.modal, draft: { ...prev.modal.draft, items: (prev.modal.draft.items || []).filter(item => item.id !== itemId) } } : null,
    }));
  };

  handleFormError = error => this.setState({ modalError: error instanceof Error ? error.message : 'No fue posible guardar el registro.' });

  // A success message is emitted only after the server acknowledges every changed record.
  persistDataUpdate = async (patch, message) => {
    if(this.savingForm)return;
    if(!this.state.remoteReady)return this.notify('Inicie sesión antes de guardar.','danger');
    const epoch=this.authEpoch;const org=this.state.remoteOrganizationId;
    this.savingForm=true;clearTimeout(this.persistTimer);
    this.setState({formSaving:true,remoteSaveStatus:'saving',modalError:'',saveError:''});
    try {
      await saveProductionState(org,patch.data);
      if(epoch!==this.authEpoch||!this.mounted)return;
      this.persistedData=patch.data;
      this.setState({...patch,formSaving:false,remoteSaveStatus:'saved'},()=>this.notify(message));
      return true;
    } catch(error) {
      if(epoch!==this.authEpoch||!this.mounted)return;
      const detail=readableError(error);
      this.setState({formSaving:false,remoteSaveStatus:'error',saveError:detail,modalError:'No se guardó el registro. '+detail});
      return false;
    } finally {if(epoch===this.authEpoch)this.savingForm=false;}
  };

  savePatientForm = event => {
    event.preventDefault();
    try {
      const result = createPatient(this.state.data, this.state.modal.draft);
      this.persistDataUpdate({ data: result.data, selectedPatientId: result.patientId, view: 'patient', patientTab: 'overview', modal: null, modalError: '' }, 'Paciente registrado correctamente.');
    } catch (error) { this.handleFormError(error); }
  };

  savePatientEditForm = event => {
    event.preventDefault();
    try {
      const { patientId, draft } = this.state.modal;
      const result = updatePatientProfile(this.state.data, patientId, draft);
      this.persistDataUpdate({ data: result.data, modal: null, modalError: '' }, 'Datos del paciente actualizados.');
    } catch (error) { this.handleFormError(error); }
  };

  saveMedicationForm = async event => {
    event.preventDefault();
    try {
      const patientId = this.state.modal.patientId;
      if (!this.can('medicationsManage') && this.can('medicationsCapture')) {
        this.setState({formSaving:true,modalError:''});
        await captureReportedMedication(this.state.remoteOrganizationId,patientId,this.state.modal.draft);
        const session=await getProductionSession();
        await this.applyProductionSession(session);
        this.setState({view:'patient',selectedPatientId:patientId,patientTab:'medications',formSaving:false,modal:null});
        this.notify('Medicamento registrado como pendiente de revisión médica.');
        return;
      }
      const editing = Boolean(this.state.modal.draft.id);
      const result = editing ? updateMedication(this.state.data, patientId, this.state.modal.draft) : addMedication(this.state.data, patientId, this.state.modal.draft);
      this.persistDataUpdate({ data: result.data, patientTab: 'medications', modal: null, modalError: '' }, editing ? 'Medicamento corregido.' : 'Medicamento agregado al tratamiento.');
    } catch (error) { this.setState({formSaving:false});this.handleFormError(error); }
  };

  approveMedication = (patient, medication) => {
    if(!this.can('medicationsManage'))return this.permissionDenied();
    try{
      const result=approveCapturedMedication(this.state.data,patient.id,medication.id);
      this.persistDataUpdate({data:result.data,patientTab:'medications'},'Medicamento revisado y activado.');
    }catch(error){this.notify(error.message||'No se pudo aprobar el medicamento.','danger');}
  };

  saveDoseForm = event => {
    event.preventDefault();
    try {
      const patientId = this.state.modal.patientId;
      const result = changeMedicationDose(this.state.data, patientId, this.state.modal.draft);
      this.persistDataUpdate({ data: result.data, patientTab: 'medications', modal: null, modalError: '' }, 'Cambio de dosis registrado.');
    } catch (error) { this.handleFormError(error); }
  };

  saveAssessmentForm = event => {
    event.preventDefault();
    try {
      const patientId = this.state.modal.patientId;
      const result = recordAssessment(this.state.data, patientId, this.state.modal.draft);
      this.persistDataUpdate({ data: result.data, patientTab: 'followup', modal: null, modalError: '' }, this.state.modal.draft.editing ? 'Medición clínica corregida.' : 'Evolución clínica registrada.');
    } catch (error) { this.handleFormError(error); }
  };

  saveVitalsForm = event => {
    event.preventDefault();
    try {
      const patientId = this.state.modal.patientId;
      const result = recordVitals(this.state.data, patientId, this.state.modal.draft);
      this.persistDataUpdate({ data: result.data, patientTab: 'followup', modal: null, modalError: '' }, this.state.modal.draft.id ? 'Control físico corregido.' : 'Control físico registrado.');
    } catch (error) { this.handleFormError(error); }
  };

  saveAdverseForm = event => {
    event.preventDefault();
    try {
      const patientId = this.state.modal.patientId;
      const result = recordAdverseEvent(this.state.data, patientId, this.state.modal.draft);
      this.persistDataUpdate({ data: result.data, patientTab: 'safety', modal: null, modalError: '' }, this.state.modal.draft.id ? 'Efecto observado corregido.' : 'Efecto observado registrado.');
    } catch (error) { this.handleFormError(error); }
  };

  saveLabForm = event => {
    event.preventDefault();
    try {
      const patientId = this.state.modal.patientId;
      const result = recordLab(this.state.data, patientId, this.state.modal.draft);
      this.persistDataUpdate({ data: result.data, patientTab: 'safety', modal: null, modalError: '' }, this.state.modal.draft.id ? 'Resultado de laboratorio corregido.' : 'Resultado de laboratorio agregado.');
    } catch (error) { this.handleFormError(error); }
  };

  saveAppointmentForm = event => {
    event.preventDefault();
    try {
      const editing = Boolean(this.state.modal.draft.id);
      const result = saveAppointment(this.state.data, this.state.modal.draft);
      this.persistDataUpdate({ data: result.data, modal: null, modalError: '', appointmentDetails: result.appointment }, editing ? 'Cita actualizada.' : 'Cita creada correctamente.');
    } catch (error) { this.handleFormError(error); }
  };

  saveMedicationStatusForm = event => {
    event.preventDefault();
    try {
      const { patientId, draft } = this.state.modal;
      const result = setMedicationStatus(this.state.data, patientId, draft.medicationId, draft.status, draft.reason);
      const label = draft.status === 'suspended' ? 'suspendido' : draft.status === 'active' ? 'reactivado' : draft.status === 'completed' ? 'completado' : 'descontinuado';
      this.persistDataUpdate({ data: result.data, patientTab: 'medications', modal: null, modalError: '' }, `Medicamento ${label}.`);
    } catch (error) { this.handleFormError(error); }
  };

  saveClinicProfileForm = event => {
    event.preventDefault();
    try {
      const data = savePracticeProfile(this.state.data, this.state.modal.draft);
      this.persistDataUpdate({ data, modal: null, modalError: '' }, 'Identidad de la clínica actualizada.');
    } catch (error) { this.handleFormError(error); }
  };

  saveSecretaryForm = async event => {
    event.preventDefault();if(this.state.teamBusy)return;if(!this.can('usersManage'))return this.permissionDenied();
    this.setState({teamBusy:true});
    try{const r=await manageTeam(this.state.remoteOrganizationId,'invite',this.state.modal.draft);this.setState({modal:null,teamBusy:false});await this.refreshTeam();this.notify(r.message);}
    catch(e){this.setState({teamBusy:false,modalError:readableError(e)});await this.refreshTeam();}
  };

  saveUserPermissionsForm = async event => {
    event.preventDefault();if(this.state.teamBusy)return;if(!this.can('usersManage'))return this.permissionDenied();
    this.setState({teamBusy:true});
    try{await manageTeam(this.state.remoteOrganizationId,'update',{...this.state.modal.draft,userId:this.state.modal.userId});this.setState({modal:null,teamBusy:false});await this.refreshTeam();this.notify('Permisos actualizados en el servidor.');}
    catch(e){this.setState({teamBusy:false,modalError:readableError(e)});}
  };

  savePrescriptionForm = async event => {
    event.preventDefault();
    try {
      const { patientId, draft } = this.state.modal;
      const result = savePrescription(this.state.data, patientId, draft);
      const patient = this.state.data.patients.find(item => item.id === patientId);
      const printWindow = window.open('', '_blank', 'width=920,height=980');
      const saved=await this.persistDataUpdate({data:result.data,patientTab:'prescriptions',modal:null,modalError:''},draft.id?'Corrección de receta guardada.':printWindow?'Receta guardada y abierta para impresión.':'Receta guardada. Use Imprimir en la pestaña Recetas.');
      if(!saved){printWindow?.close();return;}
      if (printWindow && patient) {
        printWindow.opener = null;
    printWindow.document.open();
        printWindow.document.write(buildPrescriptionPrintHtml(this.state.data, patient, result.prescription));
        printWindow.document.close();
      }
    } catch (error) { this.handleFormError(error); }
  };

  toggleTeamUser = async userId => {
    if(!this.can('usersManage'))return this.permissionDenied();
    try{await manageTeam(this.state.remoteOrganizationId,'toggle',{userId});await this.refreshTeam();this.notify('Acceso actualizado.');}catch(e){this.notify(readableError(e),'danger');}
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

  sendReminderWhatsApp = reminder => this.sendReminderChannel(reminder, 'whatsapp');

  copyReminderMessage = async reminder => {
    if (!this.can('remindersManage')) return this.permissionDenied();
    if(reminder.patient?.notificationPreferences?.consentStatus!=='granted')return this.notify('Registre primero el consentimiento del paciente para recordatorios.','danger');
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
    this.persistDataUpdate({ data }, 'Recordatorio marcado como enviado.');
  };

  printPrescription = (prescription, patientId = this.state.selectedPatientId) => {
    const patient = this.state.data.patients.find(item => item.id === patientId);
    if (!patient || !prescription) return this.notify('No se encontró la receta para imprimir.', 'danger');
    const printWindow = window.open('', '_blank', 'width=920,height=980');
    if (!printWindow) return this.notify('El navegador bloqueó la ventana de impresión. Permita ventanas emergentes.', 'danger');
    printWindow.opener = null;
    printWindow.document.open();
    printWindow.document.write(buildPrescriptionPrintHtml(this.state.data, patient, prescription));
    printWindow.document.close();
  };

  updateAppointmentStatus = (appointmentId, status) => {
    if (!this.can('appointmentsManage')) return this.permissionDenied();
    const next = changeAppointmentStatus(this.state.data, appointmentId, status);
    this.persistDataUpdate({
      data: next,
      appointmentDetails: this.state.appointmentDetails?.id === appointmentId ? { ...this.state.appointmentDetails, status } : this.state.appointmentDetails,
    }, `Cita marcada como ${statusLabel(status).toLowerCase()}.`);
  };

  saveMedicationArchive = async event => {
    event.preventDefault();const {patientId,draft}=this.state.modal;if(String(draft.reason||'').trim().length<3)return this.setState({modalError:'Escriba un motivo de al menos 3 caracteres.'});this.setState({formSaving:true,modalError:''});
    try{await this.flushChanges();await archiveMedication(this.state.remoteOrganizationId,patientId,draft.medicationId,draft.reason);const session=await getProductionSession();await this.applyProductionSession(session);this.setState({view:'patient',selectedPatientId:patientId,patientTab:'medications',formSaving:false,modal:null});this.notify('Medicamento eliminado de la lista activa y conservado en el historial.');}
    catch(error){this.setState({formSaving:false,modalError:error.message||'No se pudo eliminar el medicamento.'});}
  };

  saveClinicalArchive = async event => {
    event.preventDefault();
    const { patientId, resource, recordId, patientTab, draft } = this.state.modal;
    try {
      if(String(draft.reason||'').trim().length<3)throw new Error('Escribe un motivo de al menos 3 caracteres.');
      if (resource === 'patient') {
        this.setState({formSaving:true,modalError:''});
        await this.flushChanges();
        await archivePatient(this.state.remoteOrganizationId,patientId,draft.reason);
        const session=await getProductionSession();
        await this.applyProductionSession(session);
        this.setState({view:'patients',selectedPatientId:null,modal:null,formSaving:false,patientFilter:'all'});
        this.notify('Paciente archivado y conservado en el historial.');
        return;
      }
      if (resource === 'document') {
        const patient = this.state.data.patients.find(item => item.id === patientId);
        const document = patient?.documents?.find(item => item.id === recordId);
        if (document) await deletePatientDocumentFile(document);
      }
      const result = archiveClinicalRecord(this.state.data, patientId, resource, recordId, draft.reason);
      const labels = { adverseEvent: 'Efecto retirado', lab: 'Resultado retirado', vital: 'Control retirado', assessment: 'Medición retirada', document: 'Documento archivado', consultation: 'Consulta retirada' };
      await this.persistDataUpdate({ data: result.data, patientTab: patientTab || this.state.patientTab, modal: null, modalError: '' }, `${labels[resource] || 'Registro retirado'} y conservado en el historial.`);
    } catch (error) { this.setState({formSaving:false});this.handleFormError(error); }
  };

  updateAppointmentReview = (appointmentId, adminReviewStatus) => {
    if (!this.can('appointmentsManage')) return this.permissionDenied();
    const next=changeAppointmentReviewStatus(this.state.data,appointmentId,adminReviewStatus);
    this.persistDataUpdate({data:next,appointmentDetails:this.state.appointmentDetails?.id===appointmentId?{...this.state.appointmentDetails,adminReviewStatus}:this.state.appointmentDetails},adminReviewStatus==='reviewed'?'Cita marcada como revisada.':'Cita marcada por revisar.');
  };

  deleteAppointment = appointmentId => {
    if (!this.can('appointmentsManage')) return this.permissionDenied();
    if (!window.confirm('¿Eliminar esta cita? Esta acción no modifica el expediente clínico.')) return;
    this.persistDataUpdate({ data: removeAppointment(this.state.data, appointmentId), appointmentDetails: null }, 'Cita eliminada.');
  };

  acknowledgeAlert = alertId => {
    if (!this.can('alertsView')) return this.permissionDenied();
    return this.persistDataUpdate({data:updateAlertStatus(this.state.data,alertId,'acknowledged')},'Alerta marcada como revisada.');
  };

  reopenAlert = alertId => {
    if (!this.can('alertsView')) return this.permissionDenied();
    return this.persistDataUpdate({data:updateAlertStatus(this.state.data,alertId,'open')},'Alerta reabierta.');
  };

  changeMedicationStatus = (patient, medication, status) => this.openMedicationStatus(patient, medication, status);

  updateAdverseStatus = (patientId, eventId, status) => {
    if (!this.can('clinicalEdit')) return this.permissionDenied();
    const result = setAdverseEventStatus(this.state.data, patientId, eventId, status);
    this.persistDataUpdate({ data: result.data }, status === 'resolved' ? 'Efecto marcado como resuelto.' : 'Efecto reabierto.');
  };

  exportAnalytics = () => {
    if (!this.can('exportsManage')) return this.permissionDenied();
    downloadCSV('nexamind-resultados.csv', analyticsRows(this.state.data));
    this.notify('Resultados exportados en CSV.');
  };

  exportBackup = () => {if(!this.can('exportsManage'))return this.permissionDenied();downloadJSON(this.state.data,'linkare-respaldo-clinico.json');};

  importBackup = () => this.notify('La importación de expedientes se realiza mediante una migración controlada.','danger');

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
        <label><span>Contraseña</span><div className="login-input"><${Icon} name="lock" size=${18}/><input type=${register.showPassword ? 'text' : 'password'} autoComplete="new-password" minLength="12" value=${register.password} onChange=${event => this.updateRegisterDraft('password', event.target.value)} placeholder="Mínimo 12 caracteres" required/><button type="button" className="password-toggle" aria-label=${register.showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick=${() => this.updateRegisterDraft('showPassword', !register.showPassword)}><${Icon} name=${register.showPassword ? 'eyeOff' : 'eye'} size=${18}/></button></div></label>
        <label><span>Confirmar contraseña</span><div className="login-input"><${Icon} name="lock" size=${18}/><input type=${register.showPassword ? 'text' : 'password'} autoComplete="new-password" minLength="12" value=${register.confirmPassword} onChange=${event => this.updateRegisterDraft('confirmPassword', event.target.value)} placeholder="Repita la contraseña" required/></div></label>
        <${Button} type="submit" icon="userPlus" className="login-submit" disabled=${this.state.loginBusy}>${this.state.loginBusy ? 'Creando cuenta…' : 'Crear mi cuenta Linkare'}</${Button}>
        <small className="signup-terms">Al registrarse, se crea una organización propia y aislada mediante las políticas de Supabase.</small>
      </form>
    </div>`;
  }

  renderSignInForm() {
    const d=this.state.loginDraft;
    return html`<div className="auth-form-stack"><div className="login-panel-head"><span className="login-icon"><${Icon} name="lock"/></span><div><span className="eyebrow">Bienvenido a Linkare</span><h2>Iniciar sesión</h2><p>Ingrese con su cuenta de médico o secretaría.</p></div></div>
      ${this.state.authNotice?html`<div className="auth-notice" role="status">${this.state.authNotice}</div>`:null}
      <form className="login-form" onSubmit=${this.submitLogin}>${this.state.loginError?html`<div className="login-error" role="alert">${this.state.loginError}</div>`:null}
        <label><span>Correo</span><div className="login-input"><${Icon} name="mail"/><input type="email" autoComplete="username" required value=${d.email} onChange=${e=>this.updateLoginDraft('email',e.target.value)}/></div></label>
        <label><span>Contraseña</span><div className="login-input"><${Icon} name="lock"/><input type=${d.showPassword?'text':'password'} autoComplete="current-password" required value=${d.password} onChange=${e=>this.updateLoginDraft('password',e.target.value)}/><button type="button" aria-label="Mostrar u ocultar contraseña" onClick=${()=>this.updateLoginDraft('showPassword',!d.showPassword)}><${Icon} name="eye"/></button></div></label>
        <${Button} type="submit" className="login-submit" disabled=${this.state.loginBusy}>${this.state.loginBusy?'Ingresando…':'Ingresar a Linkare'}</${Button}>
      </form><button className="inline-auth-link" onClick=${()=>this.setState({authView:'forgot',loginError:'',authNotice:''})}>Olvidé mi contraseña</button>
      <p className="field-note">¿Es parte de secretaría? El médico debe invitarle a su consultorio.</p>
      ${this.state.authNotice?html`<button className="inline-auth-link" disabled=${this.state.loginBusy} onClick=${this.resendEmail}>Reenviar confirmación de correo</button>`:null}
    </div>`;
  }

  renderLogin() {
    if(!supabaseConfigured)return this.renderStatePage('settings','Configuración pendiente','No se pudo iniciar la conexión del consultorio. Contacte a la administración.',()=>location.reload(),'Reintentar');
    const registering=this.state.authView==='register';const passwordFlow=['forgot','set-password'].includes(this.state.authView);
    return html`<main className="login-shell"><section className="login-card"><aside className="login-intro"><${Logo} organization=${{name:'Linkare',clinicLogo:'/assets/linkare-logo.jpg',specialty:'Gestión clínica'}}/><div className="login-copy"><span className="login-kicker">Su consultorio, en orden</span><h1>Más tiempo para escuchar. Todo lo demás, aquí.</h1><p>Expedientes, agenda, documentos y notas de consulta en un mismo lugar.</p></div><div className="login-benefits"><div><${Icon} name="file"/><b>Expedientes</b><small>Seguimiento y documentos.</small></div><div><${Icon} name="calendar"/><b>Agenda</b><small>Su jornada organizada.</small></div><div><${Icon} name="notebook"/><b>Libreta clínica</b><small>Anotaciones por consulta.</small></div><div><${Icon} name="users"/><b>Su equipo</b><small>Accesos individuales.</small></div></div></aside>
      <section className="login-panel">${!passwordFlow?html`<div className="auth-tabs"><button type="button" className=${registering?'':'active'} onClick=${this.showLogin}>Iniciar sesión</button><button type="button" className=${registering?'active':''} onClick=${this.showRegister}>Crear consultorio</button></div>`:null}${passwordFlow?this.renderPasswordFlow():registering?this.renderRegistrationForm():this.renderSignInForm()}</section></section></main>`;
  }

  renderTopbar() {
    const user = this.activeUser();
    const nav = [
      ['dashboard', 'overview', 'Inicio', true],
      ['patients', 'patients', 'Pacientes', this.can('patientsView')],
      ['agenda', 'calendar', 'Agenda', this.can('appointmentsManage')],
      ['payments', 'insurance', 'Mi plan', user?.role === 'owner'],
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
    const patients = this.state.data.patients.filter(item => !item.archived);
    const { appointments } = this.state.data;
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
    if (!this.can('clinicalView')) return this.renderSecretaryDashboard();
    const patients = this.state.data.patients.filter(item => !item.archived);
    const { appointments, alerts } = this.state.data;
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
        <${KpiCard} label="Con mejoría importante" value=${percent(responseRate)} hint="cambio favorable ≥50% en su escala principal" icon="trend" tone="teal"/>
        <${KpiCard} label="Citas esta semana" value=${weekAppointments.length} hint=${`${todayAppointments.length} programadas hoy`} icon="calendar" tone="blue"/>
      </div>

      <div className="dashboard-grid">
        <${Card} className="span-8" title="Evolución general de los pacientes" subtitle="Promedio relativo de la escala principal. 100 representa el valor inicial." action=${html`<${Badge} tone="success" dot=${true}>Mejoría media ${percent(meanImprovement)}</${Badge}>`}>
          <div className="chart-summary"><div><strong>${percent(meanImprovement)}</strong><span>mejoría media observada</span></div><div><b>${percent(avgAdherence)}</b><span>adherencia media</span></div><div><b>${patients.filter(patient => patient.adverseEvents.some(event => event.status === 'active')).length}</b><span>con efecto activo</span></div></div>
          <${LineChart} series=${[{ label: 'Síntomas relativos', points: symptomPoints }]}/>
          <div className="clinical-footnote"><${Icon} name="shield" size=${17}/> Muestra cambios registrados durante el tratamiento. No demuestra que un medicamento sea la causa del cambio.</div>
        </${Card}>
        <${Card} tour="dashboard-agenda" className="span-4 agenda-preview" title="Agenda del día" action=${html`<div><button className="text-button" onClick=${this.printDailyAgenda}>Imprimir</button>${this.state.reminderProviders.whatsapp?html`<button className="text-button" disabled=${this.state.integrationBusy} onClick=${this.sendDailyAgenda}>Enviar por WhatsApp</button>`:null}<button className="text-button" onClick=${() => this.setView('agenda')}>Abrir agenda <${Icon} name="chevronRight" size=${16}/></button></div>`}>
          <div className="date-hero"><span>${new Intl.DateTimeFormat('es-SV', { weekday: 'long' }).format(new Date())}</span><strong>${new Date().getDate()}</strong><small>${new Intl.DateTimeFormat('es-SV', { month: 'long', year: 'numeric' }).format(new Date())}</small></div>
          <div className="today-list">
            ${this.state.dailyAgendaLoading?html`<p>Cargando agenda segura…</p>`:(this.state.dailyAgenda?.items||[]).length ? this.state.dailyAgenda.items.map(item => {
              const appointment=appointments.find(value=>value.id===item.appointmentId);
              return html`<button key=${item.appointmentId} className="today-item" onClick=${() => appointment&&this.setState({appointmentDetails:appointment})}><time>${formatTime(item.start)}</time><span className="event-line"></span><div><b>${item.patientName}</b><small>${item.currentMedication?`${item.currentMedication.name} ${item.currentMedication.dose||''}`:'Sin tratamiento activo'}</small><small>${item.relevantNote||'Sin cambio reciente'}</small></div></button>`;
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
      if (this.state.patientFilter === 'archived') return patient.archived;
      if (patient.archived) return false;
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
      <div className="patients-toolbar"><div><${Badge} tone="blue">${filtered.length} pacientes</${Badge}>${clinicalVisible ? html`<${Badge} tone="warning">${patients.filter(patient => !patient.archived && getPatientPriority(patient, alerts).score >= 2).length} por revisar</${Badge}>` : html`<${Badge} tone="neutral">${patients.filter(patient => !patient.archived && patient.insurance?.hasInsurance).length} con seguro</${Badge}>`}</div><div className="segmented" aria-label="Filtrar pacientes">${[['all', 'Todos'], ['active', 'Activos'], ['review', clinicalVisible ? 'Por revisar' : 'Sin próxima cita'], ['archived','Archivados']].map(([key, label]) => html`<button key=${key} className=${this.state.patientFilter === key ? 'active' : ''} onClick=${() => this.setState({ patientFilter: key })}>${label}</button>`)}</div></div>
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
    const reportedPendingMedications = (patient.medications || []).filter(item => item.status === 'pending_review' && !item.archivedAt);
    const insurance = patient.insurance || {};
    return html`<div className="view-enter administrative-patient">
      <div className="patient-hero administrative-hero">
        <button className="back-button" aria-label="Volver a pacientes" onClick=${() => this.setView('patients')}><${Icon} name="chevronLeft"/></button>
        <div className="patient-photo-control" data-tour="patient-photo"><${Avatar} patient=${patient} size="xl"/>${this.can('patientsEdit') ? html`<label className="photo-fab" title="Cambiar fotografía"><${Icon} name="camera" size=${16}/><input type="file" accept="image/png,image/jpeg,image/webp" onChange=${event => this.handlePatientPhotoUpload(patient.id, event)}/></label>` : null}</div>
        <div className="patient-hero-main" data-tour="patient-badges"><span className="eyebrow">Ficha administrativa</span><h1>${patient.name}</h1><p>${patient.age} años · ${patient.phone || 'Sin teléfono'} · ${patient.email || 'Sin correo'}</p><div className="hero-badges"><${Badge} tone=${insurance.hasInsurance ? 'blue' : 'neutral'}>${insurance.hasInsurance ? 'Con seguro médico' : 'Paciente particular'}</${Badge}><${Badge} tone=${upcoming.length ? 'success' : 'warning'}>${upcoming.length ? 'Cita programada' : 'Sin próxima cita'}</${Badge}></div></div>
        <div className="patient-hero-actions" data-tour="patient-next-visit">${this.can('patientsEdit') ? html`<${Button} tone="secondary" icon="edit" onClick=${() => this.openEditPatient(patient)}>Editar datos</${Button}>` : null}${this.can('appointmentsManage') ? html`<${Button} tone="secondary" icon="calendar" disabled=${this.state.integrationBusy} onClick=${()=>this.copyScopedCalendar('patient_own',patient.id)}>Calendario del paciente</${Button}><${Button} icon="calendar" onClick=${() => this.openNewAppointment(patient.nextVisit ? new Date(patient.nextVisit) : new Date(), patient.id)}>Agendar</${Button}>` : null}</div>
      </div>
      <div className="simple-help administrative-help"><${Icon} name="shield" size=${18}/><p><b>Información protegida.</b> El resto del expediente clínico permanece protegido. Solo se muestran los datos y las recetas autorizados para este usuario.</p></div>
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
        ${this.can('medicationsCapture')?html`<${Card} className="span-12" title="Medicamentos informados" subtitle="Secretaría puede registrar lo que informa el paciente. El médico debe revisarlo antes de activarlo." action=${html`<${Button} icon="plus" onClick=${()=>this.openMedication(patient)}>Registrar medicamento informado</${Button}>`}>
          ${reportedPendingMedications.length?html`<div className="admin-appointment-list">${reportedPendingMedications.map(medication=>html`<div key=${medication.id}><div><b>${medication.name}</b><small>${medication.dose||'Dosis no indicada'} · ${medication.frequency||'Frecuencia no indicada'}</small>${medication.reportedNotes?html`<small>${medication.reportedNotes}</small>`:null}</div><${Badge} tone="warning">Pendiente de revisión médica</${Badge}></div>`)}</div>`:html`<${EmptyState} icon="medication" title="Sin medicamentos informados" text="Registre aquí el medicamento que comunique el paciente."/>`}
        </${Card}>`:null}
        ${this.can('documentsGenerateAdministrative')?html`<${Card} className="span-12" title="Documentos administrativos" subtitle="Genere constancias e incapacidades sin acceder al contenido clínico del expediente." action=${html`<${Button} icon="file" disabled=${this.state.documentBusy} onClick=${()=>this.openDocumentGenerator(patient)}>Nuevo documento</${Button}>`}><p className="field-note">El PDF queda guardado en el almacenamiento privado y conserva la versión exacta de la plantilla usada.</p></${Card}>`:null}
      </div>
      ${this.can('documentsView') ? this.renderDocumentsTab(patient) : null}
      ${this.can('prescriptionsEdit') ? this.renderPrescriptionsTab(patient) : null}
    </div>`;
  }

  renderPatient() {
    const { patients, alerts, appointments } = this.state.data;
    const patient = patients.find(item => item.id === this.state.selectedPatientId);
    if (!patient) return html`<${EmptyState} icon="patients" title="Sin pacientes" text="Cree el primer expediente para comenzar." action=${html`<${Button} icon="userPlus" onClick=${this.openNewPatient}>Nuevo paciente</${Button}>`}/>`;
    if (!this.can('clinicalView')) return this.renderAdministrativePatient(patient);
    const summary = getAssessmentSummary(patient);
    const priority = getPatientPriority(patient, alerts);
    const patientAlerts = alerts.filter(item => item.patientId === patient.id && item.status === 'open');
    const patientAppointments = appointments.filter(item => item.patientId === patient.id).sort((left, right) => new Date(right.start) - new Date(left.start));
    const primaryMedication = patient.medication;
    const exposureDays = primaryMedication?.status === 'active' ? daysBetween(primaryMedication.startDate) : 0;
    const activeAdverseRecords = (patient.adverseEvents || []).filter(item => !item.archivedAt);
    const archivedAdverseRecords = (patient.adverseEvents || []).filter(item => item.archivedAt);
    const activeAdverse = activeAdverseRecords.filter(item => item.status === 'active');
    const activeLabs = (patient.labs || []).filter(item => !item.archivedAt);
    const archivedLabs = (patient.labs || []).filter(item => item.archivedAt);
    const activeVitals = (patient.vitalsHistory || []).filter(item => !item.archivedAt);
    const archivedVitals = (patient.vitalsHistory || []).filter(item => item.archivedAt);
    const activeAssessments = (patient.assessments || []).map(assessment => ({ ...assessment, points: (assessment.points || []).filter(point => !point.archivedAt) })).filter(assessment => assessment.points.length);
    const archivedAssessmentPoints = (patient.assessments || []).flatMap(assessment => (assessment.points || []).filter(point => point.archivedAt).map(point => ({ ...point, code: assessment.code })));
    const visibleMedications=(patient.medications||[]).filter(item=>!item.archivedAt);
    const archivedMedications=(patient.medications||[]).filter(item=>item.archivedAt);
    const tabs = [
      ['overview', 'Resumen'],
      ['medications', 'Medicamentos'],
      ['followup', 'Seguimiento'],
      ['safety', 'Efectos y controles'],
      ['consultations', 'Consultas'],
      ['documents', 'Documentos'],
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
        <div className="patient-hero-main" data-tour="patient-badges"><span className="eyebrow">Expediente del paciente · Datos clínicos</span><h1>${patient.preferredName || patient.name}</h1><p>${patient.preferredName ? `${patient.name} · ` : ''}${patient.age} años · ${patient.diagnosis} · ${patient.diagnosisCode}</p><div className="hero-badges"><${Badge} tone=${priority.tone} dot=${true}>${priority.label}</${Badge}><${Badge} tone="neutral">Riesgo ${riskLabel(patient.risk).toLowerCase()}</${Badge}><${Badge} tone=${patient.insurance?.hasInsurance ? 'blue' : 'neutral'}>${patient.insurance?.hasInsurance ? patient.insurance.provider || 'Con seguro' : 'Particular'}</${Badge}>${patient.vitalStatus === 'deceased' ? html`<${Badge} tone="danger"><${Icon} name="heart" size=${13}/> Expediente post mortem</${Badge}>` : null}${primaryMedication?.name && primaryMedication.name !== 'Sin medicamento' ? html`<${Badge} tone="purple">${primaryMedication.name} ${primaryMedication.dose}</${Badge}>` : html`<${Badge} tone="warning">Sin medicamento principal</${Badge}>`}</div></div>
        <div className="patient-hero-actions" data-tour="patient-next-visit"><div><span>Próxima cita</span><b>${patient.nextVisit ? relativeDate(patient.nextVisit) : 'Sin agendar'}</b><small>${patient.nextVisit ? formatDateTime(patient.nextVisit) : 'Cree una cita desde el botón'}</small></div><${Button} tone="secondary" icon="calendar" disabled=${this.state.integrationBusy} onClick=${()=>this.copyScopedCalendar('patient_own',patient.id)}>Compartir sus citas</${Button}><${Button} icon="calendar" onClick=${() => this.openNewAppointment(patient.nextVisit ? new Date(patient.nextVisit) : new Date(), patient.id)}>Agendar</${Button}></div>
      </div>

      ${patient.vitalStatus === 'deceased' ? html`<section className="postmortem-banner"><span><${Icon} name="shield" size=${24}/></span><div><span className="eyebrow">Expediente en modo post mortem</span><h3>Paciente registrado como fallecido</h3><p>No se enviarán recordatorios ni se permitirán nuevas consultas. La manera de muerte se muestra únicamente como dato documentado, sin inferencias automáticas.</p><small>${patient.deathRecord?.dateOfDeath ? `Fecha registrada: ${formatDate(patient.deathRecord.dateOfDeath)} · ` : ''}${patient.deathRecord?.manner || 'Pendiente de confirmación'}</small></div>${this.can('postmortemExport') ? html`<${Button} tone="secondary" icon="print" onClick=${() => this.printPostmortemReport(patient)}>Generar paquete médico-legal</${Button}>` : null}</section>` : null}

      <div className="patient-action-bar" data-tour="patient-actions" aria-label="Acciones rápidas del paciente">
        <div><b>Acciones frecuentes</b><small>Registre lo ocurrido durante o después de la consulta.</small></div>
        ${this.can('clinicalEdit') ? html`<${Button} tour="action-evolution" icon="analytics" onClick=${() => this.openAssessment(patient)}>Registrar evolución</${Button}>` : null}
        ${this.can('medicationsManage') ? html`<${Button} tour="action-medication" tone="secondary" icon="medication" onClick=${() => this.openMedication(patient)}>Agregar medicamento</${Button}>` : null}
        ${this.can('medicationsManage') ? html`<${Button} tour="action-dose" tone="secondary" icon="edit" disabled=${!patient.medications.some(item => item.status === 'active')} onClick=${() => this.openDose(patient)}>Cambiar dosis</${Button}>` : null}
        ${this.can('prescriptionsCreate') ? html`<${Button} tour="action-prescription" tone="secondary" icon="prescription" onClick=${() => this.openPrescription(patient)}>Nueva receta</${Button}>` : null}
        ${this.can('consultationsManage') && patient.vitalStatus !== 'deceased' ? html`<${Button} tone="secondary" icon="notebook" onClick=${this.startConsultationForSelectedPatient}>Iniciar consulta</${Button}>` : null}
        ${this.can('documentsManage') ? html`<${Button} tone="secondary" icon="folder" onClick=${() => this.openDocumentUpload(patient)}>Subir archivo</${Button}>` : null}
        ${this.can('patientsEdit') ? html`<${Button} tour="action-patient-data" tone="secondary" icon="edit" onClick=${() => this.openEditPatient(patient)}>Datos y seguro</${Button}>` : null}
      </div>

      <div className="patient-tabs" data-tour="patient-tabs" role="tablist">${tabs.map(([key, label]) => html`<button key=${key} role="tab" data-tour=${`patient-tab-${key}`} className=${this.state.patientTab === key ? 'active' : ''} onClick=${() => this.setState({ patientTab: key })}>${label}${key === 'safety' && patientAlerts.length ? html`<b>${patientAlerts.length}</b>` : null}</button>`)}</div>

      ${this.state.patientTab === 'overview' ? html`<div>
        <div className="patient-kpis" data-tour="patient-overview-kpis">
          <${Card} className="patient-kpi"><span>Mejoría en síntomas</span><strong className=${summary?.improvement >= 0 ? 'good-text' : 'danger-text'}>${summary ? percent(summary.improvement) : '—'}</strong><small>${summary ? `${summary.primary.code}: ${summary.baseline} → ${summary.current}` : 'Registre una escala para calcular el cambio'}</small><div className="meter"><i style=${{ width: `${Math.min(100, Math.max(0, summary?.improvement || 0))}%` }}></i></div></${Card}>
          <${Card} className="patient-kpi"><span>Funcionamiento diario</span><strong className=${patient.functioningChange >= 0 ? 'good-text' : 'danger-text'}>${patient.functioningChange >= 0 ? '+' : ''}${patient.functioningChange || 0}%</strong><small>Cambio reportado desde el valor inicial</small></${Card}>
          <${Card} className="patient-kpi"><span>Adherencia al tratamiento</span><strong>${patient.adherence}%</strong><small>Estimación de cuánto cumple la indicación</small><div className="meter purple"><i style=${{ width: `${Math.max(0, Math.min(100, patient.adherence))}%` }}></i></div></${Card}>
          <${Card} className="patient-kpi"><span>Efectos y seguridad</span><strong>${activeAdverse.length}</strong><small>efectos observados activos</small><${Badge} tone=${patientAlerts.length ? 'warning' : 'success'} dot=${true}>${patientAlerts.length ? `${patientAlerts.length} pendiente(s)` : 'Sin alertas abiertas'}</${Badge}></${Card}>
        </div>

        <div className="dashboard-grid">
          <${Card} tour="patient-trend" className="span-8" title="Cómo ha cambiado el paciente" subtitle="Compare mediciones clínicas o cambios de dosis a lo largo del tiempo." action=${html`<div className="segmented small"><button className=${this.state.chartMode === 'scales' ? 'active' : ''} onClick=${() => this.setState({ chartMode: 'scales' })}>Síntomas</button><button className=${this.state.chartMode === 'dose' ? 'active' : ''} onClick=${() => this.setState({ chartMode: 'dose' })}>Dosis</button></div>`}>
            ${this.state.chartMode === 'scales' ? html`<div><div className="chart-summary patient-chart-summary"><div><span>Puntaje inicial</span><strong>${summary?.baseline ?? '—'}</strong></div><div><span>Puntaje actual</span><strong>${summary?.current ?? '—'}</strong></div><div><span>Cambio</span><strong>${summary ? summary.absoluteChange : '—'}</strong></div><div><span>Lectura</span><b>${summary?.label || 'Sin suficientes datos'}</b></div></div><${LineChart} series=${activeAssessments.slice(0, 3).map(item => ({ label: item.code, points: item.points }))}/></div>` : html`<div><div className="chart-summary patient-chart-summary"><div><span>Medicamento</span><strong>${primaryMedication?.name || '—'}</strong></div><div><span>Dosis inicial</span><strong>${primaryMedication?.doseHistory?.[0]?.dose || '—'}</strong></div><div><span>Dosis actual</span><strong>${primaryMedication?.dose || '—'}</strong></div><div><span>Días con tratamiento</span><b>${exposureDays}</b></div></div><${LineChart} series=${doseSeries}/></div>`}
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
        <div className="dashboard-grid identity-context-grid">
          <${Card} className="span-7" title="Identidad y contexto personal" subtitle="Información opcional, autoidentificada y visible únicamente para el equipo clínico."><div className="identity-facts"><div><span>Nombre preferido</span><b>${patient.preferredName || 'No registrado'}</b></div><div><span>Pronombres</span><b>${patient.pronouns || 'No registrados'}</b></div><div><span>Identidad de género</span><b>${patient.genderIdentity || 'No registrada'}</b></div><div><span>Orientación sexual</span><b>${patient.sexualOrientation || 'No registrada'}</b></div><div><span>Sexo asignado al nacer</span><b>${patient.sexAssignedAtBirth || 'No registrado'}</b></div><div><span>Estado de relación</span><b>${patient.relationshipStatus || 'No registrado'}</b></div></div>${patient.significantPeople ? html`<div className="identity-context-note"><span>Personas significativas y red de apoyo</span><p>${patient.significantPeople}</p></div>` : null}</${Card}>
          <${Card} className="span-5" title="Preferencias de recordatorio" subtitle="Se respetan el consentimiento y el canal elegido."><div className="reminder-preference-summary"><div><span>Estado</span><b>${patient.notificationPreferences?.enabled ? 'Activos' : 'Desactivados'}</b></div><div><span>Canales</span><b>${(patient.notificationPreferences?.channels || []).map(reminderChannelLabel).join(', ') || 'No definidos'}</b></div><div><span>Anticipación</span><b>${(patient.notificationPreferences?.reminderHours || []).map(reminderLabel).join(', ')}</b></div><div><span>Consentimiento</span><b>${patient.notificationPreferences?.consentStatus === 'granted' ? 'Otorgado' : patient.notificationPreferences?.consentStatus === 'declined' ? 'Rechazado' : 'Pendiente'}</b></div></div></${Card}>
          <${Card} className="span-12" title="Antecedentes de seguridad" subtitle="Diferencie antecedentes, riesgo actual y fuentes documentadas."><div className="safety-history-grid"><div><span>Ideación previa</span><b>${patient.safetyHistory?.ideationHistory || 'No registrada'}</b></div><div><span>Intentos documentados</span><b>${patient.safetyHistory?.suicideAttemptsCount ?? 0}</b><small>${patient.safetyHistory?.lastAttemptDate ? `Último: ${formatDate(patient.safetyHistory.lastAttemptDate)}` : 'Sin fecha registrada'}</small></div><div><span>Autolesión sin intención suicida</span><b>${patient.safetyHistory?.selfHarmHistory || 'No registrada'}</b></div><div><span>Contacto de emergencia</span><b>${patient.safetyHistory?.emergencyContact || 'No registrado'}</b></div></div>${patient.safetyHistory?.safetyPlan ? html`<div className="safety-plan-summary"><${Icon} name="shield" size=${18}/><div><b>Plan de seguridad</b><p>${patient.safetyHistory.safetyPlan}</p></div></div>` : null}<div className="clinical-footnote"><${Icon} name="shield" size=${17}/> Los antecedentes no determinan por sí solos el riesgo actual. La valoración profesional debe registrarse en cada consulta cuando corresponda.</div></${Card}>
        </div>
      </div>` : null}

      ${this.state.patientTab === 'medications' ? html`<div className="dashboard-grid" data-tour="medication-section">
        <${Card} className="span-12" title="Medicamentos del paciente" subtitle="Cada medicamento conserva su estado, cambios y notas para revisión clínica." action=${this.can('medicationsManage')?html`<${Button} icon="plus" onClick=${()=>this.openMedication(patient)}>Agregar medicamento</${Button}>`:null}>
          ${visibleMedications.length ? html`<div className="medication-list">${visibleMedications.map(medication => {
            const status=medication.status==='held'?'suspended':medication.status==='stopped'?'discontinued':medication.status;
            const labels={pending_review:'Pendiente de revisión',active:'Activo',suspended:'Suspendido',discontinued:'Descontinuado',completed:'Completado'};
            return html`<article key=${medication.id} className=${`medication-card ${status!=='active'?'medication-inactive':''}`}><div className="medication-card-head"><div className="inline-title"><span className="medication-icon"><${Icon} name="medication"/></span><div><span className="eyebrow">${medication.class||'Medicamento informado'}</span><h3>${medication.name}</h3><p>${medication.indication||medication.reportedNotes||'Pendiente de valoración médica'}</p></div></div><div>${medication.isPrimary?html`<${Badge} tone="purple">Principal</${Badge}>`:null}<${Badge} tone=${status==='active'?'success':status==='pending_review'?'warning':'neutral'} dot=${true}>${labels[status]||status}</${Badge}></div></div><div className="medication-main-dose"><span>Dosis actual</span><strong>${medication.dose}</strong><small>${medication.frequency} · vía ${medication.route}</small></div>${medication.reportedNotes?html`<div className="notes-box"><span>Nota informada</span><p>${medication.reportedNotes}</p></div>`:null}${medication.clinicalNotes?html`<div className="notes-box"><span>Nota clínica</span><p>${medication.clinicalNotes}</p></div>`:null}<div className="medication-info-grid"><div><span>Inicio</span><b>${formatDate(medication.startDate)}</b></div><div><span>Días registrados</span><b>${daysBetween(medication.startDate)}</b></div><div><span>Uso según necesidad</span><b>${medication.isPrn?'Sí':'No'}</b></div><div><span>Eventos</span><b>${medication.events?.length||medication.doseHistory?.length||0}</b></div></div><div className="dose-history-mini"><span>Historial de dosis</span><div>${[...(medication.doseHistory||[])].sort((left,right)=>new Date(left.date)-new Date(right.date)).map(item=>html`<div key=${item.id}><time>${formatDate(item.date)}</time><b>${item.dose}</b><small>${item.reason}</small></div>`)}</div></div>${this.can('medicationsManage')?html`<div className="medication-actions" data-tour="medication-status"><${Button} tone="secondary" icon="edit" onClick=${()=>this.openMedication(patient,medication)}>Editar medicamento</${Button}>${status==='pending_review'?html`<${Button} tone="soft" icon="check" onClick=${()=>this.approveMedication(patient,medication)}>Revisar y activar</${Button}>`:status==='active'?html`<${Button} tone="secondary" icon="edit" onClick=${()=>this.openDose(patient,medication.id)}>Cambiar dosis</${Button}><${Button} tone="soft" onClick=${()=>this.changeMedicationStatus(patient,medication,'suspended')}>Suspender</${Button}><${Button} tone="secondary" onClick=${()=>this.changeMedicationStatus(patient,medication,'discontinued')}>Descontinuar</${Button}><${Button} tone="secondary" onClick=${()=>this.changeMedicationStatus(patient,medication,'completed')}>Completar</${Button}>`:status==='suspended'?html`<${Button} tone="secondary" icon="refresh" onClick=${()=>this.changeMedicationStatus(patient,medication,'active')}>Reactivar</${Button}><${Button} tone="secondary" onClick=${()=>this.changeMedicationStatus(patient,medication,'discontinued')}>Descontinuar</${Button}>`:null}<button type="button" className="text-danger-button" onClick=${()=>this.openMedicationArchive(patient,medication)}><${Icon} name="trash" size=${16}/> Eliminar</button></div>`:null}</article>`;
          })}</div>` : html`<${EmptyState} icon="medication" title="Sin medicamentos registrados" text="Agregue el primer medicamento para comenzar el historial de tratamiento." action=${this.can('medicationsManage')?html`<${Button} icon="plus" onClick=${()=>this.openMedication(patient)}>Agregar medicamento</${Button}>`:null}/>`}
        </${Card}>
        ${archivedMedications.length?html`<${Card} className="span-12" title="Medicamentos eliminados" subtitle="Se conservan para mantener íntegro el historial clínico."><div className="admin-appointment-list">${archivedMedications.map(medication=>html`<div key=${medication.id}><div><b>${medication.name}</b><small>${medication.dose||'Dosis no registrada'} · eliminado ${formatDateTime(medication.archivedAt)}</small><small>Motivo: ${medication.archiveReason||'No registrado'}</small></div><${Badge} tone="neutral">Eliminado</${Badge}></div>`)}</div></${Card}>`:null}
        <${Card} className="span-7" title="Cambio de dosis del medicamento principal" subtitle="Cada cambio conserva la dosis anterior, la fecha y el motivo."><${LineChart} series=${doseSeries}/></${Card}>
        <${Card} className="span-5" title="Cómo leer esta sección"><div className="glossary compact"><div><b>Dosis actual</b><p>La cantidad que el paciente tiene indicada en este momento.</p></div><div><b>Historial de dosis</b><p>Permite ver cuándo se inició, aumentó, redujo, pausó o finalizó un tratamiento.</p></div><div><b>Medicamento principal</b><p>Es el tratamiento que el dashboard usa como referencia visual principal. Puede haber otros medicamentos activos.</p></div></div></${Card}>
      </div>` : null}

      ${this.state.patientTab === 'followup' ? html`<div className="dashboard-grid" data-tour="followup-section">
        <${Card} className="span-8" title="Escalas y evolución clínica" subtitle="Cada fila compara el primer valor con el más reciente." action=${html`<${Button} icon="plus" onClick=${() => this.openAssessment(patient)}>Registrar evolución</${Button}>`}>
          ${activeAssessments.length ? html`<div className="assessment-list">${activeAssessments.map(assessment => {
            const points = [...assessment.points].sort((left, right) => new Date(left.date) - new Date(right.date));
            const baseline = Number(points[0]?.value);
            const current = Number(points.at(-1)?.value);
            const improvement = baseline ? (assessment.direction === 'higher' ? current - baseline : baseline - current) / Math.abs(baseline) * 100 : 0;
            const latest=points.at(-1);
            return html`<div key=${assessment.code} className="assessment-row"><div className="scale-code">${assessment.code}</div><div><b>${assessment.label}</b><small>Última medición: ${formatDate(latest?.date)}</small></div><div><span>Inicial</span><b>${baseline}</b></div><div><span>Actual</span><b>${current}</b></div><div><span>Cambio favorable</span><b className=${improvement >= 25 ? 'good-text' : ''}>${percent(improvement)}</b></div><${Sparkline} values=${points.map(point => Number(point.value))} tone="teal"/>${this.can('clinicalEdit')?html`<div className="record-actions"><${Button} tone="secondary" icon="edit" onClick=${()=>this.openAssessment(patient,assessment,latest)}>Editar última</${Button}><button type="button" className="text-danger-button" onClick=${()=>this.openClinicalArchive(patient,'assessment',`${assessment.code}|${latest.id||latest.date}`,`${assessment.code}: ${latest.value}`,'followup')}><${Icon} name="trash" size=${16}/> Eliminar</button></div>`:null}</div>`;
          })}</div>` : html`<${EmptyState} icon="analytics" title="Sin escalas registradas" text="Registre una evaluación para calcular la evolución." action=${html`<${Button} icon="plus" onClick=${() => this.openAssessment(patient)}>Registrar evolución</${Button}>`}/>`}
        </${Card}>
        <${Card} className="span-4" title="Estado actual"><div className="control-summary"><div><span>Estado clínico</span><b>${clinicalLabel(patient.status)}</b></div><div><span>Riesgo registrado</span><b>${riskLabel(patient.risk)}</b></div><div><span>Adherencia</span><b>${patient.adherence}%</b></div><div><span>Funcionamiento</span><b>${patient.functioningChange >= 0 ? '+' : ''}${patient.functioningChange}%</b></div></div><${Button} tone="secondary" icon="analytics" onClick=${() => this.openAssessment(patient)}>Actualizar evolución</${Button}></${Card}>
        <${Card} className="span-12" title="Controles físicos" subtitle="Peso, presión, pulso, sueño y apetito ayudan a vigilar tolerabilidad y salud general." action=${html`<${Button} tone="soft" icon="plus" onClick=${() => this.openVitals(patient)}>Nuevo control</${Button}>`}>
          ${activeVitals.length ? html`<div className="table-wrap"><table className="data-table"><thead><tr><th>Fecha</th><th>Peso</th><th>IMC</th><th>Presión</th><th>Pulso</th><th>Sueño</th><th>Acciones</th></tr></thead><tbody>${[...activeVitals].sort((left, right) => new Date(right.date) - new Date(left.date)).map(record => html`<tr key=${record.id}><td>${formatDate(record.date)}</td><td><b>${record.weight ?? '—'}${record.weight ? ' kg' : ''}</b></td><td>${record.bmi ?? '—'}</td><td>${record.bp || '—'}</td><td>${record.pulse ? `${record.pulse} bpm` : '—'}</td><td>${record.sleepCurrent !== null && record.sleepCurrent !== undefined ? `${record.sleepCurrent} h` : '—'}</td><td><div className="record-actions"><button type="button" className="text-button" onClick=${()=>this.openVitals(patient,record)}>Editar</button><button type="button" className="text-danger-button" onClick=${()=>this.openClinicalArchive(patient,'vital',record.id,`Control del ${formatDate(record.date)}`,'followup')}>Eliminar</button></div></td></tr>`)}</tbody></table></div>` : html`<${EmptyState} icon="activity" title="Sin controles físicos" text="Registre el primer control para crear una tendencia."/>`}
        </${Card}>
        ${(archivedAssessmentPoints.length||archivedVitals.length)?html`<${Card} className="span-12" title="Registros de seguimiento eliminados" subtitle="Se conservan con su motivo para auditoría."><div className="admin-appointment-list">${archivedAssessmentPoints.map(point=>html`<div key=${`${point.code}_${point.id||point.date}`}><div><b>${point.code}: ${point.value}</b><small>${formatDate(point.date)} · Motivo: ${point.archiveReason||'No registrado'}</small></div><${Badge} tone="neutral">Eliminado</${Badge}></div>`)}${archivedVitals.map(record=>html`<div key=${record.id}><div><b>Control físico</b><small>${formatDate(record.date)} · Motivo: ${record.archiveReason||'No registrado'}</small></div><${Badge} tone="neutral">Eliminado</${Badge}></div>`)}</div></${Card}>`:null}
      </div>` : null}

      ${this.state.patientTab === 'safety' ? html`<div className="dashboard-grid" data-tour="safety-section">
        <${Card} className="span-7" title="Efectos observados" subtitle="Registre qué apareció, cuándo y qué relación temporal nota. El sistema no confirma causalidad." action=${html`<${Button} tone="soft" icon="plus" onClick=${() => this.openAdverse(patient)}>Registrar efecto</${Button}>`}>
          ${activeAdverseRecords.length ? html`<div className="adverse-list">${activeAdverseRecords.map(event => html`<div key=${event.id} className="adverse-card"><span className=${`adverse-icon adverse-${event.severity}`}><${Icon} name="alert"/></span><div><div><h4>${event.name}</h4><${Badge} tone=${event.severity === 'moderate' || event.severity === 'severe' ? 'warning' : 'neutral'}>${severityLabel(event.severity)}</${Badge}><${Badge} tone=${event.status === 'resolved' ? 'success' : 'purple'}>${statusLabel(event.status)}</${Badge}></div><p>${event.relation}</p><small>Inicio: ${formatDate(event.onset)}${event.actionTaken ? ` · Acción: ${event.actionTaken}` : ''}</small><div className="adverse-actions"><${Button} tone="secondary" icon=${event.status === 'resolved' ? 'refresh' : 'check'} onClick=${() => this.updateAdverseStatus(patient.id, event.id, event.status === 'resolved' ? 'active' : 'resolved')}>${event.status === 'resolved' ? 'Reabrir' : 'Marcar resuelto'}</${Button}><${Button} tone="secondary" icon="edit" onClick=${()=>this.openAdverse(patient,event)}>Editar</${Button}><button type="button" className="text-danger-button" onClick=${()=>this.openClinicalArchive(patient,'adverseEvent',event.id,event.name,'safety')}><${Icon} name="trash" size=${16}/> Eliminar</button></div></div></div>`)}</div>` : html`<${EmptyState} icon="shield" title="Sin efectos observados" text="No hay efectos adversos registrados en el periodo mostrado." action=${html`<${Button} tone="soft" icon="plus" onClick=${() => this.openAdverse(patient)}>Registrar efecto</${Button}>`}/>`}
        </${Card}>
        <${Card} className="span-5" title="Datos físicos actuales"><div className="safety-stats"><div><span>Peso actual</span><b>${patient.vitals?.weight ?? '—'}${patient.vitals?.weight ? ' kg' : ''}</b><small>${weightChange === null ? 'Sin comparación' : `${weightChange >= 0 ? '+' : ''}${weightChange.toFixed(1)}% desde el valor inicial`}</small></div><div><span>IMC</span><b>${patient.vitals?.bmi ?? '—'}</b><small>Interpretar según contexto individual</small></div><div><span>Presión arterial</span><b>${patient.vitals?.bp || '—'}</b><small>${patient.vitals?.pulse ? `Pulso ${patient.vitals.pulse} bpm` : 'Pulso no registrado'}</small></div><div><span>Sueño</span><b>${patient.sleepCurrent ?? '—'}${patient.sleepCurrent !== null ? ' h' : ''}</b><small>${patient.sleepBaseline !== null ? `Inicial ${patient.sleepBaseline} h` : 'Sin valor inicial'}</small></div></div><${Button} tone="secondary" icon="activity" onClick=${() => this.openVitals(patient)}>Actualizar control físico</${Button}></${Card}>
        <${Card} className="span-8" title="Laboratorios" subtitle="Guarde resultados y marque si el laboratorio los reporta fuera de rango." action=${html`<${Button} tone="soft" icon="plus" onClick=${() => this.openLab(patient)}>Nuevo resultado</${Button}>`}>
          ${activeLabs.length ? html`<div className="table-wrap"><table className="data-table"><thead><tr><th>Prueba</th><th>Resultado</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${[...activeLabs].sort((left, right) => new Date(right.date) - new Date(left.date)).map(lab => html`<tr key=${lab.id}><td><b>${lab.name}</b></td><td><strong>${lab.value}</strong> <small>${lab.unit}</small></td><td>${formatDate(lab.date)}</td><td><${Badge} tone=${lab.status === 'normal' ? 'success' : 'warning'} dot=${true}>${lab.status === 'normal' ? 'En rango' : 'Revisar'}</${Badge}></td><td><div className="record-actions"><button type="button" className="text-button" onClick=${()=>this.openLab(patient,lab)}>Editar</button><button type="button" className="text-danger-button" onClick=${()=>this.openClinicalArchive(patient,'lab',lab.id,lab.name,'safety')}>Eliminar</button></div></td></tr>`)}</tbody></table></div>` : html`<${EmptyState} icon="file" title="Sin resultados" text="Agregue un laboratorio cuando sea pertinente para el tratamiento."/>`}
        </${Card}>
        <${Card} tour="patient-alerts" className="span-4" title="Alertas del paciente" action=${html`<${Badge} tone=${patientAlerts.length ? 'danger' : 'success'}>${patientAlerts.length} abiertas</${Badge}>`}><div className="alert-list">${patientAlerts.length ? patientAlerts.map(alert => html`<div className="alert-detail compact-detail" key=${alert.id}><span className=${`alert-indicator alert-${alert.severity}`}></span><div><span>${alert.category}</span><h4>${alert.title}</h4><p>${alert.detail}</p><small>${formatDateTime(alert.createdAt)}</small></div><${Button} tone="secondary" icon="check" onClick=${() => this.acknowledgeAlert(alert.id)}>Revisada</${Button}></div>`) : html`<${EmptyState} icon="shield" title="Sin alertas abiertas" text="No hay señales pendientes en este momento."/>`}</div></${Card}>
        ${(archivedAdverseRecords.length||archivedLabs.length)?html`<${Card} className="span-12" title="Efectos y resultados eliminados" subtitle="Se conservan con fecha, autor y motivo."><div className="admin-appointment-list">${archivedAdverseRecords.map(event=>html`<div key=${event.id}><div><b>Efecto: ${event.name}</b><small>${formatDate(event.onset)} · Motivo: ${event.archiveReason||'No registrado'}</small></div><${Badge} tone="neutral">Eliminado</${Badge}></div>`)}${archivedLabs.map(lab=>html`<div key=${lab.id}><div><b>Laboratorio: ${lab.name}</b><small>${formatDate(lab.date)} · Motivo: ${lab.archiveReason||'No registrado'}</small></div><${Badge} tone="neutral">Eliminado</${Badge}></div>`)}</div></${Card}>`:null}
      </div>` : null}

      ${this.state.patientTab === 'consultations' ? this.renderConsultationsTab(patient) : null}

      ${this.state.patientTab === 'documents' ? this.renderDocumentsTab(patient) : null}

      ${this.state.patientTab === 'prescriptions' ? this.renderPrescriptionsTab(patient) : null}

      ${this.state.patientTab === 'timeline' ? this.renderPatientTimeline(patient, patientAppointments) : null}
    </div>`;
  }

  renderPrescriptionsTab(patient) {
    const prescriptions = [...(patient.prescriptions || [])].sort((left,right)=>new Date(right.date||right.createdAt)-new Date(left.date||left.createdAt));
    return html`<div className="dashboard-grid prescriptions-view">
        <${Card} tour="prescriptions-section" className="span-12" title="Recetas del paciente" subtitle="Las recetas se conservan en el expediente. Si existe un error, anúlela con el motivo correspondiente." action=${this.can('prescriptionsCreate') ? html`<${Button} icon="prescription" onClick=${() => this.openPrescription(patient)}>Nueva receta</${Button}>` : null}>
          ${prescriptions.length ? html`<div className="prescription-list">${prescriptions.map(prescription => {
            const voided=prescription.status==='voided'||Boolean(prescription.archivedAt);
            const reason=prescription.voidReason||prescription.archiveReason||'Anulación histórica';
            return html`<article key=${prescription.id} className=${`prescription-card ${voided?'prescription-voided':''}`}><div className="prescription-card-icon"><${Icon} name="prescription" size=${22}/></div><div><span>${prescription.number}</span><h4>${formatLongDate(prescription.date)}</h4><p>${prescription.items.length} indicación(es) · ${prescription.diagnosis || patient.diagnosis}</p><small>Emitida por ${prescription.doctorName || this.state.data.organization.clinician}</small>${voided?html`<p><${Badge} tone="danger">Receta anulada</${Badge}></p><small>Motivo: ${reason}${prescription.voidedAt||prescription.archivedAt?` · ${formatDateTime(prescription.voidedAt||prescription.archivedAt)}`:''}</small>`:null}</div><div className="prescription-card-items">${prescription.items.slice(0,3).map(item=>html`<span key=${item.id}><b>${item.medication}</b> ${item.strength}</span>`)}</div>${this.can('prescriptionsEdit')&&!voided?html`<${Button} tone="secondary" icon="edit" onClick=${()=>this.editPrescription(patient,prescription)}>Editar receta</${Button}><button type="button" className="text-danger-button" onClick=${()=>this.openVoidPrescription(patient,prescription)}><${Icon} name="alert" size=${16}/> Anular receta</button>`:null}<${Button} tone="secondary" icon="print" onClick=${()=>this.printPrescription(prescription,patient.id)}>Imprimir</${Button}></article>`;
          })}</div>` : html`<${EmptyState} icon="prescription" title="Aún no hay recetas" text="La receta se genera con el membrete configurado por el médico." action=${this.can('prescriptionsCreate') ? html`<${Button} icon="plus" onClick=${() => this.openPrescription(patient)}>Crear primera receta</${Button}>` : null}/>`}
        </${Card}>
      </div>`;
  }

  renderPatientTimeline(patient, patientAppointments) {
    const prescriptionEvents=(patient.prescriptions||[]).flatMap(prescription=>{
      const events=[{date:prescription.createdAt||prescription.date,type:'prescription',title:`Receta ${prescription.number||''} creada`,detail:`${prescription.items?.length||0} indicación(es).`}];
      if(prescription.updatedAt&&prescription.updatedAt!==prescription.createdAt)events.push({date:prescription.updatedAt,type:'prescription',title:`Receta ${prescription.number||''} corregida`,detail:'Se conservó la misma receta con sus cambios registrados.'});
      if(prescription.status==='voided'||prescription.archivedAt)events.push({date:prescription.voidedAt||prescription.archivedAt||prescription.updatedAt,type:'prescription',title:`Receta ${prescription.number||''} anulada`,detail:`Motivo: ${prescription.voidReason||prescription.archiveReason||'Anulación histórica'}.`});
      return events;
    });
    const allEvents = [
      ...(patient.timeline || []),
      ...patientAppointments.map(appointment => ({ date: appointment.start, type: 'appointment', title: `Consulta ${statusLabel(appointment.status).toLowerCase()}`, detail: `${appointment.type} · ${appointment.modality}. ${appointment.notes || ''}` })),
      ...prescriptionEvents,
    ].sort((left, right) => new Date(right.date) - new Date(left.date));
    const filterMap = { medications: 'medication', assessments: 'assessment', effects: 'alert', vitals: 'vital', labs: 'lab', documents: 'document', prescriptions:'prescription', consultations: 'consultation', appointments: 'appointment' };
    const filtered = this.state.timelineFilter === 'all' ? allEvents : allEvents.filter(item => item.type === filterMap[this.state.timelineFilter]);
    const filters = [['all', 'Todo'], ['medications', 'Medicamentos'], ['prescriptions','Recetas'], ['assessments', 'Escalas'], ['effects', 'Efectos'], ['vitals', 'Controles'], ['labs', 'Laboratorios'], ['documents', 'Documentos'], ['consultations', 'Consultas'], ['appointments', 'Citas']];
    return html`<${Card} tour="timeline-section" className="timeline-full" title="Historial completo" subtitle="Una sola secuencia con medicamentos, mediciones, laboratorios, efectos y citas." action=${html`<div className="segmented small timeline-filter">${filters.map(([key, label]) => html`<button key=${key} className=${this.state.timelineFilter === key ? 'active' : ''} onClick=${() => this.setState({ timelineFilter: key })}>${label}</button>`)}</div>`}><div className="timeline-list large">${filtered.length ? filtered.map((item, index) => html`<div key=${`${item.date}_${index}`} className="timeline-row"><time>${formatDate(item.date)}<small>${formatTime(item.date)}</small></time><span className=${`timeline-icon timeline-${item.type}`}><${Icon} name=${item.type === 'medication' ? 'medication' : item.type === 'assessment' ? 'analytics' : item.type === 'lab' ? 'file' : item.type === 'appointment' ? 'calendar' : item.type === 'document' ? 'prescription' : item.type === 'vital' ? 'activity' : 'alert'} size=${18}/></span><div><b>${item.title}</b><p>${item.detail}</p></div></div>`) : html`<${EmptyState} icon="file" title="Sin eventos en este filtro" text="Seleccione “Todo” para ver el historial completo."/>`}</div></${Card}>`;
  }

  updateSetting = (key, value) => {
    if(!this.can('settingsManage'))return this.permissionDenied();
    this.persistDataUpdate({data:{...this.state.data,settings:{...this.state.data.settings,[key]:value}}},'Preferencia actualizada.');
  };

  renderAgenda() {
    if (!this.can('appointmentsManage')) return html`<${EmptyState} icon="shield" title="Acceso restringido" text="Este usuario no tiene permiso para gestionar la agenda."/>`;
    const { appointments, patients } = this.state.data;
    const cursor = new Date(this.state.calendarDate);
    const view = this.state.calendarView;
    const now = new Date();
    const appointmentFilter=this.state.appointmentFilter||'all';
    const filteredAppointments=appointments.filter(item=>appointmentFilter==='all'||(appointmentFilter==='review'?item.adminReviewStatus==='pending':item.status===appointmentFilter));
    const upcoming = filteredAppointments
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
      <div className="patients-toolbar"><div className="segmented" aria-label="Filtrar citas">${[['all','Todas'],['pending','Pendientes'],['confirmed','Confirmadas'],['review','Por revisar'],['cancelled','Canceladas']].map(([key,label])=>html`<button key=${key} className=${appointmentFilter===key?'active':''} onClick=${()=>this.setState({appointmentFilter:key})}>${label}</button>`)}</div></div>
      <div className="calendar-layout">
        <${Card} tour="agenda-calendar" className="calendar-main">
          <div className="calendar-toolbar">
            <div className="calendar-nav" data-tour="agenda-views"><button className="icon-button" aria-label="Periodo anterior" onClick=${() => move(-1)}><${Icon} name="chevronLeft"/></button><button className="today-button" onClick=${() => this.setState({ calendarDate: new Date() })}>Hoy</button><button className="icon-button" aria-label="Periodo siguiente" onClick=${() => move(1)}><${Icon} name="chevronRight"/></button><h2>${heading}</h2></div>
            <div className="segmented">${[['month', 'Mes'], ['week', 'Semana'], ['day', 'Día']].map(([key, label]) => html`<button key=${key} className=${view === key ? 'active' : ''} onClick=${() => this.setState({ calendarView: key })}>${label}</button>`)}</div>
          </div>
          ${view === 'month' ? this.renderMonthCalendar(cursor, filteredAppointments) : view === 'week' ? this.renderWeekCalendar(cursor, filteredAppointments) : this.renderDayCalendar(cursor, filteredAppointments)}
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
              <div className="reminder-actions">${reminder.status !== 'sent' && this.can('remindersManage') ? html`${(reminder.channels || reminder.patient?.notificationPreferences?.channels || ['whatsapp']).map(channel => html`<${Button} key=${channel} tone=${channel === 'whatsapp' ? 'soft' : 'secondary'} icon=${channel === 'email' ? 'mail' : 'message'} onClick=${() => this.sendReminderChannel(reminder, channel)}>${reminderChannelLabel(channel)}</${Button}>`)}<${Button} tone="secondary" onClick=${() => this.copyReminderMessage(reminder)}>Copiar</${Button}><button className="reminder-done" title="Marcar como enviado" onClick=${() => this.completeReminder(reminder, 'manual')}><${Icon} name="check" size=${17}/></button>` : html`<span className="reminder-complete"><${Icon} name="check" size=${16}/> Registrado</span>`}</div>
            </article>`;
          }) : html`<${EmptyState} icon="message" title="Sin recordatorios en cola" text="Los recordatorios aparecerán cuando se acerquen las próximas citas."/>`}
        </div>
        <div className="clinical-footnote"><${Icon} name="shield" size=${17}/> Linkare usa el canal autorizado por el paciente. Cuando un proveedor no está conectado, abre el mensaje preparado para que el personal confirme el envío.</div>
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
        <${Card} className="analytics-highlight"><div><span>Mejoría media observada</span><strong>${percent(avgImprovement)}</strong><p>Promedio de la escala principal de cada paciente.</p></div></${Card}>
        <${Card} className="analytics-highlight"><div><span>Adherencia media</span><strong>${percent(avgAdherence)}</strong><p>Estimación autorreportada registrada en seguimiento.</p></div></${Card}>
      </div>
      <div className="dashboard-grid">
        <${Card} className="span-7" title="Distribución de respuesta" subtitle="La interpretación se basa en la escala principal de cada expediente."><div className="response-donuts" data-tour="results-interpretation"><${Donut} value=${summaries.length ? response / summaries.length * 100 : 0} label="Respuesta significativa" caption=${response + ' pacientes'} tone="teal"/><${Donut} value=${summaries.length ? partial / summaries.length * 100 : 0} label="Respuesta parcial" caption=${partial + ' pacientes'} tone="purple"/><${Donut} value=${summaries.length ? limited / summaries.length * 100 : 0} label="Cambio limitado" caption=${limited + ' pacientes'} tone="coral"/></div><div className="clinical-footnote"><${Icon} name="shield" size=${17}/> Los umbrales son descriptivos y deben validarse por escala, diagnóstico y contexto clínico.</div></${Card}>
        <${Card} className="span-5" title="Seguridad y seguimiento"><div className="safety-overview"><div><strong>${patients.filter(patient => patient.adverseEvents.some(event => event.status === 'active')).length}</strong><span>con efecto activo</span></div><div><strong>${patients.filter(patient => patient.labs.some(lab => lab.status !== 'normal')).length}</strong><span>con laboratorio a revisar</span></div><div><strong>${patients.filter(patient => patient.adherence < 80).length}</strong><span>con adherencia menor de 80%</span></div></div></${Card}>
        <${Card} className="span-12" title="Resumen por clase de medicamento" subtitle="Se muestra el cambio observado en los registros disponibles, no la efectividad comparativa de la clase."><div className="table-wrap"><table className="data-table"><thead><tr><th>Clase</th><th>Pacientes</th><th>Mejoría media</th><th>Adherencia media</th></tr></thead><tbody>${Object.entries(classes).map(([name, values]) => html`<tr key=${name}><td><b>${name}</b></td><td>${values.count}</td><td><div className="progress-inline wide"><span><i style=${{ width: `${Math.max(0, Math.min(100, values.improvement / values.count))}%` }}></i></span><b>${percent(values.improvement / values.count)}</b></div></td><td>${percent(values.adherence / values.count)}</td></tr>`)}</tbody></table></div></${Card}>
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
    if(!this.can('settingsManage'))return html`<${EmptyState} icon="lock" title="Acceso restringido" text="La suscripción corresponde al médico responsable."/>`;
    const {plans,subscription,orders}=this.state.billingData;const status=subscriptionView(subscription);
    if(this.state.complimentaryAccess || status.free)return html`<div className="view-enter"><${PageHeader} title="Mi plan" subtitle="Acceso completo habilitado"/><section className="subscription-hero"><div className="subscription-plan-copy"><span className="eyebrow">Plan actual</span><h2>Plan gratuito</h2><p>Expedientes, consultas, agenda, documentos y equipo del consultorio.</p><${Badge} tone="success">Acceso completo</${Badge}></div><div className="subscription-status-card"><span>Precio</span><b>US$0</b><small>Puede usar todos los módulos según los permisos de su cuenta.</small></div></section></div>`;
    const current=plans.find(p=>p.code===subscription?.plan_code);const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
    const pending=orders.find(o=>['pending','creating','review'].includes(o.status));const ws=this.state.wompiStatus;
    return html`<div className="view-enter"><${PageHeader} title="Mi plan Linkare" subtitle="El mismo consultorio, con la modalidad de pago que mejor le convenga." actions=${html`<${Button} tone="secondary" onClick=${this.loadSubscriptionInvoices} disabled=${this.state.billingLoading}>Actualizar estado</${Button}>`}/>
      ${this.state.billingError?html`<div className="sync-banner error" role="alert">${this.state.billingError}</div>`:null}
      <section className="subscription-hero"><div className="subscription-plan-copy"><span className="eyebrow">Plan actual</span><h2>${current?.name||'Elija su modalidad'}</h2><p>Expedientes, consultas, agenda y equipo del consultorio.</p><${Badge} tone=${status.tone}>${status.label}</${Badge}></div><div className="subscription-status-card"><span>Próxima renovación</span><b>${subscription?.current_period_end?formatDate(subscription.current_period_end):'Aún sin periodo activo'}</b><small>${status.active?`${status.days} días restantes`:'La vigencia se activa cuando Wompi confirma el pago.'}</small><small>Renovación manual. No se realizan débitos automáticos.</small></div></section>
      ${pending?html`<${Card} title="Orden pendiente"><p>${pending.plan_name} · ${money(pending.amount_cents)}</p>${pending.payment_url?html`<${Button} icon="external" onClick=${()=>this.openPaymentLink(pending.payment_url)}>Continuar pago en Wompi</${Button}>`:html`<p>La solicitud está en proceso o requiere revisión. No genere otro pago hasta comprobar el estado.</p>`}</${Card}>`:null}
      <div className="plans-grid">${(plans.length?plans:PLAN_OPTIONS.map(p=>({code:p.code,name:p.label,amount_cents:p.amount*100,months:p.months}))).map(p=>html`<article className=${`plan-option ${p.code==='annual'?'recommended':''}`} key=${p.code}><span className="eyebrow">${p.months===1?'Mensual':p.months===6?'Semestral':'Anual'}</span><h3>${money(p.amount_cents)}</h3><p>Un pago por ${p.months} ${p.months===1?'mes':'meses'}.</p><small>${p.months===12?'US$80 menos que doce pagos mensuales.':p.months===6?'US$20 menos que seis pagos mensuales.':'Flexibilidad mes a mes.'}</small><${Button} disabled=${!plans.length||this.state.wompiBusy||!!pending} onClick=${()=>this.openWompiPaymentRequest(p.code)}>${status.active?'Renovar con este plan':'Elegir plan'}</${Button}></article>`)}</div>
      <${Card} title="Cómo se aplica la renovación"><p>Si su licencia sigue activa, el nuevo periodo se agrega al final de la vigencia actual. Cambiar de modalidad no reemplaza un periodo ya pagado.</p><div className="settings-actions"><${Button} tone="secondary" disabled=${ws.state==='loading'} onClick=${this.loadWompiStatus}>${ws.state==='loading'?'Verificando…':'Verificar medio de pago'}</${Button}><span>${ws.state==='ready'?(ws.app?.estaProductivo?'Wompi disponible':'Wompi no habilitado para cobros'):ws.error||''}</span></div></${Card}>
      <${Card} title="Historial de pagos"><div className="table-wrap"><table className="data-table"><thead><tr><th>Fecha</th><th>Modalidad</th><th>Monto</th><th>Estado</th><th>Vigencia</th><th>Acción</th></tr></thead><tbody>${orders.length?orders.map(o=>html`<tr key=${o.id}><td>${formatDate(o.created_at)}</td><td>${o.plan_name}</td><td>${money(o.amount_cents)}</td><td>${({paid:'Pagado',pending:'Pendiente',creating:'En proceso',review:'En revisión',failed:'No completado',cancelled:'Cancelado'})[o.status]||o.status}</td><td>${o.period_end?formatDate(o.period_end):'Sin activar'}</td><td>${o.status==='pending'&&o.payment_url?html`<button className="text-button" onClick=${()=>this.openPaymentLink(o.payment_url)}>Abrir pago</button>`:o.status==='paid'?html`<button className="text-button" onClick=${()=>this.showReceipt(o)}>Ver detalle</button>`:'—'}</td></tr>`):html`<tr><td colSpan="6">Todavía no hay pagos registrados.</td></tr>`}</tbody></table></div></${Card}></div>`;
  }

  renderSettings() {
    if(!this.can('settingsManage'))return html`<${EmptyState} icon="lock" title="Acceso restringido" text="Esta sección está reservada al médico."/>`;
    const s=this.state.data.settings;const org=this.state.data.organization;
    return html`<div className="view-enter"><${PageHeader} title="Configuración" subtitle="Su consultorio, su equipo y sus preferencias."/>
      <div className="settings-grid">
        <${Card} title="Identidad del consultorio"><h3>${org.name}</h3><p>${org.clinician}</p><p>${org.email}</p><${Button} icon="edit" onClick=${this.openClinicProfile}>Editar datos y logotipo</${Button}></${Card}>
        <${Card} title="Lectura y movimiento"><label className="setting-row"><span>Texto grande</span><input type="checkbox" checked=${!!s.largeText} onChange=${e=>this.updateSetting('largeText',e.target.checked)}/></label><label className="setting-row"><span>Reducir movimiento</span><input type="checkbox" checked=${!!s.reducedMotion} onChange=${e=>this.updateSetting('reducedMotion',e.target.checked)}/></label></${Card}>
        <${Card} className="settings-wide" title="Equipo del consultorio" action=${html`<${Button} icon="userPlus" onClick=${this.openSecretary}>Agregar usuario</${Button}>`}>
          <div className="team-list">${this.state.data.users.map(u=>html`<article className="team-member" key=${u.id}><${UserAvatar} user=${u}/><div className="team-member-main"><b>${u.name}</b><small>${u.email}</small><span>${ROLE_LABELS[u.role]||'Sin acceso'} · ${u.active?'Activo':'Sin acceso'}</span></div>${u.role!=='owner'?html`<div className="team-actions"><${Button} tone="secondary" onClick=${()=>this.openUserPermissions(u)}>Permisos</${Button}><${Button} tone="secondary" onClick=${()=>this.toggleTeamUser(u.id)}>${u.active?'Desactivar':'Activar'}</${Button}></div>`:null}</article>`)}</div>
          ${this.state.teamInvites.length?html`<h3>Invitaciones pendientes</h3><div className="team-list">${this.state.teamInvites.map(i=>html`<article className="team-member" key=${i.id}><div className="team-member-main"><b>${i.display_name}</b><small>${i.email}</small><span>${i.delivery_status==='sent'?'Correo enviado':'Envío pendiente'} · Vence ${formatDate(i.expires_at)}</span></div><${Button} tone="secondary" disabled=${this.state.teamBusy} onClick=${()=>this.manageInvitation(i,'resend')}>Reenviar</${Button}><${Button} tone="secondary" disabled=${this.state.teamBusy} onClick=${()=>this.manageInvitation(i,'revoke')}>Revocar</${Button}></article>`)}</div>`:null}
        </${Card}>
        <${Card} className="settings-wide" title="Anticipación de recordatorios"><p>Elija las horas previas a la cita. La preferencia y el consentimiento del paciente se revisan antes del envío.</p><div className="reminder-settings-grid">${REMINDER_OPTIONS.map(h=>html`<button className=${`reminder-option ${s.reminderHours.includes(h)?'active':''}`} key=${h} onClick=${()=>this.toggleReminderHour(h)}>${reminderLabel(h)}</button>`)}</div><p className="field-note">Los canales automáticos requieren un proveedor configurado. Desde la agenda puede preparar o enviar cada recordatorio.</p></${Card}>
        <${Card} title="Calendarios"><p>Cada enlace tiene un alcance explícito, caduca a los 90 días y puede revocarse.</p><div className="settings-actions"><${Button} tone="secondary" disabled=${this.state.integrationBusy} onClick=${this.connectGoogleCalendar}>Conectar Google</${Button}><${Button} tone="secondary" disabled=${this.state.integrationBusy} onClick=${()=>this.copyScopedCalendar('doctor_full')}>Agenda médica</${Button}><${Button} tone="secondary" disabled=${this.state.integrationBusy} onClick=${()=>this.copyScopedCalendar('family_busy')}>Familia: solo ocupado</${Button}><${Button} tone="secondary" disabled=${this.state.integrationBusy} onClick=${this.openCalendarFeeds}>Administrar enlaces</${Button}></div></${Card}>
        <${Card} title="Recordatorio personal"><p>Avise a un contacto autorizado sobre el horario general del día siguiente, sin nombres de pacientes.</p><${Button} tone="secondary" disabled=${this.state.integrationBusy} onClick=${this.openFamilyReminders}>Configurar contacto</${Button}></${Card}>
        <${Card} title="Guía y seguridad"><p>Su equipo utiliza cuentas individuales. Las notas clínicas no se muestran a secretaría.</p><${Button} tone="secondary" onClick=${this.openHelp}>Abrir guía</${Button}></${Card}>
      </div></div>`;
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
    if (modal.type === 'checkoutReady') return html`<${Modal} title="Enlace de pago disponible" subtitle="La suscripción se activa al recibir la confirmación de Wompi." onClose=${this.closeModal} size="md"><p>Revise el importe antes de pagar en Wompi.</p><${Button} icon="external" onClick=${()=>this.openPaymentLink(modal.payment.url)}>Abrir checkout de Wompi</${Button}><p className="field-note">Al terminar, regrese a Mi plan y presione Actualizar estado.</p></${Modal}>`;
    if (modal.type === 'receipt') return html`<${Modal} title="Detalle del pago" onClose=${this.closeModal} size="md"><p>${modal.order.plan_name}</p><h2>US$${(modal.order.amount_cents/100).toFixed(2)}</h2><p>Confirmado: ${formatDateTime(modal.order.paid_at)}</p><p>Vigencia: ${formatDate(modal.order.period_start)} a ${formatDate(modal.order.period_end)}</p><p className="field-note">Referencia: ${modal.order.external_reference}</p><p>Este detalle no sustituye el documento fiscal del comercio.</p><${Button} onClick=${this.closeModal}>Cerrar</${Button}></${Modal}>`;
    
    if (modal.type === 'billingSettings') return this.renderBillingSettingsModal();
    if (modal.type === 'paymentRequest') return this.renderPaymentRequestModal();
    if (modal.type === 'documentUpload') return this.renderDocumentUploadModal();
    if (modal.type === 'documentEdit') return this.renderDocumentEditModal();
    if (modal.type === 'documentGenerate') return this.renderDocumentGenerateModal();
    if (modal.type === 'calendarFeeds') return this.renderCalendarFeedsModal();
    if (modal.type === 'familyReminders') return this.renderFamilyRemindersModal();
    if (modal.type === 'planCompare') return this.renderPlanCompareModal();
    if (modal.type === 'prescription') return this.renderPrescriptionModal();
    if (modal.type === 'prescriptionVoid') return this.renderPrescriptionVoidModal();
    if (modal.type === 'medication') return this.renderMedicationFormModal();
    if (modal.type === 'dose') return this.renderDoseFormModal();
    if (modal.type === 'medicationStatus') return this.renderMedicationStatusFormModal();
    if (modal.type === 'medicationArchive') return this.renderMedicationArchiveModal();
    if (modal.type === 'clinicalArchive') return this.renderClinicalArchiveModal();
    if (modal.type === 'assessment') return this.renderAssessmentFormModal();
    if (modal.type === 'vitals') return this.renderVitalsFormModal();
    if (modal.type === 'adverse') return this.renderAdverseFormModal();
    if (modal.type === 'lab') return this.renderLabFormModal();
    if (modal.type === 'appointment') return this.renderAppointmentFormModal();
    if (modal.type === 'report') return this.renderReportModal();
    if (modal.type === 'help') return this.renderHelpModal();
    return null;
  }

  renderPrescriptionVoidModal() {
    const {patientId,prescriptionId,draft}=this.state.modal;
    const patient=this.state.data.patients.find(item=>item.id===patientId);
    const prescription=patient?.prescriptions?.find(item=>item.id===prescriptionId);
    return html`<${Modal} title="Anular receta" subtitle=${prescription?`${prescription.number} · ${patient?.name||''}`:'La receta se conservará en el expediente.'} onClose=${this.closeModal} size="md"><form className="clinical-form" onSubmit=${this.saveVoidPrescription}>${this.renderModalError()}<div className="form-information"><${Icon} name="shield" size=${18}/><div><b>La receta no se borrará</b><p>Quedará visible en el historial y cualquier impresión mostrará “RECETA ANULADA”. Ya no podrá editarse.</p></div></div><${FormField} label="Motivo de anulación" required=${true} hint="Explique brevemente el error o la razón administrativa."><textarea autoFocus rows="4" minLength="3" value=${draft.reason} onChange=${event=>this.updateDraft('reason',event.target.value)} required></textarea></${FormField}><${FormActions} disabled=${this.state.formSaving} onCancel=${this.closeModal} submitLabel="Anular y conservar receta"/></form></${Modal}>`;
  }

  renderPaymentRequestModal() {
    const plan=this.state.billingData.plans.find(p=>p.code===this.state.modal.draft.planCode);
    if(!plan)return null;
    return html`<${Modal} title="Confirmar modalidad" subtitle="El checkout se abrirá en el sitio de Wompi." onClose=${this.state.wompiBusy?()=>{}:this.closeModal} size="md"><form className="clinical-form" onSubmit=${this.submitWompiPaymentRequest}>${this.renderModalError()}<h2>${plan.name}</h2><p className="checkout-amount">US$${(plan.amount_cents/100).toFixed(2)}</p><p>${plan.months} meses de acceso. Un solo pago, sin renovación automática.</p><p>El servidor confirma el precio. La vigencia comienza cuando el proveedor confirma el pago.</p><${Button} type="submit" disabled=${this.state.wompiBusy}>${this.state.wompiBusy?'Creando enlace seguro…':'Generar enlace Wompi'}</${Button}></form></${Modal}>`;
  }

  renderBillingSettingsModal() { return this.renderPlanCompareModal(); }

  renderDocumentUploadModal() {
    const draft = this.state.modal?.draft || {};
    const patient = this.state.data.patients.find(item => item.id === this.state.modal?.patientId);
    return html`<${Modal} title="Agregar documento al expediente" subtitle=${`Paciente: ${patient?.name || 'No disponible'}`} onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.savePatientDocumentForm}>${this.renderModalError()}<div className="document-upload-drop"><span><${Icon} name="upload" size=${28}/></span><div><b>${draft.file?.name || 'Seleccione un archivo'}</b><p>PDF, imagen, texto, Word o Excel. Máximo 20 MB en producción.</p></div><label className="button button-secondary"><${Icon} name="folder" size=${18}/><span>Elegir archivo</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx" onChange=${event => this.updateDraft('file', event.target.files?.[0] || null)}/></label></div><div className="form-grid"><${FormField} label="Categoría" required=${true}><select value=${draft.category} onChange=${event => this.updateDraft('category', event.target.value)}>${DOCUMENT_CATEGORIES.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}><${FormField} label="Fecha clínica"><input type="date" value=${draft.clinicalDate} onChange=${event => this.updateDraft('clinicalDate', event.target.value)}/></${FormField}></div><${FormField} label="Descripción"><textarea rows="3" value=${draft.description} onChange=${event => this.updateDraft('description', event.target.value)} placeholder="Origen, contexto o por qué se incorpora al expediente"></textarea></${FormField}><${FormField} label="Nivel de confidencialidad"><select value=${draft.confidentiality} onChange=${event => this.updateDraft('confidentiality', event.target.value)}>${CONFIDENTIALITY_LEVELS.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}><div className="form-information"><${Icon} name="shield" size=${19}/><div><b>Almacenamiento privado</b><p>En producción, el archivo se guarda en un bucket privado de Supabase Storage y se abre mediante enlaces firmados temporales.</p></div></div><${FormActions} disabled=${this.state.formSaving} onCancel=${this.closeModal} submitLabel=${this.state.documentBusy ? 'Subiendo…' : 'Agregar al expediente'}/></form></${Modal}>`;
  }

  renderDocumentEditModal() {
    const draft = this.state.modal?.draft || {};
    const patient = this.state.data.patients.find(item => item.id === this.state.modal?.patientId);
    return html`<${Modal} title="Editar datos del documento" subtitle=${`Paciente: ${patient?.name || 'No disponible'}`} onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveDocumentEdit}>${this.renderModalError()}<div className="form-grid"><${FormField} label="Nombre" required=${true}><input autoFocus value=${draft.name||''} onChange=${event=>this.updateDraft('name',event.target.value)} required/></${FormField}><${FormField} label="Categoría" required=${true}><select value=${draft.category} onChange=${event=>this.updateDraft('category',event.target.value)}>${DOCUMENT_CATEGORIES.map(item=>html`<option key=${item}>${item}</option>`)}</select></${FormField}></div><div className="form-grid"><${FormField} label="Fecha clínica"><input type="date" value=${draft.clinicalDate||''} onChange=${event=>this.updateDraft('clinicalDate',event.target.value)}/></${FormField}><${FormField} label="Confidencialidad"><select value=${draft.confidentiality} onChange=${event=>this.updateDraft('confidentiality',event.target.value)}>${CONFIDENTIALITY_LEVELS.map(item=>html`<option key=${item}>${item}</option>`)}</select></${FormField}></div><${FormField} label="Descripción"><textarea rows="4" value=${draft.description||''} onChange=${event=>this.updateDraft('description',event.target.value)}></textarea></${FormField}><div className="form-information"><${Icon} name="shield" size=${18}/><div><b>El archivo original no cambia</b><p>Solo se corrigen el nombre, la categoría y los datos descriptivos; la versión anterior queda registrada.</p></div></div><${FormActions} disabled=${this.state.formSaving} onCancel=${this.closeModal} submitLabel="Guardar corrección"/></form></${Modal}>`;
  }

  renderDocumentGenerateModal() {
    const modal=this.state.modal,draft=modal?.draft||{},patient=this.state.data.patients.find(item=>item.id===modal?.patientId);const template=(modal?.templates||[]).find(item=>item.id===draft.templateId);const automatic=new Set(['nombre_paciente','fecha','medico','numero_junta','diagnostico']);const fields=(template?.variables||[]).filter(key=>!automatic.has(key));const labels={dias_incapacidad:'Días de incapacidad',fecha_inicio:'Fecha de inicio',fecha_final:'Fecha final',contenido_adicional:'Contenido adicional',titulo:'Título dentro del documento'};
    const selectTemplate=event=>{const next=(modal.templates||[]).find(item=>item.id===event.target.value);this.setState(prev=>({modal:{...prev.modal,draft:{templateId:next?.id||'',title:next?.name||'',variables:{}}},modalError:''}));};
    return html`<${Modal} title="Generar documento" subtitle=${`Paciente: ${patient?.name||'No disponible'}`} onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveGeneratedDocument}>${this.renderModalError()}<div className="form-grid"><${FormField} label="Plantilla" required=${true}><select value=${draft.templateId} onChange=${selectTemplate} required>${(modal.templates||[]).map(item=>html`<option key=${item.id} value=${item.id}>${item.name} · v${item.version}</option>`)}</select></${FormField}><${FormField} label="Nombre del archivo" required=${true}><input value=${draft.title||''} maxLength="180" onChange=${event=>this.updateDraft('title',event.target.value)} required/></${FormField}></div>${template?html`<div className="form-information"><${Icon} name=${template.classification==='clinical'?'shield':'file'} size=${18}/><div><b>${template.classification==='clinical'?'Documento clínico':'Documento administrativo'} · versión ${template.version}</b><p>${template.classification==='clinical'?'El diagnóstico se obtiene en el servidor y nunca se entrega a Secretaría.':'Solo usa datos administrativos autorizados.'}</p></div></div>`:null}${fields.map(key=>html`<${FormField} key=${key} label=${labels[key]||key.replaceAll('_',' ')} required=${true}>${key==='contenido_adicional'?html`<textarea rows="5" value=${draft.variables?.[key]||''} onChange=${event=>this.updateDocumentVariable(key,event.target.value)} required></textarea>`:html`<input type=${key.startsWith('fecha_')?'date':key==='dias_incapacidad'?'number':'text'} min=${key==='dias_incapacidad'?'1':undefined} value=${draft.variables?.[key]||''} onChange=${event=>this.updateDocumentVariable(key,event.target.value)} required/>`}</${FormField}>`)}<p className="field-note">Al generar, Linkare guarda un PDF privado y una copia inmutable del texto y de la versión de plantilla.</p><${FormActions} disabled=${this.state.formSaving||!template} onCancel=${this.closeModal} submitLabel=${this.state.formSaving?'Generando…':'Generar y guardar PDF'}/></form></${Modal}>`;
  }

  renderCalendarFeedsModal() {
    const labels={doctor_full:'Agenda médica completa',staff_busy:'Agenda de personal',family_busy:'Familia: solo ocupado',patient_own:'Citas de un paciente'};const feeds=this.state.modal?.feeds||[];
    return html`<${Modal} title="Enlaces de calendario" subtitle="Revise y revoque accesos compartidos." onClose=${this.closeModal} size="lg">${this.renderModalError()}${feeds.length?html`<div className="team-list">${feeds.map(feed=>html`<article className="team-member" key=${feed.id}><div className="team-member-main"><b>${labels[feed.scope]||feed.scope}</b><small>Creado ${formatDate(feed.created_at)} · vence ${formatDate(feed.expires_at)}</small><span>${feed.active?'Activo':'Revocado'}${feed.last_used_at?` · último uso ${formatDateTime(feed.last_used_at)}`:''}</span></div>${feed.active?html`<${Button} tone="secondary" disabled=${this.state.integrationBusy} onClick=${()=>this.revokeCalendarFeed(feed.id)}>Revocar</${Button}>`:null}</article>`)}</div>`:html`<${EmptyState} icon="calendar" title="Sin enlaces" text="Todavía no ha creado calendarios compartidos."/>`}<p className="field-note">Los enlaces familiares muestran únicamente bloques “Ocupado”; no incluyen pacientes ni datos clínicos.</p></${Modal}>`;
  }

  renderFamilyRemindersModal() {
    const modal=this.state.modal,draft=modal?.draft||{},recipients=modal?.recipients||[];
    return html`<${Modal} title="Recordatorios a contacto personal" subtitle="Función opcional y sin información de pacientes." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveFamilyReminder}>${this.renderModalError()}<div className="form-information"><${Icon} name="shield" size=${18}/><div><b>Mensaje protegido</b><p>El aviso solo indica el rango horario de la agenda clínica de mañana. Nunca incluye pacientes, diagnósticos ni tratamientos.</p></div></div><div className="form-grid form-grid-three"><${FormField} label="Nombre" required=${true}><input value=${draft.name||''} onChange=${event=>this.updateDraft('name',event.target.value)} required/></${FormField}><${FormField} label="Canal"><select value=${draft.channel||'whatsapp'} onChange=${event=>this.updateDraft('channel',event.target.value)}><option value="whatsapp">WhatsApp</option><option value="email">Correo</option></select></${FormField}><${FormField} label=${draft.channel==='email'?'Correo':'Teléfono internacional'} required=${true}><input type=${draft.channel==='email'?'email':'tel'} placeholder=${draft.channel==='email'?'contacto@correo.com':'+50370000000'} value=${draft.destination||''} onChange=${event=>this.updateDraft('destination',event.target.value)} required/></${FormField}></div><${Button} type="submit" disabled=${this.state.formSaving}>${this.state.formSaving?'Guardando…':'Agregar contacto'}</${Button}></form>${recipients.length?html`<div className="team-list">${recipients.map(item=>html`<article className="team-member" key=${item.id}><div className="team-member-main"><b>${item.name}</b><small>${item.destination}</small><span>${item.channel==='email'?'Correo':'WhatsApp'} · ${item.enabled?'Activo':'Desactivado'}</span></div><${Button} tone="secondary" disabled=${this.state.formSaving} onClick=${()=>this.removeFamilyReminder(item.id)}>Eliminar</${Button}></article>`)}</div>`:null}</${Modal}>`;
  }

  renderPlanCompareModal() {return html`<${Modal} title="Modalidades disponibles" onClose=${this.closeModal} size="md"><div className="guide-sections">${PLAN_OPTIONS.map(p=>html`<section key=${p.code}><h3>${p.label}: US$${p.amount}</h3><p>${p.description}</p></section>`)}</div><${Button} onClick=${()=>{this.closeModal();this.setView('payments');}}>Ver mi plan</${Button}></${Modal}>`; }

  renderPatientFormModal() {
    const draft = this.state.modal.draft;
    const scale = SCALE_CATALOG.find(item => item.code === draft.scaleCode) || SCALE_CATALOG[0];
    const clinicalFields = this.can('clinicalEdit');
    return html`<${Modal} title="Nuevo paciente" subtitle=${clinicalFields ? 'Registre identificación, contexto, preferencias y una medición inicial.' : 'Registre datos administrativos. El médico completará la información clínica.'} onClose=${this.closeModal} size="xl"><form className="clinical-form" onSubmit=${this.savePatientForm}>${this.renderModalError()}
      <fieldset data-tour="patient-form-identification"><legend>Identificación y contacto</legend><${ImagePicker} value=${draft.photo} label="Fotografía del paciente" hint="PNG, JPG o WEBP. Se optimiza para cargar rápidamente." onChange=${event => this.handleDraftImage(event, 'photo', { maxDimension: 560, quality: 0.82 })} onRemove=${() => this.updateDraft('photo', '')}/><div className="form-grid"><${FormField} label="Nombre completo" required=${true}><input autoFocus value=${draft.name} onChange=${event => this.updateDraft('name', event.target.value)} placeholder="Ej. Ana Martínez" required/></${FormField}><${FormField} label="Edad" required=${true}><input type="number" min="0" max="120" value=${draft.age} onChange=${event => this.updateDraft('age', event.target.value)} required/></${FormField}></div><div className="form-grid">${clinicalFields ? html`<${FormField} label="Sexo registrado"><select value=${draft.sex} onChange=${event => this.updateDraft('sex', event.target.value)}><option>No registrado</option><option value="F">Femenino</option><option value="M">Masculino</option><option>Otro</option></select></${FormField}>` : null}<${FormField} label="Teléfono"><input value=${draft.phone} onChange=${event => { this.updateDraft('phone', event.target.value); this.updateDraft('reminderPhone', event.target.value); }} placeholder="Ej. +503 7000 0000"/></${FormField}></div><${FormField} label="Correo"><input type="email" value=${draft.email} onChange=${event => { this.updateDraft('email', event.target.value); this.updateDraft('reminderEmail', event.target.value); }} placeholder="paciente@correo.com"/></${FormField}></fieldset>

      ${clinicalFields ? html`<fieldset><legend>Identidad y contexto personal <small>Opcional y autoidentificado</small></legend><div className="form-grid"><${FormField} label="Nombre preferido"><input value=${draft.preferredName} onChange=${event => this.updateDraft('preferredName', event.target.value)}/></${FormField}><${FormField} label="Pronombres"><input value=${draft.pronouns} onChange=${event => this.updateDraft('pronouns', event.target.value)} placeholder="Ej. ella, él, elle"/></${FormField}></div><div className="form-grid form-grid-three"><${FormField} label="Sexo asignado al nacer"><select value=${draft.sexAssignedAtBirth} onChange=${event => this.updateDraft('sexAssignedAtBirth', event.target.value)}>${SEX_ASSIGNED_AT_BIRTH_OPTIONS.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}><${FormField} label="Identidad de género"><select value=${draft.genderIdentity} onChange=${event => this.updateDraft('genderIdentity', event.target.value)}>${GENDER_IDENTITY_OPTIONS.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}><${FormField} label="Orientación sexual"><select value=${draft.sexualOrientation} onChange=${event => this.updateDraft('sexualOrientation', event.target.value)}>${SEXUAL_ORIENTATION_OPTIONS.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}></div><div className="form-grid"><${FormField} label="Estado de relación"><select value=${draft.relationshipStatus} onChange=${event => this.updateDraft('relationshipStatus', event.target.value)}>${RELATIONSHIP_STATUS_OPTIONS.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}><${FormField} label="Personas significativas y red de apoyo"><input value=${draft.significantPeople} onChange=${event => this.updateDraft('significantPeople', event.target.value)} placeholder="Familia, pareja, amistades o cuidadores"/></${FormField}></div><div className="form-information"><${Icon} name="shield" size=${18}/><div><b>Información sensible y opcional</b><p>Regístrela solo cuando sea clínicamente pertinente y a partir de lo expresado por el paciente. Secretaría no la verá.</p></div></div></fieldset>` : null}
      ${clinicalFields ? html`<fieldset><legend>Antecedentes de seguridad <small>Información documentada, no inferida</small></legend><div className="form-grid form-grid-three"><${FormField} label="Antecedente de ideación suicida"><select value=${draft.ideationHistory} onChange=${event => this.updateDraft('ideationHistory', event.target.value)}><option>No registrada</option><option>No referida</option><option>Previa, sin fecha precisa</option><option>Actual</option><option>En remisión</option><option>Prefiere no responder</option></select></${FormField}><${FormField} label="Intentos documentados"><input type="number" min="0" max="99" value=${draft.suicideAttemptsCount} onChange=${event => this.updateDraft('suicideAttemptsCount', event.target.value)}/></${FormField}><${FormField} label="Fecha del último intento"><input type="date" value=${draft.lastAttemptDate} onChange=${event => this.updateDraft('lastAttemptDate', event.target.value)}/></${FormField}></div><div className="form-grid"><${FormField} label="Autolesión sin intención suicida"><select value=${draft.selfHarmHistory} onChange=${event => this.updateDraft('selfHarmHistory', event.target.value)}><option>No registrada</option><option>No referida</option><option>Antecedente previo</option><option>Actual</option><option>En remisión</option><option>Prefiere no responder</option></select></${FormField}><${FormField} label="Contacto de emergencia"><input value=${draft.emergencyContact} onChange=${event => this.updateDraft('emergencyContact', event.target.value)} placeholder="Nombre, relación y teléfono"/></${FormField}></div><${FormField} label="Plan de seguridad"><textarea rows="3" value=${draft.safetyPlan} onChange=${event => this.updateDraft('safetyPlan', event.target.value)} placeholder="Señales de alerta, estrategias, contactos y recursos acordados"></textarea></${FormField}><${FormField} label="Notas de antecedentes"><textarea rows="2" value=${draft.safetyHistoryNotes} onChange=${event => this.updateDraft('safetyHistoryNotes', event.target.value)} placeholder="Fuente, fecha aproximada y atención recibida"></textarea></${FormField}><div className="form-information"><${Icon} name="shield" size=${18}/><div><b>Diferencie riesgo actual de antecedentes</b><p>Un antecedente no equivale a riesgo actual. Registre fuente y contexto, y actualice la valoración clínica en cada consulta cuando corresponda.</p></div></div></fieldset>` : null}

      <fieldset data-tour="patient-form-insurance-section"><legend>Seguro médico</legend><label data-tour="patient-form-insurance-toggle" className=${`insurance-toggle-card ${draft.hasInsurance ? 'active' : ''}`}><input type="checkbox" checked=${Boolean(draft.hasInsurance)} onChange=${event => this.updateDraft('hasInsurance', event.target.checked)}/><span className="insurance-toggle-icon"><${Icon} name="insurance" size=${22}/></span><span><b>${draft.hasInsurance ? 'Paciente con seguro médico' : 'Atención particular'}</b><small>Active esta opción para guardar aseguradora, plan y datos de autorización.</small></span><i><${Icon} name=${draft.hasInsurance ? 'check' : 'plus'} size=${17}/></i></label>${draft.hasInsurance ? html`<div className="insurance-form-panel"><div className="form-grid"><${FormField} label="Aseguradora" required=${true}><input value=${draft.insuranceProvider} onChange=${event => this.updateDraft('insuranceProvider', event.target.value)} required/></${FormField}><${FormField} label="Plan"><input value=${draft.insurancePlan} onChange=${event => this.updateDraft('insurancePlan', event.target.value)}/></${FormField}></div><div className="form-grid"><${FormField} label="N.º de afiliado"><input value=${draft.insuranceMemberId} onChange=${event => this.updateDraft('insuranceMemberId', event.target.value)}/></${FormField}><${FormField} label="N.º de póliza"><input value=${draft.insurancePolicyNumber} onChange=${event => this.updateDraft('insurancePolicyNumber', event.target.value)}/></${FormField}></div><div className="form-grid"><${FormField} label="Copago"><input value=${draft.insuranceCopay} onChange=${event => this.updateDraft('insuranceCopay', event.target.value)}/></${FormField}><label className="form-checkbox-card"><input type="checkbox" checked=${Boolean(draft.insuranceAuthorizationRequired)} onChange=${event => this.updateDraft('insuranceAuthorizationRequired', event.target.checked)}/><span><b>Requiere autorización</b><small>La secretaría lo verá antes de confirmar la cita.</small></span></label></div><${FormField} label="Notas del seguro"><textarea rows="2" value=${draft.insuranceNotes} onChange=${event => this.updateDraft('insuranceNotes', event.target.value)}></textarea></${FormField}></div>` : null}</fieldset>

      ${clinicalFields ? html`<fieldset data-tour="patient-form-clinical"><legend>Información clínica inicial</legend><div className="form-grid"><${FormField} label="Diagnóstico principal" required=${true}><input value=${draft.diagnosis} onChange=${event => this.updateDraft('diagnosis', event.target.value)} required/></${FormField}><${FormField} label="Código diagnóstico"><input value=${draft.diagnosisCode} onChange=${event => this.updateDraft('diagnosisCode', event.target.value)}/></${FormField}></div><div className="form-grid form-grid-three"><${FormField} label="Riesgo actual"><select value=${draft.risk} onChange=${event => this.updateDraft('risk', event.target.value)}><option value="low">Bajo</option><option value="medium">Moderado</option><option value="high">Alto</option></select></${FormField}><${FormField} label="Estado clínico"><select value=${draft.status} onChange=${event => this.updateDraft('status', event.target.value)}><option value="stable">Estable</option><option value="responding">Mejorando</option><option value="partial">Mejoría parcial</option><option value="review">Requiere revisión</option></select></${FormField}><${FormField} label="Escala"><select value=${draft.scaleCode} onChange=${event => this.updateDraft('scaleCode', event.target.value)}>${SCALE_CATALOG.map(item => html`<option key=${item.code} value=${item.code}>${item.code} · ${item.label}</option>`)}</select></${FormField}></div><${FormField} label="Puntaje inicial" hint=${`Rango permitido: ${scale.min} a ${scale.max}`}><input type="number" min=${scale.min} max=${scale.max} value=${draft.initialScore} onChange=${event => this.updateDraft('initialScore', event.target.value)}/></${FormField}></fieldset>` : html`<div className="form-information"><${Icon} name="shield" size=${19}/><div><b>Información clínica pendiente</b><p>El médico completará diagnóstico, tratamiento y escalas.</p></div></div>`}

      <fieldset><legend>Recordatorios y consentimiento</legend><label className=${`insurance-toggle-card ${draft.reminderEnabled ? 'active' : ''}`}><input type="checkbox" checked=${Boolean(draft.reminderEnabled)} onChange=${event => this.updateDraft('reminderEnabled', event.target.checked)}/><span className="insurance-toggle-icon"><${Icon} name="message" size=${22}/></span><span><b>${draft.reminderEnabled ? 'Recordatorios activados' : 'Sin recordatorios'}</b><small>El paciente o el médico puede elegir canales y anticipación.</small></span></label>${draft.reminderEnabled ? html`<div className="reminder-preferences-form"><div className="channel-choice-grid">${REMINDER_CHANNELS.map(channel => { const active = (draft.reminderChannels || []).includes(channel.value); return html`<label key=${channel.value} className=${active ? 'active' : ''}><input type="checkbox" checked=${active} onChange=${event => this.updateDraft('reminderChannels', event.target.checked ? [...new Set([...(draft.reminderChannels || []), channel.value])] : (draft.reminderChannels || []).filter(item => item !== channel.value))}/><${Icon} name=${channel.value === 'email' ? 'mail' : 'message'} size=${17}/><span>${channel.label}</span></label>`; })}</div><div className="form-grid"><${FormField} label="Correo para recordatorios"><input type="email" value=${draft.reminderEmail} onChange=${event => this.updateDraft('reminderEmail', event.target.value)}/></${FormField}><${FormField} label="Teléfono para SMS/WhatsApp"><input value=${draft.reminderPhone} onChange=${event => this.updateDraft('reminderPhone', event.target.value)}/></${FormField}></div><div className="form-grid"><${FormField} label="Consentimiento"><select value=${draft.reminderConsentStatus} onChange=${event => this.updateDraft('reminderConsentStatus', event.target.value)}><option value="pending">Pendiente</option><option value="granted">Otorgado</option><option value="declined">Rechazado</option></select></${FormField}><${FormField} label="Idioma"><input value=${draft.reminderLanguage} onChange=${event => this.updateDraft('reminderLanguage', event.target.value)}/></${FormField}></div></div>` : null}</fieldset>

      <fieldset data-tour="patient-form-followup"><legend>Seguimiento</legend><div className="form-grid"><${FormField} label="Próxima cita"><input type="datetime-local" value=${draft.nextVisit} onChange=${event => this.updateDraft('nextVisit', event.target.value)}/></${FormField}>${clinicalFields ? html`<${FormField} label="Nota inicial"><textarea rows="2" value=${draft.notes} onChange=${event => this.updateDraft('notes', event.target.value)} placeholder="Contexto importante"></textarea></${FormField}>` : null}</div></fieldset><${FormActions} disabled=${this.state.formSaving} onCancel=${this.closeModal} submitLabel="Crear paciente"/></form></${Modal}>`;
  }

  renderPatientEditFormModal() {
    const { draft, patientId } = this.state.modal;
    const patient = this.state.data.patients.find(item => item.id === patientId);
    const clinicalFields = this.can('clinicalEdit');
    const deceased = draft.vitalStatus === 'deceased';
    return html`<${Modal} title="Editar paciente" subtitle=${`Actualice datos, preferencias y estado vital de ${patient?.name || 'este paciente'}.`} onClose=${this.closeModal} size="xl"><form className="clinical-form" onSubmit=${this.savePatientEditForm}>${this.renderModalError()}
      <fieldset><legend>Identificación y contacto</legend><${ImagePicker} value=${draft.photo} label="Fotografía del paciente" hint="La imagen se guarda optimizada." onChange=${event => this.handleDraftImage(event, 'photo', { maxDimension: 560, quality: 0.82 })} onRemove=${() => this.updateDraft('photo', '')}/><div className="form-grid"><${FormField} label="Nombre completo" required=${true}><input autoFocus value=${draft.name} onChange=${event => this.updateDraft('name', event.target.value)} required/></${FormField}><${FormField} label="Edad" required=${true}><input type="number" min="0" max="120" value=${draft.age} onChange=${event => this.updateDraft('age', event.target.value)} required/></${FormField}></div><div className="form-grid">${clinicalFields ? html`<${FormField} label="Sexo registrado"><select value=${draft.sex} onChange=${event => this.updateDraft('sex', event.target.value)}><option>No registrado</option><option value="F">Femenino</option><option value="M">Masculino</option><option>Otro</option></select></${FormField}>` : null}<${FormField} label="Teléfono"><input value=${draft.phone} onChange=${event => this.updateDraft('phone', event.target.value)}/></${FormField}></div><${FormField} label="Correo"><input type="email" value=${draft.email} onChange=${event => this.updateDraft('email', event.target.value)}/></${FormField}></fieldset>

      ${clinicalFields ? html`<fieldset><legend>Identidad y contexto personal <small>Opcional y autoidentificado</small></legend><div className="form-grid"><${FormField} label="Nombre preferido"><input value=${draft.preferredName} onChange=${event => this.updateDraft('preferredName', event.target.value)}/></${FormField}><${FormField} label="Pronombres"><input value=${draft.pronouns} onChange=${event => this.updateDraft('pronouns', event.target.value)}/></${FormField}></div><div className="form-grid form-grid-three"><${FormField} label="Sexo asignado al nacer"><select value=${draft.sexAssignedAtBirth} onChange=${event => this.updateDraft('sexAssignedAtBirth', event.target.value)}>${SEX_ASSIGNED_AT_BIRTH_OPTIONS.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}><${FormField} label="Identidad de género"><select value=${draft.genderIdentity} onChange=${event => this.updateDraft('genderIdentity', event.target.value)}>${GENDER_IDENTITY_OPTIONS.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}><${FormField} label="Orientación sexual"><select value=${draft.sexualOrientation} onChange=${event => this.updateDraft('sexualOrientation', event.target.value)}>${SEXUAL_ORIENTATION_OPTIONS.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}></div><div className="form-grid"><${FormField} label="Estado de relación"><select value=${draft.relationshipStatus} onChange=${event => this.updateDraft('relationshipStatus', event.target.value)}>${RELATIONSHIP_STATUS_OPTIONS.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}><${FormField} label="Personas significativas y red de apoyo"><input value=${draft.significantPeople} onChange=${event => this.updateDraft('significantPeople', event.target.value)}/></${FormField}></div></fieldset>` : null}
      ${clinicalFields ? html`<fieldset><legend>Antecedentes de seguridad <small>Información documentada, no inferida</small></legend><div className="form-grid form-grid-three"><${FormField} label="Antecedente de ideación suicida"><select value=${draft.ideationHistory} onChange=${event => this.updateDraft('ideationHistory', event.target.value)}><option>No registrada</option><option>No referida</option><option>Previa, sin fecha precisa</option><option>Actual</option><option>En remisión</option><option>Prefiere no responder</option></select></${FormField}><${FormField} label="Intentos documentados"><input type="number" min="0" max="99" value=${draft.suicideAttemptsCount} onChange=${event => this.updateDraft('suicideAttemptsCount', event.target.value)}/></${FormField}><${FormField} label="Fecha del último intento"><input type="date" value=${draft.lastAttemptDate} onChange=${event => this.updateDraft('lastAttemptDate', event.target.value)}/></${FormField}></div><div className="form-grid"><${FormField} label="Autolesión sin intención suicida"><select value=${draft.selfHarmHistory} onChange=${event => this.updateDraft('selfHarmHistory', event.target.value)}><option>No registrada</option><option>No referida</option><option>Antecedente previo</option><option>Actual</option><option>En remisión</option><option>Prefiere no responder</option></select></${FormField}><${FormField} label="Contacto de emergencia"><input value=${draft.emergencyContact} onChange=${event => this.updateDraft('emergencyContact', event.target.value)} placeholder="Nombre, relación y teléfono"/></${FormField}></div><${FormField} label="Plan de seguridad"><textarea rows="3" value=${draft.safetyPlan} onChange=${event => this.updateDraft('safetyPlan', event.target.value)} placeholder="Señales de alerta, estrategias, contactos y recursos acordados"></textarea></${FormField}><${FormField} label="Notas de antecedentes"><textarea rows="2" value=${draft.safetyHistoryNotes} onChange=${event => this.updateDraft('safetyHistoryNotes', event.target.value)} placeholder="Fuente, fecha aproximada y atención recibida"></textarea></${FormField}><div className="form-information"><${Icon} name="shield" size=${18}/><div><b>Diferencie riesgo actual de antecedentes</b><p>Un antecedente no equivale a riesgo actual. Registre fuente y contexto, y actualice la valoración clínica en cada consulta cuando corresponda.</p></div></div></fieldset>` : null}

      <fieldset><legend>Seguro médico</legend><label className=${`insurance-toggle-card ${draft.hasInsurance ? 'active' : ''}`}><input type="checkbox" checked=${Boolean(draft.hasInsurance)} onChange=${event => this.updateDraft('hasInsurance', event.target.checked)}/><span className="insurance-toggle-icon"><${Icon} name="insurance" size=${22}/></span><span><b>${draft.hasInsurance ? 'Paciente con seguro médico' : 'Atención particular'}</b><small>La cobertura se muestra en la ficha administrativa.</small></span></label>${draft.hasInsurance ? html`<div className="insurance-form-panel"><div className="form-grid"><${FormField} label="Aseguradora" required=${true}><input value=${draft.insuranceProvider} onChange=${event => this.updateDraft('insuranceProvider', event.target.value)} required/></${FormField}><${FormField} label="Plan"><input value=${draft.insurancePlan} onChange=${event => this.updateDraft('insurancePlan', event.target.value)}/></${FormField}></div><div className="form-grid"><${FormField} label="N.º de afiliado"><input value=${draft.insuranceMemberId} onChange=${event => this.updateDraft('insuranceMemberId', event.target.value)}/></${FormField}><${FormField} label="N.º de póliza"><input value=${draft.insurancePolicyNumber} onChange=${event => this.updateDraft('insurancePolicyNumber', event.target.value)}/></${FormField}></div><div className="form-grid"><${FormField} label="Copago"><input value=${draft.insuranceCopay} onChange=${event => this.updateDraft('insuranceCopay', event.target.value)}/></${FormField}><label className="form-checkbox-card"><input type="checkbox" checked=${Boolean(draft.insuranceAuthorizationRequired)} onChange=${event => this.updateDraft('insuranceAuthorizationRequired', event.target.checked)}/><span><b>Requiere autorización</b><small>Mostrar advertencia administrativa.</small></span></label></div><${FormField} label="Notas del seguro"><textarea rows="2" value=${draft.insuranceNotes} onChange=${event => this.updateDraft('insuranceNotes', event.target.value)}></textarea></${FormField}></div>` : null}</fieldset>

      ${clinicalFields ? html`<fieldset><legend>Datos clínicos básicos</legend><div className="form-grid"><${FormField} label="Diagnóstico principal" required=${true}><input value=${draft.diagnosis} onChange=${event => this.updateDraft('diagnosis', event.target.value)} required/></${FormField}><${FormField} label="Código"><input value=${draft.diagnosisCode} onChange=${event => this.updateDraft('diagnosisCode', event.target.value)}/></${FormField}></div><div className="form-grid"><${FormField} label="Riesgo"><select value=${draft.risk} onChange=${event => this.updateDraft('risk', event.target.value)}><option value="low">Bajo</option><option value="medium">Moderado</option><option value="high">Alto</option></select></${FormField}><${FormField} label="Estado clínico"><select value=${draft.status} onChange=${event => this.updateDraft('status', event.target.value)}><option value="stable">Estable</option><option value="responding">Mejorando</option><option value="partial">Mejoría parcial</option><option value="review">Requiere revisión</option></select></${FormField}></div></fieldset>` : null}

      <fieldset><legend>Recordatorios</legend><label className=${`insurance-toggle-card ${draft.reminderEnabled ? 'active' : ''}`}><input type="checkbox" checked=${Boolean(draft.reminderEnabled)} onChange=${event => this.updateDraft('reminderEnabled', event.target.checked)}/><span className="insurance-toggle-icon"><${Icon} name="message" size=${22}/></span><span><b>${draft.reminderEnabled ? 'Recordatorios activados' : 'Sin recordatorios'}</b><small>Elija correo, SMS o WhatsApp de acuerdo con el consentimiento.</small></span></label>${draft.reminderEnabled ? html`<div className="reminder-preferences-form"><div className="channel-choice-grid">${REMINDER_CHANNELS.map(channel => { const active = (draft.reminderChannels || []).includes(channel.value); return html`<label key=${channel.value} className=${active ? 'active' : ''}><input type="checkbox" checked=${active} onChange=${event => this.updateDraft('reminderChannels', event.target.checked ? [...new Set([...(draft.reminderChannels || []), channel.value])] : (draft.reminderChannels || []).filter(item => item !== channel.value))}/><${Icon} name=${channel.value === 'email' ? 'mail' : 'message'} size=${17}/><span>${channel.label}</span></label>`; })}</div><div className="form-grid"><${FormField} label="Correo"><input type="email" value=${draft.reminderEmail} onChange=${event => this.updateDraft('reminderEmail', event.target.value)}/></${FormField}><${FormField} label="Teléfono"><input value=${draft.reminderPhone} onChange=${event => this.updateDraft('reminderPhone', event.target.value)}/></${FormField}></div><div className="form-grid"><${FormField} label="Consentimiento"><select value=${draft.reminderConsentStatus} onChange=${event => this.updateDraft('reminderConsentStatus', event.target.value)}><option value="pending">Pendiente</option><option value="granted">Otorgado</option><option value="declined">Rechazado</option></select></${FormField}><${FormField} label="Idioma"><input value=${draft.reminderLanguage} onChange=${event => this.updateDraft('reminderLanguage', event.target.value)}/></${FormField}></div></div>` : null}</fieldset>

      ${clinicalFields ? html`<fieldset className=${`vital-status-fieldset ${deceased ? 'deceased' : ''}`}><legend>Estado vital</legend><div className="form-grid"><${FormField} label="Estado"><select value=${draft.vitalStatus} onChange=${event => this.updateDraft('vitalStatus', event.target.value)}>${VITAL_STATUS_OPTIONS.map(item => html`<option key=${item.value} value=${item.value}>${item.label}</option>`)}</select></${FormField}><div className="form-information compact"><${Icon} name="shield" size=${18}/><div><b>Registro cuidadoso</b><p>“Fallecido” detiene recordatorios y activa el modo post mortem. No se infiere la manera de muerte.</p></div></div></div>${deceased ? html`<div className="death-record-panel"><div className="form-grid form-grid-three"><${FormField} label="Fecha de fallecimiento" required=${true}><input type="date" value=${draft.deathDate} onChange=${event => this.updateDraft('deathDate', event.target.value)} required/></${FormField}><${FormField} label="Fecha en que se informó"><input type="date" value=${draft.deathInformedAt} onChange=${event => this.updateDraft('deathInformedAt', event.target.value)}/></${FormField}><${FormField} label="Manera documentada"><select value=${draft.deathManner} onChange=${event => this.updateDraft('deathManner', event.target.value)}>${DEATH_MANNER_OPTIONS.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}></div><div className="form-grid"><${FormField} label="Fuente de confirmación"><select value=${draft.deathSourceType} onChange=${event => this.updateDraft('deathSourceType', event.target.value)}><option>No registrada</option><option>Familiar o persona cercana</option><option>Documento oficial</option><option>Hospital o institución</option><option>Autoridad competente</option><option>Otra</option></select></${FormField}><${FormField} label="Quién confirmó"><input value=${draft.deathConfirmedBy} onChange=${event => this.updateDraft('deathConfirmedBy', event.target.value)}/></${FormField}></div><div className="form-grid"><${FormField} label="Documento de respaldo"><input value=${draft.deathSourceDocument} onChange=${event => this.updateDraft('deathSourceDocument', event.target.value)} placeholder="Nombre o referencia del documento"/></${FormField}><${FormField} label="Lugar"><input value=${draft.deathPlace} onChange=${event => this.updateDraft('deathPlace', event.target.value)}/></${FormField}></div><${FormField} label="Notas"><textarea rows="3" value=${draft.deathNotes} onChange=${event => this.updateDraft('deathNotes', event.target.value)} placeholder="Registre hechos y fuente; evite conclusiones no documentadas."></textarea></${FormField}><div className="form-warning"><${Icon} name="alert" size=${18}/><span>Solo seleccione “Suicidio” cuando exista confirmación documentada. El sistema no deduce causa ni intención.</span></div></div>` : null}</fieldset>` : null}

${clinicalFields ? html`<${FormField} label="Nota de actualización"><textarea rows="3" value=${draft.notes} onChange=${event => this.updateDraft('notes', event.target.value)} placeholder="Opcional. Se agregará al historial de notas."></textarea></${FormField}>`:null}${!patient?.archived?html`<div className="form-warning"><${Icon} name="alert" size=${18}/><div><b>¿El expediente fue creado por error?</b><p>Puede archivarlo. Desaparecerá de pacientes activos, pero conservará todo su historial.</p><button type="button" className="text-danger-button" onClick=${()=>this.openClinicalArchive(patient,'patient',patient.id,patient.name,'patients')}><${Icon} name="trash" size=${16}/> Archivar paciente</button></div></div>`:null}<${FormActions} disabled=${this.state.formSaving} onCancel=${this.closeModal} submitLabel="Guardar cambios"/></form></${Modal}>`;
  }

  renderClinicProfileModal() {
    const draft = this.state.modal.draft;
    return html`<${Modal} title="Identidad del consultorio" subtitle="Configure logo, fotografía profesional y datos del membrete." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveClinicProfileForm}>${this.renderModalError()}
      <div className="practice-image-grid" data-tour="clinic-profile-images"><${ImagePicker} value=${draft.clinicLogo} label="Logo de la clínica" hint="Se recomienda PNG con fondo transparente." shape="logo" onChange=${event => this.handleDraftImage(event, 'clinicLogo', { maxDimension: 900, quality: 0.9, preserveTransparency: true })} onRemove=${() => this.updateDraft('clinicLogo', '')}/><${ImagePicker} value=${draft.doctorPhoto} label="Fotografía del médico" hint="Se mostrará en el perfil y la vista de usuario." onChange=${event => this.handleDraftImage(event, 'doctorPhoto', { maxDimension: 640, quality: 0.84 })} onRemove=${() => this.updateDraft('doctorPhoto', '')}/></div>
      <fieldset data-tour="clinic-profile-identity"><legend>Datos del consultorio</legend><div className="form-grid"><${FormField} label="Nombre de la clínica" required=${true}><input autoFocus value=${draft.name} onChange=${event => this.updateDraft('name', event.target.value)} required/></${FormField}><${FormField} label="Especialidad"><input value=${draft.specialty} onChange=${event => this.updateDraft('specialty', event.target.value)} placeholder="Psiquiatría"/></${FormField}></div><div className="form-grid" data-tour="clinic-profile-doctor"><${FormField} label="Nombre del profesional" required=${true}><input value=${draft.clinician} onChange=${event => this.updateDraft('clinician', event.target.value)} required/></${FormField}><${FormField} label="N.º de junta o licencia"><input value=${draft.professionalLicense} onChange=${event => this.updateDraft('professionalLicense', event.target.value)} placeholder="Ej. JVPM 0000"/></${FormField}></div><${FormField} label="Dirección"><input value=${draft.address} onChange=${event => this.updateDraft('address', event.target.value)} placeholder="Dirección del consultorio"/></${FormField}><fieldset className="clinic-phone-fieldset"><legend>Teléfonos del membrete</legend><p className="field-note">Agregue el teléfono y celular de la clínica, el número del doctor u otros contactos.</p><div className="clinic-phone-list">${(draft.phones||[]).map((phone,index)=>html`<div key=${phone.id} className="clinic-phone-row"><input aria-label=${`Tipo de teléfono ${index+1}`} value=${phone.label} onChange=${event=>this.updateClinicPhone(phone.id,'label',event.target.value)} placeholder="Ej. Celular clínica"/><input aria-label=${`Número de teléfono ${index+1}`} value=${phone.number} onChange=${event=>this.updateClinicPhone(phone.id,'number',event.target.value)} placeholder="Ej. +503 7000 0000"/><button type="button" className="text-danger-button" aria-label=${`Quitar teléfono ${index+1}`} onClick=${()=>this.removeClinicPhone(phone.id)}><${Icon} name="trash" size=${16}/> Quitar</button></div>`)}</div><${Button} tone="secondary" icon="plus" onClick=${this.addClinicPhone}>Agregar otro número</${Button}></fieldset><div className="form-grid"><${FormField} label="Correo"><input type="email" value=${draft.email} onChange=${event => this.updateDraft('email', event.target.value)}/></${FormField}><${FormField} label="Sitio web"><input value=${draft.website} onChange=${event => this.updateDraft('website', event.target.value)} placeholder="https://..."/></${FormField}></div></fieldset><div data-tour="clinic-profile-footer"><${FormField} label="Texto al pie de la receta" hint="Aparecerá en todas las recetas impresas."><textarea rows="3" value=${draft.prescriptionFooter} onChange=${event => this.updateDraft('prescriptionFooter', event.target.value)}></textarea></${FormField}><div className="letterhead-preview"><div className="letterhead-preview-logo">${draft.clinicLogo ? html`<img src=${draft.clinicLogo} alt="Logo"/>` : html`<${Icon} name="building" size=${26}/>`}</div><div><span>Vista previa del membrete</span><b>${draft.name || 'Nombre de la clínica'}</b><small>${draft.clinician || 'Nombre del profesional'} · ${draft.specialty || 'Especialidad'}</small><small>${(draft.phones||[]).filter(item=>item.number).map(item=>`${item.label}: ${item.number}`).join(' · ')}</small></div></div></div><${FormActions} disabled=${this.state.formSaving} onCancel=${this.closeModal} submitLabel="Guardar identidad"/></form></${Modal}>`;
  }

  renderTeamRoleFields(d) {
    return html`<${FormField} label="Teléfono"><input value=${d.phone||''} onChange=${e=>this.updateDraft('phone',e.target.value)}/></${FormField}><${FormField} label="Cargo"><input value=${d.title||''} onChange=${e=>this.updateDraft('title',e.target.value)}/></${FormField}><${FormField} label="Rol"><select value=${d.role||'secretary'} onChange=${e=>{const role=e.target.value;this.setState(prev=>({modal:{...prev.modal,draft:{...prev.modal.draft,role,permissions:defaultPermissions(role)}}}));}}><option value="doctor">Doctor</option><option value="nurse">Enfermería</option><option value="secretary">Secretaría</option></select></${FormField}><h3>Permisos</h3>`;
  }

  renderPermissionGroups(draft) {
    const catalog=PERMISSION_CATALOG.filter(p=>!OWNER_ONLY.includes(p.key) && (draft.role!=='secretary'||SECRETARY_PERMISSIONS.includes(p.key)||p.key==='prescriptionsEdit'));
    return html`<div className="permission-groups">${[...new Set(catalog.map(p=>p.group))].map(group=>html`<fieldset key=${group}><legend>${group}</legend>${catalog.filter(p=>p.group===group).map(p=>html`<label key=${p.key} className="permission-row"><input type="checkbox" checked=${draft.permissions?.[p.key]===true} onChange=${e=>this.updateDraftPermission(p.key,e.target.checked)}/><span><b>${p.label}</b><small>${p.description}</small></span></label>`)}</fieldset>`)}</div>`;
  }

  renderSecretaryModal() {
    const d=this.state.modal.draft;
    return html`<${Modal} title="Agregar usuario" subtitle="La persona recibirá un correo para definir su propia contraseña." onClose=${this.closeModal} size="lg">
      <form className="clinical-form" onSubmit=${this.saveSecretaryForm}>${this.renderModalError()}
        <${FormField} label="Nombre completo"><input required value=${d.name} onChange=${e=>this.updateDraft('name',e.target.value)}/></${FormField}>
        <${FormField} label="Correo"><input required type="email" value=${d.email} onChange=${e=>this.updateDraft('email',e.target.value)}/></${FormField}>
        ${this.renderTeamRoleFields(d)}<p className="field-note">Seleccione los permisos del usuario. La administración del equipo y del plan corresponde al propietario.</p>
        ${this.renderPermissionGroups(d)}
        <${Button} type="submit" disabled=${this.state.teamBusy}>${this.state.teamBusy?'Enviando invitación…':'Enviar invitación'}</${Button}>
      </form></${Modal}>`;
  }

  renderUserPermissionsModal() {
    const d=this.state.modal.draft;
    return html`<${Modal} title="Permisos del usuario" subtitle="Las restricciones se comprueban también en la base de datos." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveUserPermissionsForm}>${this.renderModalError()}
      <${FormField} label="Nombre"><input required value=${d.name} onChange=${e=>this.updateDraft('name',e.target.value)}/></${FormField}>
      <${FormField} label="Correo"><input value=${d.email} readOnly/></${FormField}>
      ${this.renderTeamRoleFields(d)}
      ${this.renderPermissionGroups(d)}<${Button} type="submit" disabled=${this.state.teamBusy}>Guardar permisos</${Button}></form></${Modal}>`;
  }

  renderAccountModal() {
    const user = this.activeUser();
    const draft = this.state.modal.draft;
    if (!user) return null;
    return html`<${Modal} title="Mi cuenta" subtitle="Revise su sesión, cambie la contraseña o cierre el acceso actual." onClose=${this.closeModal} size="md"><div className="account-summary"><${UserAvatar} user=${user} organization=${this.state.data.organization} size="xl"/><div><span>${ROLE_LABELS[user.role]||'Usuario'}</span><h3>${user.name}</h3><p>${user.email}</p><${Badge} tone=${user.role === 'owner' ? 'blue' : 'success'} dot=${true}>${user.role === 'owner' ? 'Acceso clínico completo' : 'Permisos asignados'}</${Badge}></div></div><form className="clinical-form account-password-form" onSubmit=${this.saveAccountPassword}>${this.renderModalError()}<fieldset><legend>Cambiar contraseña</legend><${FormField} label="Contraseña actual"><div className="password-field"><input type=${draft.showPasswords ? 'text' : 'password'} value=${draft.currentPassword} onChange=${event => this.updateDraft('currentPassword', event.target.value)} autoComplete="current-password"/><button type="button" onClick=${() => this.updateDraft('showPasswords', !draft.showPasswords)} aria-label=${draft.showPasswords ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}><${Icon} name=${draft.showPasswords ? 'eyeOff' : 'eye'} size=${18}/></button></div></${FormField}><div className="form-grid"><${FormField} label="Nueva contraseña"><input type=${draft.showPasswords ? 'text' : 'password'} minLength="12" value=${draft.newPassword} onChange=${event => this.updateDraft('newPassword', event.target.value)} autoComplete="new-password"/></${FormField}><${FormField} label="Confirmar contraseña"><input type=${draft.showPasswords ? 'text' : 'password'} minLength="12" value=${draft.confirmPassword} onChange=${event => this.updateDraft('confirmPassword', event.target.value)} autoComplete="new-password"/></${FormField}></div><small className="field-note">Use al menos 12 caracteres. La contraseña se actualiza en su cuenta de acceso.</small></fieldset><div className="account-actions"><${Button} tone="secondary" type="submit" icon="lock">Actualizar contraseña</${Button}><${Button} tone="secondary" icon="settings" onClick=${() => this.setState({ modal: null, view: 'settings' })} disabled=${!this.can('settingsManage') && !this.can('usersManage')}>Configuración</${Button}><button type="button" className="logout-button" onClick=${this.logoutUser}><${Icon} name="logout" size=${18}/> Cerrar sesión</button></div></form></${Modal}>`;
  }

  renderPrescriptionModal() {
    const { draft, patientId } = this.state.modal;
    const patient = this.state.data.patients.find(item => item.id === patientId);
    const items = draft.items || [];
    const activeMedications=sortMedicationsBySchedule((patient?.medications||[]).filter(item=>item.status==='active'));
    return html`<${Modal} title=${draft.id?'Editar receta':'Nueva receta'} subtitle=${`Paciente: ${patient?.name || ''}. La receta se guarda como snapshot y no cambia si el tratamiento cambia después.`} onClose=${this.closeModal} size="xl"><form className="clinical-form prescription-form" onSubmit=${this.savePrescriptionForm}>${this.renderModalError()}<div className="prescription-form-head" data-tour="prescription-form-header"><div className="prescription-patient"><${Avatar} patient=${patient} size="lg"/><div><span>Paciente</span><b>${patient?.name}</b><small>${patient?.age} años · ${patient?.diagnosis}</small></div></div><div className="letterhead-mini">${this.state.data.organization.clinicLogo ? html`<img src=${this.state.data.organization.clinicLogo} alt="Logo"/>` : html`<${Icon} name="building" size=${23}/>`}<div><b>${this.state.data.organization.name}</b><small>${this.state.data.organization.clinician}</small></div></div></div>${!draft.id&&activeMedications.length?html`<${FormField} label="Copiar medicamento del tratamiento actual"><select value="" onChange=${event=>{this.addCurrentMedicationToPrescription(event.target.value);event.target.value='';}}><option value="">Seleccione un medicamento…</option>${activeMedications.map(medication=>html`<option key=${medication.id} value=${medication.id}>${medication.name} · ${medication.dose} · ${medication.frequency}</option>`)}</select></${FormField}>`:null}<div className="form-grid" data-tour="prescription-form-header"><${FormField} label="Fecha" required=${true}><input type="date" value=${draft.date} onChange=${event => this.updateDraft('date', event.target.value)} required/></${FormField}><${FormField} label="Diagnóstico"><input value=${draft.diagnosis} onChange=${event => this.updateDraft('diagnosis', event.target.value)}/></${FormField}></div><${FormField} label="Profesional que emite"><input value=${draft.doctorName} onChange=${event => this.updateDraft('doctorName', event.target.value)} required/></${FormField}><fieldset className="prescription-items-fieldset" data-tour="prescription-form-items"><legend>Medicamentos e indicaciones</legend><div className="prescription-item-list">${items.map((item, index) => html`<article key=${item.id} className="prescription-item-editor"><header><span>${index + 1}</span><b>Indicación</b>${items.length > 1 ? html`<button type="button" aria-label="Quitar medicamento" onClick=${() => this.removePrescriptionItem(item.id)}><${Icon} name="trash" size=${16}/></button>` : null}</header><div className="form-grid" data-tour="prescription-form-item-identity"><${FormField} label="Medicamento" required=${true}><input value=${item.medication} onChange=${event => this.updatePrescriptionItem(item.id, 'medication', event.target.value)} placeholder="Ej. Sertralina" required/></${FormField}><${FormField} label="Presentación o dosis"><input value=${item.strength} onChange=${event => this.updatePrescriptionItem(item.id, 'strength', event.target.value)} placeholder="Ej. 50 mg"/></${FormField}></div><div className="form-grid"><${FormField} label="Cómo tomarlo" required=${true}><input value=${item.directions} onChange=${event => this.updatePrescriptionItem(item.id, 'directions', event.target.value)} placeholder="Ej. 1 tableta cada mañana" required/></${FormField}><${FormField} label="Cantidad"><input value=${item.quantity} onChange=${event => this.updatePrescriptionItem(item.id, 'quantity', event.target.value)} placeholder="Ej. 30 tabletas"/></${FormField}></div><div className="form-grid"><${FormField} label="Duración"><input value=${item.duration} onChange=${event => this.updatePrescriptionItem(item.id, 'duration', event.target.value)} placeholder="Ej. 30 días"/></${FormField}><${FormField} label="Nota para el paciente"><input value=${item.notes} onChange=${event => this.updatePrescriptionItem(item.id, 'notes', event.target.value)} placeholder="Ej. tomar con alimentos"/></${FormField}></div>${!draft.id&&!item.sourceMedicationId&&this.can('medicationsManage')?html`<label className="check-row"><input type="checkbox" checked=${Boolean(item.addToTreatment)} onChange=${event=>this.updatePrescriptionItem(item.id,'addToTreatment',event.target.checked)}/><span><b>Agregar también al tratamiento activo</b><small>Requiere una decisión clínica explícita. La receta seguirá siendo un snapshot independiente.</small></span></label>`:null}</article>`)}</div><div data-tour="prescription-form-more"><${Button} tone="secondary" icon="plus" onClick=${this.addPrescriptionItem}>Agregar otro medicamento</${Button}></div></fieldset><div data-tour="prescription-form-observations"><${FormField} label="Indicaciones generales"><textarea rows="3" value=${draft.generalInstructions} onChange=${event => this.updateDraft('generalInstructions', event.target.value)} placeholder="Recomendaciones que sí aparecerán en la receta"></textarea></${FormField}><${FormField} label="Observaciones internas"><textarea rows="2" value=${draft.observations} onChange=${event => this.updateDraft('observations', event.target.value)} placeholder="Uso interno; no se imprime"></textarea></${FormField}></div><div className="form-information"><${Icon} name="print" size=${19}/><div><b>Lista para papel membretado</b><p>La impresión incluye clínica, licencia, paciente, indicaciones y espacio para firma y sello. Las observaciones internas no se imprimen.</p></div></div><div data-tour="prescription-form-save"><${FormActions} disabled=${this.state.formSaving} onCancel=${this.closeModal} submitLabel=${draft.id?'Guardar corrección y abrir receta':'Guardar y abrir receta'}/></div></form></${Modal}>`;
  }

  renderMedicationFormModal() {
    const draft = this.state.modal.draft;
    const patient = this.state.data.patients.find(item => item.id === this.state.modal.patientId);
    const clinicalMode=this.can('medicationsManage');
    return html`<${Modal} title=${draft.id?'Editar medicamento':clinicalMode?'Agregar medicamento':'Registrar medicamento informado'} subtitle=${clinicalMode?`Paciente: ${patient?.name || ''}`:'Quedará pendiente de revisión médica y no modificará el tratamiento activo.'} onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveMedicationForm}>${this.renderModalError()}<div data-tour="medication-form-identity"><div className="form-grid"><${FormField} label="Medicamento" required=${true}><input autoFocus value=${draft.name} onChange=${event => this.updateDraft('name', event.target.value)} placeholder="Ej. Sertralina" required/></${FormField}>${clinicalMode?html`<${FormField} label="Clase"><select value=${draft.class} onChange=${event => this.updateDraft('class', event.target.value)}>${MEDICATION_CLASSES.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}>`:null}</div>${clinicalMode?html`<${FormField} label="Indicación clínica"><input value=${draft.indication} onChange=${event => this.updateDraft('indication', event.target.value)} placeholder="Motivo clínico del tratamiento"/></${FormField}>`:null}</div><div className="form-grid form-grid-three" data-tour="medication-form-dose"><${FormField} label="Dosis" required=${true}><input type="number" min="0" step="0.01" value=${draft.doseValue} onChange=${event => this.updateDraft('doseValue', event.target.value)} required/></${FormField}><${FormField} label="Unidad"><select value=${draft.doseUnit} onChange=${event => this.updateDraft('doseUnit', event.target.value)}><option>mg</option><option>mcg</option><option>g</option><option>mL</option><option>tableta(s)</option><option>gota(s)</option></select></${FormField}><${FormField} label="Frecuencia"><select value=${draft.frequency} onChange=${event => this.updateDraft('frequency', event.target.value)}>${FREQUENCIES.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}></div>${draft.frequency==='otra'?html`<${FormField} label="Frecuencia personalizada" required=${true}><input value=${draft.customFrequency} onChange=${event=>this.updateDraft('customFrequency',event.target.value)} placeholder="Describa cuándo lo toma" required/></${FormField}>`:null}<div className="form-grid" data-tour="medication-form-start"><${FormField} label="Vía"><select value=${draft.route} onChange=${event => this.updateDraft('route', event.target.value)}><option>oral</option><option>sublingual</option><option>intramuscular</option><option>transdérmica</option><option>otra</option></select></${FormField}><${FormField} label=${clinicalMode?'Fecha de inicio':'Fecha informada'}><input type="date" value=${draft.startDate} onChange=${event => this.updateDraft('startDate', event.target.value)} required/></${FormField}></div>${clinicalMode?html`<div className="check-grid" data-tour="medication-form-start"><label><input type="checkbox" checked=${Boolean(draft.isPrimary)} onChange=${event => this.updateDraft('isPrimary', event.target.checked)}/><span><b>Medicamento principal</b><small>Se mostrará como referencia principal del dashboard.</small></span></label><label><input type="checkbox" checked=${Boolean(draft.isPrn)} onChange=${event => this.updateDraft('isPrn', event.target.checked)}/><span><b>Uso según necesidad</b><small>Marque si la indicación es PRN.</small></span></label></div>`:null}<${FormField} label=${clinicalMode?'Notas clínicas':'Nota de captura'}><textarea rows="3" value=${draft.notes} onChange=${event => this.updateDraft('notes', event.target.value)} placeholder=${clinicalMode?'Contexto clínico del medicamento':'Fuente o aclaración administrativa; no escriba diagnóstico.'}></textarea></${FormField}>${!clinicalMode?html`<div className="form-information"><${Icon} name="shield" size=${18}/><div><b>Pendiente de revisión</b><p>Este registro no prescribe, activa, suspende ni cambia un tratamiento. El médico debe revisarlo.</p></div></div>`:null}<${FormActions} disabled=${this.state.formSaving} onCancel=${this.closeModal} submitLabel=${draft.id?'Guardar corrección':clinicalMode?'Agregar medicamento':'Enviar a revisión'}/></form></${Modal}>`;
  }

  renderDoseFormModal() {
    const draft = this.state.modal.draft;
    const patient = this.state.data.patients.find(item => item.id === this.state.modal.patientId);
    const active = patient?.medications?.filter(item => item.status === 'active') || [];
    const selected = active.find(item => item.id === draft.medicationId) || active[0];
    return html`<${Modal} title="Cambiar dosis" subtitle="El valor anterior se conservará en el historial." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveDoseForm}>${this.renderModalError()}<div data-tour="dose-form-current"><${FormField} label="Medicamento"><select value=${draft.medicationId} onChange=${event => { const medication = active.find(item => item.id === event.target.value); this.setState(prev => ({ modal: { ...prev.modal, draft: { ...prev.modal.draft, medicationId: event.target.value, currentDose: medication?.dose || '', newDoseValue: medication?.doseValue ?? '', doseUnit: medication?.doseUnit || 'mg', frequency: medication?.frequency || 'una vez al día' } } })); }}>${active.map(item => html`<option key=${item.id} value=${item.id}>${item.name} · ${item.dose}</option>`)}</select></${FormField}><div className="dose-change-panel"><div><span>Dosis actual</span><strong>${selected?.dose || draft.currentDose}</strong></div><${Icon} name="chevronRight"/><div><span>Nueva dosis</span><strong>${draft.newDoseValue || '—'} ${draft.doseUnit}</strong></div></div><div className="form-grid form-grid-three" data-tour="dose-form-current"><${FormField} label="Nueva dosis" required=${true}><input autoFocus type="number" min="0" step="0.01" value=${draft.newDoseValue} onChange=${event => this.updateDraft('newDoseValue', event.target.value)} required/></${FormField}><${FormField} label="Unidad"><select value=${draft.doseUnit} onChange=${event => this.updateDraft('doseUnit', event.target.value)}><option>mg</option><option>mcg</option><option>g</option><option>mL</option><option>tableta(s)</option><option>gota(s)</option></select></${FormField}><${FormField} label="Frecuencia"><select value=${draft.frequency} onChange=${event => this.updateDraft('frequency', event.target.value)}>${FREQUENCIES.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}></div></div><div className="form-grid" data-tour="dose-form-context"><${FormField} label="Fecha efectiva"><input type="date" value=${draft.effectiveDate} onChange=${event => this.updateDraft('effectiveDate', event.target.value)} required/></${FormField}><${FormField} label="Motivo"><input value=${draft.reason} onChange=${event => this.updateDraft('reason', event.target.value)} placeholder="Ej. respuesta parcial"/></${FormField}></div><${FormField} label="Notas"><textarea rows="3" value=${draft.notes} onChange=${event => this.updateDraft('notes', event.target.value)}></textarea></${FormField}><${FormActions} disabled=${this.state.formSaving} onCancel=${this.closeModal} submitLabel="Guardar cambio de dosis"/></form></${Modal}>`;
  }

  renderMedicationStatusFormModal() {
    const draft = this.state.modal.draft;
    const action = draft.status === 'suspended' ? 'Suspender medicamento' : draft.status === 'active' ? 'Reactivar medicamento' : draft.status==='completed'?'Completar medicamento':'Descontinuar medicamento';
    const explanation = draft.status === 'suspended'
      ? 'La suspensión queda registrada y el medicamento podrá reactivarse después.'
      : draft.status === 'active'
        ? 'El medicamento volverá a mostrarse como activo.'
        : 'El medicamento quedará en el historial, pero dejará de mostrarse como tratamiento activo.';
    return html`<${Modal} title=${action} subtitle=${draft.medicationName} onClose=${this.closeModal} size="md"><form className="clinical-form" onSubmit=${this.saveMedicationStatusForm}>${this.renderModalError()}<div className="form-note"><${Icon} name="medication" size=${18}/><span>${explanation}</span></div><${FormField} label="Motivo del cambio" hint="Opcional, pero útil para interpretar la línea de tiempo."><textarea autoFocus rows="4" value=${draft.reason} onChange=${event => this.updateDraft('reason', event.target.value)} placeholder="Ej. respuesta insuficiente, efecto observado, fin de esquema o decisión compartida"></textarea></${FormField}><${FormActions} disabled=${this.state.formSaving} onCancel=${this.closeModal} submitLabel=${action}/></form></${Modal}>`;
  }

  renderAssessmentFormModal() {
    const draft = this.state.modal.draft;
    const patient = this.state.data.patients.find(item => item.id === this.state.modal.patientId);
    const scale = SCALE_CATALOG.find(item => item.code === draft.code) || SCALE_CATALOG[0];
    return html`<${Modal} title=${draft.editing?'Editar medición':'Registrar evolución'} subtitle=${`Paciente: ${patient?.name || ''}`} onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveAssessmentForm}>${this.renderModalError()}<div className="form-grid" data-tour="assessment-form-score"><${FormField} label="Escala clínica"><select value=${draft.code} disabled=${draft.editing} onChange=${event => this.updateDraft('code', event.target.value)}>${SCALE_CATALOG.map(item => html`<option key=${item.code} value=${item.code}>${item.code} · ${item.label}</option>`)}</select></${FormField}><${FormField} label="Puntaje" required=${true} hint=${`Rango: ${scale.min} a ${scale.max}`}><input autoFocus type="number" min=${scale.min} max=${scale.max} value=${draft.score} onChange=${event => this.updateDraft('score', event.target.value)} required/></${FormField}></div><div data-tour="assessment-form-context"><div className="form-grid form-grid-three"><${FormField} label="Fecha"><input type="date" value=${draft.date} onChange=${event => this.updateDraft('date', event.target.value)} required/></${FormField}><${FormField} label="Adherencia %"><input type="number" min="0" max="100" value=${draft.adherence} onChange=${event => this.updateDraft('adherence', event.target.value)}/></${FormField}><${FormField} label="Sueño promedio (h)"><input type="number" min="0" max="24" step="0.1" value=${draft.sleepCurrent} onChange=${event => this.updateDraft('sleepCurrent', event.target.value)}/></${FormField}></div><div className="form-grid form-grid-three"><${FormField} label="Cambio en funcionamiento %"><input type="number" min="-100" max="100" value=${draft.functioningChange} onChange=${event => this.updateDraft('functioningChange', event.target.value)}/></${FormField}><${FormField} label="Estado clínico"><select value=${draft.status} onChange=${event => this.updateDraft('status', event.target.value)}><option value="responding">Mejorando</option><option value="partial">Mejoría parcial</option><option value="stable">Estable</option><option value="review">Requiere revisión</option></select></${FormField}><${FormField} label="Riesgo actual"><select value=${draft.risk} onChange=${event => this.updateDraft('risk', event.target.value)}><option value="low">Bajo</option><option value="medium">Moderado</option><option value="high">Alto</option></select></${FormField}></div></div><div data-tour="assessment-form-note"><${FormField} label="Nota clínica"><textarea rows="4" value=${draft.note} onChange=${event => this.updateDraft('note', event.target.value)} placeholder="Cambios observados, contexto, adherencia, tolerabilidad y plan"></textarea></${FormField}></div><div className="form-note"><${Icon} name="shield" size=${17}/><span>El porcentaje de mejoría se recalculará contra el primer puntaje registrado de esta escala.</span></div><${FormActions} disabled=${this.state.formSaving} onCancel=${this.closeModal} submitLabel=${draft.editing?'Guardar corrección':'Guardar evolución'}/></form></${Modal}>`;
  }

  renderVitalsFormModal() {
    const draft = this.state.modal.draft;
    return html`<${Modal} title=${draft.id?'Editar control físico':'Control físico'} subtitle="Registre solo los datos disponibles durante esta consulta." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveVitalsForm}>${this.renderModalError()}<div className="form-grid form-grid-three" data-tour="vitals-form-body"><${FormField} label="Fecha"><input type="date" value=${draft.date} onChange=${event => this.updateDraft('date', event.target.value)} required/></${FormField}><${FormField} label="Peso (kg)"><input type="number" min="0" step="0.1" value=${draft.weight} onChange=${event => this.updateDraft('weight', event.target.value)}/></${FormField}><${FormField} label="Estatura (cm)"><input type="number" min="0" step="0.1" value=${draft.height} onChange=${event => this.updateDraft('height', event.target.value)}/></${FormField}></div><div className="form-grid form-grid-three" data-tour="vitals-form-cardio"><${FormField} label="Presión sistólica"><input type="number" min="0" value=${draft.systolic} onChange=${event => this.updateDraft('systolic', event.target.value)}/></${FormField}><${FormField} label="Presión diastólica"><input type="number" min="0" value=${draft.diastolic} onChange=${event => this.updateDraft('diastolic', event.target.value)}/></${FormField}><${FormField} label="Pulso (bpm)"><input type="number" min="0" value=${draft.pulse} onChange=${event => this.updateDraft('pulse', event.target.value)}/></${FormField}></div><div className="form-grid" data-tour="vitals-form-wellbeing"><${FormField} label="Sueño promedio (horas)"><input type="number" min="0" max="24" step="0.1" value=${draft.sleepCurrent} onChange=${event => this.updateDraft('sleepCurrent', event.target.value)}/></${FormField}><${FormField} label="Apetito"><select value=${draft.appetite} onChange=${event => this.updateDraft('appetite', event.target.value)}><option>No registrado</option><option>Sin cambios</option><option>Disminuido</option><option>Aumentado</option></select></${FormField}></div><${FormField} label="Notas"><textarea rows="3" value=${draft.notes} onChange=${event => this.updateDraft('notes', event.target.value)}></textarea></${FormField}><${FormActions} disabled=${this.state.formSaving} onCancel=${this.closeModal} submitLabel=${draft.id?'Guardar corrección':'Guardar control'}/></form></${Modal}>`;
  }

  renderAdverseFormModal() {
    const draft = this.state.modal.draft;
    const patient = this.state.data.patients.find(item => item.id === this.state.modal.patientId);
    return html`<${Modal} title=${draft.id?'Editar efecto observado':'Registrar efecto observado'} subtitle="Describa temporalidad sin asumir causalidad automática." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveAdverseForm}>${this.renderModalError()}<div className="form-grid" data-tour="adverse-form-identification"><${FormField} label="Medicamento relacionado"><select value=${draft.medicationId} onChange=${event => this.updateDraft('medicationId', event.target.value)}><option value="">No definido</option>${patient?.medications?.filter(item=>!item.archivedAt).map(item => html`<option key=${item.id} value=${item.id}>${item.name} · ${item.dose}</option>`)}</select></${FormField}><${FormField} label="Efecto observado"><select value=${draft.name} onChange=${event => this.updateDraft('name', event.target.value)}>${COMMON_ADVERSE_EFFECTS.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}></div>${draft.name === 'Otro' ? html`<${FormField} label="Nombre del efecto" required=${true}><input autoFocus value=${draft.customName} onChange=${event => this.updateDraft('customName', event.target.value)} required/></${FormField}>` : null}<div className="form-grid form-grid-three" data-tour="adverse-form-identification"><${FormField} label="Severidad"><select value=${draft.severity} onChange=${event => this.updateDraft('severity', event.target.value)}><option value="mild">Leve</option><option value="moderate">Moderada</option><option value="severe">Severa</option><option value="critical">Crítica</option></select></${FormField}><${FormField} label="Estado"><select value=${draft.status} onChange=${event => this.updateDraft('status', event.target.value)}><option value="active">Activo</option><option value="resolved">Resuelto</option><option value="unknown">Sin confirmar</option></select></${FormField}><${FormField} label="Fecha de aparición"><input type="date" value=${draft.onset} onChange=${event => this.updateDraft('onset', event.target.value)} required/></${FormField}></div><div data-tour="adverse-form-clinical"><${FormField} label="Relación temporal"><textarea rows="3" value=${draft.relation} onChange=${event => this.updateDraft('relation', event.target.value)} placeholder="Ej. apareció cuatro días después del aumento de dosis"></textarea></${FormField}><${FormField} label="Acción tomada"><input value=${draft.actionTaken} onChange=${event => this.updateDraft('actionTaken', event.target.value)} placeholder="Ej. observación, cambio de horario, evaluación adicional"/></${FormField}></div><${FormActions} disabled=${this.state.formSaving} onCancel=${this.closeModal} submitLabel=${draft.id?'Guardar corrección':'Guardar efecto'}/></form></${Modal}>`;
  }

  renderLabFormModal() {
    const draft = this.state.modal.draft;
    return html`<${Modal} title=${draft.id?'Editar resultado de laboratorio':'Nuevo resultado de laboratorio'} subtitle="Use el rango y la bandera reportados por el laboratorio." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveLabForm}>${this.renderModalError()}<div className="form-grid" data-tour="lab-form-identification"><${FormField} label="Prueba" required=${true}><input autoFocus value=${draft.name} onChange=${event => this.updateDraft('name', event.target.value)} placeholder="Ej. TSH, HbA1c o litio sérico" required/></${FormField}><${FormField} label="Fecha"><input type="date" value=${draft.date} onChange=${event => this.updateDraft('date', event.target.value)} required/></${FormField}></div><div className="form-grid form-grid-three" data-tour="lab-form-identification"><${FormField} label="Resultado" required=${true}><input value=${draft.value} onChange=${event => this.updateDraft('value', event.target.value)} required/></${FormField}><${FormField} label="Unidad"><input value=${draft.unit} onChange=${event => this.updateDraft('unit', event.target.value)} placeholder="mg/dL"/></${FormField}><${FormField} label="Estado"><select value=${draft.status} onChange=${event => this.updateDraft('status', event.target.value)}><option value="normal">En rango</option><option value="low">Bajo</option><option value="high">Alto</option><option value="abnormal">Fuera de rango</option><option value="critical_low">Críticamente bajo</option><option value="critical_high">Críticamente alto</option></select></${FormField}></div><div data-tour="lab-form-interpretation"><${FormField} label="Rango de referencia"><input value=${draft.reference} onChange=${event => this.updateDraft('reference', event.target.value)} placeholder="Ej. 0.4–4.0 mUI/L"/></${FormField}><${FormField} label="Notas"><textarea rows="3" value=${draft.notes} onChange=${event => this.updateDraft('notes', event.target.value)}></textarea></${FormField}></div><${FormActions} disabled=${this.state.formSaving} onCancel=${this.closeModal} submitLabel=${draft.id?'Guardar corrección':'Guardar resultado'}/></form></${Modal}>`;
  }

  renderAppointmentFormModal() {
    const draft = this.state.modal.draft;
    const patients = this.state.data.patients.filter(item => !item.archived);
    return html`<${Modal} title=${draft.id ? 'Editar cita' : 'Nueva cita'} subtitle="La cita se guardará en la agenda del consultorio." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveAppointmentForm}>${this.renderModalError()}<div data-tour="appointment-form-who-when"><${FormField} label="Paciente" required=${true}><select value=${draft.patientId} onChange=${event => this.updateDraft('patientId', event.target.value)}>${patients.map(patient => html`<option key=${patient.id} value=${patient.id}>${patient.name} · ${patient.diagnosis}</option>`)}</select></${FormField}><div className="form-grid"><${FormField} label="Fecha y hora" required=${true}><input type="datetime-local" value=${draft.start} onChange=${event => this.updateDraft('start', event.target.value)} required/></${FormField}><${FormField} label="Duración"><select value=${draft.duration} onChange=${event => this.updateDraft('duration', event.target.value)}><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60">60 minutos</option><option value="90">90 minutos</option></select></${FormField}></div></div><div data-tour="appointment-form-details"><div className="form-grid form-grid-three"><${FormField} label="Tipo"><select value=${draft.type} onChange=${event => this.updateDraft('type', event.target.value)}><option>Seguimiento</option><option>Primera consulta</option><option>Prioritaria</option><option>Seguridad</option><option>Laboratorios</option></select></${FormField}><${FormField} label="Modalidad"><select value=${draft.modality} onChange=${event => this.updateDraft('modality', event.target.value)}><option>Presencial</option><option>Videollamada</option></select></${FormField}><${FormField} label="Estado"><select value=${draft.status} onChange=${event => this.updateDraft('status', event.target.value)}><option value="confirmed">Confirmada</option><option value="pending">Pendiente</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option><option value="no_show">No asistió</option></select></${FormField}></div><${FormField} label="Revisión administrativa"><select value=${draft.adminReviewStatus||'none'} onChange=${event=>this.updateDraft('adminReviewStatus',event.target.value)}><option value="none">Sin marca</option><option value="pending">Por revisar</option><option value="reviewed">Revisada</option></select></${FormField}>${this.can('clinicalView')?html`<${FormField} label="Notas de preparación clínica"><textarea rows="4" value=${draft.notes} onChange=${event => this.updateDraft('notes', event.target.value)} placeholder="Ej. revisar escala, adherencia, efectos y controles"></textarea></${FormField}>`:null}</div><${FormActions} disabled=${this.state.formSaving} onCancel=${this.closeModal} submitLabel=${draft.id ? 'Guardar cambios' : 'Crear cita'}/></form></${Modal}>`;
  }

  renderReportModal() {
    const patient = this.state.data.patients.find(item => item.id === this.state.modal.patientId);
    if (!patient) return null;
    const report = buildPatientReport(patient, this.state.data.alerts);
    return html`<${Modal} title="Resumen del paciente" subtitle="Documento descriptivo para revisar o imprimir." onClose=${this.closeModal} size="xl"><div className="report-sheet"><div className="report-head"><${Logo} organization=${this.state.data.organization}/><div><span>Generado</span><b>${formatDateTime(report.generatedAt)}</b></div></div><div className="report-patient"><${Avatar} patient=${patient} size="lg"/><div><h2>${patient.name}</h2><p>${patient.age} años · ${patient.diagnosis} · ${patient.diagnosisCode}</p></div></div><div className="report-grid"><div><span>Medicamento principal</span><b>${report.medication?.name || 'Sin medicamento'}</b><small>${report.medication?.dose || '—'} · ${report.medication?.frequency || '—'}</small></div><div><span>Escala principal</span><b>${report.primary?.code || 'Sin escala'}</b><small>${report.baseline ?? '—'} → ${report.current ?? '—'}</small></div><div><span>Mejoría observada</span><b>${report.improvement === null ? '—' : percent(report.improvement)}</b><small>No implica causalidad automática.</small></div><div><span>Adherencia</span><b>${patient.adherence}%</b><small>Estimación registrada.</small></div></div><h3>Situación actual</h3><div className="report-list"><p><b>Estado clínico:</b> ${clinicalLabel(patient.status)}.</p><p><b>Riesgo registrado:</b> ${riskLabel(patient.risk)}.</p><p><b>Efectos activos:</b> ${report.activeAdverse.length ? report.activeAdverse.map(item => `${item.name} (${severityLabel(item.severity)})`).join(', ') : 'Ninguno registrado'}.</p><p><b>Alertas abiertas:</b> ${report.openAlerts.length ? report.openAlerts.map(item => item.title).join('; ') : 'Ninguna'}.</p><p><b>Próxima cita:</b> ${patient.nextVisit ? formatDateTime(patient.nextVisit) : 'Sin agendar'}.</p></div><div className="clinical-footnote"><${Icon} name="shield" size=${17}/> Este resumen apoya la revisión clínica. No diagnostica ni indica cambios terapéuticos.</div></div><div className="modal-sticky-actions"><${Button} tone="secondary" onClick=${this.closeModal}>Cerrar</${Button}><${Button} icon="print" onClick=${this.printReport}>Imprimir</${Button}></div></${Modal}>`;
  }

  renderHelpModal() {
    const secretary=this.activeUser()?.role==='secretary';const guide=secretary?[['Crear paciente','Abra Pacientes, use “Nuevo paciente” y complete identificación, contacto, seguro y consentimiento. La información clínica queda reservada al médico.'],['Agenda y confirmación','Cree o abra una cita, cambie su estado y marque la revisión administrativa.'],['Medicamentos y recetas','Puede capturar un medicamento informado para revisión médica, y corregir o anular recetas cuando tenga permiso.'],['Documentos','Genere constancias e incapacidades administrativas desde la ficha del paciente.']]:[['Consulta diaria','Revise Inicio y Agenda, confirme la cita y abra la libreta de consulta.'],['Tratamiento','Revise medicamentos pendientes, registre cambios de dosis y conserve el historial.'],['Recetas','Cree, corrija o anule la receta. La versión anterior y las recetas anuladas permanecen visibles.'],['Documentos y agenda','Genere documentos versionados, imprima la agenda diaria y gestione calendarios compartidos.']];
    return html`<${Modal} title="Centro de ayuda" subtitle=${secretary?'Guía rápida para Secretaría':'Guía rápida para el médico'} onClose=${this.closeModal} size="lg"><div className="guide-sections">${guide.map(([title,text])=>html`<section key=${title}><h3>${title}</h3><p>${text}</p></section>`)}</div><h3>Preguntas frecuentes</h3><div className="guide-sections"><section><h3>¿Se guardó el cambio?</h3><p>Espere el mensaje “Guardado en el servidor”. Si aparece un error, no cierre la página y use Reintentar.</p></section><section><h3>¿Cómo corrijo una receta?</h3><p>Use Editar para crear una revisión o Anular para conservarla marcada como inválida. Las recetas no se borran del historial.</p></section><section><h3>¿Qué ve Secretaría?</h3><p>Solo los datos y acciones concedidos. Diagnósticos, notas y documentos clínicos siguen protegidos.</p></section></div><div className="settings-actions">${TUTORIAL_URL?html`<a className="button button-secondary" href=${TUTORIAL_URL} target="_blank" rel="noreferrer"><${Icon} name="play" size=${18}/><span>Ver tutorial</span></a>`:html`<span className="field-note">El enlace del tutorial se habilitará al configurar VITE_TUTORIAL_URL.</span>`}${SUPPORT_WHATSAPP_NUMBER?html`<a className="button button-secondary" href=${`https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer"><${Icon} name="message" size=${18}/><span>Soporte por WhatsApp</span></a>`:null}<${Button} onClick=${this.closeModal}>Cerrar</${Button}></div></${Modal}>`;
  }

  renderMedicationArchiveModal() {
    const draft=this.state.modal.draft;
    return html`<${Modal} title="Eliminar medicamento" subtitle=${draft.medicationName} onClose=${this.closeModal} size="md"><form className="clinical-form" onSubmit=${this.saveMedicationArchive}>${this.renderModalError()}<div className="form-warning"><${Icon} name="alert" size=${18}/><span>El medicamento desaparecerá del tratamiento activo, pero se conservará en el historial clínico con autor, fecha y motivo.</span></div><${FormField} label="Motivo de eliminación" required=${true}><textarea autoFocus rows="4" minLength="3" value=${draft.reason} onChange=${event=>this.updateDraft('reason',event.target.value)} placeholder="Ej. registro duplicado o medicamento agregado por error" required></textarea></${FormField}><${FormActions} disabled=${this.state.formSaving} onCancel=${this.closeModal} submitLabel=${this.state.formSaving?'Eliminando…':'Eliminar medicamento'}/></form></${Modal}>`;
  }

  renderClinicalArchiveModal() {
    const { resource, draft } = this.state.modal;
    const signedConsultation = resource === 'consultation';
    const patientArchive = resource === 'patient';
    const titles = { adverseEvent: 'Eliminar efecto', lab: 'Eliminar resultado', vital: 'Eliminar control físico', assessment: 'Eliminar medición', document: 'Eliminar documento', consultation: 'Retirar consulta', patient: 'Archivar paciente' };
    return html`<${Modal} title=${titles[resource]||'Retirar registro'} subtitle=${draft.label} onClose=${this.closeModal} size="md"><form className="clinical-form" onSubmit=${this.saveClinicalArchive}>${this.renderModalError()}<div className="form-warning"><${Icon} name="alert" size=${18}/><span>${patientArchive?'El paciente dejará de aparecer entre los expedientes activos y sus citas futuras se cancelarán.':signedConsultation?'Si la nota está firmada, su contenido original permanecerá intacto y aparecerá como anulada en el historial.':'El registro desaparecerá de la vista activa, pero se conservará con autor, fecha y motivo.'}</span></div><${FormField} label="Motivo" required=${true}><textarea autoFocus rows="4" minLength="3" value=${draft.reason} onChange=${event=>this.updateDraft('reason',event.target.value)} placeholder="Ej. registro duplicado o información agregada por error" required></textarea></${FormField}><${FormActions} disabled=${this.state.formSaving} onCancel=${this.closeModal} submitLabel=${patientArchive?'Archivar paciente':'Eliminar y conservar historial'}/></form></${Modal}>`;
  }

  renderTutorialIntro() { return null; }

  renderGuidedTour() { return null; }

  renderAppointmentDetails() {
    const appointment = this.state.appointmentDetails;
    if (!appointment) return null;
    const patient = this.state.data.patients.find(item => item.id === appointment.patientId);
    const reminders = getReminderQueue(this.state.data).filter(item => item.appointment.id === appointment.id);
    const insurance = patient?.insurance || {};
    const canStart = this.can('consultationsManage') && patient?.vitalStatus !== 'deceased' && !['completed', 'cancelled', 'no_show'].includes(appointment.status);
    return html`<${Modal} title="Detalle de la cita" subtitle="Revise datos, recordatorios, calendarios y notas de preparación." onClose=${() => this.setState({ appointmentDetails: null })} size="xl"><div className="appointment-detail-hero"><${Avatar} patient=${patient} size="lg"/><div><span className="eyebrow">${appointment.type}</span><h3>${appointment.title}</h3><p>${this.can('clinicalView') ? patient?.diagnosis || '' : patient?.phone || 'Sin teléfono registrado'}</p></div><${Badge} tone=${appointment.status === 'confirmed' ? 'success' : appointment.status === 'pending' ? 'warning' : appointment.status === 'cancelled' || appointment.status === 'no_show' ? 'danger' : 'neutral'}>${statusLabel(appointment.status)}</${Badge}></div>
      <div className="appointment-info"><div><${Icon} name="calendar"/><span>Fecha</span><b>${formatLongDate(appointment.start)}</b></div><div><${Icon} name="clock"/><span>Hora</span><b>${formatTime(appointment.start)} – ${formatTime(appointment.end)}</b></div><div><${Icon} name="activity"/><span>Modalidad</span><b>${appointment.modality}</b></div><div><${Icon} name="insurance"/><span>Cobertura</span><b>${insurance.hasInsurance ? insurance.provider || 'Seguro médico' : 'Particular'}</b></div></div>
      ${insurance.hasInsurance && insurance.authorizationRequired ? html`<div className="appointment-insurance-warning"><${Icon} name="insurance" size=${18}/><div><b>Autorización de seguro requerida</b><p>${insurance.plan || 'Plan sin registrar'}${insurance.memberId ? ` · Afiliado ${insurance.memberId}` : ''}${insurance.copay ? ` · Copago ${insurance.copay}` : ''}</p></div></div>` : null}
      ${this.can('clinicalView')?html`<div className="notes-box"><span>Notas de preparación clínica</span><p>${appointment.notes || 'Sin notas.'}</p></div>`:null}
      ${canStart ? html`<section className="start-consultation-card"><span><${Icon} name="notebook" size=${24}/></span><div><b>¿Ya está con el paciente?</b><p>Abra la libreta virtual para tomar notas con guardado automático durante la consulta.</p></div><${Button} icon="play" onClick=${() => this.startConsultation(appointment)}>Iniciar consulta</${Button}></section>` : null}
      <section className="appointment-reminder-section"><header><div><span className="eyebrow">Confirmación de cita</span><h3>Recordatorios</h3></div><div>${reminders.map(reminder => html`<${Badge} key=${reminder.id} tone=${reminder.status === 'sent' ? 'success' : reminder.status === 'due' || reminder.status === 'overdue' ? 'warning' : 'neutral'}>${reminderLabel(reminder.hours)} · ${reminder.status === 'sent' ? 'Enviado' : reminder.status === 'due' ? 'Listo' : reminder.status === 'overdue' ? 'Pendiente' : 'Programado'}</${Badge}>`)}</div></header>${this.can('remindersManage') ? html`<div className="appointment-reminder-actions">${reminders.filter(reminder => reminder.status !== 'sent').slice(0, 3).map(reminder => html`<div key=${reminder.id}><span>${reminderLabel(reminder.hours)}</span>${(reminder.channels || patient?.notificationPreferences?.channels || ['whatsapp']).map(channel => html`<${Button} key=${channel} tone=${channel === 'whatsapp' ? 'soft' : 'secondary'} icon=${channel === 'email' ? 'mail' : 'message'} onClick=${() => this.sendReminderChannel(reminder, channel)}>${reminderChannelLabel(channel)}</${Button}>`)}<${Button} tone="secondary" onClick=${() => this.copyReminderMessage(reminder)}>Copiar</${Button}></div>`)}</div>` : null}</section>
      <section className="calendar-actions-card"><div><span className="eyebrow">Calendarios</span><h3>Conservar la cita en sus dispositivos</h3><p>Google Calendar puede sincronizarse. Apple Calendar puede importar esta cita o suscribirse al calendario privado de Linkare.</p></div><div>${this.state.calendarStatus?.google?.connected ? html`<${Button} tone="secondary" icon="calendar" onClick=${() => this.syncGoogleAppointment(appointment)}>Sincronizar con Google</${Button}>` : html`<a className="button button-secondary" href=${googleCalendarUrl(appointment)} target="_blank" rel="noreferrer"><${Icon} name="external" size=${18}/><span>Agregar a Google</span></a>`}${this.can('exportsManage') ? html`<${Button} tone="secondary" icon="download" onClick=${() => downloadICS(appointment)}>Agregar a Apple / ICS</${Button}>` : null}</div></section>
      <div className="appointment-actions-grid">${this.can('appointmentsManage') ? html`<${Button} tone="secondary" icon="edit" onClick=${() => this.openEditAppointment(appointment)}>Editar cita</${Button}>` : null}<${Button} tone="soft" onClick=${() => this.openPatient(appointment.patientId)}>Abrir paciente</${Button}></div>
      ${this.can('appointmentsManage') ? html`<div className="status-actions"><span>Cambiar estado:</span>${[['confirmed', 'Confirmada'], ['pending', 'Pendiente'], ['completed', 'Completada'], ['cancelled', 'Cancelada'], ['no_show', 'No asistió']].map(([key, label]) => html`<button key=${key} className=${appointment.status === key ? 'active' : ''} onClick=${() => this.updateAppointmentStatus(appointment.id, key)}>${label}</button>`)}</div><div className="status-actions"><span>Revisión administrativa:</span>${[['none','Sin marca'],['pending','Por revisar'],['reviewed','Revisada']].map(([key,label])=>html`<button key=${key} className=${(appointment.adminReviewStatus||'none')===key?'active':''} onClick=${()=>this.updateAppointmentReview(appointment.id,key)}>${label}</button>`)}</div><div className="danger-zone"><button onClick=${() => this.deleteAppointment(appointment.id)}><${Icon} name="trash" size=${17}/> Eliminar cita</button></div>` : null}
    </${Modal}>`;
  }

  render() {
    if(this.state.productionLoading)return this.renderLoading();
    if(!this.state.authenticatedUserId)return this.renderLogin();
    if(location.pathname!=='/' && location.pathname!=='/index.html')return this.renderStatePage('search','Página no encontrada','La dirección no corresponde a una sección de Linkare.',()=>{history.replaceState({},'','/');this.setView('dashboard');},'Ir al inicio');
    const v=this.state.view;const s=this.state.data.settings;let body;
    if(v==='notebook')body=this.renderConsultationNotebook();else if(v==='dashboard')body=this.renderDashboard();else if(v==='patients')body=this.renderPatients();else if(v==='patient')body=this.renderPatient();else if(v==='agenda')body=this.renderAgenda();else if(v==='payments')body=this.renderPayments();else if(v==='analytics')body=this.renderAnalytics();else if(v==='alerts')body=this.renderAlerts();else if(v==='settings')body=this.renderSettings();else body=this.renderStatePage('search','Sección no encontrada','Regrese al inicio para continuar.',()=>this.setView('dashboard'));
    return html`<div className=${`app-shell ${s.largeText?'large-text-mode':''} ${s.reducedMotion?'reduced-motion-mode':''}`}><div className="app-frame">${this.renderTopbar()}${this.renderSaveBanner()}<main className="main-content">${body}</main><footer><span>Linkare · Gestión clínica</span><span>${this.state.remoteSaveStatus==='saved'?'Cambios guardados':'Revise el estado de guardado'}</span></footer></div>${this.renderModal()}${this.renderAppointmentDetails()}${this.renderConsultationPrompt()}${this.state.toast?html`<div className=${`toast toast-${this.state.toastTone}`} role="status">${this.state.toast}</div>`:null}</div>`;
  }

  showReceipt = order => this.setState({modal:{type:'receipt',order}});

  renderSaveBanner() {
    const state=this.state.remoteSaveStatus;
    if(this.state.networkOffline)return html`<div className="sync-banner warning" role="status">Sin conexión. No cierre esta ventana si tiene anotaciones pendientes.</div>`;
    if(state==='error')return html`<div className="sync-banner error" role="alert"><span>${this.state.saveError||'No se pudo guardar.'}</span><button onClick=${()=>this.flushChanges().catch(()=>{})}>Reintentar</button></div>`;
    if(['dirty','saving'].includes(state))return html`<div className="sync-banner" role="status"><span className="mini-spinner"></span> Guardando cambios…</div>`;
    if(this.state.remoteReady&&this.state.complimentaryAccess)return html`<div className="sync-banner" role="status">Plan gratuito · Acceso completo habilitado</div>`;
    if(this.state.remoteReady&&!this.state.subscriptionWritable)return html`<div className="sync-banner warning" role="status"><span>El consultorio no tiene un periodo de pago vigente. Puede leer los registros existentes. Para guardar cambios, ${this.activeUser()?.role==='owner'?'elija un plan en Mi plan.':'solicite la renovación al médico.'}</span>${this.activeUser()?.role==='owner'?html`<button onClick=${()=>this.setView('payments')}>Ver planes</button>`:null}</div>`;
    return null;
  }

  renderLoading() {
    if(this.state.networkOffline)return this.renderStatePage('refresh','Sin conexión','Revise su conexión a internet e intente nuevamente.',()=>this.restoreProductionSession());
    return html`<main className="state-screen" aria-busy="true"><section className="state-card" role="status"><img className="state-brand" src="/assets/linkare-wordmark.png" alt="Linkare"/><span className="loading-ring"></span><h1>Preparando su consultorio</h1><p>Validando su sesión y cargando sus registros.</p><div className="skeleton-stack" aria-hidden="true"><i></i><i></i><i></i></div>${this.state.loadingSlow?html`<p>La conexión está tardando más de lo esperado.</p><${Button} tone="secondary" onClick=${()=>{this.authEpoch++;this.restoring=false;this.setState({productionLoading:false,loginError:'La carga no pudo completarse. Intente ingresar nuevamente.'});}}>Volver al acceso</${Button}>`:null}</section></main>`;
  }

  renderStatePage(icon,title,text,action=null,label='Reintentar') {
    return html`<main className="state-screen"><section className="state-card"><img className="state-brand" src="/assets/linkare-wordmark.png" alt="Linkare"/><span className="state-symbol"><${Icon} name=${icon} size=${38}/></span><h1>${title}</h1><p>${text}</p>${action?html`<${Button} onClick=${action}>${label}</${Button}>`:null}</section></main>`;
  }

  renderPasswordFlow() {
    const reset=this.state.authView==='set-password';const d=this.state.passwordDraft;
    return html`<div className="auth-form-stack"><h2>${reset?'Defina su contraseña':'Recuperar acceso'}</h2><p>${reset?'Use una contraseña personal de al menos 12 caracteres.':'Le enviaremos un enlace a su correo.'}</p>
      ${this.state.authNotice?html`<div className="auth-notice" role="status">${this.state.authNotice}</div>`:null}${this.state.loginError?html`<div className="login-error" role="alert">${this.state.loginError}</div>`:null}
      <form className="login-form" onSubmit=${this.submitPasswordFlow}>
        ${reset?html`<label><span>Nueva contraseña</span><div className="login-input"><input required type="password" minLength="12" autoComplete="new-password" value=${d.password} onChange=${e=>this.setState({passwordDraft:{...d,password:e.target.value}})}/></div></label><label><span>Confirmar contraseña</span><div className="login-input"><input required type="password" minLength="12" autoComplete="new-password" value=${d.confirmPassword} onChange=${e=>this.setState({passwordDraft:{...d,confirmPassword:e.target.value}})}/></div></label>`:html`<label><span>Correo</span><div className="login-input"><input required type="email" value=${this.state.loginDraft.email} onChange=${e=>this.updateLoginDraft('email',e.target.value)}/></div></label>`}
        <${Button} type="submit" disabled=${this.state.loginBusy}>${this.state.loginBusy?'Procesando…':reset?'Guardar contraseña y continuar':'Enviar enlace'}</${Button}>
      </form><button className="inline-auth-link" onClick=${()=>{history.replaceState({},'',location.pathname);this.showLogin();}}>Volver al acceso</button></div>`;
  }

  manageInvitation = async (invite,action) => {
    if(this.state.teamBusy)return;this.setState({teamBusy:true});
    try{await manageTeam(this.state.remoteOrganizationId,action,{inviteId:invite.id,email:invite.email,name:invite.display_name});await this.refreshTeam();this.notify(action==='resend'?'Invitación reenviada.':'Invitación revocada.');}
    catch(e){this.notify(readableError(e),'danger');}finally{this.setState({teamBusy:false});}
  };

  refreshTeam = async () => {
    if(!this.can('usersManage')||!this.state.remoteOrganizationId)return;
    const epoch=this.authEpoch;
    try{const r=await manageTeam(this.state.remoteOrganizationId,'list');if(epoch!==this.authEpoch)return;this.setState(prev=>({data:{...prev.data,users:r.users},teamInvites:r.invitations||[]}));}
    catch(e){this.notify(readableError(e),'danger');}
  };

  resendEmail = async () => {
    if(this.state.loginBusy)return;this.setState({loginBusy:true});
    try{await resendConfirmation(this.state.loginDraft.email);this.setState({authNotice:'Revise el correo y su carpeta de no deseados.',loginBusy:false});}
    catch(e){this.setState({loginError:readableError(e),loginBusy:false});}
  };

  submitPasswordFlow = async event => {
    event.preventDefault();if(this.state.loginBusy)return;
    this.setState({loginBusy:true,loginError:'',authNotice:''});
    try{
      if(this.state.authView==='forgot'){
        await requestPasswordReset(this.state.loginDraft.email);
        this.setState({loginBusy:false,authNotice:'Si el correo tiene cuenta, recibirá un enlace para establecer una nueva contraseña.'});return;
      }
      const d=this.state.passwordDraft;if(d.password!==d.confirmPassword)throw new Error('Las contraseñas no coinciden.');
      await setAccountPassword(d.password);
      const session=await getProductionSession();
      history.replaceState({},'',location.pathname);
      this.setState({passwordDraft:{password:'',confirmPassword:''}});
      await this.applyProductionSession(session);
    }catch(error){this.setState({loginBusy:false,loginError:readableError(error)});}
  };

  clearSessionView = () => {
    this.authEpoch++;this.savingForm=false;this.persistedData=null;clearTimeout(this.persistTimer);clearTimeout(this.encounterSaveIndicatorTimer);clearTimeout(this.toastTimer);clearInterval(this.encounterTimer);resetPersistence();
    this.setState({data:createEmptyData(),authenticatedUserId:null,remoteOrganizationId:null,remoteReady:false,subscriptionWritable:false,complimentaryAccess:false,remoteSaveStatus:'waiting',
      formSaving:false,modal:null,appointmentDetails:null,activeEncounter:null,appointmentPrompt:null,productionLoading:false,authView:'login',view:'dashboard',
      teamInvites:[],teamBusy:false,documentBusy:false,integrationBusy:false,wompiBusy:false,billingLoading:false,billingError:'',saveError:'',modalError:'',toast:null,search:'',selectedPatientId:null,promptDismissedFor:null,passwordDraft:{password:'',confirmPassword:''},registerDraft:{fullName:'',clinicName:'',email:'',password:'',confirmPassword:'',showPassword:false},calendarStatus:{google:{connected:false},apple:{connected:false,feedUrl:''}},reminderProviders:{email:false,sms:false,whatsapp:false},wompiStatus:{state:'idle',app:null,error:''},billingData:{plans:[],subscription:null,orders:[]},loginDraft:{email:'',password:'',showPassword:false}});
  };

  flushChanges = async () => {
    clearTimeout(this.persistTimer);
    if(!this.state.remoteReady || !this.state.remoteOrganizationId)return;
    if(!navigator.onLine){this.setState({remoteSaveStatus:'offline'});throw new Error('Sin conexión. Mantenga esta ventana abierta.');}
    const org=this.state.remoteOrganizationId;const snapshot=this.state.data;const epoch=this.authEpoch;
    this.setState({remoteSaveStatus:'saving',saveError:''});
    try{
      await saveProductionState(org,snapshot);
      if(epoch===this.authEpoch && this.mounted)this.setState({remoteSaveStatus:snapshot===this.state.data?'saved':'dirty',encounterAutosaveStatus:'saved'});
    }catch(error){if(epoch===this.authEpoch && this.mounted)this.setState({remoteSaveStatus:'error',encounterAutosaveStatus:'error',saveError:readableError(error)});throw error;}
  };

  warnUnsaved = event => {if(['dirty','saving','error','offline'].includes(this.state.remoteSaveStatus)){event.preventDefault();event.returnValue='';}};

  handleOffline = () => {this.setState({networkOffline:true});};

  handleOnline = () => {this.setState({networkOffline:false});if(this.state.remoteSaveStatus==='offline')this.flushChanges().catch(()=>{});};
}

export { App };

createRoot(document.getElementById('root')).render(html`<${AppErrorBoundary}><${App}/></${AppErrorBoundary}>`);

