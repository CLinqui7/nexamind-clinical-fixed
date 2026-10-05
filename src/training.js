// The guide is deliberately role-scoped. Nothing here changes permissions or
// provides a shortcut around the server's authorization checks.
export const TRAINING = Object.freeze({
  secretary: {
    label: 'Secretaría', video: '/tutorials/secretaria.webm',
    intro: 'Practique con un paciente y una cita ficticios que desaparecen al salir. Cada secretaria debe usar su cuenta y solo verá las acciones que el doctor le autorizó.',
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
      ['0. Práctica segura', 'Pulse Iniciar recorrido interactivo para crear Paciente Demo Linkare, capturar un medicamento informado si tiene permiso y agendar una cita ficticia. El sistema trabaja en una copia temporal: nada se guarda en el servidor y todo desaparece al salir. Espere a que termine cualquier guardado pendiente antes de empezar.'],
      ['1. Entrar con su cuenta', 'Abra el enlace de invitación recibido por correo, establezca su propia contraseña e ingrese con su dirección. Si el enlace caducó, pida al doctor que lo reenvíe.'],
      ['2. Pacientes', 'Abra Pacientes para buscar o registrar identificación, contacto, seguro y consentimiento según sus permisos. Por revisar muestra pacientes con una cita marcada para revisión administrativa; Sin próxima cita es otro filtro. La ficha no permite leer notas clínicas privadas.'],
      ['3. Calendarios y citas', 'Abra Calendarios, active los filtros necesarios y use Nuevo evento. Elija primero el calendario; después indique paciente o evento general, fecha, duración y estado.'],
      ['4. Confirmación y recordatorios', 'Abra la cita para cambiar el estado o marcar revisión administrativa. Antes de enviar un recordatorio, compruebe consentimiento, canal y número del paciente.'],
      ['5. Medicamentos informados y recetas', 'Si se le concedió acceso, registre medicamentos informados con nombre, dosis, unidad, frecuencia y fuente para revisión médica; no cambian el tratamiento activo hasta aprobación. El recorrido usa un nombre ficticio y nunca transmite ese registro. Puede corregir o anular una receta existente si tiene permiso, pero no emitir una nueva. La anulación exige motivo y conserva historial.'],
      ['6. Documentos administrativos', 'En la ficha del paciente, Nuevo documento permite generar constancias o incapacidades con plantilla cuando su cuenta tiene permiso. Revise variables y PDF antes de imprimir; el archivo queda privado en el expediente.'],
      ['7. Guardado y ayuda', 'Espere “Cambios guardados”. Si falla la conexión, mantenga la página abierta y use Reintentar. El doctor puede revisar los permisos de su cuenta en Configuración.'],
    ],
  },
  doctor: {
    label: 'Médico', video: '/tutorials/doctor.webm',
    intro: 'Practique de principio a fin con un paciente ficticio: expediente, medicamento, cuaderno y cita. La copia temporal se descarta al salir y no modifica la base clínica.',
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
      ['0. Práctica segura', 'En Iniciar recorrido interactivo creará Paciente Demo Linkare, abrirá su expediente, registrará un medicamento ficticio, escribirá un borrador en la libreta y programará una cita de prueba. Todo ocurre en una copia temporal del navegador. No se envía al servidor, no se firma ni se mandan recordatorios; al salir se restablecen los datos originales.'],
      ['1. Preparar el día', 'Revise Inicio y la Agenda del día: horario, paciente, tratamiento activo y último cambio relevante. Use Imprimir cuando necesite una copia. El envío automático por WhatsApp requiere proveedor habilitado y teléfono autorizado.'],
      ['2. Expediente y consulta', 'Desde Pacientes abra la ficha. Revise Resumen, Medicamentos, Consultas, Documentos y Línea de tiempo según sus permisos. En la libreta distinga Notas libres, Motivo, Evolución, Riesgo y Medicamentos y tolerabilidad. El recorrido le hará escribir un borrador ficticio; en una consulta real compruebe el guardado antes de firmar.'],
      ['3. Medicamentos y recetas', 'Revise los medicamentos informados antes de activarlos. En Medicamentos distinga nombre, dosis y unidad, frecuencia, vía, fecha, estado, notas e historial de dosis. El ejemplo del recorrido no es una prescripción ni una recomendación. Puede elegir un medicamento al crear la receta; la receta guarda una instantánea. Una corrección crea revisión y una anulación conserva motivo e historial. Use Imprimir o Guardar PDF; ambos incluyen firma y sello, pero no observaciones internas.'],
      ['4. Documentos con plantilla', 'En la ficha abra Documentos y Nuevo documento. Elija constancia, incapacidad, carta o formulario, complete las variables y genere el PDF privado. Compruebe el texto y la versión antes de entregar.'],
      ['5. Equipo y contraseñas', 'En Configuración invite por correo a cada secretaria o enfermera. La persona establece su propia contraseña; no se envían contraseñas compartidas o en texto plano.'],
      ['6. Permisos y calendarios', 'Revise cada casilla de permiso y el acceso por calendario. Use una cuenta de prueba con el rol correspondiente para comprobar lo visible antes de trabajar con pacientes reales.'],
      ['7. Guardado y continuidad', 'Espere “Cambios guardados” y atienda los avisos de conexión. Las exportaciones, sincronizaciones y recordatorios requieren verificar el resultado antes de repetirlos. La historia FoxPro ya importada se consulta en Sistema anterior y no debe convertirse automáticamente en tratamiento activo.'],
    ],
  },
});

