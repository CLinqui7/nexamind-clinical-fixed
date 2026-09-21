// Keep this contract aligned with linkare_permission_v3; the database is authoritative.
export const PERMISSION_KEYS = Object.freeze(["patientsView", "patientsCreate", "patientsEdit", "appointmentsManage", "remindersManage", "clinicalView", "clinicalEdit", "medicationsManage", "prescriptionsCreate", "prescriptionsEdit", "documentsView", "documentsManage", "consultationsManage", "postmortemExport", "alertsView", "analyticsView", "exportsManage", "settingsManage", "usersManage"]);
export const OWNER_ONLY = Object.freeze(['settingsManage','usersManage','billingManage','accessManage']);
export const ADMIN_PERMISSIONS = Object.freeze(['patientsView','patientsCreate','patientsEdit','appointmentsManage','remindersManage','prescriptionsEdit']);
export const ROLE_LABELS = Object.freeze({owner:'Propietario / Admin',doctor:'Doctor',nurse:'Enfermería',secretary:'Secretaría'});
export function uiRole(role) { return ({psychiatrist:'doctor',clinical_assistant:'nurse'})[role] || role; }
export function permissionAllowed(member, permission) {
 if (!member || member.active === false || !PERMISSION_KEYS.includes(permission) && !OWNER_ONLY.includes(permission)) return false;
 const role=uiRole(member.role);
 if (role==='owner') return true;
 if (OWNER_ONLY.includes(permission) || !['doctor','nurse','secretary'].includes(role)) return false;
 if (role==='secretary' && !ADMIN_PERMISSIONS.includes(permission)) return false;
 if (member.permissions?.[permission] !== true) return false;
 if (['clinicalEdit','medicationsManage','prescriptionsCreate','consultationsManage','postmortemExport','analyticsView'].includes(permission) && member.permissions?.clinicalView !== true) return false;
 if (permission==='documentsManage' && member.permissions?.documentsView !== true) return false;
 if (['clinicalView','clinicalEdit','medicationsManage','prescriptionsCreate','consultationsManage','postmortemExport','analyticsView','documentsView','documentsManage','patientsEdit','prescriptionsEdit'].includes(permission) && member.permissions?.patientsView !== true) return false;
 return true;
}
export function defaultPermissions(role='secretary') {
 return Object.fromEntries(PERMISSION_KEYS.map(key=>[key, ADMIN_PERMISSIONS.includes(key) || uiRole(role)==='doctor' && !OWNER_ONLY.includes(key)]));
}
export function changePermission(permissions,key,value) {
 const next={...permissions,[key]:value};
 const clinical=['clinicalEdit','medicationsManage','prescriptionsCreate','consultationsManage','postmortemExport','analyticsView'];
 const patient=['clinicalView',...clinical,'documentsView','documentsManage','patientsEdit','prescriptionsEdit'];
 if(value){
  if(patient.includes(key))next.patientsView=true;
  if(clinical.includes(key))next.clinicalView=true;
  if(key==='documentsManage')next.documentsView=true;
 } else {
  if(key==='patientsView')for(const child of patient)next[child]=false;
  if(key==='clinicalView')for(const child of clinical)next[child]=false;
  if(key==='documentsView')next.documentsManage=false;
 }
 return next;
}
