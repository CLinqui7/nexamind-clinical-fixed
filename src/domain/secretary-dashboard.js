const clock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/El_Salvador', year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function clinicDayAndMinutes(value) {
  const parts = Object.fromEntries(clock.formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return {
    day: parts.year + '-' + parts.month + '-' + parts.day,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function secretaryTodayAppointments(appointments, doctorCalendarId, now = new Date()) {
  if (!doctorCalendarId) return [];
  const day = clinicDayAndMinutes(now).day;
  return appointments.filter(item =>
    item.calendarId === doctorCalendarId &&
    item.patientId &&
    !['cancelled', 'no_show'].includes(item.status) &&
    item.start && !Number.isNaN(new Date(item.start).getTime()) &&
    clinicDayAndMinutes(item.start).day === day
  ).sort((left, right) => new Date(left.start) - new Date(right.start));
}

export function showSecretaryAgendaNotice(now = new Date()) {
  return clinicDayAndMinutes(now).minutes >= 8 * 60;
}