export const DEMO_PATIENT_NAME = 'Paciente Demo Linkare';
export const DEMO_MEDICATION_NAME = 'Medicamento ficticio';

// This route uses the real controls against a temporary in-memory copy. It must
// never create a patient, medicine, consultation or appointment on the server.
const SECRETARY_PRACTICE = [
  {icon:'patients',title:'Abra Pacientes',view:'dashboard',target:'nav-patients',event:'click',action:'Pulse Pacientes.',text:'Empezaremos con un expediente ficticio. Esta práctica no modifica la base del consultorio.'},
  {icon:'userPlus',title:'Cree una ficha de práctica',view:'patients',target:'patients-new',event:'click',action:'Pulse Nuevo paciente.',text:'La ficha de demostración desaparecerá cuando termine o salga del recorrido.'},
  {icon:'edit',title:'Escriba el nombre',view:'patients',target:'patient-form-name',event:'input',expected:DEMO_PATIENT_NAME,action:`Escriba: ${DEMO_PATIENT_NAME}`,text:'Use este nombre exacto para reconocer el registro de práctica. No escriba datos de una persona real.'},
  {icon:'edit',title:'Agregue la edad',view:'patients',target:'patient-form-age',event:'input',expected:'35',action:'Escriba 35 en Edad.',text:'Observe cómo los campos obligatorios piden la identificación mínima.'},
  {icon:'check',title:'Guarde la ficha ficticia',view:'patients',target:'patient-form-save',event:'click',action:'Pulse Crear paciente.',text:'Solo se guardará en esta sesión temporal. El expediente real permanece intacto.'},
  {icon:'medication',title:'Medicamento informado',view:'patient',target:'admin-medication-add',event:'click',requires:'medicationsCapture',action:'Pulse Registrar medicamento informado.',text:'Secretaría registra lo que la persona comunica; no prescribe ni activa tratamientos.'},
  {icon:'edit',title:'Nombre informado',view:'patient',target:'medication-form-name',event:'input',expected:DEMO_MEDICATION_NAME,requires:'medicationsCapture',action:`Escriba: ${DEMO_MEDICATION_NAME}`,text:'Es un nombre ficticio. En trabajo real registre literalmente lo referido por el paciente.'},
  {icon:'edit',title:'Dosis informada',view:'patient',target:'medication-form-dose',event:'input',expected:'1',requires:'medicationsCapture',action:'Escriba 1 como valor de ejemplo.',text:'La dosis, unidad, frecuencia y fuente deben verificarse; esto no es una indicación médica.'},
  {icon:'check',title:'Envíe a revisión',view:'patient',target:'medication-form-save',event:'click',requires:'medicationsCapture',action:'Pulse Enviar a revisión.',text:'En esta práctica queda pendiente solo en la copia temporal; el médico revisa cualquier registro real.'},
  {icon:'calendar',title:'Agende al paciente demo',view:'patient',target:'patient-agendar',event:'click',requires:'demoAppointment',action:'Pulse Agendar.',text:'La cita de prueba quedará vinculada a este paciente ficticio y no enviará recordatorios.'},
  {icon:'calendar',title:'Elija el calendario',view:'patient',target:'appointment-calendar-first',event:'change',requires:'demoAppointment',action:'Seleccione un calendario disponible.',text:'El calendario es obligatorio. Compruebe a quién pertenece antes de guardar citas reales.'},
  {icon:'clock',title:'Elija una fecha',view:'patient',target:'appointment-start',event:'change',requires:'demoAppointment',action:'Elija una fecha futura.',text:'La fecha se guarda separada de la hora para evitar ambigüedades.'},
  {icon:'clock',title:'Confirme AM o PM',view:'patient',target:'appointment-period',event:'change',expected:'PM',requires:'demoAppointment',action:'Seleccione p. m.',text:'Revise siempre Hora, Minutos y AM / PM antes de crear la cita.'},
  {icon:'check',title:'Cree la cita de prueba',view:'patient',target:'appointment-form-save',event:'click',requires:'demoAppointment',action:'Pulse Crear evento.',text:'La cita solo aparecerá durante este recorrido. No llegará al calendario real.'},
  {icon:'close',title:'Revise y cierre el detalle',view:'patient',target:'appointment-detail-close',event:'click',requires:'demoAppointment',action:'Cierre el detalle de la cita.',text:'Aquí se comprueba paciente, calendario, fecha, hora y estado.'},
  {icon:'calendar',title:'Vea la agenda',view:'patient',target:'nav-agenda',event:'click',requires:'agenda',action:'Pulse Agenda.',text:'Los filtros muestran los calendarios autorizados; la cita demo existe solo en esta pantalla temporal.'},
  {icon:'clock',title:'Regrese a hoy',view:'agenda',target:'agenda-today',event:'click',requires:'agenda',action:'Pulse Hoy.',text:'Puede alternar entre Mes, Semana y Día para revisar la disponibilidad.'},
  {icon:'patients',title:'Vuelva al directorio',view:'agenda',target:'nav-patients',event:'click',action:'Pulse Pacientes.',text:'Ahora localice la ficha que acaba de crear.'},
  {icon:'search',title:'Busque el paciente demo',view:'patients',target:'patients-search',event:'input',expected:DEMO_PATIENT_NAME,action:`Escriba: ${DEMO_PATIENT_NAME}`,text:'La búsqueda encuentra datos administrativos sin exponer notas clínicas privadas.'},
  {icon:'patients',title:'Abra el expediente',view:'patients',target:'patient-card',event:'click',action:'Abra la tarjeta del paciente demo.',text:'Revise contacto, seguro, próxima cita y medicamentos informados según sus permisos.'},
  {icon:'help',title:'Abra Ayuda',view:'patient',target:'help-button',event:'click',action:'Pulse Ayuda.',text:'El video y las guías se pueden consultar de nuevo cuando lo necesite.'},
  {icon:'file',title:'Lea la guía rápida',view:'patient',target:'help-guide-tab',event:'click',action:'Pulse Guía rápida.',text:'Aquí están los pasos de pacientes, calendarios, recordatorios y privacidad.'},
  {icon:'check',title:'Termine la práctica',view:'patient',target:'help-close',event:'click',action:'Cierre Ayuda.',text:'Al finalizar se descartan el paciente, medicamento y cita ficticios.'},
];

