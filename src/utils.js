const DAY_MS = 24 * 60 * 60 * 1000;

const dateFormatters = new Map();
function formatter(locale, options) {
  const key = `${locale}:${JSON.stringify(options)}`;
  if (!dateFormatters.has(key)) dateFormatters.set(key, new Intl.DateTimeFormat(locale, options));
  return dateFormatters.get(key);
}

export function asDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, options = {}) {
  const date = asDate(value);
  if (!date) return 'Sin fecha';
  const config = {
    day: options.day || '2-digit',
    month: options.month || 'short',
    ...(options.year === false ? {} : { year: options.year || 'numeric' }),
  };
  return formatter('es-SV', config).format(date);
}

export function formatLongDate(value) {
  const date = asDate(value);
  if (!date) return 'Sin fecha';
  return formatter('es-SV', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export function formatTime(value) {
  const date = asDate(value);
  if (!date) return '--:--';
  return formatter('es-SV', { hour: '2-digit', minute: '2-digit', hour12: true }).format(date);
}

export function formatDateTime(value) {
  const date = asDate(value);
  if (!date) return 'Sin fecha';
  return `${formatDate(date)} · ${formatTime(date)}`;
}

export function relativeDate(value, reference = new Date()) {
  const date = asDate(value);
  const base = asDate(reference);
  if (!date || !base) return 'Sin cita';
  const start = new Date(base); start.setHours(0, 0, 0, 0);
  const target = new Date(date); target.setHours(0, 0, 0, 0);
  const diff = Math.round((target - start) / DAY_MS);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  if (diff > 1 && diff <= 7) return `En ${diff} días`;
  if (diff < -1 && diff >= -7) return `Hace ${Math.abs(diff)} días`;
  return formatDate(date);
}

export function getAssessmentSummary(patient, code = null) {
  const assessments = patient?.assessments || [];
  const primary = code ? assessments.find(item => item.code === code) : assessments[0];
  if (!primary?.points?.length) return null;
  const points = [...primary.points].sort((a, b) => new Date(a.date) - new Date(b.date));
  const baseline = Number(points[0].value);
  const current = Number(points[points.length - 1].value);
  let improvement = 0;
  if (Number.isFinite(baseline) && baseline !== 0 && Number.isFinite(current)) {
    improvement = primary.direction === 'higher'
      ? ((current - baseline) / Math.abs(baseline)) * 100
      : ((baseline - current) / Math.abs(baseline)) * 100;
  }
  let label = 'Sin cambio significativo';
  if (improvement >= 50) label = 'Respuesta significativa';
  else if (improvement >= 25) label = 'Respuesta parcial';
  else if (improvement > -10) label = 'Cambio limitado';
  else label = 'Deterioro observado';
  return {
    primary: { ...primary, points },
    baseline,
    current,
    absoluteChange: current - baseline,
    improvement,
    label,
    lastDate: points[points.length - 1].date,
  };
}

export function getPatientPriority(patient, alerts = []) {
  const patientAlerts = alerts.filter(alert => alert.patientId === patient?.id && alert.status === 'open');
  const hasHigh = patientAlerts.some(alert => alert.severity === 'high' || alert.severity === 'critical');
  const hasMedium = patientAlerts.some(alert => alert.severity === 'medium');
  const summary = getAssessmentSummary(patient);
  let score = 0;
  if (hasHigh) score += 3;
  if (hasMedium) score += 2;
  if (patient?.risk === 'high') score += 3;
  else if (patient?.risk === 'medium') score += 1;
  if ((patient?.adherence ?? 100) < 75) score += 2;
  if (summary && summary.improvement < 25) score += 1;
  if (patient?.status === 'review') score += 1;
  if (score >= 4) return { score, label: 'Alta prioridad', tone: 'danger' };
  if (score >= 2) return { score, label: 'Revisar', tone: 'warning' };
  return { score, label: 'Estable', tone: 'success' };
}

export function getStatusLabel(status) {
  const map = {
    responding: 'Mejorando', partial: 'Mejoría parcial', stable: 'Estable', review: 'Requiere revisión',
    active: 'Activo', held: 'En pausa', stopped: 'Finalizado', inactive: 'Inactivo', resolved: 'Resuelto', unknown: 'Sin confirmar',
    open: 'Abierta', acknowledged: 'Revisada', pending: 'Pendiente', confirmed: 'Confirmada', completed: 'Completada',
    cancelled: 'Cancelada', no_show: 'No asistió', normal: 'Normal', low: 'Bajo', high: 'Alto', abnormal: 'Anormal',
  };
  return map[status] || String(status || 'Sin estado');
}

export function severityLabel(severity) {
  return ({ low: 'Baja', mild: 'Leve', medium: 'Media', moderate: 'Moderada', high: 'Alta', severe: 'Severa', critical: 'Crítica' })[severity] || getStatusLabel(severity);
}

export function statusLabel(status) {
  return getStatusLabel(status);
}

export function toLocalInputDateTime(value) {
  const date = asDate(value);
  if (!date) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function toDateInput(value) {
  const date = asDate(value);
  if (!date) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function fromLocalInputDateTime(value) {
  const date = asDate(value);
  return date ? date.toISOString() : new Date().toISOString();
}

export function fromDateInput(value, hour = 9) {
  if (!value) return new Date().toISOString();
  const date = new Date(`${value}T${String(hour).padStart(2, '0')}:00:00`);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function addMinutes(value, minutes) {
  const date = asDate(value) || new Date();
  date.setMinutes(date.getMinutes() + Number(minutes || 0));
  return date.toISOString();
}

export function addDays(value, days) {
  const date = asDate(value) || new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString();
}

export function startOfWeek(value) {
  const date = asDate(value) || new Date();
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function isSameDay(a, b) {
  const left = asDate(a); const right = asDate(b);
  return Boolean(left && right && left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate());
}

function escapeICS(value = '') {
  return String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function toICSDate(value) {
  return (asDate(value) || new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function googleCalendarUrl(appointment) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: appointment?.title ? `Consulta · ${appointment.title}` : 'Consulta psiquiátrica',
    dates: `${toICSDate(appointment?.start)}/${toICSDate(appointment?.end)}`,
    details: [appointment?.type, appointment?.modality, appointment?.notes].filter(Boolean).join('\n'),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function makeICS(appointments = []) {
  const rows = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NexaMind Clinical//Agenda//ES', 'CALSCALE:GREGORIAN'];
  appointments.forEach(appointment => {
    rows.push(
      'BEGIN:VEVENT',
      `UID:${appointment?.id || uid('appointment')}@nexamind.local`,
      `DTSTAMP:${toICSDate(new Date())}`,
      `DTSTART:${toICSDate(appointment?.start)}`,
      `DTEND:${toICSDate(appointment?.end)}`,
      `SUMMARY:${escapeICS(appointment?.title ? `Consulta · ${appointment.title}` : 'Consulta psiquiátrica')}`,
      `DESCRIPTION:${escapeICS([appointment?.type, appointment?.modality, appointment?.notes].filter(Boolean).join('\n'))}`,
      'END:VEVENT',
    );
  });
  rows.push('END:VCALENDAR');
  return rows.join('\r\n');
}

function downloadBlob(content, type, filename) {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 500);
}

export function downloadICS(appointment) {
  downloadBlob(makeICS([appointment]), 'text/calendar;charset=utf-8', `cita-${appointment?.id || 'nexamind'}.ics`);
}

export function downloadAllICS(appointments) {
  downloadBlob(makeICS(appointments), 'text/calendar;charset=utf-8', 'agenda-nexamind.ics');
}

export function downloadCSV(filename, rows = []) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  const encode = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const content = [columns.map(encode).join(','), ...rows.map(row => columns.map(column => encode(row[column])).join(','))].join('\r\n');
  downloadBlob(`\uFEFF${content}`, 'text/csv;charset=utf-8', filename);
}

export function downloadJSON(filename, value) {
  downloadBlob(JSON.stringify(value, null, 2), 'application/json;charset=utf-8', filename);
}

export function uid(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function percent(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0%';
  return `${number.toFixed(digits)}%`;
}

export function daysBetween(from, to = new Date()) {
  const start = asDate(from); const end = asDate(to);
  if (!start || !end) return 0;
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}

export function initialsFromName(name = '') {
  return String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'NM';
}

export function calculateBMI(weightKg, heightCm) {
  const weight = Number(weightKg); const height = Number(heightCm) / 100;
  if (!Number.isFinite(weight) || !Number.isFinite(height) || height <= 0) return null;
  return Number((weight / (height * height)).toFixed(1));
}

export function formatMetric(value, suffix = '', fallback = 'Sin registrar') {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return fallback;
  return `${value}${suffix}`;
}
