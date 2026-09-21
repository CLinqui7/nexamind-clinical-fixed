import {invokeAuthedFunction} from '../lib/supabase.js';
async function call(payload){const {data,error}=await invokeAuthedFunction('family-reminders',payload);if(error){let message=error.message||'No se pudo guardar el contacto.';try{if(error.context instanceof Response)message=(await error.context.clone().json())?.message||message;}catch{}throw new Error(message);}if(!data?.ok)throw new Error(data?.message||'No se pudo completar la operación.');return data;}
export async function listFamilyReminderRecipients(organizationId){return (await call({organizationId,action:'list'})).recipients||[];}
export async function saveFamilyReminderRecipient(organizationId,recipient){return call({organizationId,action:'save',...recipient});}
export async function removeFamilyReminderRecipient(organizationId,id){return call({organizationId,action:'remove',id});}
