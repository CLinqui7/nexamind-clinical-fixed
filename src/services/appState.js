import { supabase, supabaseConfigured, assertSupabaseConfigured } from '../lib/supabase.js';
import { StateWriter } from '../domain/state-writer.js';

export const appMode = 'production';
export const productionMode = true;
export const publicAppUrl = String(import.meta.env.VITE_PUBLIC_APP_URL || 'https://nexamind-clinical.vercel.app').trim().replace(/\/+$/, '');

import { readableError } from '../domain/errors.js';
export { readableError };

async function rpc(name,args={}) {
  const {data,error}=await assertSupabaseConfigured().rpc(name,args);
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
  const result=await rpc('linkare_load_state_v3',{org:organizationId});
  if(!['owner','doctor','nurse','secretary'].includes(result?.memberRole) || !result?.userId)throw new Error('No hay un rol habilitado para su cuenta.');
  return result;
}

let activeOrganization=null;
const writer=new StateWriter(changes=>rpc('linkare_save_changes_v3',{org:activeOrganization,changes}));
export function setPersistenceBaseline(organizationId,data,revisions,clinical){activeOrganization=organizationId;writer.seed(data,revisions,clinical);}
export function resetPersistence(){activeOrganization=null;writer.reset();}
export function saveProductionState(organizationId,payload){
  if(!organizationId || organizationId!==activeOrganization)throw new Error('La sesión de guardado no coincide con el consultorio.');
  return writer.save(payload);
}
export function captureReportedMedication(organizationId,patientId,draft){
  return rpc('linkare_capture_medication_v1',{org:organizationId,patient_id:patientId,input:draft});
}
export function loadDailyAgenda(organizationId,date){
  return rpc('linkare_daily_agenda_v1',{org:organizationId,agenda_date:date});
}
// Billing prices and validity are exclusively maintained by server functions.
export async function savePlatformBillingSettings(){throw new Error('El precio se define por el plan elegido. No puede modificarse desde el consultorio.');}
