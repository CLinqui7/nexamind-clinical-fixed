// The guide is deliberately role-scoped. Nothing here changes permissions or
// provides a shortcut around the server's authorization checks.
export const TRAINING = Object.freeze({
  secretary: {
    label: 'Secretaría', video: '/tutorials/secretaria.webm',
    intro: 'Un recorrido práctico para las dos secretarias. Use sus propias cuentas: cada acción depende de los permisos concedidos por el doctor.',
    steps: [
      { icon: 'overview', title: 'Su tablero', view: 'dashboard', target: 'secretary-overview', text: 'Aquí empieza el día: citas, confirmaciones y pendientes administrativos. No aparece la historia clínica privada.', tip: 'Revise primero las citas de hoy y los recordatorios pendientes.' },
      { icon: 'patients', title: 'Encontrar o registrar', view: 'patients', target: 'patients-tools', text: 'Busque por nombre, contacto o seguro. Nuevo paciente abre el formulario administrativo cuando su cuenta tiene ese permiso.', tip: 'No escriba diagnósticos ni notas clínicas en campos administrativos.' },
      { icon: 'calendar', title: 'Elegir calendarios', view: 'agenda', target: 'calendar-filters', text: 'Los filtros Doctor, Esposa y General muestran solo los calendarios a los que puede acceder. Puede activar varios a la vez.', tip: 'Mostrar u ocultar un calendario no cambia ni borra eventos.' },
      { icon: 'plus', title: 'Crear una cita', view: 'agenda', target: 'agenda-new-event', text: 'Nuevo evento pide elegir explícitamente el calendario. Después elija cita de paciente o evento general, fecha y hora; guarde solo cuando esté correcto.', tip: 'Al final confirme el mensaje de guardado en el servidor.' },
      { icon: 'clock', title: 'Confirmar y recordar', view: 'agenda', target: 'agenda-views', text: 'Abra un evento para revisar estado, confirmación y recordatorios. El envío por WhatsApp depende del consentimiento y del proveedor configurado.', tip: 'Si aparece un error de guardado, no cierre la página: use Reintentar.' },
      { icon: 'patients', title: 'Pacientes por revisar', view: 'patients', target: 'patients-tools', text: 'Use el filtro Por revisar para encontrar pacientes con una cita marcada para revisión administrativa. Sin próxima cita es un filtro distinto; ninguno muestra alertas clínicas privadas.', tip: 'Abra la cita para cambiar su marca a Revisada cuando termine el pendiente.' },
      { icon: 'shield', title: 'Permisos y privacidad', view: 'dashboard', target: 'secretary-privacy', text: 'El doctor administra los permisos de cada secretaria. Si falta una acción, solicite acceso; la guía nunca cambia los permisos de su cuenta.', tip: 'No comparta contraseñas ni cuentas entre las dos secretarias.' },
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
      { icon: 'overview', title: 'Panorama del día', view: 'dashboard', target: 'dashboard-review', text: 'Inicio reúne agenda, pacientes que requieren revisión y señales clínicas. Las cifras apoyan la revisión, no sustituyen el juicio médico.', tip: 'Abra cada expediente antes de decidir un cambio de tratamiento.' },
      { icon: 'calendar', title: 'Agenda clínica del día', view: 'dashboard', target: 'dashboard-agenda', text: 'Este resumen se genera con las citas del día, horario real, medicamento activo principal y último cambio relevante. Puede imprimirlo desde Inicio.', tip: 'El envío por WhatsApp solo está disponible con proveedor, teléfono y autorización configurados.' },
      { icon: 'patients', title: 'Expedientes', view: 'patients', target: 'patients-tools', text: 'Busque al paciente y abra su ficha para ver evolución, medicamentos, documentos y consultas. Los registros firmados conservan su historial.', tip: 'Las correcciones son nuevas versiones; no reescriba una nota firmada.' },
      { icon: 'calendar', title: 'Calendarios compartidos', view: 'agenda', target: 'calendar-filters', text: 'Filtre Doctor, Esposa y General. La visualización no altera los eventos y el acceso del equipo se concede por calendario y acción.', tip: 'Compruebe que el calendario correcto está visible antes de crear.' },
      { icon: 'plus', title: 'Evento con destino claro', view: 'agenda', target: 'agenda-new-event', text: 'Nuevo evento exige escoger calendario. Para una cita, seleccione paciente y horario; para un bloqueo o reunión, use Evento general.', tip: 'No se elige un calendario automáticamente.' },
      { icon: 'activity', title: 'Consulta y receta', view: 'patients', target: 'patients-tools', text: 'Abra un paciente para iniciar la libreta, documentar la consulta y preparar una receta. Verifique guardado y contenido antes de firmar; anular requiere motivo.', tip: 'Evite datos reales mientras practica con el entorno de capacitación.' },
      { icon: 'file', title: 'Documentos con plantilla', view: 'patients', target: 'patients-tools', text: 'En Documentos del paciente, Nuevo documento ofrece constancia, incapacidad, carta y formulario según permisos. Revise las variables antes de generar el PDF privado.', tip: 'La Secretaría no recibe el diagnóstico ni documentos clínicos al generar una constancia administrativa.' },
      { icon: 'users', title: 'Equipo y permisos', view: 'settings', target: 'team-add-user', text: 'En Configuración invite a cada secretaria por su propio correo. Cada una establece su contraseña mediante el enlace. Defina permisos generales y por calendario.', tip: 'Pruebe el acceso con una cuenta de secretaria antes de usar datos reales.' },
      { icon: 'help', title: 'Soporte y continuidad', view: 'settings', target: 'help-settings', text: 'La guía rápida y el recorrido se pueden repetir desde Ayuda. Si una sincronización falla, confirme el estado antes de volver a enviar o guardar.', tip: 'No incluya información identificable de pacientes en mensajes de soporte.' },
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
  return { ...profile, steps: profile.steps.filter(step => step.view === 'dashboard' || access[step.view] === true) };
}
