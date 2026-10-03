// The guide is deliberately role-scoped. Nothing here changes permissions or
// provides a shortcut around the server's authorization checks.
export const TRAINING = Object.freeze({
  secretary: {
    label: 'Secretaría', video: '/tutorials/secretaria.webm',
    intro: 'Un recorrido práctico para las dos secretarias. Use sus propias cuentas: cada acción depende de los permisos concedidos por el doctor.',
    steps: [
      { icon:'patients', title:'Abra Pacientes', view:'dashboard', target:'nav-patients', event:'click', requires:'patients', action:'Pulse Pacientes en la navegación.', text:'Aquí puede localizar expedientes administrativos sin acceder a notas clínicas privadas.', tip:'Cada secretaria debe usar su propia cuenta.' },
      { icon:'search', title:'Encuentre un paciente', view:'patients', target:'patients-search', event:'focusin', action:'Pulse el campo de búsqueda.', text:'La búsqueda permite localizar pacientes por nombre, teléfono o seguro. En esta práctica no escriba datos reales.', tip:'El recorrido no modifica expedientes.' },
      { icon:'patients', title:'Pendientes administrativos', view:'patients', target:'patients-filter-review', event:'click', action:'Pulse Por revisar.', text:'Este filtro reúne las fichas con citas marcadas para revisión administrativa.', tip:'No equivale a una alerta clínica.' },
      { icon:'calendar', title:'Sin próxima cita', view:'patients', target:'patients-filter-unscheduled', event:'click', action:'Pulse Sin próxima cita.', text:'Este filtro muestra a quienes requieren coordinación de agenda.', tip:'Puede volver a Todos al terminar.' },
      { icon:'calendar', title:'Abra Calendarios', view:'patients', target:'nav-agenda', event:'click', requires:'agenda', action:'Pulse Agenda en la navegación.', text:'La agenda reúne solo los calendarios que le fueron autorizados.', tip:'Los permisos se configuran por persona y por calendario.' },
      { icon:'calendar', title:'Filtre un calendario', view:'agenda', target:'calendar-filter-first', event:'change', requires:'hasCalendars', action:'Toque el primer calendario para mostrarlo u ocultarlo.', text:'Puede combinar calendarios sin borrar ni mover eventos.', tip:'El cambio aquí solo afecta lo que ve en pantalla.' },
      { icon:'clock', title:'Regrese a hoy', view:'agenda', target:'agenda-today', event:'click', action:'Pulse Hoy.', text:'El botón centra la agenda en la fecha actual.', tip:'Use Mes, Semana o Día para cambiar la vista cuando lo necesite.' },
      { icon:'plus', title:'Prepare un evento', view:'agenda', target:'agenda-new-event', event:'click', requires:'createEvent', action:'Pulse Nuevo evento.', text:'Antes de guardar una cita, deberá elegir el calendario y completar los datos obligatorios.', tip:'Esta práctica no enviará ni guardará ningún evento.' },
      { icon:'calendar', title:'Elija el destino', view:'agenda', target:'appointment-calendar-first', event:'change', requires:'createEvent', action:'Seleccione una tarjeta de calendario.', text:'El destino no se asigna automáticamente. Confirme el calendario correcto antes de crear.', tip:'Todavía no se ha guardado la cita.' },
      { icon:'close', title:'Cierre sin guardar', view:'agenda', target:'appointment-cancel', event:'click', requires:'createEvent', action:'Pulse la X del formulario.', text:'Salga de esta demostración sin crear una cita real.', tip:'Los botones de guardar son para el trabajo real, no para practicar.' },
      { icon:'overview', title:'Vuelva al inicio', view:'agenda', target:'nav-dashboard', event:'click', action:'Pulse Inicio.', text:'Desde el tablero podrá revisar las citas y los pendientes del día.', tip:'Si el guardado falla durante el trabajo real, use Reintentar.' },
      { icon:'help', title:'Abra Ayuda', view:'dashboard', target:'help-button', event:'click', action:'Pulse Ayuda.', text:'La capacitación queda disponible para consultarla de nuevo en cualquier momento.', tip:'El video y la guía usan datos ficticios.' },
      { icon:'file', title:'Lea la guía rápida', view:'dashboard', target:'help-guide-tab', event:'click', action:'Pulse Guía rápida.', text:'Aquí encontrará instrucciones de acceso, pacientes, citas, recordatorios y privacidad.', tip:'Si falta una función, solicite al doctor que revise sus permisos.' },
      { icon:'check', title:'Termine la práctica', view:'dashboard', target:'help-close', event:'click', action:'Cierre la ventana de ayuda.', text:'Ya conoce el camino para volver a la guía o repetir este recorrido.', tip:'Nunca comparta contraseñas ni datos de pacientes por soporte.' },
    ],
    guide: [
      ['1. Entrar con su cuenta', 'Abra el enlace de invitación recibido por correo, establezca su propia contraseña e ingrese con su dirección. Si el enlace caducó, pida al doctor que lo reenvíe.'],
      ['2. Pacientes', 'Abra Pacientes para buscar o registrar identificación, contacto, seguro y consentimiento según sus permisos. Por revisar muestra pacientes con una cita marcada para revisión administrativa; Sin próxima cita es otro filtro. La ficha no permite leer notas clínicas privadas.'],
      ['3. Calendarios y citas', 'Abra Calendarios, active los filtros necesarios y use Nuevo evento. Elija primero el calendario; después indique paciente o evento general, fecha, duración y estado.'],
      ['4. Confirmación y recordatorios', 'Abra la cita para cambiar el estado o marcar revisión administrativa. Antes de enviar un recordatorio, compruebe consentimiento, canal y número del paciente.'],
      ['5. Medicamentos informados y recetas', 'Si se le concedió acceso, registre medicamentos informados con dosis, frecuencia y nota para revisión médica; no cambian el tratamiento activo hasta aprobación. Puede corregir o anular una receta existente si tiene permiso, pero no emitir una nueva. La anulación exige motivo y conserva historial.'],
      ['6. Documentos administrativos', 'En la ficha del paciente, Nuevo documento permite generar constancias o incapacidades con plantilla cuando su cuenta tiene permiso. Revise variables y PDF antes de imprimir; el archivo queda privado en el expediente.'],
      ['7. Guardado y ayuda', 'Espere “Cambios guardados”. Si falla la conexión, mantenga la página abierta y use Reintentar. El doctor puede revisar los permisos de su cuenta en Configuración.'],
    ],
  },
  doctor: {
    label: 'Médico', video: '/tutorials/doctor.webm',
    intro: 'Una ruta de trabajo para el doctor: de la agenda y el expediente al equipo, permisos y cierre seguro de la consulta.',
    steps: [
      { icon:'patients', title:'Abra Pacientes', view:'dashboard', target:'nav-patients', event:'click', requires:'patients', action:'Pulse Pacientes.', text:'Los expedientes reúnen evolución, medicamentos, documentos y consultas según su acceso.', tip:'Revise cada expediente antes de cambiar un tratamiento.' },
      { icon:'search', title:'Localice una ficha', view:'patients', target:'patients-search', event:'focusin', action:'Pulse el campo de búsqueda.', text:'Puede buscar por nombre, diagnóstico o medicamento. No escriba datos reales para practicar.', tip:'Una nota firmada conserva su historial.' },
      { icon:'patients', title:'Pacientes por revisar', view:'patients', target:'patients-filter-review', event:'click', action:'Pulse Por revisar.', text:'La lista le ayuda a priorizar la revisión clínica; no sustituye el juicio médico.', tip:'Abra la ficha antes de tomar decisiones.' },
      { icon:'calendar', title:'Abra la agenda', view:'patients', target:'nav-agenda', event:'click', requires:'agenda', action:'Pulse Agenda.', text:'Puede ver Doctor, Esposa y General de acuerdo con los accesos concedidos.', tip:'Compruebe siempre el calendario antes de crear.' },
      { icon:'calendar', title:'Filtre la agenda', view:'agenda', target:'calendar-filter-first', event:'change', requires:'hasCalendars', action:'Toque el primer calendario.', text:'Mostrar u ocultar un calendario no altera sus eventos.', tip:'El acceso del equipo se define para cada calendario.' },
      { icon:'clock', title:'Vuelva a hoy', view:'agenda', target:'agenda-today', event:'click', action:'Pulse Hoy.', text:'La agenda vuelve a la fecha actual. Puede cambiar entre Mes, Semana y Día.', tip:'Revise horarios antes de confirmar una cita.' },
      { icon:'plus', title:'Abra Nuevo evento', view:'agenda', target:'agenda-new-event', event:'click', requires:'createEvent', action:'Pulse Nuevo evento.', text:'Un evento puede ser cita de paciente o actividad general. La selección de calendario es obligatoria.', tip:'Esta práctica no guardará ningún evento.' },
      { icon:'calendar', title:'Seleccione calendario', view:'agenda', target:'appointment-calendar-first', event:'change', requires:'createEvent', action:'Seleccione una tarjeta de calendario.', text:'Compruebe el destino antes de llenar paciente, fecha y duración.', tip:'La aplicación no elige un calendario por usted.' },
      { icon:'close', title:'Salga sin guardar', view:'agenda', target:'appointment-cancel', event:'click', requires:'createEvent', action:'Pulse la X del formulario.', text:'Terminamos la demostración sin crear un evento real.', tip:'En trabajo real, confirme que aparezca “Cambios guardados”.' },
      { icon:'settings', title:'Abra Configuración', view:'agenda', target:'settings-button', event:'click', requires:'settings', action:'Pulse Configuración.', text:'Desde aquí gestiona identidad, preferencias y equipo.', tip:'La cuenta propietaria controla la administración del equipo.' },
      { icon:'users', title:'Revise el equipo', view:'settings', target:'team-add-user', event:'click', requires:'usersManage', action:'Pulse Agregar usuario.', text:'Cada secretaria o enfermera recibe una invitación individual y crea su propia contraseña.', tip:'No existe contraseña predeterminada ni compartida.' },
      { icon:'shield', title:'Permisos personalizados', view:'settings', target:'team-permissions-custom', event:'change', requires:'usersManage', action:'Seleccione Personalizados.', text:'Las casillas definen qué puede hacer la persona. Los permisos de calendario también deben verificarse.', tip:'Este ejemplo no enviará la invitación.' },
      { icon:'close', title:'Cierre sin invitar', view:'settings', target:'team-cancel', event:'click', requires:'usersManage', action:'Pulse la X del formulario.', text:'Puede volver para crear una invitación real cuando tenga el correo de la persona.', tip:'Antes de operar, pruebe el acceso con su cuenta.' },
      { icon:'help', title:'Abra Ayuda', view:'settings', target:'help-button', event:'click', action:'Pulse Ayuda.', text:'El video, la guía y este recorrido se pueden repetir.', tip:'No envíe información identificable de pacientes a soporte.' },
      { icon:'file', title:'Lea la guía', view:'settings', target:'help-guide-tab', event:'click', action:'Pulse Guía rápida.', text:'Incluye consulta, recetas, documentos, equipo y continuidad del guardado.', tip:'Las correcciones clínicas conservan versiones e historial.' },
      { icon:'check', title:'Finalice', view:'settings', target:'help-close', event:'click', action:'Cierre la ventana de ayuda.', text:'Ya puede iniciar su trabajo o repetir el recorrido desde Ayuda.', tip:'Compruebe el estado de conexión antes de repetir una operación.' },
    ],
    guide: [
      ['1. Preparar el día', 'Revise Inicio y la Agenda del día: horario, paciente, tratamiento activo y último cambio relevante. Use Imprimir cuando necesite una copia. El envío automático por WhatsApp requiere proveedor habilitado y teléfono autorizado.'],
      ['2. Expediente y consulta', 'Desde Pacientes abra la ficha. Revise tratamiento, evolución, riesgos y documentos; use la libreta durante la consulta y compruebe el guardado antes de firmar.'],
      ['3. Medicamentos y recetas', 'Revise los medicamentos informados antes de activarlos. La vista muestra notas y distingue activo, suspendido y descontinuado. Puede elegir un medicamento al crear la receta y programar mediodía; la receta guarda una instantánea. Una corrección crea revisión y una anulación conserva motivo e historial. La impresión incluye firma y sello, pero no observaciones internas.'],
      ['4. Documentos con plantilla', 'En la ficha abra Documentos y Nuevo documento. Elija constancia, incapacidad, carta o formulario, complete las variables y genere el PDF privado. Compruebe el texto y la versión antes de entregar.'],
      ['5. Equipo y contraseñas', 'En Configuración invite por correo a cada secretaria o enfermera. La persona establece su propia contraseña; no se envían contraseñas compartidas o en texto plano.'],
      ['6. Permisos y calendarios', 'Revise cada casilla de permiso y el acceso por calendario. Use una cuenta de prueba con el rol correspondiente para comprobar lo visible antes de trabajar con pacientes reales.'],
      ['7. Guardado y continuidad', 'Espere “Cambios guardados” y atienda los avisos de conexión. Las exportaciones, sincronizaciones y recordatorios requieren verificar el resultado antes de repetirlos. La migración histórica aún exige exportación, conciliación y autorización antes de importar.'],
    ],
  },
});

export function trainingFor(role, access = {}) {
  const profile = role === 'secretary' || role === 'nurse' ? TRAINING.secretary : TRAINING.doctor;
  const steps=profile.steps.map(step=>{
    let view=step.view;
    if(step.target==='nav-agenda'&&!access.patients)view='dashboard';
    if(step.target==='settings-button'&&!access.agenda)view=access.patients?'patients':'dashboard';
    if(profile===TRAINING.doctor&&['help-button','help-guide-tab','help-close'].includes(step.target)&&!access.settings)view=access.agenda?'agenda':access.patients?'patients':'dashboard';
    return {...step,view};
  }).filter(step => (step.view === 'dashboard' || access[step.view] === true) && (!step.requires || access[step.requires] === true));
  return {...profile,steps};
}
