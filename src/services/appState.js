import { supabase, supabaseConfigured, assertSupabaseConfigured } from '../lib/supabase.js';
import { StateWriter } from '../domain/state-writer.js';
import { APPOINTMENT_KEYS, pick } from '../domain/records.js';

export const appMode = 'production';
export const productionMode = true;
export const publicAppUrl = String(import.meta.env.VITE_PUBLIC_APP_URL || 'https://nexamind-clinical.vercel.app').trim().replace(/\/+$/, '');

import { readableError } from '../domain/errors.js';
export { readableError };

async function rpc(name,args={},options={}) {
  const request=assertSupabaseConfigured().rpc(name,args);
  if(options.signal&&typeof request.abortSignal==='function')request.abortSignal(options.signal);
  const {data,error}=await request;
  if(error) { const e=new Error(readableError(error));e.code=error.code;e.original=error.message;throw e; }
  return data;
}
export async function signUpProduction({fullName,clinicName,email,password}) {
  const client=assertSupabaseConfigured();
  if(!String(fullName||'').trim() || !String(clinicName||'').trim())throw new Error('Complete su nombre y el nombre del consultorio.');
  if(String(password||'').length<12)throw new Error('Use una contraseña de al menos 12 caracteres.');
  const {data,error}=await client.auth.signUp({email:String(email).trim().toLowerCase(),password,options:{emailRedirectTo:publicAppUrl+'/?auth=confirmed',data:{full_name:fullName.trim(),clinic_name:clinicName.trim()}}});
  if(error)throw new Error(readableError(error));
  return {user:data.user,session:data.session,needsEmailConfirmation:!data.session,clinicName};
}
export async function signInProduction(email,password) {
  const {data,error}=await assertSupabaseConfigured().auth.signInWithPassword({email:String(email).trim().toLowerCase(),password});
  if(error)throw new Error(readableError(error));return data.session;
}
export async function getProductionSession() {
  if(!supabaseConfigured)return null;
  const {data,error}=await supabase.auth.getSession();if(error)throw new Error(readableError(error));return data.session;
}
export async function signOutProduction() {
  try {
    if(!supabase)return;
    const {error}=await supabase.auth.signOut({scope:'local'});
    if(error){
      // Explicitly clear only this project's Auth storage on an offline sign-out.
      supabase.auth.stopAutoRefresh();
      const storageKey=supabase.auth.storageKey;
      if(storageKey)for(const suffix of ['', '-code-verifier','-user'])localStorage.removeItem(storageKey+suffix);
      throw new Error(readableError(error));
    }
  } finally { resetPersistence(); }
}
export async function requestPasswordReset(email) {
  const {error}=await assertSupabaseConfigured().auth.resetPasswordForEmail(String(email).trim().toLowerCase(),{redirectTo:publicAppUrl+'/?auth=reset'});
  if(error)throw new Error(readableError(error));
}
export async function resendConfirmation(email) {
  const {error}=await assertSupabaseConfigured().auth.resend({type:'signup',email:String(email).trim(),options:{emailRedirectTo:publicAppUrl+'/?auth=confirmed'}});
  if(error)throw new Error(readableError(error));
}
export async function setAccountPassword(password) {
  if(String(password).length<12)throw new Error('Use al menos 12 caracteres.');
  const {error}=await assertSupabaseConfigured().auth.updateUser({password});if(error)throw new Error(readableError(error));
}
export async function changeAccountPassword(email,currentPassword,password) { await signInProduction(email,currentPassword);await setAccountPassword(password); }
export function onAuthChange(callback) { return supabase?.auth.onAuthStateChange(callback)?.data?.subscription || null; }
export function checkProductionAccess(organizationId) { return rpc('linkare_access_v3',{org:organizationId}); }
export async function bootstrapAndLoadState(_unused,requestedOrganizationName=null) {
  const organizationId=await rpc('linkare_bootstrap_v3',{requested_name:requestedOrganizationName});
  const result=await rpc('linkare_bootstrap_state_v4',{org:organizationId});
  if(!['owner','doctor','nurse','secretary'].includes(result?.memberRole) || !result?.userId)throw new Error('No hay un rol habilitado para su cuenta.');
  return result;
}

