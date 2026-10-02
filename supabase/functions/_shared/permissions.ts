// Keep this contract aligned with linkare_permission_v3; the database is authoritative.
export const CALENDAR_DEFINITIONS = Object.freeze([{code:'doctor',name:'Doctor'},{code:'wife',name:'Esposa'},{code:'general',name:'General'}]);
export const CALENDAR_ACTIONS = Object.freeze(['View','Create','Edit','Cancel','Delete']);
export const calendarPermissionKey = (calendarCode:string,action:string)=>`calendar${String(calendarCode||'').charAt(0).toUpperCase()}${String(calendarCode||'').slice(1)}${action}`;
export const CALENDAR_PERMISSION_KEYS = Object.freeze(CALENDAR_DEFINITIONS.flatMap(calendar=>CALENDAR_ACTIONS.map(action=>calendarPermissionKey(calendar.code,action))));
export const BASE_PERMISSION_KEYS = Object.freeze(['patientsView','patientsCreate','patientsEdit','appointmentsManage','remindersManage','clinicalView','clinicalEdit','medicationsCapture','medicationsManage','prescriptionsCreate','prescriptionsEdit','documentsView','documentsManage','documentsGenerateAdministrative','documentsGenerateClinical','consultationsManage','postmortemExport','alertsView','analyticsView','exportsManage','settingsManage','usersManage']);
export const PERMISSION_KEYS = Object.freeze([...BASE_PERMISSION_KEYS,...CALENDAR_PERMISSION_KEYS]);
export const OWNER_ONLY = Object.freeze(['settingsManage','usersManage','billingManage','accessManage']);
export const SECRETARY_BASE_PERMISSIONS = Object.freeze(['patientsView','patientsCreate','patientsEdit','remindersManage','medicationsCapture','prescriptionsEdit','documentsGenerateAdministrative']);
export const ADMIN_PERMISSIONS = Object.freeze([...SECRETARY_BASE_PERMISSIONS,'appointmentsManage',...CALENDAR_PERMISSION_KEYS]);
export const SECRETARY_ASSIGNABLE_PERMISSIONS = Object.freeze([...SECRETARY_BASE_PERMISSIONS,...CALENDAR_PERMISSION_KEYS]);
export const ROLE_LABELS = Object.freeze({owner:'Propietario / Admin',doctor:'Doctor',nurse:'Enfermería',secretary:'Secretaría'});
export function uiRole(role:string){return({psychiatrist:'doctor',clinical_assistant:'nurse'} as Record<string,string>)[role]||role;}
export function permissionAllowed(member:any,permission:string){
 if(!member||member.active===false||!PERMISSION_KEYS.includes(permission)&&!OWNER_ONLY.includes(permission))return false;
 const role=uiRole(member.role);if(role==='owner')return true;
 if(OWNER_ONLY.includes(permission)||!['doctor','nurse','secretary'].includes(role))return false;
 if(role==='secretary'&&permission==='appointmentsManage')return CALENDAR_PERMISSION_KEYS.some(key=>member.permissions?.[key]===true);
 if(role==='secretary'&&!ADMIN_PERMISSIONS.includes(permission))return false;
 if(member.permissions?.[permission]!==true)return false;
 if(CALENDAR_PERMISSION_KEYS.includes(permission)&&!permission.endsWith('View')&&member.permissions?.[permission.replace(/(Create|Edit|Cancel|Delete)$/,'View')]!==true)return false;
 if(['clinicalEdit','medicationsManage','prescriptionsCreate','documentsGenerateClinical','consultationsManage','postmortemExport','analyticsView'].includes(permission)&&member.permissions?.clinicalView!==true)return false;
 if(permission==='documentsManage'&&member.permissions?.documentsView!==true)return false;
 if(['clinicalView','clinicalEdit','medicationsCapture','medicationsManage','prescriptionsCreate','documentsGenerateAdministrative','documentsGenerateClinical','consultationsManage','postmortemExport','analyticsView','documentsView','documentsManage','patientsEdit','prescriptionsEdit'].includes(permission)&&member.permissions?.patientsView!==true)return false;
 return true;
}
export function calendarPermissionAllowed(member:any,calendarCode:string,action='View'){
 if(!CALENDAR_DEFINITIONS.some(calendar=>calendar.code===calendarCode)||!CALENDAR_ACTIONS.includes(action))return false;
 const role=uiRole(member?.role);if(role==='owner')return member?.active!==false;
 if(permissionAllowed(member,calendarPermissionKey(calendarCode,action)))return true;
 return role!=='secretary'&&permissionAllowed(member,'appointmentsManage');
}
export function defaultPermissions(role='secretary'){
 const normalized=uiRole(role);const allowed=normalized==='secretary'?SECRETARY_ASSIGNABLE_PERMISSIONS:normalized==='nurse'?[...SECRETARY_BASE_PERMISSIONS,'appointmentsManage',...CALENDAR_PERMISSION_KEYS]:PERMISSION_KEYS;
 return Object.fromEntries(PERMISSION_KEYS.map(key=>[key,allowed.includes(key)&&['secretary','doctor','nurse'].includes(normalized)]));
}