const DOCTOR_PRACTICE = [
  {icon:'patients',title:'Abra Pacientes',view:'dashboard',target:'nav-patients',event:'click',action:'Pulse Pacientes.',text:'Creará un expediente ficticio en un espacio temporal. Ningún dato demo llegará al servidor.'},
  {icon:'userPlus',title:'Cree el paciente demo',view:'patients',target:'patients-new',event:'click',action:'Pulse Nuevo paciente.',text:'Esta práctica muestra el flujo real de alta sin tocar expedientes clínicos existentes.'},
  {icon:'edit',title:'Identificación ficticia',view:'patients',target:'patient-form-name',event:'input',expected:DEMO_PATIENT_NAME,action:`Escriba: ${DEMO_PATIENT_NAME}`,text:'Use solo este nombre ficticio; nunca practique sobre una persona real.'},
  {icon:'edit',title:'Complete la edad',view:'patients',target:'patient-form-age',event:'input',expected:'35',action:'Escriba 35 en Edad.',text:'Los datos básicos y los campos clínicos se separan para evitar confusiones.'},
  {icon:'file',title:'Contexto clínico de ejemplo',view:'patients',target:'patient-form-diagnosis',event:'input',expected:'Caso ficticio para capacitación',action:'Escriba: Caso ficticio para capacitación',text:'Es un texto de práctica, no un diagnóstico. En un expediente real documente solo lo evaluado.'},
  {icon:'check',title:'Abra el expediente demo',view:'patients',target:'patient-form-save',event:'click',action:'Pulse Crear paciente.',text:'El paciente existirá solo hasta que termine el recorrido.'},
  {icon:'medication',title:'Explore medicamentos',view:'patient',target:'patient-tab-medications',event:'click',requires:'medicationsManage',action:'Pulse Medicamentos.',text:'Esta pestaña distingue estado, dosis actual, frecuencia, notas e historial de cambios.'},
  {icon:'plus',title:'Abra el registro',view:'patient',target:'action-medication',event:'click',requires:'medicationsManage',action:'Pulse Agregar medicamento.',text:'Un tratamiento real exige una decisión clínica; aquí solo practicamos el formulario.'},
  {icon:'edit',title:'Nombre de práctica',view:'patient',target:'medication-form-name',event:'input',expected:DEMO_MEDICATION_NAME,requires:'medicationsManage',action:`Escriba: ${DEMO_MEDICATION_NAME}`,text:'El nombre es deliberadamente ficticio y no representa una recomendación terapéutica.'},
  {icon:'edit',title:'Observe dosis y frecuencia',view:'patient',target:'medication-form-dose',event:'input',expected:'1',requires:'medicationsManage',action:'Escriba 1 como valor de ejemplo.',text:'Revise unidad, frecuencia, vía, fecha y notas. Ninguna de estas cifras sirve como indicación clínica.'},
  {icon:'check',title:'Guarde solo en la práctica',view:'patient',target:'medication-form-save',event:'click',requires:'medicationsManage',action:'Pulse Agregar medicamento.',text:'El historial demo mostrará el registro; saliendo del tutorial desaparecerá.'},
  {icon:'notebook',title:'Abra consultas',view:'patient',target:'patient-tab-consultations',event:'click',requires:'consultationsManage',action:'Pulse Consultas.',text:'Cada nota pertenece al expediente del paciente y conserva su contexto.'},
  {icon:'play',title:'Inicie el cuaderno',view:'patient',target:'consultations-start',event:'click',requires:'consultationsManage',action:'Pulse Iniciar consulta.',text:'La libreta organiza la información mientras conversa con el paciente.'},
  {icon:'edit',title:'Anote un ejemplo',view:'notebook',target:'notebook-freeNotes',event:'input',minLength:18,requires:'consultationsManage',action:'Escriba una nota ficticia de al menos 18 caracteres.',text:'Practique diferenciando lo referido, lo observado y lo pendiente. No use datos reales.'},
  {icon:'edit',title:'Motivo de consulta',view:'notebook',target:'notebook-reason',event:'input',minLength:8,requires:'consultationsManage',action:'Describa un motivo ficticio (mín. 8 caracteres).',text:'El motivo resume por qué se abrió la consulta, no reemplaza el análisis clínico.'},
  {icon:'medication',title:'Medicamentos y tolerancia',view:'notebook',target:'notebook-medicationNotes',event:'input',minLength:8,requires:'consultationsManage',action:'Escriba una observación ficticia (mín. 8 caracteres).',text:'Este campo documenta adherencia y tolerabilidad; no modifica automáticamente el tratamiento.'},
  {icon:'close',title:'Regrese sin firmar',view:'notebook',target:'notebook-close',event:'click',requires:'consultationsManage',action:'Pulse Volver al expediente.',text:'La nota queda como borrador solo en esta práctica. Firmar notas reales es una acción clínica definitiva.'},
  {icon:'patients',title:'Vea el resumen',view:'patient',target:'patient-tab-overview',event:'click',action:'Pulse Resumen.',text:'Aquí se unen evolución, alertas, tratamiento y próxima cita sin sustituir la revisión del expediente.'},
  {icon:'calendar',title:'Agende al paciente demo',view:'patient',target:'patient-agendar',event:'click',requires:'demoAppointment',action:'Pulse Agendar.',text:'El formulario vincula la cita con este expediente ficticio.'},
  {icon:'calendar',title:'Seleccione calendario',view:'patient',target:'appointment-calendar-first',event:'change',requires:'demoAppointment',action:'Elija un calendario disponible.',text:'El destino debe elegirse de forma explícita antes de crear el evento.'},
  {icon:'clock',title:'Elija una fecha',view:'patient',target:'appointment-start',event:'change',requires:'demoAppointment',action:'Elija una fecha futura.',text:'La fecha se guarda separada de la hora para evitar ambigüedades.'},
  {icon:'clock',title:'Confirme AM o PM',view:'patient',target:'appointment-period',event:'change',expected:'PM',requires:'demoAppointment',action:'Seleccione p. m.',text:'Revise siempre Hora, Minutos y AM / PM antes de crear la cita.'},
  {icon:'check',title:'Cree la cita de prueba',view:'patient',target:'appointment-form-save',event:'click',requires:'demoAppointment',action:'Pulse Crear evento.',text:'Se guardará solamente en memoria; no enviará recordatorios ni sincronizaciones.'},
  {icon:'close',title:'Revise el detalle',view:'patient',target:'appointment-detail-close',event:'click',requires:'demoAppointment',action:'Cierre el detalle de la cita.',text:'Confirme paciente, calendario, horario y estado en cada cita real.'},
  {icon:'calendar',title:'Abra Calendarios',view:'patient',target:'nav-agenda',event:'click',requires:'agenda',action:'Pulse Agenda.',text:'Use Mes, Semana o Día para localizar la cita de demostración.'},
  {icon:'clock',title:'Vuelva a hoy',view:'agenda',target:'agenda-today',event:'click',requires:'agenda',action:'Pulse Hoy.',text:'Los filtros de calendario modifican la vista, no los datos guardados.'},
  {icon:'settings',title:'Abra Configuración',view:'agenda',target:'settings-button',event:'click',requires:'settings',action:'Pulse Configuración.',text:'Solo quien tiene permiso puede administrar al equipo.'},
  {icon:'users',title:'Revise una invitación',view:'settings',target:'team-add-user',event:'click',requires:'usersManage',action:'Pulse Agregar usuario.',text:'Cada secretaria o enfermera recibe su invitación individual y establece una contraseña privada.'},
  {icon:'shield',title:'Permisos personalizados',view:'settings',target:'team-permissions-custom',event:'change',requires:'usersManage',action:'Seleccione Personalizados.',text:'Verifique cada permiso, incluido el acceso por calendario. No enviaremos esta invitación.'},
  {icon:'close',title:'Cierre sin invitar',view:'settings',target:'team-cancel',event:'click',requires:'usersManage',action:'Cierre el formulario.',text:'Nunca use una cuenta compartida para el equipo.'},
  {icon:'help',title:'Abra Ayuda',view:'settings',target:'help-button',event:'click',action:'Pulse Ayuda.',text:'Puede repetir este recorrido o consultar las guías en cualquier momento.'},
  {icon:'file',title:'Lea la guía rápida',view:'settings',target:'help-guide-tab',event:'click',action:'Pulse Guía rápida.',text:'Incluye expediente, consulta, medicamentos, citas y permisos.'},
  {icon:'check',title:'Termine la práctica',view:'settings',target:'help-close',event:'click',action:'Cierre Ayuda.',text:'El paciente y todos los registros de demostración desaparecerán al salir.'},
];

export function trainingFor(role, access = {}) {
  const profile = role === 'secretary' || role === 'nurse' ? TRAINING.secretary : TRAINING.doctor;
  const route=access.demoPatient ? (profile===TRAINING.secretary ? SECRETARY_PRACTICE : DOCTOR_PRACTICE) : profile.steps;
  const steps=route.map(step=>{
    let view=step.view;
    if(step.target==='nav-agenda'&&!access.patients)view='dashboard';
    if(step.target==='nav-patients'&&step.view==='agenda'&&!access.agenda)view='patient';
    if(step.target==='settings-button'&&!access.agenda)view=access.patients?'patients':'dashboard';
    if(profile===TRAINING.doctor&&['help-button','help-guide-tab','help-close'].includes(step.target)&&!access.settings)view=access.agenda?'agenda':access.patients?'patients':'dashboard';
    return {...step,view};
  }).filter(step => (step.view === 'dashboard' || access[step.view] === true || (access.demoPatient && ['patient','notebook'].includes(step.view))) && (!step.requires || access[step.requires] === true));
  return {...profile,steps};
}
