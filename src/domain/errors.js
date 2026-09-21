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
    'Failed to send a request to the Edge Function':'No se pudo conectar con el servidor. Intente nuevamente.',
    'Edge Function returned a non-2xx status code':'No fue posible cargar esta integración. Intente nuevamente.',
    'Failed to fetch':'No se pudo conectar con el servidor. Sus cambios pendientes siguen en esta pantalla.',
    'schema cache':'La base de datos requiere la migración de Linkare 3.0. Contacte a la administración.',
  };
  for(const [key,message] of Object.entries(messages)) if(text.includes(key)) return message;
  return text.slice(0,360);
}
