import { calendarPermissionAllowed, permissionAllowed } from './permissions.ts';

export function localDate(value: Date | string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function oneLine(value: unknown) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function secretaryAgendaItems(appointments: any[], patients: Map<string, any>, member: any, doctorCalendarId: string, date: string, timezone: string) {
  if (member?.role !== 'secretary' || member.active !== true || !permissionAllowed(member, 'patientsView') || !calendarPermissionAllowed(member, 'doctor', 'View')) return [];
  return appointments.filter(row => {
    const appointment = row.payload || row;
    const patient = patients.get(String(appointment.patientId || ''));
    return !row.deleted && appointment.calendarId === doctorCalendarId && appointment.eventType !== 'general' &&
      !['cancelled', 'no_show'].includes(appointment.status) && patient && !patient.archived &&
      Number.isFinite(Date.parse(appointment.start)) && localDate(appointment.start, timezone) === date;
  }).map(row => {
    const appointment = row.payload || row;
    return {
      start: appointment.start,
      time: new Intl.DateTimeFormat('es-SV', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(appointment.start)),
      patientName: oneLine(patients.get(String(appointment.patientId))?.name) || 'Paciente sin nombre',
    };
  }).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

export function secretaryAgendaMessage(date: string, items: { time: string; patientName: string }[]) {
  return `Agenda de citas de hoy (${date})\n\n${items.length ? items.map(item => `${item.time} · ${item.patientName}`).join('\n') : 'No hay citas programadas para hoy.'}\n\nConsulte Linkare para ver cambios de última hora.`;
}
