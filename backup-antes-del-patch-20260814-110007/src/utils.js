const DAY_MS = 24 * 60 * 60 * 1000;

function asDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
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
  return new Intl.DateTimeFormat('es-SV', config).format(date);
}

export function formatTime(value) {
  const date = asDate(value);
  if (!date) return '--:--';
  return new Intl.DateTimeFormat('es-SV', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatDateTime(value) {
  const date = asDate(value);
  if (!date) return 'Sin fecha';
  return `${formatDate(date)} · ${formatTime(date)}`;
}

export function relativeDate(value, reference = new Date()) {
  const date = asDate(value);
  const base = asDate(reference);
  if (!date || !base) return 'Sin fecha';
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

export function getAssessmentSummary(patient) {
  const primary = patient?.assessments?.[0];
  if (!primary?.points?.length) return null;
  const baseline = Number(primary.points[0].value);
  const current = Number(primary.points[primary.points.length - 1].value);
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
    primary,
    baseline,
    current,
    absoluteChange: current - baseline,
    improvement,
    label,
  };
}

export function getPatientPriority(patient, alerts = []) {
  const patientAlerts = alerts.filter(a => a.patientId === patient?.id && a.status === 'open');
  const hasHigh = patientAlerts.some(a => a.severity === 'high');
  const hasMedium = patientAlerts.some(a => a.severity === 'medium');
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
    responding: 'Respondiendo',
    partial: 'Respuesta parcial',
    stable: 'Estable',
    review: 'Requiere revisión',
    active: 'Activo',
    resolved: 'Resuelto',
    open: 'Abierta',
    acknowledged: 'Revisada',
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    completed: 'Completada',
    cancelled: 'Cancelada',
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

export function fromLocalInputDateTime(value) {
  const date = asDate(value);
  return date ? date.toISOString() : new Date().toISOString();
}

export function addMinutes(value, minutes) {
  const date = asDate(value) || new Date();
  date.setMinutes(date.getMinutes() + Number(minutes || 0));
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

export function downloadICS(appointment) {
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NexaMind Clinical//Agenda//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${appointment?.id || uid('appointment')}@nexamind.local`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(appointment?.start)}`,
    `DTEND:${toICSDate(appointment?.end)}`,
    `SUMMARY:${escapeICS(appointment?.title ? `Consulta · ${appointment.title}` : 'Consulta psiquiátrica')}`,
    `DESCRIPTION:${escapeICS([appointment?.type, appointment?.modality, appointment?.notes].filter(Boolean).join('\n'))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `cita-${appointment?.id || 'nexamind'}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
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
