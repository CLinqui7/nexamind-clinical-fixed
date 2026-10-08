import { stableJSON } from './records.js';

const SIMPLE_FIELDS = ['calendarId', 'eventType', 'patientId', 'title', 'type', 'modality', 'status', 'adminReviewStatus'];
const same = (a, b) => stableJSON(a ?? null) === stableJSON(b ?? null);

/** Only the values the editor changed may be sent to the server. */
export function appointmentEditPatch(original, edited, { canEditNotes = false } = {}) {
  // Identity is a dependency of every edit: never silently apply notes or a
  // status change to a different patient or calendar after reassignment.
  const base = Object.fromEntries(['calendarId', 'eventType', 'patientId']
    .map(field => [field, original[field] ?? null]));
  const changes = {};
  for (const field of SIMPLE_FIELDS) {
    // A patient's display name is not an edit to the appointment's identity.
    if (field === 'title' && edited.eventType !== 'general'
        && original.eventType !== 'general' && edited.patientId === original.patientId) continue;
    if (same(original[field], edited[field])) continue;
    base[field] = original[field] ?? null;
    changes[field] = edited[field] ?? null;
  }
  // Time and duration form one logical choice. Never merge half a time slot.
  if (!same(original.start, edited.start) || !same(original.end, edited.end)) {
    for (const field of ['start', 'end']) {
      base[field] = original[field] ?? null;
      changes[field] = edited[field] ?? null;
    }
  }
  if (canEditNotes && !same(original.notes || '', edited.notes || '')) {
    base.notes = original.notes || '';
    changes.notes = edited.notes || '';
  }
  return { base, changes };
}

export function appointmentConflictGroups(fields = []) {
  const groups = new Set();
  for (const field of fields) {
    if (['start', 'end'].includes(field)) groups.add('time');
    else if (['eventType', 'patientId', 'title'].includes(field)) groups.add('identity');
    else groups.add(field);
  }
  return [...groups];
}

export const appointmentConflictLabels = Object.freeze({
  time: 'fecha, hora o duración', identity: 'paciente o clase de evento', calendarId: 'calendario',
  type: 'tipo', modality: 'modalidad', status: 'estado', adminReviewStatus: 'revisión administrativa',
  notes: 'notas de preparación',
});

/** Rebase a local form onto the latest server copy without losing disjoint edits. */
export function rebaseAppointmentDraft(draft, current, changedFields, conflictFields, keepMine) {
  const next = { ...draft };
  const localGroups = appointmentConflictGroups(changedFields);
  const disputedGroups = appointmentConflictGroups(conflictFields);
  const takeServer = group => !localGroups.includes(group) || (!keepMine && disputedGroups.includes(group));
  if (takeServer('identity')) {
    for (const field of ['eventType', 'patientId', 'title']) next[field] = current[field] || '';
  }
  if (takeServer('time')) {
    const start = new Date(current.start);
    next.start = Number.isNaN(start.getTime()) ? draft.start
      : new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const minutes = Math.round((new Date(current.end) - start) / 60000);
    next.duration = Number.isFinite(minutes) && minutes > 0 ? minutes : draft.duration;
  }
  for (const field of ['calendarId', 'type', 'modality', 'status', 'adminReviewStatus', 'notes']) {
    if (takeServer(field)) next[field] = current[field] ?? (field === 'notes' ? '' : next[field]);
  }
  return next;
}