let activeOrganization=null;
async function serializeClinicalWrite(organizationId,write){
  const locks=globalThis.navigator?.locks;
  if(!locks?.request)return write();
  // The Web Locks API coordinates all tabs on this browser profile/origin.
  // Server revisions still resolve true conflicts; this only prevents tabs
  // belonging to the same clinic from hammering PostgreSQL simultaneously.
  return locks.request(`linkare-save:${organizationId}`,{mode:'exclusive'},write);
}
const sendChanges=changes=>{
  const organizationId=activeOrganization;
  return serializeClinicalWrite(organizationId,()=>rpc('linkare_save_changes_v3',{org:organizationId,changes}));
};
const writer=new StateWriter(sendChanges);
export function setPersistenceBaseline(organizationId,data,revisions,clinical){activeOrganization=organizationId;writer.seed(data,revisions,clinical,{allowDeletes:false});}
export function mergePersistenceBaseline(data,revisions,clinical){writer.merge(data,revisions,clinical);}
export function mergeAppointmentPersistenceBaseline(organizationId,appointment){
  if(!organizationId || organizationId!==activeOrganization)throw new Error('La sesión de guardado no coincide con el consultorio.');
  if(!appointment?.id || !Number.isInteger(Number(appointment.__revision)))throw new Error('Falta la revisión de la cita guardada.');
  writer.mergeRecord({kind:'appointment',id:appointment.id,payload:pick(appointment,APPOINTMENT_KEYS)},Number(appointment.__revision));
  if(Number.isInteger(Number(appointment.__notesRevision))&&Number(appointment.__notesRevision)>0){
    writer.mergeRecord({kind:'appointment_clinical',id:appointment.id,payload:{notes:appointment.notes||''}},Number(appointment.__notesRevision));
  }
}
export function resetPersistence(){activeOrganization=null;writer.reset();}
export function saveProductionState(organizationId,payload){
  if(!organizationId || organizationId!==activeOrganization)throw new Error('La sesión de guardado no coincide con el consultorio.');
  return writer.save(payload);
}
/**
 * Create one appointment without diffing and rewriting the rest of the loaded
 * patient state. This keeps the calendar submit bounded to the two records it
 * owns and prevents a second autosave from competing for the same locks.
 */
