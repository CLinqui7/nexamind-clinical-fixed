// Keep this contract aligned with linkare_permission_v3; the database is authoritative.
export const CALENDAR_DEFINITIONS = Object.freeze([
 { code: 'doctor', name: 'Doctor', visualKey: 'stethoscope' },
 { code: 'wife', name: 'Esposa', visualKey: 'heart' },
 { code: 'general', name: 'General', visualKey: 'users' },
]);
export const CALENDAR_ACTIONS = Object.freeze(['View','Create','Edit','Cancel','Delete']);
export const calendarPermissionKey = (calendarCode, action) => `calendar${String(calendarCode || '').charAt(0).toUpperCase()}${String(calendarCode || '').slice(1)}${action}`;
export const CALENDAR_PERMISSION_KEYS = Object.freeze(CALENDAR_DEFINITIONS.flatMap(calendar => CALENDAR_ACTIONS.map(action => calendarPermissionKey(calendar.code, action))));
export const BASE_PERMISSION_KEYS = Object.freeze(['patientsView','patientsCreate','patientsEdit','appointmentsManage','remindersManage','clinicalView','clinicalEdit','medicationsCapture','medicationsManage','prescriptionsCreate','prescriptionsEdit','documentsView','documentsManage','documentsGenerateAdministrative','documentsGenerateClinical','consultationsManage','postmortemExport','alertsView','analyticsView','exportsManage','settingsManage','usersManage']);
export const PERMISSION_KEYS = Object.freeze([...BASE_PERMISSION_KEYS, ...CALENDAR_PERMISSION_KEYS]);
export const OWNER_ONLY = Object.freeze(['settingsManage','usersManage','billingManage','accessManage']);
export const SECRETARY_BASE_PERMISSIONS = Object.freeze(['patientsView','patientsCreate','patientsEdit','remindersManage','medicationsCapture','prescriptionsEdit','documentsGenerateAdministrative']);
// appointmentsManage is an internal compatibility capability; it is never rendered as a Secretary grant.
export const ADMIN_PERMISSIONS = Object.freeze([...SECRETARY_BASE_PERMISSIONS, 'appointmentsManage', ...CALENDAR_PERMISSION_KEYS]);
export const SECRETARY_ASSIGNABLE_PERMISSIONS = Object.freeze([...SECRETARY_BASE_PERMISSIONS, ...CALENDAR_PERMISSION_KEYS]);
export const ROLE_LABELS = Object.freeze({owner:'Propietario / Admin',doctor:'Doctor',nurse:'Enfermería',secretary:'Secretaría'});
export function uiRole(role) { return ({psychiatrist:'doctor',clinical_assistant:'nurse'})[role] || role; }
export function permissionAllowed(member, permission) {
 if (!member || member.active === false || !PERMISSION_KEYS.includes(permission) && !OWNER_ONLY.includes(permission)) return false;
 const role=uiRole(member.role);
 if (role==='owner') return true;
 if (OWNER_ONLY.includes(permission) || !['doctor','nurse','secretary'].includes(role)) return false;
 if (role==='secretary' && permission==='appointmentsManage') return CALENDAR_PERMISSION_KEYS.some(key=>member.permissions?.[key]===true);
 if (role==='secretary' && !ADMIN_PERMISSIONS.includes(permission)) return false;
 if (member.permissions?.[permission] !== true) return false;
 if (CALENDAR_PERMISSION_KEYS.includes(permission) && !permission.endsWith('View')) {
  const viewKey=permission.replace(/(Create|Edit|Cancel|Delete)$/,'View');
  if(member.permissions?.[viewKey]!==true)return false;
 }
 if (['clinicalEdit','medicationsManage','prescriptionsCreate','documentsGenerateClinical','consultationsManage','postmortemExport','analyticsView'].includes(permission) && member.permissions?.clinicalView !== true) return false;
 if (permission==='documentsManage' && member.permissions?.documentsView !== true) return false;
 if (['clinicalView','clinicalEdit','medicationsCapture','medicationsManage','prescriptionsCreate','documentsGenerateAdministrative','documentsGenerateClinical','consultationsManage','postmortemExport','analyticsView','documentsView','documentsManage','patientsEdit','prescriptionsEdit'].includes(permission) && member.permissions?.patientsView !== true) return false;
 return true;
}
export function calendarPermissionAllowed(member, calendar, action='View') {
 const code=typeof calendar==='string'?calendar:calendar?.code;
 if(!code || !CALENDAR_DEFINITIONS.some(item=>item.code===code) || !CALENDAR_ACTIONS.includes(action))return false;
 const role=uiRole(member?.role);
 if(role==='owner')return member?.active!==false;
 const exact=calendarPermissionKey(code,action);
 if(permissionAllowed(member,exact))return true;
 // Existing doctor/nurse accounts retain their old agenda grant until an owner customizes calendar access.
 return role!=='secretary' && permissionAllowed(member,'appointmentsManage');
}
export function assignablePermissions(role='secretary') {
 return uiRole(role)==='secretary' ? SECRETARY_ASSIGNABLE_PERMISSIONS : PERMISSION_KEYS.filter(key=>!OWNER_ONLY.includes(key));
}
export function defaultPermissions(role='secretary') {
 const normalized=uiRole(role);
 const allowed=normalized==='nurse'?[...SECRETARY_BASE_PERMISSIONS,'appointmentsManage',...CALENDAR_PERMISSION_KEYS]:assignablePermissions(normalized);
 return Object.fromEntries(PERMISSION_KEYS.map(key=>[key,allowed.includes(key) && ['secretary','doctor','nurse'].includes(normalized)]));
}
export function changePermission(permissions,key,value) {
 const next={...permissions,[key]:value};
 const clinical=['clinicalEdit','medicationsManage','prescriptionsCreate','documentsGenerateClinical','consultationsManage','postmortemExport','analyticsView'];
 const patient=['clinicalView','medicationsCapture','documentsGenerateAdministrative',...clinical,'documentsView','documentsManage','patientsEdit','prescriptionsEdit'];
 if(value){
  if(patient.includes(key))next.patientsView=true;
  if(clinical.includes(key))next.clinicalView=true;
  if(key==='documentsManage')next.documentsView=true;
  if(CALENDAR_PERMISSION_KEYS.includes(key) && !key.endsWith('View'))next[key.replace(/(Create|Edit|Cancel|Delete)$/,'View')]=true;
 } else {
  if(key==='patientsView')for(const child of patient)next[child]=false;
  if(key==='clinicalView')for(const child of clinical)next[child]=false;
  if(key==='documentsView')next.documentsManage=false;
  if(CALENDAR_PERMISSION_KEYS.includes(key) && key.endsWith('View'))for(const action of CALENDAR_ACTIONS.slice(1))next[key.replace(/View$/,action)]=false;
 }
 return next;
}
