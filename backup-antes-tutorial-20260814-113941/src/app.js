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
  validateImportedData,
  vitalsFormDefaults,
} from './clinical.js';

const html = htm.bind(React.createElement);
const STORAGE_KEY = 'nexamind-clinical-demo-v2';
const LEGACY_STORAGE_KEY = 'nexamind-clinical-demo-v1';

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
};

function Icon({ name, size = 18, className = '' }) {
  return html`<svg className=${`icon ${className}`} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: iconPaths[name] || iconPaths.activity }}></svg>`;
}

function Logo() {
  return html`<div className="brand"><div className="brand-mark"><span></span><span></span><span></span></div><div><strong>NEXAMIND</strong><small>Seguimiento clínico</small></div></div>`;
}

function Avatar({ patient, size = 'md' }) {
  return html`<div className=${`avatar avatar-${size}`} title=${patient?.name || ''}>${patient?.initials || 'NM'}</div>`;
}

function Badge({ tone = 'neutral', children, dot = false }) {
  return html`<span className=${`badge badge-${tone}`}>${dot ? html`<i></i>` : null}${children}</span>`;
}

function Button({ tone = 'primary', icon, children, onClick, className = '', type = 'button', disabled = false, title = '' }) {
  return html`<button type=${type} title=${title} className=${`button button-${tone} ${className}`} onClick=${onClick} disabled=${disabled}>${icon ? html`<${Icon} name=${icon} size=${18}/>` : null}<span>${children}</span></button>`;
}

