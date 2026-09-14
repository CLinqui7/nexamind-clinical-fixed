import { supabase, supabaseConfigured, assertSupabaseConfigured } from '../lib/supabase.js';
import { StateWriter } from '../domain/state-writer.js';

export const appMode = 'production';
export const productionMode = true;
export const publicAppUrl = String(import.meta.env.VITE_PUBLIC_APP_URL || 'https://nexamind-clinical.vercel.app').trim().replace(/\/+$/, '');

export function readableError(error) {
  const text=String(error?.message || error || 'No se pudo completar la operación.');
  const messages={
    SUBSCRIPTION_REQUIRED:'Seleccione o renueve un plan para guardar registros. Puede consultar la información existente.',
    REVISION_CONFLICT:'Otra persona modificó este registro. Sus cambios no se sobrescribieron. Copie sus anotaciones y recargue los datos antes de continuar.',
    SIGNED_NOTE_IMMUTABLE:'La nota ya está firmada y no puede reemplazarse. Registre una nueva nota o adenda.',
    INVALID_SIGNER:'Solo el autor autenticado puede firmar esta nota.',
    ACCOUNT_DISABLED:'Su acceso fue desactivado por el responsable del consultorio.',
    ACCESS_DENIED:'Su cuenta no tiene permiso para esta operación.',
    EMAIL_NOT_CONFIRMED:'Confirme su correo antes de ingresar.',
    INVITATION_EXPIRED:'La invitación venció. Solicite una nueva al médico.',
    INVITATION_REQUIRED:'Necesita una invitación del consultorio para ingresar.',
    LOGIN_REQUIRED:'Su sesión finalizó. Inicie sesión nuevamente.',
    'Invalid login credentials':'El correo o la contraseña no son correctos.',
    'Email not confirmed':'Revise su correo y confirme su cuenta.',
    'Failed to fetch':'No se pudo conectar con el servidor. Sus cambios pendientes siguen en esta pantalla.',
    'schema cache':'La base de datos requiere la migración de Linkare 3.0. Contacte a la administración.',
  };
  for(const [key,message] of Object.entries(messages)) if(text.includes(key)) return message;
  return text.slice(0,360);
}
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
  if(!supabase)return;
  const {error}=await supabase.auth.signOut({scope:'local'}); if(error)throw new Error(readableError(error));
  resetPersistence();
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
export async function bootstrapAndLoadState(_unused,requestedOrganizationName=null) {
  const organizationId=await rpc('linkare_bootstrap_v3',{requested_name:requestedOrganizationName});
  const result=await rpc('linkare_load_state_v3',{org:organizationId});
  if(!['doctor','secretary'].includes(result?.memberRole) || !result?.userId)throw new Error('No hay un rol habilitado para su cuenta.');
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
// Billing prices and validity are exclusively maintained by server functions.
export async function savePlatformBillingSettings(){throw new Error('El precio se define por el plan elegido. No puede modificarse desde el consultorio.');}
