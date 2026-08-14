import React from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import '../styles.css';
import { createSeedData } from './data.js';
import {
  formatDate, formatTime, formatDateTime, relativeDate, getAssessmentSummary, getPatientPriority,
  getStatusLabel, severityLabel, statusLabel, toLocalInputDateTime, fromLocalInputDateTime,
  addMinutes, monthMatrix, isSameDay, startOfWeek, googleCalendarUrl, downloadICS, uid, percent, daysBetween,
} from './utils.js';

const html = htm.bind(React.createElement);
const STORAGE_KEY = 'nexamind-clinical-demo-v1';

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
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
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
  more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
};

function Icon({ name, size = 18, className = '' }) {
  return html`<svg className=${`icon ${className}`} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML=${{ __html: iconPaths[name] || iconPaths.activity }}></svg>`;
}

function Logo() {
  return html`<div className="brand">
    <div className="brand-mark"><span></span><span></span><span></span></div>
    <div><strong>NEXAMIND</strong><small>Clinical Intelligence</small></div>
  </div>`;
}

function Avatar({ patient, size = 'md' }) {
  return html`<div className=${`avatar avatar-${size}`} title=${patient?.name || ''}>${patient?.initials || 'NM'}</div>`;
}

function Badge({ tone = 'neutral', children, dot = false }) {
  return html`<span className=${`badge badge-${tone}`}>${dot ? html`<i></i>` : null}${children}</span>`;
}

function Button({ tone = 'primary', icon, children, onClick, className = '', type = 'button', disabled = false }) {
  return html`<button type=${type} className=${`button button-${tone} ${className}`} onClick=${onClick} disabled=${disabled}>${icon ? html`<${Icon} name=${icon} size=${17}/>` : null}<span>${children}</span></button>`;
}

function Card({ children, className = '', title, action }) {
  return html`<section className=${`card ${className}`}>
    ${title ? html`<div className="card-heading"><div><h3>${title}</h3></div>${action || null}</div>` : null}
    ${children}
  </section>`;
}

function Sparkline({ values, tone = 'purple' }) {
  const width = 150; const height = 56; const pad = 4;
  const max = Math.max(...values); const min = Math.min(...values); const range = max - min || 1;
  const points = values.map((v, i) => `${pad + i * (width - pad * 2) / Math.max(values.length - 1, 1)},${pad + (max - v) / range * (height - pad * 2)}`).join(' ');
  return html`<svg className=${`sparkline spark-${tone}`} viewBox=${`0 0 ${width} ${height}`} preserveAspectRatio="none">
    <polyline points=${points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    ${values.map((v, i) => { const [x, y] = points.split(' ')[i].split(','); return html`<circle key=${i} cx=${x} cy=${y} r="2.5" fill="currentColor"/>`; })}
  </svg>`;
}