function Card({ children, className = '', title, subtitle, action }) {
  return html`<section className=${`card ${className}`}>
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

function KpiCard({ label, value, hint, icon, tone = 'purple', chart }) {
  return html`<${Card} className=${`kpi-card kpi-${tone}`}><div className="kpi-top"><span>${label}</span><span className="kpi-icon"><${Icon} name=${icon} size=${19}/></span></div><div className="kpi-body"><div><strong>${value}</strong><small>${hint}</small></div>${chart || null}</div></${Card}>`;
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

class App extends React.Component {
  constructor(props) {
    super(props);
    let data;
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      data = stored ? normalizeData(JSON.parse(stored)) : createSeedData();
    } catch (_) {
      data = createSeedData();
    }
    this.state = {
      data,
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
    };
  }

  componentDidMount() {
    this.schedulePersist();
    window.addEventListener('keydown', this.handleKeyDown);
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.handleKeyDown);
    document.body.style.overflow = '';
    clearTimeout(this.persistTimer);
    clearTimeout(this.toastTimer);
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.data !== this.state.data) this.schedulePersist();
    const hadOverlay = Boolean(prevState.modal || prevState.appointmentDetails);
    const hasOverlay = Boolean(this.state.modal || this.state.appointmentDetails);
    if (hadOverlay !== hasOverlay) document.body.style.overflow = hasOverlay ? 'hidden' : '';
  }

  handleKeyDown = event => {
    if (event.key !== 'Escape') return;
    if (this.state.modal) this.closeModal();
    else if (this.state.appointmentDetails) this.setState({ appointmentDetails: null });
  };

  schedulePersist = () => {
    clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state.data)); } catch (_) { /* Browser storage can be unavailable. */ }
    }, 180);
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

  openPatient = patientId => {
    this.setState({ selectedPatientId: patientId, view: 'patient', patientTab: 'overview', chartMode: 'scales', timelineFilter: 'all', mobileNav: false, appointmentDetails: null });
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  };

  closeModal = () => this.setState({ modal: null, modalError: '' });

  updateDraft = (key, value) => {
    this.setState(prev => ({ modal: prev.modal ? { ...prev.modal, draft: { ...prev.modal.draft, [key]: value } } : null, modalError: '' }));
  };

  openNewPatient = () => this.setState({ modal: { type: 'patient', draft: patientFormDefaults() }, modalError: '' });

  openMedication = patient => this.setState({ modal: { type: 'medication', patientId: patient.id, draft: medicationFormDefaults(patient) }, modalError: '' });

  openDose = (patient, medicationId = null) => this.setState({ modal: { type: 'dose', patientId: patient.id, draft: doseFormDefaults(patient, medicationId) }, modalError: '' });

  openMedicationStatus = (patient, medication, status) => this.setState({
    modal: {
      type: 'medicationStatus',
      patientId: patient.id,
      draft: { medicationId: medication.id, medicationName: medication.name, currentStatus: medication.status, status, reason: '' },
    },
    modalError: '',
  });

  openAssessment = patient => this.setState({ modal: { type: 'assessment', patientId: patient.id, draft: assessmentFormDefaults(patient) }, modalError: '' });

  openVitals = patient => this.setState({ modal: { type: 'vitals', patientId: patient.id, draft: vitalsFormDefaults(patient) }, modalError: '' });

  openAdverse = patient => this.setState({ modal: { type: 'adverse', patientId: patient.id, draft: adverseFormDefaults(patient) }, modalError: '' });

  openLab = patient => this.setState({ modal: { type: 'lab', patientId: patient.id, draft: labFormDefaults(patient) }, modalError: '' });

  openReport = patient => this.setState({ modal: { type: 'report', patientId: patient.id, draft: {} }, modalError: '' });

  openHelp = () => this.setState({ modal: { type: 'help', draft: {} }, modalError: '' });

  openNewAppointment = (date = new Date(), patientId = null) => {
    this.setState({ modal: { type: 'appointment', draft: appointmentFormDefaults(this.state.data, date, null, patientId) }, modalError: '' });
  };

  openEditAppointment = appointment => {
    this.setState({ appointmentDetails: null, modal: { type: 'appointment', draft: appointmentFormDefaults(this.state.data, new Date(appointment.start), appointment) }, modalError: '' });
  };

  handleFormError = error => this.setState({ modalError: error instanceof Error ? error.message : 'No fue posible guardar el registro.' });

  savePatientForm = event => {
    event.preventDefault();
    try {
      const result = createPatient(this.state.data, this.state.modal.draft);
      this.setState({ data: result.data, selectedPatientId: result.patientId, view: 'patient', patientTab: 'overview', modal: null, modalError: '' }, () => this.notify('Paciente registrado correctamente.'));
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

  updateAppointmentStatus = (appointmentId, status) => {
    const next = changeAppointmentStatus(this.state.data, appointmentId, status);
    this.setState(prev => ({
      data: next,
      appointmentDetails: prev.appointmentDetails?.id === appointmentId ? { ...prev.appointmentDetails, status } : prev.appointmentDetails,
    }), () => this.notify(`Cita marcada como ${statusLabel(status).toLowerCase()}.`));
  };

  deleteAppointment = appointmentId => {
    if (!window.confirm('¿Eliminar esta cita? Esta acción no modifica el expediente clínico.')) return;
    this.setState({ data: removeAppointment(this.state.data, appointmentId), appointmentDetails: null }, () => this.notify('Cita eliminada.'));
  };

  acknowledgeAlert = alertId => this.setState({ data: updateAlertStatus(this.state.data, alertId, 'acknowledged') }, () => this.notify('Alerta marcada como revisada.'));

  reopenAlert = alertId => this.setState({ data: updateAlertStatus(this.state.data, alertId, 'open') }, () => this.notify('Alerta reabierta.'));

  changeMedicationStatus = (patient, medication, status) => this.openMedicationStatus(patient, medication, status);

  updateAdverseStatus = (patientId, eventId, status) => {
    const result = setAdverseEventStatus(this.state.data, patientId, eventId, status);
    this.setState({ data: result.data }, () => this.notify(status === 'resolved' ? 'Efecto marcado como resuelto.' : 'Efecto reabierto.'));
  };

  exportAnalytics = () => {
    downloadCSV('nexamind-resultados.csv', analyticsRows(this.state.data));
    this.notify('Resultados exportados en CSV.');
  };

  exportBackup = () => {
    downloadJSON(`nexamind-respaldo-${new Date().toISOString().slice(0, 10)}.json`, this.state.data);
    this.notify('Respaldo descargado.');
  };

  importBackup = async event => {
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
    if (!window.confirm('¿Restaurar los datos de demostración? Se reemplazarán los cambios guardados en este navegador.')) return;
    const data = createSeedData();
    this.setState({ data, selectedPatientId: data.patients[0]?.id || null, view: 'dashboard', modal: null }, () => this.notify('Datos de demostración restaurados.'));
  };

  printReport = () => window.print();

  renderTopbar() {
    const nav = [
      ['dashboard', 'overview', 'Inicio'],
      ['patients', 'patients', 'Pacientes'],
      ['agenda', 'calendar', 'Agenda'],
      ['analytics', 'analytics', 'Resultados'],
      ['alerts', 'alert', 'Alertas'],
    ];
    const active = this.state.view === 'patient' ? 'patients' : this.state.view;
    const openAlerts = this.state.data.alerts.filter(item => item.status === 'open').length;
    return html`<header className="topbar">
      <${Logo}/>
      <nav className=${`nav-pill ${this.state.mobileNav ? 'nav-open' : ''}`} aria-label="Navegación principal">
        ${nav.map(([key, icon, label]) => html`<button key=${key} className=${active === key ? 'active' : ''} onClick=${() => this.setView(key)}><${Icon} name=${icon} size=${17}/><span>${label}</span>${key === 'alerts' && openAlerts ? html`<b>${openAlerts}</b>` : null}</button>`)}
      </nav>
      <div className="top-actions">
        <button className="help-button" onClick=${this.openHelp}><${Icon} name="help" size=${17}/><span>Ayuda</span></button>
        <button className="icon-button notification-button" aria-label="Ver alertas" onClick=${() => this.setView('alerts')}><${Icon} name="alert"/>${openAlerts ? html`<i></i>` : null}</button>
        <button className="icon-button" aria-label="Configuración" onClick=${() => this.setView('settings')}><${Icon} name="settings"/></button>
        <div className="profile-chip"><div className="avatar avatar-sm">AS</div><div><b>Dra. Salazar</b><small>Psiquiatra</small></div></div>
        <button className="mobile-menu icon-button" aria-label="Abrir menú" onClick=${() => this.setState({ mobileNav: !this.state.mobileNav })}><${Icon} name="menu"/></button>
      </div>
    </header>`;
  }

  renderDashboard() {
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
        title=${`${greeting()}, Dra. Salazar`}
        subtitle="Aquí encontrará pacientes que requieren atención, citas del día y cambios clínicos importantes."
        actions=${html`<${Button} tone="secondary" icon="userPlus" onClick=${this.openNewPatient}>Nuevo paciente</${Button}><${Button} icon="plus" onClick=${() => this.openNewAppointment()}>Nueva cita</${Button}>`}
      />
      <div className="simple-help"><${Icon} name="help" size=${18}/><p><b>Empiece por “Requieren revisión”.</b> El sistema ordena señales de evolución, adherencia, efectos y controles. La decisión final siempre corresponde al psiquiatra.</p></div>
      <div className="kpi-grid">
        <${KpiCard} label="Pacientes activos" value=${patients.length} hint="con expediente en seguimiento" icon="patients" tone="purple" chart=${html`<${Sparkline} values=${[Math.max(1, patients.length - 3), patients.length - 2, patients.length - 2, patients.length - 1, patients.length]} />`}/>
        <${KpiCard} label="Requieren revisión" value=${needReview} hint="ordenados por prioridad clínica" icon="alert" tone="coral" chart=${html`<div className="mini-stack"><span style=${{ height: '35%' }}></span><span style=${{ height: '48%' }}></span><span style=${{ height: '60%' }}></span><span style=${{ height: '52%' }}></span><span style=${{ height: '78%' }}></span></div>`}/>
        <${KpiCard} label="Con mejoría importante" value=${percent(responseRate)} hint="cambio favorable ≥50% en su escala principal" icon="trend" tone="teal" chart=${html`<${Sparkline} values=${[42, 48, 51, 56, responseRate]} tone="teal"/>`}/>
        <${KpiCard} label="Citas esta semana" value=${weekAppointments.length} hint=${`${todayAppointments.length} programadas hoy`} icon="calendar" tone="blue" chart=${html`<${Sparkline} values=${[2, 1, 3, 2, weekAppointments.length]} tone="blue"/>`}/>
      </div>

      <div className="dashboard-grid">
        <${Card} className="span-8" title="Evolución general de los pacientes" subtitle="Promedio relativo de la escala principal. 100 representa el valor inicial." action=${html`<${Badge} tone="success" dot=${true}>Mejoría media ${percent(meanImprovement)}</${Badge}>`}>
          <div className="chart-summary"><div><strong>${percent(meanImprovement)}</strong><span>mejoría media observada</span></div><div><b>${percent(avgAdherence)}</b><span>adherencia media</span></div><div><b>${patients.filter(patient => patient.adverseEvents.some(event => event.status === 'active')).length}</b><span>con efecto activo</span></div></div>
          <${LineChart} series=${[{ label: 'Síntomas relativos', points: symptomPoints }]}/>
          <div className="clinical-footnote"><${Icon} name="shield" size=${17}/> Muestra cambios registrados durante el tratamiento. No demuestra que un medicamento sea la causa del cambio.</div>
        </${Card}>
        <${Card} className="span-4 agenda-preview" title="Agenda de hoy" action=${html`<button className="text-button" onClick=${() => this.setView('agenda')}>Abrir agenda <${Icon} name="chevronRight" size=${16}/></button>`}>
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
        <${Card} className="span-8" title="Pacientes que conviene revisar primero" action=${html`<button className="text-button" onClick=${() => this.setView('patients')}>Ver todos <${Icon} name="chevronRight" size=${16}/></button>`}>
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
    const { patients, alerts } = this.state.data;
    const query = this.state.search.trim().toLowerCase();
    const filtered = patients.filter(patient => {
      const matchesSearch = !query || [patient.name, patient.diagnosis, patient.medication?.name, patient.diagnosisCode].join(' ').toLowerCase().includes(query);
      if (!matchesSearch) return false;
      if (this.state.patientFilter === 'active') return patient.status !== 'inactive';
      if (this.state.patientFilter === 'review') return getPatientPriority(patient, alerts).score >= 2;
      return true;
    });
    return html`<div className="view-enter">
      <${PageHeader}
        eyebrow="Expedientes"
        title="Pacientes"
        subtitle="Busque un paciente o cree un expediente nuevo. Las tarjetas muestran solamente la información más útil para decidir dónde entrar."
        actions=${html`<div className="search-box"><${Icon} name="search"/><input value=${this.state.search} onChange=${event => this.setState({ search: event.target.value })} placeholder="Buscar por nombre, diagnóstico o medicamento"/></div><${Button} icon="userPlus" onClick=${this.openNewPatient}>Nuevo paciente</${Button}>`}
      />
      <div className="patients-toolbar"><div><${Badge} tone="purple">${filtered.length} pacientes</${Badge}><${Badge} tone="warning">${patients.filter(patient => getPatientPriority(patient, alerts).score >= 2).length} por revisar</${Badge}></div><div className="segmented" aria-label="Filtrar pacientes">${[['all', 'Todos'], ['active', 'Activos'], ['review', 'Por revisar']].map(([key, label]) => html`<button key=${key} className=${this.state.patientFilter === key ? 'active' : ''} onClick=${() => this.setState({ patientFilter: key })}>${label}</button>`)}</div></div>
      ${filtered.length ? html`<div className="patient-grid">${filtered.map(patient => {
        const summary = getAssessmentSummary(patient);
        const priority = getPatientPriority(patient, alerts);
        return html`<button key=${patient.id} className="patient-card" onClick=${() => this.openPatient(patient.id)}><div className="patient-card-top"><div className="patient-identity"><${Avatar} patient=${patient} size="lg"/><div><h3>${patient.name}</h3><span>${patient.age} años · ${patient.diagnosisCode}</span></div></div><${Badge} tone=${priority.tone} dot=${true}>${priority.label}</${Badge}></div><p>${patient.diagnosis}</p><div className="patient-metrics"><div><span>Medicamento principal</span><b>${patient.medication?.name || 'Sin medicamento'}</b><small>${patient.medication?.dose || 'Agregue el tratamiento'}</small></div><div><span>${summary?.primary.code || 'Escala'}</span><b>${summary?.current ?? '—'}</b><small>${summary ? `Inicial ${summary.baseline}` : 'Sin medición'}</small></div><div><span>Mejoría observada</span><b className=${summary?.improvement >= 25 ? 'good-text' : ''}>${summary ? percent(summary.improvement) : '—'}</b><small>${summary?.label || 'Registrar evolución'}</small></div></div><div className="patient-card-footer"><div><${Icon} name="calendar" size=${16}/><span>${patient.nextVisit ? `${relativeDate(patient.nextVisit)} · ${formatTime(patient.nextVisit)}` : 'Sin próxima cita'}</span></div><span>Abrir expediente <${Icon} name="chevronRight" size=${16}/></span></div></button>`;
      })}</div>` : html`<${EmptyState} icon="search" title="No encontramos pacientes" text="Cambie el filtro o cree un expediente nuevo." action=${html`<${Button} icon="userPlus" onClick=${this.openNewPatient}>Nuevo paciente</${Button}>`}/>`}
    </div>`;
  }

  renderPatient() {
    const { patients, alerts, appointments } = this.state.data;
    const patient = patients.find(item => item.id === this.state.selectedPatientId) || patients[0];
    if (!patient) return html`<${EmptyState} icon="patients" title="Sin pacientes" text="Cree el primer expediente para comenzar." action=${html`<${Button} icon="userPlus" onClick=${this.openNewPatient}>Nuevo paciente</${Button}>`}/>`;
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
      <div className="patient-hero">
        <button className="back-button" aria-label="Volver a pacientes" onClick=${() => this.setView('patients')}><${Icon} name="chevronLeft"/></button>
        <${Avatar} patient=${patient} size="xl"/>
        <div className="patient-hero-main"><span className="eyebrow">Expediente del paciente · Datos sintéticos</span><h1>${patient.name}</h1><p>${patient.age} años · ${patient.diagnosis} · ${patient.diagnosisCode}</p><div className="hero-badges"><${Badge} tone=${priority.tone} dot=${true}>${priority.label}</${Badge}><${Badge} tone="neutral">Riesgo ${riskLabel(patient.risk).toLowerCase()}</${Badge}>${primaryMedication?.name && primaryMedication.name !== 'Sin medicamento' ? html`<${Badge} tone="purple">${primaryMedication.name} ${primaryMedication.dose}</${Badge}>` : html`<${Badge} tone="warning">Sin medicamento principal</${Badge}>`}</div></div>
        <div className="patient-hero-actions"><div><span>Próxima cita</span><b>${patient.nextVisit ? relativeDate(patient.nextVisit) : 'Sin agendar'}</b><small>${patient.nextVisit ? formatDateTime(patient.nextVisit) : 'Cree una cita desde el botón'}</small></div><${Button} icon="calendar" onClick=${() => this.openNewAppointment(patient.nextVisit ? new Date(patient.nextVisit) : new Date(), patient.id)}>Agendar</${Button}></div>
      </div>

      <div className="patient-action-bar" aria-label="Acciones rápidas del paciente">
        <div><b>Acciones frecuentes</b><small>Registre lo ocurrido durante o después de la consulta.</small></div>
        <${Button} icon="analytics" onClick=${() => this.openAssessment(patient)}>Registrar evolución</${Button}>
        <${Button} tone="secondary" icon="medication" onClick=${() => this.openMedication(patient)}>Agregar medicamento</${Button}>
        <${Button} tone="secondary" icon="edit" disabled=${!patient.medications.some(item => item.status === 'active')} onClick=${() => this.openDose(patient)}>Cambiar dosis</${Button}>
        <${Button} tone="secondary" icon="activity" onClick=${() => this.openVitals(patient)}>Control físico</${Button}>
      </div>

      <div className="patient-tabs" role="tablist">${tabs.map(([key, label]) => html`<button key=${key} role="tab" className=${this.state.patientTab === key ? 'active' : ''} onClick=${() => this.setState({ patientTab: key })}>${label}${key === 'safety' && patientAlerts.length ? html`<b>${patientAlerts.length}</b>` : null}</button>`)}</div>

      ${this.state.patientTab === 'overview' ? html`<div>
        <div className="patient-kpis">
          <${Card} className="patient-kpi"><span>Mejoría en síntomas</span><strong className=${summary?.improvement >= 0 ? 'good-text' : 'danger-text'}>${summary ? percent(summary.improvement) : '—'}</strong><small>${summary ? `${summary.primary.code}: ${summary.baseline} → ${summary.current}` : 'Registre una escala para calcular el cambio'}</small><div className="meter"><i style=${{ width: `${Math.min(100, Math.max(0, summary?.improvement || 0))}%` }}></i></div></${Card}>
          <${Card} className="patient-kpi"><span>Funcionamiento diario</span><strong className=${patient.functioningChange >= 0 ? 'good-text' : 'danger-text'}>${patient.functioningChange >= 0 ? '+' : ''}${patient.functioningChange || 0}%</strong><small>Cambio reportado desde el valor inicial</small><${Sparkline} values=${[0, Math.round((patient.functioningChange || 0) * .2), Math.round((patient.functioningChange || 0) * .45), Math.round((patient.functioningChange || 0) * .7), patient.functioningChange || 0]} tone="teal"/></${Card}>
          <${Card} className="patient-kpi"><span>Adherencia al tratamiento</span><strong>${patient.adherence}%</strong><small>Estimación de cuánto cumple la indicación</small><div className="meter purple"><i style=${{ width: `${Math.max(0, Math.min(100, patient.adherence))}%` }}></i></div></${Card}>
          <${Card} className="patient-kpi"><span>Efectos y seguridad</span><strong>${activeAdverse.length}</strong><small>efectos observados activos</small><${Badge} tone=${patientAlerts.length ? 'warning' : 'success'} dot=${true}>${patientAlerts.length ? `${patientAlerts.length} pendiente(s)` : 'Sin alertas abiertas'}</${Badge}></${Card}>
        </div>

        <div className="dashboard-grid">
          <${Card} className="span-8" title="Cómo ha cambiado el paciente" subtitle="Compare mediciones clínicas o cambios de dosis a lo largo del tiempo." action=${html`<div className="segmented small"><button className=${this.state.chartMode === 'scales' ? 'active' : ''} onClick=${() => this.setState({ chartMode: 'scales' })}>Síntomas</button><button className=${this.state.chartMode === 'dose' ? 'active' : ''} onClick=${() => this.setState({ chartMode: 'dose' })}>Dosis</button></div>`}>
            ${this.state.chartMode === 'scales' ? html`<div><div className="chart-summary patient-chart-summary"><div><span>Puntaje inicial</span><strong>${summary?.baseline ?? '—'}</strong></div><div><span>Puntaje actual</span><strong>${summary?.current ?? '—'}</strong></div><div><span>Cambio</span><strong>${summary ? summary.absoluteChange : '—'}</strong></div><div><span>Lectura</span><b>${summary?.label || 'Sin suficientes datos'}</b></div></div><${LineChart} series=${patient.assessments.slice(0, 3).map(item => ({ label: item.code, points: item.points }))}/></div>` : html`<div><div className="chart-summary patient-chart-summary"><div><span>Medicamento</span><strong>${primaryMedication?.name || '—'}</strong></div><div><span>Dosis inicial</span><strong>${primaryMedication?.doseHistory?.[0]?.dose || '—'}</strong></div><div><span>Dosis actual</span><strong>${primaryMedication?.dose || '—'}</strong></div><div><span>Días con tratamiento</span><b>${exposureDays}</b></div></div><${LineChart} series=${doseSeries}/></div>`}
            <div className="clinical-footnote"><${Icon} name="shield" size=${17}/> La gráfica ayuda a ver coincidencias temporales. Por sí sola no confirma que el medicamento produjo la mejoría o el efecto.</div>
          </${Card}>

          <${Card} className="span-4 treatment-analysis" title="Resumen del tratamiento">
            <div className="treatment-name"><span className="medication-icon"><${Icon} name="medication"/></span><div><h3>${primaryMedication?.name || 'Sin medicamento'}</h3><p>${primaryMedication?.dose || '—'} · ${primaryMedication?.frequency || 'Sin frecuencia'}</p></div></div>
            <dl><div><dt>Días con tratamiento</dt><dd>${exposureDays}</dd></div><div><dt>Motivo del medicamento</dt><dd>${primaryMedication?.indication || 'Sin registrar'}</dd></div><div><dt>Adherencia</dt><dd>${patient.adherence}%</dd></div><div><dt>Efectos activos</dt><dd>${activeAdverse.length}</dd></div></dl>
            <div className=${`analysis-conclusion ${patientAlerts.length ? 'attention' : ''}`}><${Icon} name=${patientAlerts.length ? 'alert' : 'shield'} size=${21}/><div><b>${clinicalLabel(patient.status)}</b><p>${patientAlerts.length ? 'Hay información que conviene revisar antes de tomar una decisión terapéutica.' : 'Los datos muestran una evolución estable o favorable durante el periodo registrado.'}</p></div></div>
            <button className="text-button full" onClick=${() => this.openReport(patient)}>Abrir resumen imprimible <${Icon} name="chevronRight" size=${16}/></button>
          </${Card}>
        </div>

        <div className="dashboard-grid lower-grid">
          <${Card} className="span-7" title="Sueño, peso y estado diario">
            <div className="wellbeing-grid"><div><span>Sueño inicial</span><b>${patient.sleepBaseline ?? '—'}${patient.sleepBaseline !== null ? ' h' : ''}</b></div><div><span>Sueño actual</span><b>${patient.sleepCurrent ?? '—'}${patient.sleepCurrent !== null ? ' h' : ''}</b></div><div><span>Peso</span><b>${patient.vitals?.weight ?? '—'}${patient.vitals?.weight ? ' kg' : ''}</b><small>${weightChange === null ? 'Sin comparación inicial' : `${weightChange >= 0 ? '+' : ''}${weightChange.toFixed(1)}% desde el valor inicial`}</small></div><div><span>Presión y pulso</span><b>${patient.vitals?.bp || '—'}</b><small>${patient.vitals?.pulse ? `Pulso ${patient.vitals.pulse} bpm` : 'Sin pulso registrado'}</small></div></div>
            <div className="mini-insight"><${Icon} name="activity"/><p>Estos datos ayudan a distinguir entre <b>mejoría de síntomas</b>, funcionamiento y posibles efectos físicos del tratamiento.</p></div>
          </${Card}>
          <${Card} className="span-5" title="Qué revisar después" action=${html`<${Badge} tone=${patientAlerts.length ? 'warning' : 'success'}>${patientAlerts.length ? `${patientAlerts.length} pendiente(s)` : 'Al día'}</${Badge}>`}>
            <div className="task-list">${patientAlerts.slice(0, 3).map(alert => html`<div key=${alert.id} className="task-row"><span className=${`task-icon task-${alert.severity}`}><${Icon} name="alert" size=${17}/></span><div><b>${alert.title}</b><small>${alert.detail}</small></div><button aria-label="Marcar alerta revisada" onClick=${() => this.acknowledgeAlert(alert.id)}><${Icon} name="check" size=${17}/></button></div>`)}<div className="task-row"><span className="task-icon task-low"><${Icon} name="calendar" size=${17}/></span><div><b>Próxima consulta</b><small>${patient.nextVisit ? formatDateTime(patient.nextVisit) : 'No programada'}</small></div><button aria-label="Agendar cita" onClick=${() => this.openNewAppointment(patient.nextVisit ? new Date(patient.nextVisit) : new Date(), patient.id)}><${Icon} name="chevronRight" size=${17}/></button></div></div>
          </${Card}>
        </div>
      </div>` : null}

      ${this.state.patientTab === 'medications' ? html`<div className="dashboard-grid">
        <${Card} className="span-12" title="Medicamentos del paciente" subtitle="Agregue tratamientos, registre cambios de dosis o marque un medicamento como pausado o finalizado." action=${html`<${Button} icon="plus" onClick=${() => this.openMedication(patient)}>Agregar medicamento</${Button}>`}>
          ${patient.medications.length ? html`<div className="medication-list">${patient.medications.map(medication => html`<article key=${medication.id} className=${`medication-card ${medication.status !== 'active' ? 'medication-inactive' : ''}`}><div className="medication-card-head"><div className="inline-title"><span className="medication-icon"><${Icon} name="medication"/></span><div><span className="eyebrow">${medication.class}</span><h3>${medication.name}</h3><p>${medication.indication}</p></div></div><div>${medication.isPrimary ? html`<${Badge} tone="purple">Principal</${Badge}>` : null}<${Badge} tone=${medication.status === 'active' ? 'success' : medication.status === 'held' ? 'warning' : 'neutral'} dot=${true}>${medication.status === 'active' ? 'Activo' : medication.status === 'held' ? 'En pausa' : 'Finalizado'}</${Badge}></div></div><div className="medication-main-dose"><span>Dosis actual</span><strong>${medication.dose}</strong><small>${medication.frequency} · vía ${medication.route}</small></div><div className="medication-info-grid"><div><span>Inicio</span><b>${formatDate(medication.startDate)}</b></div><div><span>Días registrados</span><b>${daysBetween(medication.startDate)}</b></div><div><span>Uso según necesidad</span><b>${medication.isPrn ? 'Sí' : 'No'}</b></div><div><span>Cambios de dosis</span><b>${medication.doseHistory?.length || 0}</b></div></div><div className="dose-history-mini"><span>Historial de dosis</span><div>${[...(medication.doseHistory || [])].sort((left, right) => new Date(left.date) - new Date(right.date)).map(item => html`<div key=${item.id}><time>${formatDate(item.date)}</time><b>${item.dose}</b><small>${item.reason}</small></div>`)}</div></div><div className="medication-actions">${medication.status === 'active' ? html`<${Button} tone="secondary" icon="edit" onClick=${() => this.openDose(patient, medication.id)}>Cambiar dosis</${Button}><${Button} tone="soft" onClick=${() => this.changeMedicationStatus(patient, medication, 'held')}>Pausar</${Button}><${Button} tone="secondary" onClick=${() => this.changeMedicationStatus(patient, medication, 'stopped')}>Finalizar</${Button}>` : medication.status === 'held' ? html`<${Button} tone="secondary" icon="refresh" onClick=${() => this.changeMedicationStatus(patient, medication, 'active')}>Reactivar</${Button}><${Button} tone="secondary" onClick=${() => this.changeMedicationStatus(patient, medication, 'stopped')}>Finalizar</${Button}>` : null}</div></article>`)}</div>` : html`<${EmptyState} icon="medication" title="Sin medicamentos registrados" text="Agregue el primer medicamento para comenzar a relacionar dosis, evolución y controles." action=${html`<${Button} icon="plus" onClick=${() => this.openMedication(patient)}>Agregar medicamento</${Button}>`}/>`}
        </${Card}>
        <${Card} className="span-7" title="Cambio de dosis del medicamento principal" subtitle="Cada cambio conserva la dosis anterior, la fecha y el motivo."><${LineChart} series=${doseSeries}/></${Card}>
        <${Card} className="span-5" title="Cómo leer esta sección"><div className="glossary compact"><div><b>Dosis actual</b><p>La cantidad que el paciente tiene indicada en este momento.</p></div><div><b>Historial de dosis</b><p>Permite ver cuándo se inició, aumentó, redujo, pausó o finalizó un tratamiento.</p></div><div><b>Medicamento principal</b><p>Es el tratamiento que el dashboard usa como referencia visual principal. Puede haber otros medicamentos activos.</p></div></div></${Card}>
      </div>` : null}

      ${this.state.patientTab === 'followup' ? html`<div className="dashboard-grid">
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

      ${this.state.patientTab === 'safety' ? html`<div className="dashboard-grid">
        <${Card} className="span-7" title="Efectos observados" subtitle="Registre qué apareció, cuándo y qué relación temporal nota. El sistema no confirma causalidad." action=${html`<${Button} tone="soft" icon="plus" onClick=${() => this.openAdverse(patient)}>Registrar efecto</${Button}>`}>
          ${patient.adverseEvents.length ? html`<div className="adverse-list">${patient.adverseEvents.map(event => html`<div key=${event.id} className="adverse-card"><span className=${`adverse-icon adverse-${event.severity}`}><${Icon} name="alert"/></span><div><div><h4>${event.name}</h4><${Badge} tone=${event.severity === 'moderate' || event.severity === 'severe' ? 'warning' : 'neutral'}>${severityLabel(event.severity)}</${Badge}><${Badge} tone=${event.status === 'resolved' ? 'success' : 'purple'}>${statusLabel(event.status)}</${Badge}></div><p>${event.relation}</p><small>Inicio: ${formatDate(event.onset)}${event.actionTaken ? ` · Acción: ${event.actionTaken}` : ''}</small><div className="adverse-actions"><${Button} tone="secondary" icon=${event.status === 'resolved' ? 'refresh' : 'check'} onClick=${() => this.updateAdverseStatus(patient.id, event.id, event.status === 'resolved' ? 'active' : 'resolved')}>${event.status === 'resolved' ? 'Reabrir' : 'Marcar resuelto'}</${Button}></div></div></div>`)}</div>` : html`<${EmptyState} icon="shield" title="Sin efectos observados" text="No hay efectos adversos registrados en el periodo mostrado." action=${html`<${Button} tone="soft" icon="plus" onClick=${() => this.openAdverse(patient)}>Registrar efecto</${Button}>`}/>`}
        </${Card}>
        <${Card} className="span-5" title="Datos físicos actuales"><div className="safety-stats"><div><span>Peso actual</span><b>${patient.vitals?.weight ?? '—'}${patient.vitals?.weight ? ' kg' : ''}</b><small>${weightChange === null ? 'Sin comparación' : `${weightChange >= 0 ? '+' : ''}${weightChange.toFixed(1)}% desde el valor inicial`}</small></div><div><span>IMC</span><b>${patient.vitals?.bmi ?? '—'}</b><small>Interpretar según contexto individual</small></div><div><span>Presión arterial</span><b>${patient.vitals?.bp || '—'}</b><small>${patient.vitals?.pulse ? `Pulso ${patient.vitals.pulse} bpm` : 'Pulso no registrado'}</small></div><div><span>Sueño</span><b>${patient.sleepCurrent ?? '—'}${patient.sleepCurrent !== null ? ' h' : ''}</b><small>${patient.sleepBaseline !== null ? `Inicial ${patient.sleepBaseline} h` : 'Sin valor inicial'}</small></div></div><${Button} tone="secondary" icon="activity" onClick=${() => this.openVitals(patient)}>Actualizar control físico</${Button}></${Card}>
        <${Card} className="span-8" title="Laboratorios" subtitle="Guarde resultados y marque si el laboratorio los reporta fuera de rango." action=${html`<${Button} tone="soft" icon="plus" onClick=${() => this.openLab(patient)}>Nuevo resultado</${Button}>`}>
          ${patient.labs.length ? html`<div className="table-wrap"><table className="data-table"><thead><tr><th>Prueba</th><th>Resultado</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>${[...patient.labs].sort((left, right) => new Date(right.date) - new Date(left.date)).map(lab => html`<tr key=${lab.id}><td><b>${lab.name}</b></td><td><strong>${lab.value}</strong> <small>${lab.unit}</small></td><td>${formatDate(lab.date)}</td><td><${Badge} tone=${lab.status === 'normal' ? 'success' : 'warning'} dot=${true}>${lab.status === 'normal' ? 'En rango' : 'Revisar'}</${Badge}></td></tr>`)}</tbody></table></div>` : html`<${EmptyState} icon="file" title="Sin resultados" text="Agregue un laboratorio cuando sea pertinente para el tratamiento."/>`}
        </${Card}>
        <${Card} className="span-4" title="Alertas del paciente" action=${html`<${Badge} tone=${patientAlerts.length ? 'danger' : 'success'}>${patientAlerts.length} abiertas</${Badge}>`}><div className="alert-list">${patientAlerts.length ? patientAlerts.map(alert => html`<div className="alert-detail compact-detail" key=${alert.id}><span className=${`alert-indicator alert-${alert.severity}`}></span><div><span>${alert.category}</span><h4>${alert.title}</h4><p>${alert.detail}</p><small>${formatDateTime(alert.createdAt)}</small></div><${Button} tone="secondary" icon="check" onClick=${() => this.acknowledgeAlert(alert.id)}>Revisada</${Button}></div>`) : html`<${EmptyState} icon="shield" title="Sin alertas abiertas" text="No hay señales pendientes en este momento."/>`}</div></${Card}>
      </div>` : null}

      ${this.state.patientTab === 'timeline' ? this.renderPatientTimeline(patient, patientAppointments) : null}
    </div>`;
  }

  renderPatientTimeline(patient, patientAppointments) {
    const allEvents = [
      ...(patient.timeline || []),
      ...patientAppointments.map(appointment => ({ date: appointment.start, type: 'appointment', title: `Consulta ${statusLabel(appointment.status).toLowerCase()}`, detail: `${appointment.type} · ${appointment.modality}. ${appointment.notes || ''}` })),
    ].sort((left, right) => new Date(right.date) - new Date(left.date));
    const filterMap = { medications: 'medication', assessments: 'assessment', effects: 'alert', vitals: 'vital', labs: 'lab', appointments: 'appointment' };
    const filtered = this.state.timelineFilter === 'all' ? allEvents : allEvents.filter(item => item.type === filterMap[this.state.timelineFilter]);
    const filters = [['all', 'Todo'], ['medications', 'Medicamentos'], ['assessments', 'Escalas'], ['effects', 'Efectos'], ['vitals', 'Controles'], ['labs', 'Laboratorios'], ['appointments', 'Citas']];
    return html`<${Card} className="timeline-full" title="Historial completo" subtitle="Una sola secuencia con medicamentos, mediciones, laboratorios, efectos y citas." action=${html`<div className="segmented small timeline-filter">${filters.map(([key, label]) => html`<button key=${key} className=${this.state.timelineFilter === key ? 'active' : ''} onClick=${() => this.setState({ timelineFilter: key })}>${label}</button>`)}</div>`}><div className="timeline-list large">${filtered.length ? filtered.map((item, index) => html`<div key=${`${item.date}_${index}`} className="timeline-row"><time>${formatDate(item.date)}<small>${formatTime(item.date)}</small></time><span className=${`timeline-icon timeline-${item.type}`}><${Icon} name=${item.type === 'medication' ? 'medication' : item.type === 'assessment' ? 'analytics' : item.type === 'lab' ? 'file' : item.type === 'appointment' ? 'calendar' : item.type === 'vital' ? 'activity' : 'alert'} size=${18}/></span><div><b>${item.title}</b><p>${item.detail}</p></div></div>`) : html`<${EmptyState} icon="file" title="Sin eventos en este filtro" text="Seleccione “Todo” para ver el historial completo."/>`}</div></${Card}>`;
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
    const { appointments, patients } = this.state.data;
    const cursor = new Date(this.state.calendarDate);
    const view = this.state.calendarView;
    const upcoming = appointments
      .filter(item => new Date(item.start) >= new Date() && item.status !== 'cancelled')
      .sort((left, right) => new Date(left.start) - new Date(right.start))
      .slice(0, 8);
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
        eyebrow="Agenda clínica"
        title="Citas"
        subtitle="Cree, edite y organice consultas. La agenda funciona sin depender de Google Calendar."
        actions=${html`<${Button} tone="secondary" icon="download" onClick=${() => downloadAllICS(appointments.filter(item => item.status !== 'cancelled'))}>Exportar agenda</${Button}><${Button} icon="plus" onClick=${() => this.openNewAppointment(cursor)}>Nueva cita</${Button}>`}
      />
      <div className="calendar-layout">
        <${Card} className="calendar-main">
          <div className="calendar-toolbar">
            <div className="calendar-nav"><button className="icon-button" aria-label="Periodo anterior" onClick=${() => move(-1)}><${Icon} name="chevronLeft"/></button><button className="today-button" onClick=${() => this.setState({ calendarDate: new Date() })}>Hoy</button><button className="icon-button" aria-label="Periodo siguiente" onClick=${() => move(1)}><${Icon} name="chevronRight"/></button><h2>${heading}</h2></div>
            <div className="segmented">${[['month', 'Mes'], ['week', 'Semana'], ['day', 'Día']].map(([key, label]) => html`<button key=${key} className=${view === key ? 'active' : ''} onClick=${() => this.setState({ calendarView: key })}>${label}</button>`)}</div>
          </div>
          ${view === 'month' ? this.renderMonthCalendar(cursor, appointments) : view === 'week' ? this.renderWeekCalendar(cursor, appointments) : this.renderDayCalendar(cursor, appointments)}
          <div className="calendar-tip"><${Icon} name="help" size=${16}/><span>Haga clic en un día para crear una cita. Abra una cita existente para editarla, cambiar su estado o exportarla.</span></div>
        </${Card}>
        <${Card} className="upcoming-card" title="Próximas citas" action=${html`<${Badge} tone="purple">${upcoming.length}</${Badge}>`}>
          <div className="upcoming-list">${upcoming.length ? upcoming.map(appointment => {
            const patient = patients.find(item => item.id === appointment.patientId);
            return html`<button key=${appointment.id} onClick=${() => this.setState({ appointmentDetails: appointment })}><div className="date-box"><b>${new Date(appointment.start).getDate()}</b><span>${new Intl.DateTimeFormat('es-SV', { month: 'short' }).format(new Date(appointment.start))}</span></div><div><b>${appointment.title}</b><small>${formatTime(appointment.start)} · ${appointment.type}</small></div><${Avatar} patient=${patient} size="sm"/></button>`;
          }) : html`<${EmptyState} icon="calendar" title="Sin citas próximas" text="Cree una cita para comenzar."/>`}</div>
          <a className="button button-secondary full-width" href="https://calendar.google.com/calendar/u/0/r" target="_blank" rel="noreferrer"><${Icon} name="external" size=${18}/><span>Abrir Google Calendar</span></a>
        </${Card}>
      </div>
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
      <div className="analytics-grid">
        <${Card} className="analytics-highlight"><div><span>Mejoría media observada</span><strong>${percent(avgImprovement)}</strong><p>Promedio de la escala principal de cada paciente.</p></div><${Sparkline} values=${[18, 24, 31, 39, avgImprovement]} tone="teal"/></${Card}>
        <${Card} className="analytics-highlight"><div><span>Adherencia media</span><strong>${percent(avgAdherence)}</strong><p>Estimación autorreportada registrada en seguimiento.</p></div><${Sparkline} values=${[78, 81, 85, 88, avgAdherence]} tone="purple"/></${Card}>
      </div>
      <div className="dashboard-grid">
        <${Card} className="span-7" title="Distribución de respuesta" subtitle="La interpretación se basa en la escala principal de cada expediente."><div className="response-donuts"><${Donut} value=${summaries.length ? response / summaries.length * 100 : 0} label="Respuesta significativa" caption=${response + ' pacientes'} tone="teal"/><${Donut} value=${summaries.length ? partial / summaries.length * 100 : 0} label="Respuesta parcial" caption=${partial + ' pacientes'} tone="purple"/><${Donut} value=${summaries.length ? limited / summaries.length * 100 : 0} label="Cambio limitado" caption=${limited + ' pacientes'} tone="coral"/></div><div className="clinical-footnote"><${Icon} name="shield" size=${17}/> Los umbrales son descriptivos y deben validarse por escala, diagnóstico y contexto clínico.</div></${Card}>
        <${Card} className="span-5" title="Seguridad y seguimiento"><div className="safety-overview"><div><strong>${patients.filter(patient => patient.adverseEvents.some(event => event.status === 'active')).length}</strong><span>con efecto activo</span></div><div><strong>${patients.filter(patient => patient.labs.some(lab => lab.status !== 'normal')).length}</strong><span>con laboratorio a revisar</span></div><div><strong>${patients.filter(patient => patient.adherence < 80).length}</strong><span>con adherencia menor de 80%</span></div></div></${Card}>
        <${Card} className="span-12" title="Resumen por clase de medicamento" subtitle="Se muestra el cambio observado en esta base sintética, no la efectividad comparativa de la clase."><div className="table-wrap"><table className="data-table"><thead><tr><th>Clase</th><th>Pacientes</th><th>Mejoría media</th><th>Adherencia media</th></tr></thead><tbody>${Object.entries(classes).map(([name, values]) => html`<tr key=${name}><td><b>${name}</b></td><td>${values.count}</td><td><div className="progress-inline wide"><span><i style=${{ width: `${Math.max(0, Math.min(100, values.improvement / values.count))}%` }}></i></span><b>${percent(values.improvement / values.count)}</b></div></td><td>${percent(values.adherence / values.count)}</td></tr>`)}</tbody></table></div></${Card}>
      </div>
    </div>`;
  }

  renderAlerts() {
    const { alerts, patients } = this.state.data;
    const open = alerts.filter(item => item.status === 'open');
    const reviewed = alerts.filter(item => item.status !== 'open');
    return html`<div className="view-enter"><${PageHeader} eyebrow="Revisión priorizada" title="Alertas" subtitle="Las alertas llaman la atención del profesional. No cambian un tratamiento automáticamente." actions=${html`<${Badge} tone=${open.length ? 'danger' : 'success'}>${open.length} abiertas</${Badge}>`}/>
      <div className="alert-summary"><div><span className="alert-indicator alert-high"></span><strong>${open.filter(item => item.severity === 'high' || item.severity === 'critical').length}</strong><p>Alta prioridad</p></div><div><span className="alert-indicator alert-medium"></span><strong>${open.filter(item => item.severity === 'medium').length}</strong><p>Prioridad media</p></div><div><span className="alert-indicator alert-low"></span><strong>${open.filter(item => item.severity === 'low').length}</strong><p>Seguimiento</p></div><div><${Icon} name="check"/><strong>${reviewed.length}</strong><p>Revisadas</p></div></div>
      <${Card} title="Pendientes de revisión"><div className="alert-list full">${open.length ? open.map(alert => {
        const patient = patients.find(item => item.id === alert.patientId);
        return html`<div key=${alert.id} className="alert-detail"><span className=${`alert-indicator alert-${alert.severity}`}></span><div><span>${alert.category} · ${severityLabel(alert.severity)}</span><h4>${alert.title}</h4><p>${alert.detail}</p><small>${patient?.name || 'Paciente no disponible'} · ${formatDateTime(alert.createdAt)}</small></div><div className="alert-actions"><${Button} tone="secondary" onClick=${() => this.openPatient(alert.patientId)}>Abrir paciente</${Button}><${Button} tone="soft" icon="check" onClick=${() => this.acknowledgeAlert(alert.id)}>Marcar revisada</${Button}></div></div>`;
      }) : html`<${EmptyState} icon="shield" title="Sin alertas abiertas" text="No hay señales pendientes en este momento."/>`}</div></${Card}>
      ${reviewed.length ? html`<${Card} className="reviewed-alerts" title="Historial de alertas revisadas"><div className="alert-list compact">${reviewed.slice(0, 12).map(alert => { const patient = patients.find(item => item.id === alert.patientId); return html`<div key=${alert.id} className="alert-row passive"><span className="alert-indicator alert-reviewed"></span><div><b>${alert.title}</b><small>${patient?.name || 'Paciente'} · ${formatDate(alert.createdAt)}</small></div><${Button} tone="secondary" onClick=${() => this.reopenAlert(alert.id)}>Reabrir</${Button}></div>`; })}</div></${Card}>` : null}
    </div>`;
  }

  renderSettings() {
    const settings = this.state.data.settings || {};
    return html`<div className="view-enter"><${PageHeader} eyebrow="Configuración" title="Preferencias y respaldo" subtitle="Ajuste la legibilidad y conserve una copia de los datos sintéticos del navegador."/>
      <div className="settings-grid">
        <${Card} title="Interfaz sencilla"><div className="setting-row"><span className="setting-icon purple"><${Icon} name="help"/></span><div><h4>Texto grande</h4><p>Aumenta el tamaño de letras y controles para facilitar la lectura.</p></div><label className="switch"><input type="checkbox" checked=${Boolean(settings.largeText)} onChange=${event => this.updateSetting('largeText', event.target.checked)}/><span></span></label></div><div className="setting-row"><span className="setting-icon blue"><${Icon} name="activity"/></span><div><h4>Reducir movimiento</h4><p>Desactiva transiciones y animaciones de entrada.</p></div><label className="switch"><input type="checkbox" checked=${Boolean(settings.reducedMotion)} onChange=${event => this.updateSetting('reducedMotion', event.target.checked)}/><span></span></label></div></${Card}>
        <${Card} title="Respaldo local"><div className="setting-row"><span className="setting-icon green"><${Icon} name="download"/></span><div><h4>Guardar una copia</h4><p>Descarga pacientes, citas, evolución y alertas en un archivo JSON.</p></div></div><div className="settings-actions"><${Button} tone="secondary" icon="download" onClick=${this.exportBackup}>Descargar respaldo</${Button}><label className="button button-secondary file-button"><${Icon} name="upload" size=${18}/><span>Importar respaldo</span><input type="file" accept="application/json" onChange=${this.importBackup}/></label></div></${Card}>
        <${Card} title="Datos de demostración"><div className="setting-row"><span className="setting-icon coral"><${Icon} name="refresh"/></span><div><h4>Restaurar información inicial</h4><p>Reemplaza los cambios locales por los nueve pacientes sintéticos originales.</p></div></div><${Button} tone="secondary" icon="refresh" onClick=${this.resetDemo}>Restaurar demo</${Button}></${Card}>
        <${Card} title="Base de datos"><div className="setting-row"><span className="setting-icon purple"><${Icon} name="file"/></span><div><h4>Modo local activo</h4><p>Esta versión guarda los cambios en el navegador. El esquema Supabase permanece incluido para la conexión posterior.</p></div><${Badge} tone="success" dot=${true}>Funcionando</${Badge}></div></${Card}>
      </div>
      <${Card} className="terms-card" title="Términos técnicos en palabras sencillas"><div className="term-grid"><div><b>React</b><p>Construye y actualiza las pantallas.</p></div><div><b>localStorage</b><p>Guarda esta demo dentro del navegador.</p></div><div><b>Supabase</b><p>Será la base de datos y el sistema de usuarios al pasar a producción.</p></div><div><b>Vercel</b><p>Publica la aplicación en internet.</p></div><div><b>CSV</b><p>Archivo de tabla que puede abrirse en Excel.</p></div><div><b>ICS</b><p>Archivo de citas compatible con Google, Outlook y Apple Calendar.</p></div></div></${Card}>
    </div>`;
  }

  renderModalError() {
    return this.state.modalError ? html`<div className="form-error" role="alert"><${Icon} name="alert" size=${18}/><span>${this.state.modalError}</span></div>` : null;
  }

  renderModal() {
    const modal = this.state.modal;
    if (!modal) return null;
    if (modal.type === 'patient') return this.renderPatientFormModal();
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

  renderPatientFormModal() {
    const draft = this.state.modal.draft;
    const scale = SCALE_CATALOG.find(item => item.code === draft.scaleCode) || SCALE_CATALOG[0];
    return html`<${Modal} title="Nuevo paciente" subtitle="Registre primero lo esencial. Podrá completar otros datos después." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.savePatientForm}>${this.renderModalError()}<fieldset><legend>Datos esenciales</legend><div className="form-grid"><${FormField} label="Nombre completo" required=${true}><input autoFocus value=${draft.name} onChange=${event => this.updateDraft('name', event.target.value)} placeholder="Ej. Ana Martínez" required/></${FormField}><${FormField} label="Edad" required=${true}><input type="number" min="0" max="120" value=${draft.age} onChange=${event => this.updateDraft('age', event.target.value)} required/></${FormField}></div><div className="form-grid"><${FormField} label="Sexo registrado"><select value=${draft.sex} onChange=${event => this.updateDraft('sex', event.target.value)}><option>No registrado</option><option value="F">Femenino</option><option value="M">Masculino</option><option>Otro</option></select></${FormField}><${FormField} label="Diagnóstico principal" required=${true}><input value=${draft.diagnosis} onChange=${event => this.updateDraft('diagnosis', event.target.value)} placeholder="Ej. Trastorno depresivo mayor" required/></${FormField}></div><div className="form-grid"><${FormField} label="Código diagnóstico"><input value=${draft.diagnosisCode} onChange=${event => this.updateDraft('diagnosisCode', event.target.value)} placeholder="Ej. F33.1"/></${FormField}><${FormField} label="Riesgo actual"><select value=${draft.risk} onChange=${event => this.updateDraft('risk', event.target.value)}><option value="low">Bajo</option><option value="medium">Moderado</option><option value="high">Alto</option></select></${FormField}></div></fieldset><fieldset><legend>Medición inicial</legend><div className="form-grid"><${FormField} label="Escala"><select value=${draft.scaleCode} onChange=${event => this.updateDraft('scaleCode', event.target.value)}>${SCALE_CATALOG.map(item => html`<option key=${item.code} value=${item.code}>${item.code} · ${item.label}</option>`)}</select></${FormField}><${FormField} label="Puntaje inicial" hint=${`Rango permitido: ${scale.min} a ${scale.max}`}><input type="number" min=${scale.min} max=${scale.max} value=${draft.initialScore} onChange=${event => this.updateDraft('initialScore', event.target.value)}/></${FormField}></div><div className="form-grid"><${FormField} label="Estado clínico"><select value=${draft.status} onChange=${event => this.updateDraft('status', event.target.value)}><option value="stable">Estable</option><option value="responding">Mejorando</option><option value="partial">Mejoría parcial</option><option value="review">Requiere revisión</option></select></${FormField}><${FormField} label="Próxima cita"><input type="datetime-local" value=${draft.nextVisit} onChange=${event => this.updateDraft('nextVisit', event.target.value)}/></${FormField}></div></fieldset><details className="optional-section"><summary>Datos opcionales</summary><div className="form-grid"><${FormField} label="Teléfono"><input value=${draft.phone} onChange=${event => this.updateDraft('phone', event.target.value)}/></${FormField}><${FormField} label="Correo"><input type="email" value=${draft.email} onChange=${event => this.updateDraft('email', event.target.value)}/></${FormField}></div><${FormField} label="Nota inicial"><textarea rows="3" value=${draft.notes} onChange=${event => this.updateDraft('notes', event.target.value)} placeholder="Contexto importante para el seguimiento"></textarea></${FormField}></details><${FormActions} onCancel=${this.closeModal} submitLabel="Crear paciente"/></form></${Modal}>`;
  }

  renderMedicationFormModal() {
    const draft = this.state.modal.draft;
    const patient = this.state.data.patients.find(item => item.id === this.state.modal.patientId);
    return html`<${Modal} title="Agregar medicamento" subtitle=${`Paciente: ${patient?.name || ''}`} onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveMedicationForm}>${this.renderModalError()}<div className="form-grid"><${FormField} label="Medicamento" required=${true}><input autoFocus value=${draft.name} onChange=${event => this.updateDraft('name', event.target.value)} placeholder="Ej. Sertralina" required/></${FormField}><${FormField} label="Clase"><select value=${draft.class} onChange=${event => this.updateDraft('class', event.target.value)}>${MEDICATION_CLASSES.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}></div><${FormField} label="Indicación"><input value=${draft.indication} onChange=${event => this.updateDraft('indication', event.target.value)} placeholder="Motivo clínico del tratamiento"/></${FormField}><div className="form-grid form-grid-three"><${FormField} label="Dosis" required=${true}><input type="number" min="0" step="0.01" value=${draft.doseValue} onChange=${event => this.updateDraft('doseValue', event.target.value)} required/></${FormField}><${FormField} label="Unidad"><select value=${draft.doseUnit} onChange=${event => this.updateDraft('doseUnit', event.target.value)}><option>mg</option><option>mcg</option><option>g</option><option>mL</option><option>tableta(s)</option><option>gota(s)</option></select></${FormField}><${FormField} label="Frecuencia"><select value=${draft.frequency} onChange=${event => this.updateDraft('frequency', event.target.value)}>${FREQUENCIES.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}></div><div className="form-grid"><${FormField} label="Vía"><select value=${draft.route} onChange=${event => this.updateDraft('route', event.target.value)}><option>oral</option><option>sublingual</option><option>intramuscular</option><option>transdérmica</option><option>otra</option></select></${FormField}><${FormField} label="Fecha de inicio"><input type="date" value=${draft.startDate} onChange=${event => this.updateDraft('startDate', event.target.value)} required/></${FormField}></div><div className="check-grid"><label><input type="checkbox" checked=${Boolean(draft.isPrimary)} onChange=${event => this.updateDraft('isPrimary', event.target.checked)}/><span><b>Medicamento principal</b><small>Se mostrará como referencia principal del dashboard.</small></span></label><label><input type="checkbox" checked=${Boolean(draft.isPrn)} onChange=${event => this.updateDraft('isPrn', event.target.checked)}/><span><b>Uso según necesidad</b><small>Marque si la indicación es PRN.</small></span></label></div><${FormField} label="Notas"><textarea rows="3" value=${draft.notes} onChange=${event => this.updateDraft('notes', event.target.value)}></textarea></${FormField}><${FormActions} onCancel=${this.closeModal} submitLabel="Agregar medicamento"/></form></${Modal}>`;
  }

  renderDoseFormModal() {
    const draft = this.state.modal.draft;
    const patient = this.state.data.patients.find(item => item.id === this.state.modal.patientId);
    const active = patient?.medications?.filter(item => item.status === 'active') || [];
    const selected = active.find(item => item.id === draft.medicationId) || active[0];
    return html`<${Modal} title="Cambiar dosis" subtitle="El valor anterior se conservará en el historial." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveDoseForm}>${this.renderModalError()}<${FormField} label="Medicamento"><select value=${draft.medicationId} onChange=${event => { const medication = active.find(item => item.id === event.target.value); this.setState(prev => ({ modal: { ...prev.modal, draft: { ...prev.modal.draft, medicationId: event.target.value, currentDose: medication?.dose || '', newDoseValue: medication?.doseValue ?? '', doseUnit: medication?.doseUnit || 'mg', frequency: medication?.frequency || 'una vez al día' } } })); }}>${active.map(item => html`<option key=${item.id} value=${item.id}>${item.name} · ${item.dose}</option>`)}</select></${FormField}><div className="dose-change-panel"><div><span>Dosis actual</span><strong>${selected?.dose || draft.currentDose}</strong></div><${Icon} name="chevronRight"/><div><span>Nueva dosis</span><strong>${draft.newDoseValue || '—'} ${draft.doseUnit}</strong></div></div><div className="form-grid form-grid-three"><${FormField} label="Nueva dosis" required=${true}><input autoFocus type="number" min="0" step="0.01" value=${draft.newDoseValue} onChange=${event => this.updateDraft('newDoseValue', event.target.value)} required/></${FormField}><${FormField} label="Unidad"><select value=${draft.doseUnit} onChange=${event => this.updateDraft('doseUnit', event.target.value)}><option>mg</option><option>mcg</option><option>g</option><option>mL</option><option>tableta(s)</option><option>gota(s)</option></select></${FormField}><${FormField} label="Frecuencia"><select value=${draft.frequency} onChange=${event => this.updateDraft('frequency', event.target.value)}>${FREQUENCIES.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}></div><div className="form-grid"><${FormField} label="Fecha efectiva"><input type="date" value=${draft.effectiveDate} onChange=${event => this.updateDraft('effectiveDate', event.target.value)} required/></${FormField}><${FormField} label="Motivo"><input value=${draft.reason} onChange=${event => this.updateDraft('reason', event.target.value)} placeholder="Ej. respuesta parcial"/></${FormField}></div><${FormField} label="Notas"><textarea rows="3" value=${draft.notes} onChange=${event => this.updateDraft('notes', event.target.value)}></textarea></${FormField}><${FormActions} onCancel=${this.closeModal} submitLabel="Guardar cambio de dosis"/></form></${Modal}>`;
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
    return html`<${Modal} title="Registrar evolución" subtitle=${`Paciente: ${patient?.name || ''}`} onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveAssessmentForm}>${this.renderModalError()}<div className="form-grid"><${FormField} label="Escala clínica"><select value=${draft.code} onChange=${event => this.updateDraft('code', event.target.value)}>${SCALE_CATALOG.map(item => html`<option key=${item.code} value=${item.code}>${item.code} · ${item.label}</option>`)}</select></${FormField}><${FormField} label="Puntaje" required=${true} hint=${`Rango: ${scale.min} a ${scale.max}`}><input autoFocus type="number" min=${scale.min} max=${scale.max} value=${draft.score} onChange=${event => this.updateDraft('score', event.target.value)} required/></${FormField}></div><div className="form-grid form-grid-three"><${FormField} label="Fecha"><input type="date" value=${draft.date} onChange=${event => this.updateDraft('date', event.target.value)} required/></${FormField}><${FormField} label="Adherencia %"><input type="number" min="0" max="100" value=${draft.adherence} onChange=${event => this.updateDraft('adherence', event.target.value)}/></${FormField}><${FormField} label="Sueño promedio (h)"><input type="number" min="0" max="24" step="0.1" value=${draft.sleepCurrent} onChange=${event => this.updateDraft('sleepCurrent', event.target.value)}/></${FormField}></div><div className="form-grid form-grid-three"><${FormField} label="Cambio en funcionamiento %"><input type="number" min="-100" max="100" value=${draft.functioningChange} onChange=${event => this.updateDraft('functioningChange', event.target.value)}/></${FormField}><${FormField} label="Estado clínico"><select value=${draft.status} onChange=${event => this.updateDraft('status', event.target.value)}><option value="responding">Mejorando</option><option value="partial">Mejoría parcial</option><option value="stable">Estable</option><option value="review">Requiere revisión</option></select></${FormField}><${FormField} label="Riesgo actual"><select value=${draft.risk} onChange=${event => this.updateDraft('risk', event.target.value)}><option value="low">Bajo</option><option value="medium">Moderado</option><option value="high">Alto</option></select></${FormField}></div><${FormField} label="Nota clínica"><textarea rows="4" value=${draft.note} onChange=${event => this.updateDraft('note', event.target.value)} placeholder="Cambios observados, contexto, adherencia, tolerabilidad y plan"></textarea></${FormField}><div className="form-note"><${Icon} name="shield" size=${17}/><span>El porcentaje de mejoría se recalculará contra el primer puntaje registrado de esta escala.</span></div><${FormActions} onCancel=${this.closeModal} submitLabel="Guardar evolución"/></form></${Modal}>`;
  }

  renderVitalsFormModal() {
    const draft = this.state.modal.draft;
    return html`<${Modal} title="Control físico" subtitle="Registre solo los datos disponibles durante esta consulta." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveVitalsForm}>${this.renderModalError()}<div className="form-grid form-grid-three"><${FormField} label="Fecha"><input type="date" value=${draft.date} onChange=${event => this.updateDraft('date', event.target.value)} required/></${FormField}><${FormField} label="Peso (kg)"><input type="number" min="0" step="0.1" value=${draft.weight} onChange=${event => this.updateDraft('weight', event.target.value)}/></${FormField}><${FormField} label="Estatura (cm)"><input type="number" min="0" step="0.1" value=${draft.height} onChange=${event => this.updateDraft('height', event.target.value)}/></${FormField}></div><div className="form-grid form-grid-three"><${FormField} label="Presión sistólica"><input type="number" min="0" value=${draft.systolic} onChange=${event => this.updateDraft('systolic', event.target.value)}/></${FormField}><${FormField} label="Presión diastólica"><input type="number" min="0" value=${draft.diastolic} onChange=${event => this.updateDraft('diastolic', event.target.value)}/></${FormField}><${FormField} label="Pulso (bpm)"><input type="number" min="0" value=${draft.pulse} onChange=${event => this.updateDraft('pulse', event.target.value)}/></${FormField}></div><div className="form-grid"><${FormField} label="Sueño promedio (horas)"><input type="number" min="0" max="24" step="0.1" value=${draft.sleepCurrent} onChange=${event => this.updateDraft('sleepCurrent', event.target.value)}/></${FormField}><${FormField} label="Apetito"><select value=${draft.appetite} onChange=${event => this.updateDraft('appetite', event.target.value)}><option>No registrado</option><option>Sin cambios</option><option>Disminuido</option><option>Aumentado</option></select></${FormField}></div><${FormField} label="Notas"><textarea rows="3" value=${draft.notes} onChange=${event => this.updateDraft('notes', event.target.value)}></textarea></${FormField}><${FormActions} onCancel=${this.closeModal} submitLabel="Guardar control"/></form></${Modal}>`;
  }

  renderAdverseFormModal() {
    const draft = this.state.modal.draft;
    const patient = this.state.data.patients.find(item => item.id === this.state.modal.patientId);
    return html`<${Modal} title="Registrar efecto observado" subtitle="Describa temporalidad sin asumir causalidad automática." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveAdverseForm}>${this.renderModalError()}<div className="form-grid"><${FormField} label="Medicamento relacionado"><select value=${draft.medicationId} onChange=${event => this.updateDraft('medicationId', event.target.value)}><option value="">No definido</option>${patient?.medications?.map(item => html`<option key=${item.id} value=${item.id}>${item.name} · ${item.dose}</option>`)}</select></${FormField}><${FormField} label="Efecto observado"><select value=${draft.name} onChange=${event => this.updateDraft('name', event.target.value)}>${COMMON_ADVERSE_EFFECTS.map(item => html`<option key=${item}>${item}</option>`)}</select></${FormField}></div>${draft.name === 'Otro' ? html`<${FormField} label="Nombre del efecto" required=${true}><input autoFocus value=${draft.customName} onChange=${event => this.updateDraft('customName', event.target.value)} required/></${FormField}>` : null}<div className="form-grid form-grid-three"><${FormField} label="Severidad"><select value=${draft.severity} onChange=${event => this.updateDraft('severity', event.target.value)}><option value="mild">Leve</option><option value="moderate">Moderada</option><option value="severe">Severa</option><option value="critical">Crítica</option></select></${FormField}><${FormField} label="Estado"><select value=${draft.status} onChange=${event => this.updateDraft('status', event.target.value)}><option value="active">Activo</option><option value="resolved">Resuelto</option><option value="unknown">Sin confirmar</option></select></${FormField}><${FormField} label="Fecha de aparición"><input type="date" value=${draft.onset} onChange=${event => this.updateDraft('onset', event.target.value)} required/></${FormField}></div><${FormField} label="Relación temporal"><textarea rows="3" value=${draft.relation} onChange=${event => this.updateDraft('relation', event.target.value)} placeholder="Ej. apareció cuatro días después del aumento de dosis"></textarea></${FormField}><${FormField} label="Acción tomada"><input value=${draft.actionTaken} onChange=${event => this.updateDraft('actionTaken', event.target.value)} placeholder="Ej. observación, cambio de horario, evaluación adicional"/></${FormField}><${FormActions} onCancel=${this.closeModal} submitLabel="Guardar efecto"/></form></${Modal}>`;
  }

  renderLabFormModal() {
    const draft = this.state.modal.draft;
    return html`<${Modal} title="Nuevo resultado de laboratorio" subtitle="Use el rango y la bandera reportados por el laboratorio." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveLabForm}>${this.renderModalError()}<div className="form-grid"><${FormField} label="Prueba" required=${true}><input autoFocus value=${draft.name} onChange=${event => this.updateDraft('name', event.target.value)} placeholder="Ej. TSH, HbA1c o litio sérico" required/></${FormField}><${FormField} label="Fecha"><input type="date" value=${draft.date} onChange=${event => this.updateDraft('date', event.target.value)} required/></${FormField}></div><div className="form-grid form-grid-three"><${FormField} label="Resultado" required=${true}><input value=${draft.value} onChange=${event => this.updateDraft('value', event.target.value)} required/></${FormField}><${FormField} label="Unidad"><input value=${draft.unit} onChange=${event => this.updateDraft('unit', event.target.value)} placeholder="mg/dL"/></${FormField}><${FormField} label="Estado"><select value=${draft.status} onChange=${event => this.updateDraft('status', event.target.value)}><option value="normal">En rango</option><option value="low">Bajo</option><option value="high">Alto</option><option value="abnormal">Fuera de rango</option><option value="critical_low">Críticamente bajo</option><option value="critical_high">Críticamente alto</option></select></${FormField}></div><${FormField} label="Rango de referencia"><input value=${draft.reference} onChange=${event => this.updateDraft('reference', event.target.value)} placeholder="Ej. 0.4–4.0 mUI/L"/></${FormField}><${FormField} label="Notas"><textarea rows="3" value=${draft.notes} onChange=${event => this.updateDraft('notes', event.target.value)}></textarea></${FormField}><${FormActions} onCancel=${this.closeModal} submitLabel="Guardar resultado"/></form></${Modal}>`;
  }

  renderAppointmentFormModal() {
    const draft = this.state.modal.draft;
    const patients = this.state.data.patients;
    return html`<${Modal} title=${draft.id ? 'Editar cita' : 'Nueva cita'} subtitle="La cita quedará guardada en la agenda local." onClose=${this.closeModal} size="lg"><form className="clinical-form" onSubmit=${this.saveAppointmentForm}>${this.renderModalError()}<${FormField} label="Paciente" required=${true}><select value=${draft.patientId} onChange=${event => this.updateDraft('patientId', event.target.value)}>${patients.map(patient => html`<option key=${patient.id} value=${patient.id}>${patient.name} · ${patient.diagnosis}</option>`)}</select></${FormField}><div className="form-grid"><${FormField} label="Fecha y hora" required=${true}><input type="datetime-local" value=${draft.start} onChange=${event => this.updateDraft('start', event.target.value)} required/></${FormField}><${FormField} label="Duración"><select value=${draft.duration} onChange=${event => this.updateDraft('duration', event.target.value)}><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60">60 minutos</option><option value="90">90 minutos</option></select></${FormField}></div><div className="form-grid form-grid-three"><${FormField} label="Tipo"><select value=${draft.type} onChange=${event => this.updateDraft('type', event.target.value)}><option>Seguimiento</option><option>Primera consulta</option><option>Prioritaria</option><option>Seguridad</option><option>Laboratorios</option></select></${FormField}><${FormField} label="Modalidad"><select value=${draft.modality} onChange=${event => this.updateDraft('modality', event.target.value)}><option>Presencial</option><option>Videollamada</option></select></${FormField}><${FormField} label="Estado"><select value=${draft.status} onChange=${event => this.updateDraft('status', event.target.value)}><option value="confirmed">Confirmada</option><option value="pending">Pendiente</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option><option value="no_show">No asistió</option></select></${FormField}></div><${FormField} label="Notas de preparación"><textarea rows="4" value=${draft.notes} onChange=${event => this.updateDraft('notes', event.target.value)} placeholder="Ej. revisar escala, adherencia, efectos y controles"></textarea></${FormField}><${FormActions} onCancel=${this.closeModal} submitLabel=${draft.id ? 'Guardar cambios' : 'Crear cita'}/></form></${Modal}>`;
  }

  renderReportModal() {
    const patient = this.state.data.patients.find(item => item.id === this.state.modal.patientId);
    if (!patient) return null;
    const report = buildPatientReport(patient, this.state.data.alerts);
    return html`<${Modal} title="Resumen del paciente" subtitle="Documento descriptivo para revisar o imprimir." onClose=${this.closeModal} size="xl"><div className="report-sheet"><div className="report-head"><${Logo}/><div><span>Generado</span><b>${formatDateTime(report.generatedAt)}</b></div></div><div className="report-patient"><${Avatar} patient=${patient} size="lg"/><div><h2>${patient.name}</h2><p>${patient.age} años · ${patient.diagnosis} · ${patient.diagnosisCode}</p></div></div><div className="report-grid"><div><span>Medicamento principal</span><b>${report.medication?.name || 'Sin medicamento'}</b><small>${report.medication?.dose || '—'} · ${report.medication?.frequency || '—'}</small></div><div><span>Escala principal</span><b>${report.primary?.code || 'Sin escala'}</b><small>${report.baseline ?? '—'} → ${report.current ?? '—'}</small></div><div><span>Mejoría observada</span><b>${report.improvement === null ? '—' : percent(report.improvement)}</b><small>No implica causalidad automática.</small></div><div><span>Adherencia</span><b>${patient.adherence}%</b><small>Estimación registrada.</small></div></div><h3>Situación actual</h3><div className="report-list"><p><b>Estado clínico:</b> ${clinicalLabel(patient.status)}.</p><p><b>Riesgo registrado:</b> ${riskLabel(patient.risk)}.</p><p><b>Efectos activos:</b> ${report.activeAdverse.length ? report.activeAdverse.map(item => `${item.name} (${severityLabel(item.severity)})`).join(', ') : 'Ninguno registrado'}.</p><p><b>Alertas abiertas:</b> ${report.openAlerts.length ? report.openAlerts.map(item => item.title).join('; ') : 'Ninguna'}.</p><p><b>Próxima cita:</b> ${patient.nextVisit ? formatDateTime(patient.nextVisit) : 'Sin agendar'}.</p></div><div className="clinical-footnote"><${Icon} name="shield" size=${17}/> Este resumen apoya la revisión clínica. No diagnostica ni indica cambios terapéuticos.</div></div><div className="modal-sticky-actions"><${Button} tone="secondary" onClick=${this.closeModal}>Cerrar</${Button}><${Button} icon="print" onClick=${this.printReport}>Imprimir</${Button}></div></${Modal}>`;
  }

  renderHelpModal() {
    return html`<${Modal} title="Ayuda rápida" subtitle="Qué significa cada parte de NexaMind." onClose=${this.closeModal} size="lg"><div className="help-content"><div className="help-step"><b>1</b><div><h3>Inicio</h3><p>Muestra pacientes prioritarios y citas del día.</p></div></div><div className="help-step"><b>2</b><div><h3>Pacientes</h3><p>Abra un expediente, agregue medicamentos y registre cómo evoluciona.</p></div></div><div className="help-step"><b>3</b><div><h3>Agenda</h3><p>Cree, edite, exporte y cambie el estado de una cita.</p></div></div><div className="help-step"><b>4</b><div><h3>Resultados</h3><p>Resume cambios observados en síntomas, adherencia y seguridad.</p></div></div><div className="help-step"><b>5</b><div><h3>Alertas</h3><p>Señales que requieren revisión humana. No son órdenes automáticas.</p></div></div><div className="help-terms"><h3>Términos clínicos</h3><dl><div><dt>Valor inicial</dt><dd>Primera medición usada para comparar.</dd></div><div><dt>Mejoría observada</dt><dd>Cambio favorable durante el seguimiento, sin atribuir automáticamente la causa.</dd></div><div><dt>Adherencia</dt><dd>Estimación de cuánto sigue el paciente la indicación.</dd></div><div><dt>Relación temporal</dt><dd>Un evento ocurrió cerca del inicio o ajuste de un tratamiento.</dd></div></dl></div></div><div className="modal-sticky-actions"><${Button} onClick=${this.closeModal}>Entendido</${Button}></div></${Modal}>`;
  }

  renderAppointmentDetails() {
    const appointment = this.state.appointmentDetails;
    if (!appointment) return null;
    const patient = this.state.data.patients.find(item => item.id === appointment.patientId);
    return html`<${Modal} title="Detalle de la cita" subtitle="Revise, edite o cambie el estado." onClose=${() => this.setState({ appointmentDetails: null })} size="lg"><div className="appointment-detail-hero"><${Avatar} patient=${patient} size="lg"/><div><span className="eyebrow">${appointment.type}</span><h3>${appointment.title}</h3><p>${patient?.diagnosis || ''}</p></div><${Badge} tone=${appointment.status === 'confirmed' ? 'success' : appointment.status === 'pending' ? 'warning' : appointment.status === 'cancelled' || appointment.status === 'no_show' ? 'danger' : 'neutral'}>${statusLabel(appointment.status)}</${Badge}></div><div className="appointment-info"><div><${Icon} name="calendar"/><span>Fecha</span><b>${formatLongDate(appointment.start)}</b></div><div><${Icon} name="clock"/><span>Hora</span><b>${formatTime(appointment.start)} – ${formatTime(appointment.end)}</b></div><div><${Icon} name="activity"/><span>Modalidad</span><b>${appointment.modality}</b></div></div><div className="notes-box"><span>Notas de preparación</span><p>${appointment.notes || 'Sin notas.'}</p></div><div className="appointment-actions-grid"><${Button} tone="secondary" icon="edit" onClick=${() => this.openEditAppointment(appointment)}>Editar cita</${Button}><a className="button button-secondary" href=${googleCalendarUrl(appointment)} target="_blank" rel="noreferrer"><${Icon} name="external" size=${18}/><span>Abrir en Google</span></a><${Button} tone="secondary" icon="download" onClick=${() => downloadICS(appointment)}>Descargar ICS</${Button}><${Button} tone="soft" onClick=${() => this.openPatient(appointment.patientId)}>Abrir paciente</${Button}></div><div className="status-actions"><span>Cambiar estado:</span>${[['confirmed', 'Confirmada'], ['pending', 'Pendiente'], ['completed', 'Completada'], ['cancelled', 'Cancelada'], ['no_show', 'No asistió']].map(([key, label]) => html`<button key=${key} className=${appointment.status === key ? 'active' : ''} onClick=${() => this.updateAppointmentStatus(appointment.id, key)}>${label}</button>`)}</div><div className="danger-zone"><button onClick=${() => this.deleteAppointment(appointment.id)}><${Icon} name="trash" size=${17}/> Eliminar cita</button></div></${Modal}>`;
  }

  render() {
    const view = this.state.view;
    const settings = this.state.data.settings || {};
    const body = view === 'dashboard' ? this.renderDashboard()
      : view === 'patients' ? this.renderPatients()
        : view === 'patient' ? this.renderPatient()
          : view === 'agenda' ? this.renderAgenda()
            : view === 'analytics' ? this.renderAnalytics()
              : view === 'alerts' ? this.renderAlerts()
                : this.renderSettings();
    return html`<div className=${`app-shell ${settings.largeText ? 'large-text-mode' : ''} ${settings.reducedMotion ? 'reduced-motion-mode' : ''}`}><div className="ambient ambient-one"></div><div className="ambient ambient-two"></div><div className="app-frame">${this.renderTopbar()}<main className="main-content">${body}</main><footer><span>NexaMind Clinical · Apoyo al seguimiento</span><span>Datos sintéticos · No usar para atención real</span></footer></div>${this.renderModal()}${this.renderAppointmentDetails()}${this.state.toast ? html`<div className=${`toast toast-${this.state.toastTone}`}><${Icon} name=${this.state.toastTone === 'danger' ? 'alert' : 'check'} size=${18}/>${this.state.toast}</div>` : null}</div>`;
  }
}

createRoot(document.getElementById('root')).render(html`<${App}/>`);
