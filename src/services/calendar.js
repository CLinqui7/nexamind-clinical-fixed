import { invokeAuthedFunction } from '../lib/supabase.js';

async function unwrap(data, error, fallback) {
  if (error) {
    let message = error.message || fallback;
    try {
      if (error.context instanceof Response) {
        const payload = await error.context.clone().json().catch(() => null);
        message = payload?.message || payload?.error || message;
      }
    } catch (_) { /* Keep generic message. */ }
    throw new Error(message);
  }
  if (!data?.ok) throw new Error(data?.message || fallback);
  return data;
}

export async function requestGoogleCalendarConnection(organizationId) {
  const { data, error } = await invokeAuthedFunction('google-calendar-auth-url', { organizationId });
  const result = await unwrap(data, error, 'No se pudo iniciar la conexión con Google Calendar.');
  if (!result.url) throw new Error('Google Calendar no devolvió una URL de autorización.');
  window.location.href = result.url;
  return result;
}

export async function fetchCalendarIntegrationStatus(organizationId) {
  const { data, error } = await invokeAuthedFunction('calendar-status', { organizationId });
  return (await unwrap(data, error, 'No se pudo consultar los calendarios.')).status;
}

export async function syncAppointmentToGoogle(organizationId, appointment) {
  const { data, error } = await invokeAuthedFunction('google-calendar-sync', { organizationId, appointmentId: appointment.id });
  return await unwrap(data, error, 'No se pudo sincronizar la cita con Google Calendar.');
}

export async function createAppleCalendarFeed(organizationId,scope='staff_busy',patientId=null,action='create',tokenId=null) {
  const { data, error } = await invokeAuthedFunction('calendar-feed-token', { organizationId,scope,patientId,action,tokenId });
  return await unwrap(data, error, 'No se pudo crear el enlace de Apple Calendar.');
}

export async function listCalendarFeeds(organizationId) {
  const {data,error}=await invokeAuthedFunction('calendar-feed-token',{organizationId,action:'list'});
  return (await unwrap(data,error,'No se pudieron consultar los calendarios compartidos.')).feeds||[];
}
