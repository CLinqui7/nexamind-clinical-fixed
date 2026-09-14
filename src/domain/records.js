/** Persistence contract shared by the UI and tests. No authentication data is persisted here. */
export const ADMIN_PATIENT_KEYS = Object.freeze([
  'id', 'name', 'initials', 'age', 'phone', 'email', 'photo', 'insurance',
  'nextVisit', 'archived', 'createdAt', 'updatedAt', 'notificationPreferences',
]);
export const APPOINTMENT_KEYS = Object.freeze([
  'id', 'patientId', 'title', 'start', 'end', 'type', 'modality', 'status',
  'reminderLog', 'googleEventId', 'googleEventUrl', 'createdAt', 'updatedAt',
]);
export const PROFILE_KEYS = Object.freeze(['name','clinician','specialty','professionalLicense','address','phone','email','website','clinicLogo','doctorPhoto','prescriptionFooter','updatedAt']);
export const SETTINGS_KEYS = Object.freeze(['largeText','reducedMotion','simpleMode','theme','reminderHours','reminderChannels','palette']);
export const SECRETARY_PERMISSIONS = Object.freeze(['patientsView','patientsCreate','patientsEdit','appointmentsManage','remindersManage']);
export function pick(value, keys) {
  return Object.fromEntries(keys.filter(key => value?.[key] !== undefined).map(key => [key, value[key]]));
}
export function stableJSON(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJSON).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => JSON.stringify(k)+':'+stableJSON(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function recordKey(kind,id) { return `${kind}:${id}`; }
export function projectRecords(data, clinical = false) {
  const out = new Map();
  const add = (kind,id,payload) => out.set(recordKey(kind,id), {kind,id:String(id),payload});
  if (clinical) {
    add('profile','clinic',pick(data.organization, PROFILE_KEYS));
    add('settings','clinic',pick(data.settings, SETTINGS_KEYS));
  }
  for (const patient of data.patients || []) {
    add('patient_admin',patient.id,pick(patient,ADMIN_PATIENT_KEYS));
    if(clinical) {
      const privateFields=Object.fromEntries(Object.entries(patient).filter(([k])=>!ADMIN_PATIENT_KEYS.includes(k) && !k.startsWith('__')));
      add('patient_clinical',patient.id,privateFields);
    }
  }
  for (const a of data.appointments || []) {
    add('appointment',a.id,pick(a,APPOINTMENT_KEYS));
    if (clinical) add('appointment_clinical',a.id,{notes:a.notes || ''});
  }
  if(clinical) for(const alert of data.alerts || []) add('alert',alert.id,alert);
  return out;
}
export function diffRecords(previous, next, revisions = new Map()) {
  const changes=[];
  for(const [key,record] of next) {
    const old=previous.get(key);
    if(!old || stableJSON(old.payload)!==stableJSON(record.payload)) changes.push({...record,expectedRevision:revisions.get(key)||0,deleted:false});
  }
  for(const [key,record] of previous) if(!next.has(key)) changes.push({kind:record.kind,id:record.id,expectedRevision:revisions.get(key)||0,deleted:true,payload:{}});
  return changes;
}
export function isSignedNote(note) { return Boolean(note?.signedAt) || ['completed','signed'].includes(note?.status); }
export function signedNotesUnchanged(before, after) {
  return (before||[]).filter(isSignedNote).every(old => {
    const current=(after||[]).find(n=>n.id===old.id);
    return current && stableJSON(current)===stableJSON(old);
  });
}