export function createProductionAppointment(organizationId,appointment,{includeClinical=false}={}){
  if(!organizationId || organizationId!==activeOrganization)throw new Error('La sesión de guardado no coincide con el consultorio.');
  const changes=[{kind:'appointment',id:appointment.id,expectedRevision:0,deleted:false,payload:pick(appointment,APPOINTMENT_KEYS)}];
  if(includeClinical && String(appointment.notes||'').trim())changes.push({kind:'appointment_clinical',id:appointment.id,expectedRevision:0,deleted:false,payload:{notes:String(appointment.notes).trim()}});
  return serializeClinicalWrite(organizationId,()=>rpc('linkare_save_changes_v3',{org:organizationId,changes}));
}
export function setProductionAppointmentStatus(organizationId,appointmentId,status){
  if(!organizationId || organizationId!==activeOrganization)throw new Error('La sesión de guardado no coincide con el consultorio.');
  return serializeClinicalWrite(organizationId,()=>rpc('linkare_set_appointment_status_v1',{org:organizationId,p_appointment_id:appointmentId,p_status:status}));
}
export async function patchProductionAppointment(organizationId,appointmentId,expectedRevision,base,changes){
  if(!organizationId || organizationId!==activeOrganization)throw new Error('La sesión de guardado no coincide con el consultorio.');
  if(!Number.isInteger(expectedRevision)||expectedRevision<1)throw new Error('Falta la revisión de la cita. Actualice la agenda.');
  const result=await serializeClinicalWrite(organizationId,()=>rpc('linkare_patch_appointment_v1',{
    org:organizationId,p_appointment_id:appointmentId,p_expected_revision:expectedRevision,p_base:base,p_changes:changes,
  }));
  if(result?.conflict&&result.code==='FIELD_CONFLICT'&&Array.isArray(result.fields)&&result.current)return result;
  if(result?.saved!==true||result.appointment?.id!==appointmentId)throw new Error('No se confirmó la actualización de la cita.');
  return result;
}
export async function deleteProductionAppointment(organizationId,appointmentId,expectedRevision){
  if(!organizationId || organizationId!==activeOrganization)throw new Error('La sesión de guardado no coincide con el consultorio.');
  if(!Number.isInteger(expectedRevision) || expectedRevision<1)throw new Error('Falta la revisión de la cita. Actualice la agenda.');
  const result=await serializeClinicalWrite(organizationId,()=>rpc('linkare_delete_appointment_v1',{
    org:organizationId,p_appointment_id:appointmentId,p_expected_revision:expectedRevision,
  }));
  if(result?.conflict){const error=new Error('REVISION_CONFLICT');error.code='REVISION_CONFLICT';throw error;}
  if(result?.deleted!==true || result.id!==appointmentId)throw new Error('No se confirmó la eliminación del evento.');
  return result;
}
export function forgetAppointmentPersistenceBaseline(organizationId,appointmentId){
  if(!organizationId || organizationId!==activeOrganization)throw new Error('La sesión de guardado no coincide con el consultorio.');
  writer.forgetRecord('appointment',appointmentId);
  writer.forgetRecord('appointment_clinical',appointmentId);
}
export function captureReportedMedication(organizationId,patientId,draft){
  return rpc('linkare_capture_medication_v1',{org:organizationId,patient_id:patientId,input:draft});
}
export function loadDailyAgenda(organizationId,date){
  return rpc('linkare_daily_agenda_v1',{org:organizationId,agenda_date:date});
}
export function loadPrintableAgenda(organizationId,date){
  return rpc('linkare_printable_agenda_v1',{org:organizationId,agenda_date:date});
}
export function saveAgendaNote(organizationId,appointmentId,note,expectedRevision){
  return rpc('linkare_save_agenda_note_v1',{org:organizationId,p_appointment_id:appointmentId,p_note:note,p_expected_revision:expectedRevision});
}
export function loadPatientDirectory(organizationId,{scope='recent',query='',cursor=null,asOf=null,limit=20,signal}={}){
  return rpc('linkare_patient_directory_v1',{org:organizationId,p_scope:scope,p_query:query||null,p_cursor:cursor,p_as_of:asOf,p_limit:Math.min(20,limit)},{signal});
}
export function loadPatientDetail(organizationId,patientId,{signal}={}){
  return rpc('linkare_patient_detail_v1',{org:organizationId,p_patient_id:patientId},{signal});
}
export function loadAgendaRange(organizationId,{start,end,calendarIds=null,cursor=null,limit=200,signal}={}){
  return rpc('linkare_agenda_range_v1',{org:organizationId,p_start:start,p_end:end,p_calendar_ids:calendarIds?.length?calendarIds:null,p_cursor:cursor,p_limit:Math.min(200,limit)},{signal});
}
export function loadDashboardSummary(organizationId,{asOf=null,signal}={}){
  return rpc('linkare_dashboard_summary_v1',{org:organizationId,p_as_of:asOf},{signal});
}
export function loadProfileAssets(organizationId,{signal}={}){
  return rpc('linkare_profile_assets_v1',{org:organizationId},{signal});
}
export function loadLegacyPatientHistory(organizationId,patientId,cursor=null,limit=20,scope='all'){
  return rpc('linkare_legacy_patient_history_v2',{org:organizationId,p_patient_id:patientId,p_scope:scope,p_cursor:cursor,p_limit:Math.min(20,limit)});
}
export function archiveMedication(organizationId,patientId,medicationId,reason){
  return rpc('linkare_archive_medication_v1',{p_org:organizationId,p_patient_id:patientId,p_medication_id:medicationId,p_reason:reason});
}
export function archivePatient(organizationId,patientId,reason){
  return rpc('linkare_archive_patient_v1',{p_org:organizationId,p_patient_id:patientId,p_reason:reason});
}
// Billing prices and validity are exclusively maintained by server functions.
export async function savePlatformBillingSettings(){throw new Error('El precio se define por el plan elegido. No puede modificarse desde el consultorio.');}