function LineChart({ series, height = 230, invert = false, showLegend = true }) {
  const width = 760; const pad = { l: 46, r: 20, t: 22, b: 38 };
  const all = series.reduce((acc, s) => acc.concat(s.points.map(p => p.value)), []);
  const min = Math.min(...all, 0); const max = Math.max(...all, 1); const range = max - min || 1;
  const count = Math.max(...series.map(s => s.points.length));
  const x = i => pad.l + i * (width - pad.l - pad.r) / Math.max(count - 1, 1);
  const y = v => pad.t + (max - v) / range * (height - pad.t - pad.b);
  const ticks = [0, .25, .5, .75, 1].map(t => max - t * range);
  return html`<div className="chart-wrap">
    ${showLegend ? html`<div className="chart-legend">${series.map((s, i) => html`<span key=${s.label}><i className=${`legend-${i}`}></i>${s.label}</span>`)}</div>` : null}
    <svg className="line-chart" viewBox=${`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="Gráfico de tendencia clínica">
      ${ticks.map((t, i) => html`<g key=${i}><line x1=${pad.l} y1=${y(t)} x2=${width - pad.r} y2=${y(t)} className="grid-line"/><text x=${pad.l - 10} y=${y(t) + 4} textAnchor="end">${Math.round(t)}</text></g>`)}
      ${series.map((s, si) => {
        const points = s.points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
        return html`<g key=${s.label} className=${`series series-${si}`}>
          <polyline points=${points} fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
          ${s.points.map((p, i) => html`<g key=${i}><circle cx=${x(i)} cy=${y(p.value)} r="5"/><title>${formatDate(p.date)}: ${p.value}</title></g>`)}
        </g>`;
      })}
      ${series[0]?.points.map((p, i) => html`<text key=${i} x=${x(i)} y=${height - 10} textAnchor="middle" className="x-label">${formatDate(p.date, { year: false, month: 'short', day: '2-digit' })}</text>`)}
    </svg>
  </div>`;
}

function Donut({ value, label, caption, tone = 'purple' }) {
  const r = 48; const c = 2 * Math.PI * r; const safe = Math.max(0, Math.min(100, value));
  return html`<div className="donut-card">
    <div className=${`donut donut-${tone}`}>
      <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r=${r} className="donut-bg"/><circle cx="60" cy="60" r=${r} className="donut-value" strokeDasharray=${c} strokeDashoffset=${c * (1 - safe / 100)}/></svg>
      <strong>${Math.round(value)}%</strong>
    </div>
    <div><b>${label}</b><small>${caption}</small></div>
  </div>`;
}

function KpiCard({ label, value, hint, icon, tone = 'purple', trend, chart }) {
  return html`<${Card} className=${`kpi-card kpi-${tone}`}>
    <div className="kpi-top"><span>${label}</span><span className="kpi-icon"><${Icon} name=${icon} size=${18}/></span></div>
    <div className="kpi-body"><div><strong>${value}</strong><small className=${trend?.direction === 'down' ? 'trend-good' : trend?.good ? 'trend-good' : ''}>${trend ? html`<${Icon} name=${trend.direction === 'down' ? 'arrowDown' : 'arrowUp'} size=${14}/>` : null}${hint}</small></div>${chart || null}</div>
  </${Card}>`;
}

function Modal({ title, children, onClose, wide = false, footer }) {
  return html`<div className="modal-backdrop" onMouseDown=${e => e.target === e.currentTarget && onClose()}>
    <div className=${`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true">
      <div className="modal-header"><div><span className="eyebrow">NexaMind Clinical</span><h2>${title}</h2></div><button className="icon-button" onClick=${onClose}><${Icon} name="close"/></button></div>
      <div className="modal-body">${children}</div>
      ${footer ? html`<div className="modal-footer">${footer}</div>` : null}
    </div>
  </div>`;
}

function PageHeader({ eyebrow, title, subtitle, actions }) {
  return html`<div className="page-header"><div><span className="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${subtitle}</p></div><div className="page-actions">${actions}</div></div>`;
}

function EmptyState({ icon = 'file', title, text }) {
  return html`<div className="empty-state"><span><${Icon} name=${icon} size=${24}/></span><h3>${title}</h3><p>${text}</p></div>`;
}

class App extends React.Component {
  constructor(props) {
    super(props);
    let data;
    try { data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || createSeedData(); } catch (_) { data = createSeedData(); }
    this.state = {
      data,
      view: 'dashboard',
      selectedPatientId: 'p1',
      patientTab: 'overview',
      search: '',
      mobileNav: false,
      appointmentModal: false,
      appointmentDetails: null,
      appointmentDraft: null,
      calendarDate: new Date(),
      calendarView: 'month',
      toast: null,
    };
  }

  componentDidMount() { this.persist(); }
  componentDidUpdate(prevProps, prevState) { if (prevState.data !== this.state.data) this.persist(); }
  persist = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state.data));
  notify = message => { this.setState({ toast: message }); clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => this.setState({ toast: null }), 2800); };
  setView = view => this.setState({ view, mobileNav: false });
  openPatient = id => this.setState({ selectedPatientId: id, view: 'patient', patientTab: 'overview', mobileNav: false });
  resetDemo = () => this.setState({ data: createSeedData(), view: 'dashboard' }, () => this.notify('Datos demo restaurados.'));

  openNewAppointment = (date = new Date()) => {
    const start = new Date(date); if (start.getHours() === 0) start.setHours(9, 0, 0, 0);
    const firstPatient = this.state.data.patients[0];
    this.setState({
      appointmentModal: true,
      appointmentDraft: { patientId: firstPatient.id, start: toLocalInputDateTime(start), duration: 45, type: 'Seguimiento', modality: 'Presencial', status: 'confirmed', notes: '' },
    });
  };

  saveAppointment = e => {
    e.preventDefault();
    const draft = this.state.appointmentDraft; const patient = this.state.data.patients.find(p => p.id === draft.patientId);
    if (!patient || !draft.start) return;
    const start = fromLocalInputDateTime(draft.start);
    const appointment = { id: uid('appt'), patientId: patient.id, title: patient.name, start, end: addMinutes(start, Number(draft.duration)), type: draft.type, modality: draft.modality, status: draft.status, notes: draft.notes };
    this.setState(prev => ({ data: { ...prev.data, appointments: [...prev.data.appointments, appointment] }, appointmentModal: false, appointmentDraft: null, appointmentDetails: appointment }), () => this.notify('Cita creada correctamente.'));
  };

  updateAppointmentStatus = (id, status) => this.setState(prev => ({
    data: { ...prev.data, appointments: prev.data.appointments.map(a => a.id === id ? { ...a, status } : a) },
    appointmentDetails: prev.appointmentDetails?.id === id ? { ...prev.appointmentDetails, status } : prev.appointmentDetails,
  }), () => this.notify(`Cita marcada como ${statusLabel(status).toLowerCase()}.`));

  acknowledgeAlert = id => this.setState(prev => ({ data: { ...prev.data, alerts: prev.data.alerts.map(a => a.id === id ? { ...a, status: 'acknowledged' } : a) } }), () => this.notify('Alerta marcada como revisada.'));

  renderTopbar() {
    const nav = [
      ['dashboard', 'overview', 'Resumen'], ['patients', 'patients', 'Pacientes'], ['agenda', 'calendar', 'Agenda'], ['analytics', 'analytics', 'Analíticas'], ['alerts', 'alert', 'Alertas'],
    ];
    const active = this.state.view === 'patient' ? 'patients' : this.state.view;
    const openAlerts = this.state.data.alerts.filter(a => a.status === 'open').length;
    return html`<header className="topbar">
      <${Logo}/>
      <nav className=${`nav-pill ${this.state.mobileNav ? 'nav-open' : ''}`}>
        ${nav.map(([key, icon, label]) => html`<button key=${key} className=${active === key ? 'active' : ''} onClick=${() => this.setView(key)}><${Icon} name=${icon} size=${16}/><span>${label}</span>${key === 'alerts' && openAlerts ? html`<b>${openAlerts}</b>` : null}</button>`)}
      </nav>
      <div className="top-actions">
        <button className="icon-button notification-button" onClick=${() => this.setView('alerts')}><${Icon} name="alert"/><i></i></button>
        <button className="icon-button" onClick=${() => this.setView('settings')}><${Icon} name="settings"/></button>
        <div className="profile-chip"><div className="avatar avatar-sm">AS</div><div><b>Dra. Salazar</b><small>Psiquiatría</small></div></div>
        <button className="mobile-menu icon-button" onClick=${() => this.setState({ mobileNav: !this.state.mobileNav })}><${Icon} name="menu"/></button>
      </div>
    </header>`;
  }

  renderDashboard() {
    const { patients, appointments, alerts } = this.state.data;
    const summaries = patients.map(p => getAssessmentSummary(p)).filter(Boolean);
    const responseRate = summaries.length ? summaries.filter(s => s.improvement >= 50).length / summaries.length * 100 : 0;
    const meanImprovement = summaries.length ? summaries.reduce((n, s) => n + s.improvement, 0) / summaries.length : 0;
    const avgAdherence = patients.reduce((n, p) => n + p.adherence, 0) / patients.length;
    const openAlerts = alerts.filter(a => a.status === 'open');
    const needReview = patients.filter(p => getPatientPriority(p, alerts).score >= 2).length;
    const todayAppointments = appointments.filter(a => isSameDay(a.start, new Date()) && a.status !== 'cancelled').sort((a,b) => new Date(a.start)-new Date(b.start));
    const weekStart = startOfWeek(new Date()); const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate()+7);
    const weekAppointments = appointments.filter(a => new Date(a.start) >= weekStart && new Date(a.start) < weekEnd && a.status !== 'cancelled');
    const priority = [...patients].sort((a,b) => getPatientPriority(b, alerts).score - getPatientPriority(a, alerts).score || new Date(a.nextVisit)-new Date(b.nextVisit));
    const cohortSeries = [
      { label: 'Síntomas', points: [-8,-7,-6,-5,-4,-3,-2,-1,0].map((offset, i) => ({ date: new Date(Date.now()+offset*7*86400000).toISOString(), value: Math.round(18 - i*1.25 + [0,1,0,-1,0,0,-1,0,-1][i]) })) },
      { label: 'Funcionamiento', points: [-8,-7,-6,-5,-4,-3,-2,-1,0].map((offset, i) => ({ date: new Date(Date.now()+offset*7*86400000).toISOString(), value: Math.round(7 + i*.8) })) },
    ];
    return html`<div>
      <${PageHeader} eyebrow="Centro de control clínico" title=${`Buenas tardes, Dra. Salazar`} subtitle="Una vista priorizada de evolución, seguridad y agenda. Los datos son sintéticos para demostración."
        actions=${html`<${Button} tone="secondary" icon="file" onClick=${() => this.openPatient('p1')}>Abrir paciente demo</${Button}><${Button} icon="plus" onClick=${() => this.openNewAppointment()}>Nueva cita</${Button}>`}/>
      <div className="kpi-grid">
        <${KpiCard} label="Pacientes activos" value=${patients.length} hint="seguimiento farmacológico" icon="patients" tone="purple" chart=${html`<${Sparkline} values=${[6,6,7,7,8,8,9]} />`}/>
        <${KpiCard} label="Requieren revisión" value=${needReview} hint="priorizados por reglas clínicas" icon="alert" tone="coral" chart=${html`<div className="mini-stack"><span style=${{height:'35%'}}></span><span style=${{height:'48%'}}></span><span style=${{height:'60%'}}></span><span style=${{height:'52%'}}></span><span style=${{height:'78%'}}></span></div>`}/>
        <${KpiCard} label="Respuesta significativa" value=${percent(responseRate)} hint="reducción ≥50% en escala primaria" icon="trend" tone="teal" trend=${{ direction: 'up', good: true }} chart=${html`<${Sparkline} values=${[42,48,51,56,61,64,responseRate]} tone="teal"/>`}/>
        <${KpiCard} label="Citas esta semana" value=${weekAppointments.length} hint=${`${todayAppointments.length} programadas hoy`} icon="calendar" tone="blue" chart=${html`<${Sparkline} values=${[2,1,3,2,4,1,2]} tone="blue"/>`}/>
      </div>

      <div className="dashboard-grid">
        <${Card} className="span-8" title="Evolución clínica del panel" action=${html`<${Badge} tone="success" dot=${true}>Mejoría media ${percent(meanImprovement)}</${Badge}>`}>
          <div className="chart-summary"><div><strong>${percent(meanImprovement)}</strong><span>mejoría media observada</span></div><div><b>${percent(avgAdherence)}</b><span>adherencia media</span></div><div><b>${patients.filter(p => p.adverseEvents.some(a=>a.status==='active')).length}</b><span>pacientes con efecto activo</span></div></div>
          <${LineChart} series=${cohortSeries}/>
          <div className="clinical-footnote"><${Icon} name="shield" size=${16}/> Los indicadores describen cambios observados durante la exposición. No atribuyen causalidad ni sustituyen el juicio médico.</div>
        </${Card}>
        <${Card} className="span-4 agenda-preview" title="Agenda de hoy" action=${html`<button className="text-button" onClick=${() => this.setView('agenda')}>Ver calendario <${Icon} name="chevronRight" size=${15}/></button>`}>
          <div className="date-hero"><span>${new Intl.DateTimeFormat('es-SV',{weekday:'long'}).format(new Date())}</span><strong>${new Date().getDate()}</strong><small>${new Intl.DateTimeFormat('es-SV',{month:'long',year:'numeric'}).format(new Date())}</small></div>
          <div className="today-list">
            ${todayAppointments.length ? todayAppointments.map(a => { const p=patients.find(x=>x.id===a.patientId); return html`<button key=${a.id} className="today-item" onClick=${() => this.setState({ appointmentDetails: a })}><time>${formatTime(a.start)}</time><span className=${`event-line event-${a.type.toLowerCase().replace(/\s/g,'-')}`}></span><div><b>${a.title}</b><small>${a.type} · ${a.modality}</small></div><${Avatar} patient=${p} size="sm"/></button>`; }) : html`<${EmptyState} icon="calendar" title="Sin citas hoy" text="Puedes crear una nueva cita desde esta tarjeta."/>`}
          </div>
          <${Button} tone="soft" icon="plus" onClick=${() => this.openNewAppointment()}>Agregar cita</${Button}>
        </${Card}>
      </div>

      <div className="dashboard-grid lower-grid">
        <${Card} className="span-8" title="Pacientes priorizados" action=${html`<button className="text-button" onClick=${() => this.setView('patients')}>Ver todos <${Icon} name="chevronRight" size=${15}/></button>`}>
          <div className="table-wrap"><table className="data-table"><thead><tr><th>Paciente</th><th>Tratamiento</th><th>Evolución</th><th>Adherencia</th><th>Próxima cita</th><th>Prioridad</th></tr></thead><tbody>
            ${priority.slice(0,6).map(p => { const s=getAssessmentSummary(p); const pr=getPatientPriority(p,alerts); return html`<tr key=${p.id} onClick=${() => this.openPatient(p.id)}><td><div className="patient-cell"><${Avatar} patient=${p}/><div><b>${p.name}</b><small>${p.diagnosis}</small></div></div></td><td><b>${p.medication.name}</b><small>${p.medication.dose}</small></td><td><div className=${`metric-change ${s.improvement >= 25 ? 'positive' : 'neutral'}`}><${Icon} name=${s.improvement>=0?'arrowDown':'arrowUp'} size=${14}/>${percent(Math.abs(s.improvement))}</div><small>${s.primary.code}: ${s.baseline} → ${s.current}</small></td><td><div className="progress-inline"><span><i style=${{width:`${p.adherence}%`}}></i></span><b>${p.adherence}%</b></div></td><td><b>${relativeDate(p.nextVisit)}</b><small>${formatTime(p.nextVisit)}</small></td><td><${Badge} tone=${pr.tone} dot=${true}>${pr.label}</${Badge}></td></tr>`; })}
          </tbody></table></div>
        </${Card}>
        <${Card} className="span-4" title="Alertas clínicas" action=${html`<${Badge} tone="danger">${openAlerts.length} abiertas</${Badge}>`}>
          <div className="alert-list compact">
            ${openAlerts.slice(0,4).map(a => { const p=patients.find(x=>x.id===a.patientId); return html`<button key=${a.id} className="alert-row" onClick=${() => this.openPatient(a.patientId)}><span className=${`alert-indicator alert-${a.severity}`}></span><div><b>${a.title}</b><small>${p?.name} · ${relativeDate(a.createdAt)}</small></div><${Icon} name="chevronRight" size=${16}/></button>`; })}
          </div>
          <${Button} tone="secondary" onClick=${() => this.setView('alerts')}>Gestionar alertas</${Button}>
        </${Card}>
      </div>
    </div>`;
  }

  renderPatients() {
    const { patients, alerts } = this.state.data;
    const q = this.state.search.trim().toLowerCase();
    const filtered = patients.filter(p => !q || [p.name,p.diagnosis,p.medication.name,p.diagnosisCode].join(' ').toLowerCase().includes(q));
    return html`<div>
      <${PageHeader} eyebrow="Registro longitudinal" title="Pacientes" subtitle="Búsqueda rápida, priorización clínica y acceso al análisis terapéutico."
        actions=${html`<div className="search-box"><${Icon} name="search"/><input value=${this.state.search} onChange=${e=>this.setState({search:e.target.value})} placeholder="Buscar paciente, diagnóstico o medicamento"/></div><${Button} icon="plus" onClick=${()=>this.notify('El formulario de alta se conecta a Supabase en la siguiente fase.')}>Nuevo paciente</${Button}>`}/>
      <div className="patients-toolbar"><div><${Badge} tone="purple">${filtered.length} pacientes</${Badge}><${Badge} tone="warning">${patients.filter(p=>getPatientPriority(p,alerts).score>=2).length} por revisar</${Badge}></div><div className="segmented"><button className="active">Todos</button><button>Activos</button><button>Seguimiento</button></div></div>
      <div className="patient-grid">
        ${filtered.map(p => { const s=getAssessmentSummary(p); const priority=getPatientPriority(p,alerts); return html`<button key=${p.id} className="patient-card" onClick=${()=>this.openPatient(p.id)}>
          <div className="patient-card-top"><div className="patient-identity"><${Avatar} patient=${p} size="lg"/><div><h3>${p.name}</h3><span>${p.age} años · ${p.diagnosisCode}</span></div></div><${Badge} tone=${priority.tone} dot=${true}>${priority.label}</${Badge}></div>
          <p>${p.diagnosis}</p>
          <div className="patient-metrics"><div><span>Tratamiento</span><b>${p.medication.name}</b><small>${p.medication.dose}</small></div><div><span>${s.primary.code}</span><b>${s.current}</b><small>Basal ${s.baseline}</small></div><div><span>Mejoría</span><b className=${s.improvement>=25?'good-text':''}>${percent(s.improvement)}</b><small>${s.label}</small></div></div>
          <div className="patient-card-footer"><div><${Icon} name="calendar" size=${15}/><span>${relativeDate(p.nextVisit)} · ${formatTime(p.nextVisit)}</span></div><span>Ver expediente <${Icon} name="chevronRight" size=${15}/></span></div>
        </button>`; })}
      </div>
    </div>`;
  }

  renderPatient() {
    const { patients, alerts, appointments } = this.state.data;
    const p = patients.find(x=>x.id===this.state.selectedPatientId) || patients[0];
    const s = getAssessmentSummary(p); const priority = getPatientPriority(p,alerts);
    const patientAlerts = alerts.filter(a=>a.patientId===p.id && a.status==='open');
    const patientAppointments = appointments.filter(a=>a.patientId===p.id).sort((a,b)=>new Date(b.start)-new Date(a.start));
    const tabs = [['overview','Resumen'],['treatment','Tratamiento'],['safety','Seguridad'],['labs','Laboratorios'],['timeline','Línea de tiempo']];
    const exposureDays = daysBetween(p.medication.startDate);
    return html`<div>
      <div className="patient-hero">
        <button className="back-button" onClick=${()=>this.setView('patients')}><${Icon} name="chevronLeft"/></button>
        <${Avatar} patient=${p} size="xl"/>
        <div className="patient-hero-main"><span className="eyebrow">Expediente longitudinal · Datos sintéticos</span><h1>${p.name}</h1><p>${p.age} años · ${p.diagnosis} · ${p.diagnosisCode}</p><div className="hero-badges"><${Badge} tone=${priority.tone} dot=${true}>${priority.label}</${Badge}><${Badge} tone="neutral">Riesgo ${p.risk==='low'?'bajo':p.risk==='medium'?'moderado':'alto'}</${Badge}><${Badge} tone="purple">${p.medication.name} ${p.medication.dose}</${Badge}></div></div>
        <div className="patient-hero-actions"><div><span>Próxima cita</span><b>${relativeDate(p.nextVisit)}</b><small>${formatDateTime(p.nextVisit)}</small></div><${Button} icon="calendar" onClick=${()=>this.openNewAppointment(new Date(p.nextVisit))}>Agendar</${Button}></div>
      </div>
      <div className="patient-tabs">${tabs.map(([key,label])=>html`<button key=${key} className=${this.state.patientTab===key?'active':''} onClick=${()=>this.setState({patientTab:key})}>${label}${key==='safety'&&patientAlerts.length?html`<b>${patientAlerts.length}</b>`:null}</button>`)}</div>
      ${this.state.patientTab === 'overview' ? html`<div>
        <div className="patient-kpis">
          <${Card} className="patient-kpi"><span>Respuesta sintomática</span><strong className="good-text">${percent(s.improvement)}</strong><small>${s.primary.code}: ${s.baseline} → ${s.current}</small><div className="meter"><i style=${{width:`${Math.min(100,Math.max(0,s.improvement))}%`}}></i></div></${Card}>
          <${Card} className="patient-kpi"><span>Funcionamiento</span><strong className="good-text">+${p.functioningChange}%</strong><small>Cambio observado vs. basal</small><${Sparkline} values=${[8,9,11,12,14,15,16]} tone="teal"/></${Card}>
          <${Card} className="patient-kpi"><span>Adherencia</span><strong>${p.adherence}%</strong><small>Estimación autorreportada</small><div className="meter purple"><i style=${{width:`${p.adherence}%`}}></i></div></${Card}>
          <${Card} className="patient-kpi"><span>Seguridad</span><strong>${p.adverseEvents.filter(a=>a.status==='active').length}</strong><small>efectos adversos activos</small><${Badge} tone=${patientAlerts.length?'warning':'success'} dot=${true}>${patientAlerts.length?`${patientAlerts.length} alerta(s)`:'Sin alertas abiertas'}</${Badge}></${Card}>
        </div>
        <div className="dashboard-grid">
          <${Card} className="span-8" title="Trayectoria clínica" action=${html`<div className="segmented small"><button className="active">Escalas</button><button>Medicamento</button></div>`}>
            <div className="chart-summary patient-chart-summary"><div><span>Baseline</span><strong>${s.baseline}</strong></div><div><span>Actual</span><strong>${s.current}</strong></div><div><span>Cambio absoluto</span><strong>${s.current-s.baseline}</strong></div><div><span>Estado</span><b>${s.label}</b></div></div>
            <${LineChart} series=${p.assessments.slice(0,3).map(a=>({label:a.code,points:a.points}))}/>
            <div className="dose-strip"><span><${Icon} name="medication" size=${16}/> Exposición: ${p.medication.name}</span><div><i style=${{width:'42%'}}>Inicio ${p.medication.dose.includes('100')?'50 mg':p.medication.dose}</i><i className="dose-current">Dosis actual ${p.medication.dose}</i></div></div>
          </${Card}>
          <${Card} className="span-4 treatment-analysis" title="Análisis del tratamiento">
            <div className="treatment-name"><span className="medication-icon"><${Icon} name="medication"/></span><div><h3>${p.medication.name}</h3><p>${p.medication.dose} · ${p.medication.frequency}</p></div></div>
            <dl><div><dt>Exposición</dt><dd>${exposureDays} días</dd></div><div><dt>Indicación</dt><dd>${p.medication.indication}</dd></div><div><dt>Adherencia</dt><dd>${p.adherence}%</dd></div><div><dt>Tolerabilidad</dt><dd>${p.adverseEvents.some(a=>a.severity==='moderate')?'Requiere revisión':'Favorable'}</dd></div></dl>
            <div className=${`analysis-conclusion ${patientAlerts.length?'attention':''}`}><${Icon} name=${patientAlerts.length?'alert':'shield'} size=${20}/><div><b>${p.status==='responding'?'Beneficio observado favorable':p.status==='partial'?'Beneficio parcial observado':p.status==='review'?'Revisión clínica recomendada':'Evolución estable'}</b><p>${p.status==='review'?'Existen señales de eficacia, seguridad o adherencia que deben contextualizarse en consulta.':'El cambio temporal es compatible con mejoría durante la exposición, sin afirmar causalidad automática.'}</p></div></div>
            <button className="text-button full">Ver reporte terapéutico <${Icon} name="chevronRight" size=${15}/></button>
          </${Card}>
        </div>
        <div className="dashboard-grid lower-grid">
          <${Card} className="span-7" title="Sueño, peso y funcionamiento">
            <div className="wellbeing-grid"><div><span>Sueño basal</span><b>${p.sleepBaseline} h</b></div><div><span>Sueño actual</span><b className="good-text">${p.sleepCurrent} h</b></div><div><span>Peso</span><b>${p.vitals.weight} kg</b><small>Basal ${p.vitals.baselineWeight} kg</small></div><div><span>Presión</span><b>${p.vitals.bp}</b><small>Pulso ${p.vitals.pulse} bpm</small></div></div>
            <div className="mini-insight"><${Icon} name="activity"/><p>El sueño aumentó <b>${(p.sleepCurrent-p.sleepBaseline).toFixed(1)} horas</b> y la funcionalidad reportada cambió <b>+${p.functioningChange}%</b> desde el baseline.</p></div>
          </${Card}>
          <${Card} className="span-5" title="Próximos pasos" action=${html`<${Badge} tone=${patientAlerts.length?'warning':'success'}>${patientAlerts.length?`${patientAlerts.length} pendiente(s)`:'Al día'}</${Badge}>`}>
            <div className="task-list">
              ${patientAlerts.map(a=>html`<div key=${a.id} className="task-row"><span className=${`task-icon task-${a.severity}`}><${Icon} name="alert" size=${16}/></span><div><b>${a.title}</b><small>${a.detail}</small></div><button onClick=${()=>this.acknowledgeAlert(a.id)}><${Icon} name="check" size=${16}/></button></div>`)}
              <div className="task-row"><span className="task-icon task-low"><${Icon} name="calendar" size=${16}/></span><div><b>Próxima consulta</b><small>${formatDateTime(p.nextVisit)}</small></div><button onClick=${()=>this.openNewAppointment(new Date(p.nextVisit))}><${Icon} name="chevronRight" size=${16}/></button></div>
            </div>
          </${Card}>
        </div>
      </div>` : null}

      ${this.state.patientTab === 'treatment' ? html`<div className="dashboard-grid">
        <${Card} className="span-7" title="Tratamiento farmacológico actual">
          <div className="medication-detail"><span className="medication-icon large"><${Icon} name="medication" size=${25}/></span><div><span className="eyebrow">${p.medication.class}</span><h2>${p.medication.name} ${p.medication.dose}</h2><p>${p.medication.frequency} · iniciado ${formatDate(p.medication.startDate)}</p></div><${Badge} tone="success" dot=${true}>Activo</${Badge}></div>
          <div className="info-grid"><div><span>Indicación</span><b>${p.medication.indication}</b></div><div><span>Exposición</span><b>${exposureDays} días</b></div><div><span>Adherencia</span><b>${p.adherence}%</b></div><div><span>Respuesta</span><b>${s.label}</b></div></div>
          <div className="causality-box"><h4><${Icon} name="shield" size=${18}/> Evaluación de asociación temporal</h4><p>Se documentan inicio, titulación, escalas, efectos y eventos concurrentes. El dashboard presenta temporalidad y dechallenge/rechallenge cuando existe información, pero no convierte correlación en causalidad.</p></div>
        </${Card}>
        <${Card} className="span-5" title="Balance beneficio-tolerabilidad"><${Donut} value=${Math.max(0,s.improvement)} label="Beneficio sintomático" caption=${`${s.primary.code}: ${s.baseline} → ${s.current}`} tone="purple"/><${Donut} value=${p.adherence} label="Exposición estimada" caption="Adherencia autorreportada" tone="teal"/><div className="benefit-grid"><div><span>Beneficio</span><b>${s.improvement>=50?'Alto':s.improvement>=25?'Moderado':'Limitado'}</b></div><div><span>Carga adversa</span><b>${p.adverseEvents.filter(a=>a.status==='active').length?'Presente':'Baja'}</b></div></div></${Card}>
        <${Card} className="span-12" title="Eventos farmacológicos y clínicos"><div className="timeline-list">${p.timeline.map((t,i)=>html`<div key=${i} className="timeline-row"><time>${formatDate(t.date)}</time><span className=${`timeline-icon timeline-${t.type}`}><${Icon} name=${t.type==='medication'?'medication':t.type==='assessment'?'analytics':t.type==='lab'?'file':'alert'} size=${16}/></span><div><b>${t.title}</b><p>${t.detail}</p></div></div>`)}</div></${Card}>
      </div>` : null}

      ${this.state.patientTab === 'safety' ? html`<div className="dashboard-grid">
        <${Card} className="span-7" title="Efectos adversos registrados" action=${html`<${Button} tone="soft" icon="plus" onClick=${()=>this.notify('Formulario clínico listo para conectarse a Supabase.')}>Registrar efecto</${Button}>`}>
          ${p.adverseEvents.length ? html`<div className="adverse-list">${p.adverseEvents.map((a,i)=>html`<div key=${i} className="adverse-card"><span className=${`adverse-icon adverse-${a.severity}`}><${Icon} name="alert"/></span><div><div><h4>${a.name}</h4><${Badge} tone=${a.severity==='moderate'?'warning':'neutral'}>${severityLabel(a.severity)}</${Badge}><${Badge} tone=${a.status==='resolved'?'success':'purple'}>${statusLabel(a.status)}</${Badge}></div><p>${a.relation}</p><small>Inicio: ${formatDate(a.onset)}</small></div></div>`)}</div>` : html`<${EmptyState} icon="shield" title="Sin efectos adversos registrados" text="No se documentan eventos en el periodo mostrado."/>`}
        </${Card}>
        <${Card} className="span-5" title="Biometría y seguridad"><div className="safety-stats"><div><span>Peso actual</span><b>${p.vitals.weight} kg</b><small>${((p.vitals.weight-p.vitals.baselineWeight)/p.vitals.baselineWeight*100).toFixed(1)}% desde basal</small></div><div><span>IMC</span><b>${p.vitals.bmi}</b><small>Interpretación configurable</small></div><div><span>Presión arterial</span><b>${p.vitals.bp}</b><small>Pulso ${p.vitals.pulse} bpm</small></div><div><span>Sueño</span><b>${p.sleepCurrent} h</b><small>Basal ${p.sleepBaseline} h</small></div></div><div className="clinical-footnote"><${Icon} name="shield" size=${16}/> Los rangos y frecuencias deben ser aprobados y versionados por el psiquiatra responsable.</div></${Card}>
        <${Card} className="span-12" title="Alertas del paciente"><div className="alert-list">${patientAlerts.length?patientAlerts.map(a=>html`<div className="alert-detail" key=${a.id}><span className=${`alert-indicator alert-${a.severity}`}></span><div><span>${a.category}</span><h4>${a.title}</h4><p>${a.detail}</p><small>${formatDateTime(a.createdAt)}</small></div><${Button} tone="secondary" onClick=${()=>this.acknowledgeAlert(a.id)}>Marcar revisada</${Button}></div>`):html`<${EmptyState} icon="shield" title="Sin alertas abiertas" text="Los parámetros configurados están al día."/>`}</div></${Card}>
      </div>` : null}

      ${this.state.patientTab === 'labs' ? html`<div className="dashboard-grid">
        <${Card} className="span-8" title="Resultados de laboratorio" action=${html`<${Button} tone="soft" icon="plus" onClick=${()=>this.notify('Carga de laboratorio preparada para la fase Supabase.')}>Nuevo resultado</${Button}>`}>
          ${p.labs.length ? html`<div className="table-wrap"><table className="data-table"><thead><tr><th>Prueba</th><th>Resultado</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>${p.labs.map((l,i)=>html`<tr key=${i}><td><b>${l.name}</b></td><td><strong>${l.value}</strong> <small>${l.unit}</small></td><td>${formatDate(l.date)}</td><td><${Badge} tone=${l.status==='normal'?'success':'warning'} dot=${true}>${l.status==='normal'?'En rango':'Revisar'}</${Badge}></td></tr>`)}</tbody></table></div>`:html`<${EmptyState} icon="file" title="Sin resultados registrados" text="Este tratamiento no tiene resultados cargados en el demo."/>`}
        </${Card}>
        <${Card} className="span-4" title="Protocolo activo"><div className="protocol-card"><span className="medication-icon"><${Icon} name="shield"/></span><h3>${p.medication.class}</h3><p>Reglas de seguimiento configurables según medicamento, riesgo y guía adoptada.</p><ul><li><${Icon} name="check" size=${15}/> Baseline documentado</li><li><${Icon} name="check" size=${15}/> Signos vitales actualizados</li><li className=${patientAlerts.length?'pending':''}><${Icon} name=${patientAlerts.length?'clock':'check'} size=${15}/> ${patientAlerts.length?'Revisión pendiente':'Monitoreo al día'}</li></ul></div></${Card}>
      </div>` : null}

      ${this.state.patientTab === 'timeline' ? html`<${Card} className="timeline-full" title="Línea de tiempo clínica unificada" action=${html`<div className="segmented small"><button className="active">Todos</button><button>Medicamentos</button><button>Escalas</button><button>Laboratorios</button></div>`}><div className="timeline-list large">${[...p.timeline,...patientAppointments.map(a=>({date:a.start,type:'appointment',title:`Consulta ${statusLabel(a.status).toLowerCase()}`,detail:`${a.type} · ${a.modality}. ${a.notes}`}))].sort((a,b)=>new Date(b.date)-new Date(a.date)).map((t,i)=>html`<div key=${i} className="timeline-row"><time>${formatDate(t.date)}<small>${formatTime(t.date)}</small></time><span className=${`timeline-icon timeline-${t.type}`}><${Icon} name=${t.type==='medication'?'medication':t.type==='assessment'?'analytics':t.type==='lab'?'file':t.type==='appointment'?'calendar':'alert'} size=${17}/></span><div><b>${t.title}</b><p>${t.detail}</p></div></div>`)}</div></${Card}>` : null}
    </div>`;
  }

  renderAgenda() {
    const { appointments, patients } = this.state.data;
    const cursor = new Date(this.state.calendarDate);
    const view = this.state.calendarView;
    const monthName = new Intl.DateTimeFormat('es-SV',{month:'long',year:'numeric'}).format(cursor);
    const upcoming = appointments.filter(a=>new Date(a.start)>=new Date() && a.status!=='cancelled').sort((a,b)=>new Date(a.start)-new Date(b.start)).slice(0,8);
    const move = delta => { const d=new Date(cursor); if(view==='month') d.setMonth(d.getMonth()+delta); else d.setDate(d.getDate()+delta*(view==='week'?7:1)); this.setState({calendarDate:d}); };
    return html`<div>
      <${PageHeader} eyebrow="Agenda clínica" title="Calendario y citas" subtitle="Vista mensual, semanal y diaria con creación de citas, exportación ICS y acceso a Google Calendar."
        actions=${html`<${Button} tone="secondary" icon="external" onClick=${()=>this.notify('La sincronización bidireccional requiere OAuth de Google; el demo permite exportar y abrir eventos.')}>Google Calendar</${Button}><${Button} icon="plus" onClick=${()=>this.openNewAppointment(cursor)}>Nueva cita</${Button}>`}/>
      <div className="calendar-layout">
        <${Card} className="calendar-main">
          <div className="calendar-toolbar"><div><button className="icon-button" onClick=${()=>move(-1)}><${Icon} name="chevronLeft"/></button><button className="today-button" onClick=${()=>this.setState({calendarDate:new Date()})}>Hoy</button><button className="icon-button" onClick=${()=>move(1)}><${Icon} name="chevronRight"/></button><h2>${monthName}</h2></div><div className="segmented">${['month','week','day'].map(v=>html`<button key=${v} className=${view===v?'active':''} onClick=${()=>this.setState({calendarView:v})}>${v==='month'?'Mes':v==='week'?'Semana':'Día'}</button>`)}</div></div>
          ${view==='month'?this.renderMonthCalendar(cursor,appointments,patients):view==='week'?this.renderWeekCalendar(cursor,appointments,patients):this.renderDayCalendar(cursor,appointments,patients)}
        </${Card}>
        <div className="calendar-side">
          <${Card} title="Próximas citas" action=${html`<${Badge} tone="purple">${upcoming.length}</${Badge}>`}>
            <div className="upcoming-list">${upcoming.map(a=>{const p=patients.find(x=>x.id===a.patientId);return html`<button key=${a.id} onClick=${()=>this.setState({appointmentDetails:a})}><div className="date-box"><b>${new Date(a.start).getDate()}</b><span>${new Intl.DateTimeFormat('es-SV',{month:'short'}).format(new Date(a.start))}</span></div><div><b>${a.title}</b><small>${formatTime(a.start)} · ${a.type}</small></div><${Avatar} patient=${p} size="sm"/></button>`;})}</div>
          </${Card}>
          <${Card} className="calendar-stats" title="Carga semanal"><div className="week-load"><div><strong>${appointments.filter(a=>new Date(a.start)>=startOfWeek(new Date())&&new Date(a.start)<new Date(startOfWeek(new Date()).getTime()+7*86400000)&&a.status!=='cancelled').length}</strong><span>citas</span></div><div><strong>${appointments.filter(a=>a.status==='confirmed'&&new Date(a.start)>=new Date()).length}</strong><span>confirmadas</span></div><div><strong>${appointments.filter(a=>a.status==='pending'&&new Date(a.start)>=new Date()).length}</strong><span>pendientes</span></div></div><div className="clinical-footnote"><${Icon} name="calendar" size=${16}/> Las citas creadas en el demo persisten en el navegador.</div></${Card}>
        </div>
      </div>
    </div>`;
  }

  renderMonthCalendar(cursor, appointments, patients) {
    const days=monthMatrix(cursor.getFullYear(),cursor.getMonth()); const weekdays=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    return html`<div className="month-calendar"><div className="weekday-row">${weekdays.map(w=>html`<div key=${w}>${w}</div>`)}</div><div className="month-grid">${days.map(day=>{const events=appointments.filter(a=>isSameDay(a.start,day)&&a.status!=='cancelled').sort((a,b)=>new Date(a.start)-new Date(b.start));const outside=day.getMonth()!==cursor.getMonth();const today=isSameDay(day,new Date());return html`<div key=${day.toISOString()} className=${`calendar-day ${outside?'outside':''} ${today?'today':''}`} onDoubleClick=${()=>this.openNewAppointment(day)}><button className="day-number" onClick=${()=>this.openNewAppointment(day)}>${day.getDate()}</button><div className="day-events">${events.slice(0,3).map(a=>html`<button key=${a.id} className=${`calendar-event event-status-${a.status}`} onClick=${e=>{e.stopPropagation();this.setState({appointmentDetails:a})}}><span>${formatTime(a.start)}</span><b>${a.title.split(' ')[0]}</b></button>`)}${events.length>3?html`<small>+${events.length-3} más</small>`:null}</div></div>`;})}</div></div>`;
  }

  renderWeekCalendar(cursor, appointments, patients) {
    const start=startOfWeek(cursor); const days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d;});
    return html`<div className="week-calendar"><div className="week-head"><div></div>${days.map(d=>html`<button key=${d.toISOString()} className=${isSameDay(d,new Date())?'today':''} onClick=${()=>this.setState({calendarDate:d,calendarView:'day'})}><span>${new Intl.DateTimeFormat('es-SV',{weekday:'short'}).format(d)}</span><b>${d.getDate()}</b></button>`)}</div><div className="week-body"><div className="time-axis">${Array.from({length:10},(_,i)=>html`<span key=${i}>${8+i}:00</span>`)}</div>${days.map(d=>html`<div key=${d.toISOString()} className="week-column" onDoubleClick=${()=>this.openNewAppointment(d)}>${Array.from({length:10},(_,i)=>html`<i key=${i}></i>`)}${appointments.filter(a=>isSameDay(a.start,d)&&a.status!=='cancelled').map(a=>{const dt=new Date(a.start);const top=(dt.getHours()-8)*70+dt.getMinutes()/60*70;const height=Math.max(42,(new Date(a.end)-dt)/60000/60*70);return html`<button key=${a.id} className="week-event" style=${{top:`${top}px`,height:`${height}px`}} onClick=${()=>this.setState({appointmentDetails:a})}><b>${formatTime(a.start)}</b><span>${a.title}</span><small>${a.type}</small></button>`;})}</div>`)}</div></div>`;
  }

  renderDayCalendar(cursor, appointments, patients) {
    const events=appointments.filter(a=>isSameDay(a.start,cursor)&&a.status!=='cancelled').sort((a,b)=>new Date(a.start)-new Date(b.start));
    return html`<div className="day-view"><div className="day-view-header"><div className=${isSameDay(cursor,new Date())?'today':''}><span>${new Intl.DateTimeFormat('es-SV',{weekday:'long'}).format(cursor)}</span><strong>${cursor.getDate()}</strong><small>${new Intl.DateTimeFormat('es-SV',{month:'long'}).format(cursor)}</small></div><p>${events.length} citas programadas</p></div><div className="day-schedule">${events.length?events.map(a=>{const p=patients.find(x=>x.id===a.patientId);return html`<button key=${a.id} onClick=${()=>this.setState({appointmentDetails:a})}><time>${formatTime(a.start)}<small>${Math.round((new Date(a.end)-new Date(a.start))/60000)} min</small></time><span className="schedule-line"></span><${Avatar} patient=${p}/><div><h3>${a.title}</h3><p>${a.type} · ${a.modality}</p><small>${a.notes}</small></div><${Badge} tone=${a.status==='confirmed'?'success':a.status==='pending'?'warning':'neutral'}>${statusLabel(a.status)}</${Badge}></button>`;}) : html`<${EmptyState} icon="calendar" title="Agenda libre" text="Haz doble clic o crea una cita para este día."/>`}</div></div>`;
  }

  renderAnalytics() {
    const { patients }=this.state.data; const summaries=patients.map(p=>({p,s:getAssessmentSummary(p)}));
    const response=summaries.filter(x=>x.s.improvement>=50).length; const partial=summaries.filter(x=>x.s.improvement>=25&&x.s.improvement<50).length; const limited=patients.length-response-partial;
    const classes={}; patients.forEach(p=>{const k=p.medication.class;classes[k]=classes[k]||{count:0,improvement:0,adherence:0};classes[k].count++;classes[k].improvement+=getAssessmentSummary(p).improvement;classes[k].adherence+=p.adherence;});
    return html`<div><${PageHeader} eyebrow="Inteligencia clínica" title="Analíticas" subtitle="Indicadores descriptivos del panel demo. No son comparaciones de efectividad causal entre medicamentos." actions=${html`<${Button} tone="secondary" icon="download" onClick=${()=>this.notify('Exportación preparada para conectarse a consultas SQL/CSV.')}>Exportar</${Button}>`}/>
      <div className="analytics-hero"><div><span>Mejoría media del panel</span><strong>${percent(summaries.reduce((n,x)=>n+x.s.improvement,0)/patients.length)}</strong><p>Cambio relativo en la escala primaria de cada paciente.</p></div><div className="analytics-donuts"><${Donut} value=${response/patients.length*100} label="Respuesta significativa" caption=${`${response} de ${patients.length} pacientes`} tone="purple"/><${Donut} value=${patients.reduce((n,p)=>n+p.adherence,0)/patients.length} label="Adherencia media" caption="Estimación del panel" tone="teal"/></div></div>
      <div className="dashboard-grid">
        <${Card} className="span-7" title="Distribución de respuesta"><div className="response-distribution"><div style=${{width:`${response/patients.length*100}%`}} className="response-good"><b>${response}</b><span>Significativa</span></div><div style=${{width:`${partial/patients.length*100}%`}} className="response-partial"><b>${partial}</b><span>Parcial</span></div><div style=${{width:`${limited/patients.length*100}%`}} className="response-limited"><b>${limited}</b><span>Limitada</span></div></div><div className="response-legend"><span><i className="good"></i>≥50% de cambio favorable</span><span><i className="partial"></i>25–49%</span><span><i className="limited"></i>&lt;25%</span></div></${Card}>
        <${Card} className="span-5" title="Seguridad y tolerabilidad"><div className="safety-overview"><div><strong>${patients.filter(p=>p.adverseEvents.some(a=>a.status==='active')).length}</strong><span>con efecto activo</span></div><div><strong>${patients.filter(p=>p.labs.some(l=>l.status!=='normal')).length}</strong><span>con laboratorio a revisar</span></div><div><strong>${patients.filter(p=>p.adherence<80).length}</strong><span>con adherencia &lt;80%</span></div></div></${Card}>
        <${Card} className="span-12" title="Resumen por clase farmacológica"><div className="table-wrap"><table className="data-table"><thead><tr><th>Clase</th><th>Pacientes</th><th>Mejoría media observada</th><th>Adherencia media</th><th>Nota</th></tr></thead><tbody>${Object.entries(classes).map(([name,v])=>html`<tr key=${name}><td><b>${name}</b></td><td>${v.count}</td><td><div className="progress-inline wide"><span><i style=${{width:`${Math.max(0,Math.min(100,v.improvement/v.count))}%`}}></i></span><b>${percent(v.improvement/v.count)}</b></div></td><td>${percent(v.adherence/v.count)}</td><td><small>Muestra sintética; no comparar efectividad causal.</small></td></tr>`)}</tbody></table></div></${Card}>
      </div>
    </div>`;
  }

  renderAlerts() {
    const { alerts, patients }=this.state.data; const open=alerts.filter(a=>a.status==='open'); const reviewed=alerts.filter(a=>a.status!=='open');
    return html`<div><${PageHeader} eyebrow="Centro de seguridad" title="Alertas clínicas" subtitle="Señales priorizadas para revisión humana. Ninguna alerta ejecuta cambios terapéuticos automáticamente." actions=${html`<${Badge} tone="danger">${open.length} abiertas</${Badge}>`}/>
      <div className="alert-summary"><div><span className="alert-indicator alert-high"></span><strong>${open.filter(a=>a.severity==='high').length}</strong><p>Alta prioridad</p></div><div><span className="alert-indicator alert-medium"></span><strong>${open.filter(a=>a.severity==='medium').length}</strong><p>Prioridad media</p></div><div><span className="alert-indicator alert-low"></span><strong>${open.filter(a=>a.severity==='low').length}</strong><p>Seguimiento</p></div><div><${Icon} name="check"/><strong>${reviewed.length}</strong><p>Revisadas</p></div></div>
      <${Card} title="Pendientes de revisión"><div className="alert-list full">${open.map(a=>{const p=patients.find(x=>x.id===a.patientId);return html`<div key=${a.id} className="alert-detail"><span className=${`alert-indicator alert-${a.severity}`}></span><div><span>${a.category} · ${severityLabel(a.severity)}</span><h4>${a.title}</h4><p>${a.detail}</p><small>${p?.name} · ${formatDateTime(a.createdAt)}</small></div><div className="alert-actions"><${Button} tone="secondary" onClick=${()=>this.openPatient(a.patientId)}>Abrir paciente</${Button}><${Button} tone="soft" icon="check" onClick=${()=>this.acknowledgeAlert(a.id)}>Revisada</${Button}></div></div>`;})}</div></${Card}>
      ${reviewed.length?html`<${Card} className="reviewed-alerts" title="Historial reciente"><div className="alert-list compact">${reviewed.map(a=>{const p=patients.find(x=>x.id===a.patientId);return html`<div key=${a.id} className="alert-row passive"><span className="alert-indicator alert-reviewed"></span><div><b>${a.title}</b><small>${p?.name} · ${statusLabel(a.status)}</small></div></div>`;})}</div></${Card}>`:null}
    </div>`;
  }

  renderSettings() {
    return html`<div><${PageHeader} eyebrow="Configuración" title="Producto y conectividad" subtitle="Este paquete funciona en modo demo local y contiene el esquema Supabase para la siguiente etapa."/>
      <div className="settings-grid">
        <${Card} title="Modo de datos"><div className="setting-row"><span className="setting-icon purple"><${Icon} name="file"/></span><div><h4>Datos sintéticos locales</h4><p>La aplicación persiste citas y estados en localStorage. Ningún dato real debe cargarse en esta versión demo.</p></div><${Badge} tone="success" dot=${true}>Activo</${Badge}></div><${Button} tone="secondary" onClick=${this.resetDemo}>Restaurar datos demo</${Button}></${Card}>
        <${Card} title="Supabase"><div className="setting-row"><span className="setting-icon green"><${Icon} name="activity"/></span><div><h4>PostgreSQL + Auth + RLS</h4><p>Incluye migración, seed sintético, políticas por organización y vistas analíticas.</p></div><${Badge} tone="neutral">Preparado</${Badge}></div><code>supabase/schema.sql<br/>supabase/seed.sql</code></${Card}>
        <${Card} title="Google Calendar"><div className="setting-row"><span className="setting-icon blue"><${Icon} name="calendar"/></span><div><h4>Integración de agenda</h4><p>El demo abre eventos en Google Calendar y exporta ICS. La sincronización bidireccional requiere OAuth 2.0.</p></div><${Badge} tone="warning">OAuth pendiente</${Badge}></div></${Card}>
        <${Card} title="Gobierno clínico"><div className="setting-row"><span className="setting-icon coral"><${Icon} name="shield"/></span><div><h4>Reglas versionadas</h4><p>Umbrales, periodicidades y alertas deben ser aprobados por el psiquiatra responsable antes de producción.</p></div><${Badge} tone="purple">Requerido</${Badge}></div></${Card}>
      </div>
      <${Card} className="deployment-card" title="Ruta de producción"><div className="deployment-flow"><div><b>1</b><span>Crear proyecto Supabase</span><small>Ejecutar schema.sql y seed.sql</small></div><i></i><div><b>2</b><span>Configurar autenticación</span><small>MFA, miembros y RLS</small></div><i></i><div><b>3</b><span>Conectar repositorio</span><small>Variables de entorno</small></div><i></i><div><b>4</b><span>Desplegar en Vercel</span><small>Dominio y monitoreo</small></div></div></${Card}>
    </div>`;
  }

  renderAppointmentModal() {
    const draft=this.state.appointmentDraft; if(!this.state.appointmentModal||!draft)return null;
    const { patients }=this.state.data;
    const set=(key,value)=>this.setState({appointmentDraft:{...draft,[key]:value}});
    return html`<${Modal} title="Nueva cita" onClose=${()=>this.setState({appointmentModal:false,appointmentDraft:null})} footer=${html`<${Button} tone="secondary" onClick=${()=>this.setState({appointmentModal:false,appointmentDraft:null})}>Cancelar</${Button}><${Button} icon="check" type="submit" onClick=${this.saveAppointment}>Guardar cita</${Button}>`}>
      <form className="appointment-form" onSubmit=${this.saveAppointment}>
        <label><span>Paciente</span><select value=${draft.patientId} onChange=${e=>set('patientId',e.target.value)}>${patients.map(p=>html`<option key=${p.id} value=${p.id}>${p.name} · ${p.diagnosis}</option>`)}</select></label>
        <div className="form-grid"><label><span>Fecha y hora</span><input type="datetime-local" value=${draft.start} onChange=${e=>set('start',e.target.value)} required/></label><label><span>Duración</span><select value=${draft.duration} onChange=${e=>set('duration',e.target.value)}><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60">60 minutos</option><option value="90">90 minutos</option></select></label></div>
        <div className="form-grid"><label><span>Tipo de cita</span><select value=${draft.type} onChange=${e=>set('type',e.target.value)}><option>Seguimiento</option><option>Primera consulta</option><option>Prioritaria</option><option>Seguridad</option><option>Laboratorios</option></select></label><label><span>Modalidad</span><select value=${draft.modality} onChange=${e=>set('modality',e.target.value)}><option>Presencial</option><option>Videollamada</option></select></label></div>
        <label><span>Estado</span><select value=${draft.status} onChange=${e=>set('status',e.target.value)}><option value="confirmed">Confirmada</option><option value="pending">Pendiente</option></select></label>
        <label><span>Notas de preparación</span><textarea rows="4" value=${draft.notes} onChange=${e=>set('notes',e.target.value)} placeholder="Ej. revisar PHQ-9, adherencia y tolerabilidad"></textarea></label>
      </form>
    </${Modal}>`;
  }

  renderAppointmentDetails() {
    const a=this.state.appointmentDetails; if(!a)return null; const p=this.state.data.patients.find(x=>x.id===a.patientId);
    return html`<${Modal} title="Detalle de la cita" onClose=${()=>this.setState({appointmentDetails:null})}>
      <div className="appointment-detail-hero"><${Avatar} patient=${p} size="lg"/><div><span className="eyebrow">${a.type}</span><h3>${a.title}</h3><p>${p?.diagnosis}</p></div><${Badge} tone=${a.status==='confirmed'?'success':a.status==='pending'?'warning':a.status==='completed'?'neutral':'danger'}>${statusLabel(a.status)}</${Badge}></div>
      <div className="appointment-info"><div><${Icon} name="calendar"/><span>Fecha</span><b>${formatDate(a.start)}</b></div><div><${Icon} name="clock"/><span>Hora</span><b>${formatTime(a.start)} – ${formatTime(a.end)}</b></div><div><${Icon} name="activity"/><span>Modalidad</span><b>${a.modality}</b></div></div>
      <div className="notes-box"><span>Notas de preparación</span><p>${a.notes||'Sin notas.'}</p></div>
      <div className="appointment-actions-grid"><a className="button button-secondary" href=${googleCalendarUrl(a)} target="_blank" rel="noreferrer"><${Icon} name="external" size=${17}/><span>Abrir en Google Calendar</span></a><${Button} tone="secondary" icon="download" onClick=${()=>downloadICS(a)}>Descargar .ICS</${Button}><${Button} tone="soft" onClick=${()=>this.openPatient(a.patientId)}>Abrir paciente</${Button}></div>
      <div className="status-actions"><span>Cambiar estado:</span>${['confirmed','pending','completed','cancelled'].map(st=>html`<button key=${st} className=${a.status===st?'active':''} onClick=${()=>this.updateAppointmentStatus(a.id,st)}>${statusLabel(st)}</button>`)}</div>
    </${Modal}>`;
  }

  render() {
    const view=this.state.view;
    return html`<div className="app-shell">
      <div className="ambient ambient-one"></div><div className="ambient ambient-two"></div>
      <div className="app-frame">${this.renderTopbar()}<main className="main-content">${view==='dashboard'?this.renderDashboard():view==='patients'?this.renderPatients():view==='patient'?this.renderPatient():view==='agenda'?this.renderAgenda():view==='analytics'?this.renderAnalytics():view==='alerts'?this.renderAlerts():this.renderSettings()}</main><footer><span>NexaMind Clinical · Prototipo de apoyo a decisiones</span><span>Datos 100% sintéticos · No usar para atención real</span></footer></div>
      ${this.renderAppointmentModal()}${this.renderAppointmentDetails()}
      ${this.state.toast?html`<div className="toast"><${Icon} name="check" size=${17}/>${this.state.toast}</div>`:null}
    </div>`;
  }
}

createRoot(document.getElementById('root')).render(html`<${App}/>`);
