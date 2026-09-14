import { invokeAuthedFunction } from '../lib/supabase.js';
export async function manageTeam(organizationId,action,input={}) {
  const {data,error}=await invokeAuthedFunction('linkare-team',{organizationId,action,...input});
  if(error){let message=error.message;try{const p=await error.context?.clone().json();message=p?.message||message;}catch{}throw new Error(message);}
  if(!data?.ok)throw new Error(data?.message||'No se pudo actualizar el equipo.');return data;
}
