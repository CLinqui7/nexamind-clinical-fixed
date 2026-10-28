// Product instructions, shared by the interactive school and its narrated videos.
// Every example is descriptive; this catalog never sends a clinical write.
const chapter=(id,title,view,tab,permission,intro,rows,exercise,question,answers,correct=0)=>({id,title,view,tab,permission,intro,controls:rows.trim().split('\n').map(row=>{const [label,how,result]=row.split('|');return {label,how,result};}),exercise,quiz:{question,answers,correct},video:`/tutorials/pages/${id}.mp4`,captions:`/tutorials/pages/${id}.vtt`});
export const LEARNING_CHAPTERS=[
chapter('acceso','Acceso, invitaciones y contraseña','login',null,null,'Aprenda a entrar con su cuenta personal y a recuperar el acceso. El correo de invitación vincula al equipo con el consultorio correcto.',`
Correo|Escriba la dirección con la que se registró o recibió la invitación; revise espacios y errores de escritura.|La cuenta identifica sus permisos y su consultorio.
Contraseña y mostrar contraseña|Escriba su clave; el icono de ojo permite comprobar lo escrito. Ocúltela antes de compartir pantalla.|Ver la clave no cambia ni restablece la contraseña.
Ingresar a Linkare|Complete correo y contraseña y pulse una vez. Espere a que termine la carga.|Inicio se abre al validar la sesión y la membresía.
Crear consultorio|Use el registro únicamente para una clínica nueva. Complete nombre, consultorio, correo, contraseña y confirmación.|Puede ser necesario confirmar el correo antes de entrar.
Confirmar cuenta y reenviar confirmación|Abra el enlace recibido en su correo. Si caducó, solicite una confirmación nueva.|Después de confirmar, vuelva al acceso con su correo original.
Olvidé mi contraseña|Escriba su correo y solicite recuperación. Abra el enlace más reciente y establezca una nueva clave.|La nueva contraseña sustituye la anterior; no cree otra cuenta.
Aceptar invitación|Abra el enlace enviado por el propietario y establezca su contraseña individual.|Entra al consultorio que le invitó, con los permisos concedidos.
Volver al inicio de sesión|Cierre la recuperación o el registro para regresar al formulario de acceso.|No cancela una cuenta ya creada ni una invitación enviada.
Cuenta desactivada o enlace vencido|Solicite al propietario revisar su acceso o reenviar la invitación.|Repetir la contraseña no reactiva una membresía deshabilitada.
Cerrar sesión|Use el menú del usuario al terminar. Antes compruebe Cambios guardados.|Evita que otra persona use su cuenta en un equipo compartido.`,
'Localice los campos de acceso y explique la diferencia entre crear consultorio y aceptar una invitación. Use solo la práctica para ensayar.','Una secretaria invitada debe…',['Abrir su invitación y establecer su propia clave','Crear otro consultorio','Usar la contraseña del médico']),
chapter('inicio','Inicio y navegación','dashboard',null,null,'Inicio reúne la agenda y los indicadores del consultorio. Los números y los accesos cambian según los permisos de su cuenta.',`
Inicio|Pulse Inicio en la barra superior desde cualquier sección.|Regresa al tablero; no elimina ni guarda por sí solo un formulario abierto.
Pacientes|Pulse Pacientes para abrir el directorio y buscar el expediente antes de registrar información.|La ficha se abre al seleccionar una tarjeta del paciente.
Agenda|Abra Agenda para combinar los calendarios autorizados.|Los filtros de calendario cambian la vista, no los eventos.
Mi plan|Abra esta sección para revisar la modalidad y el acceso del consultorio.|El acceso gratuito y los datos de facturación se muestran tal como estén configurados.
Resultados|Abra Resultados para revisar indicadores y tendencias disponibles.|Son resúmenes de datos registrados, no diagnósticos automáticos.
Alertas|Abra Alertas y revise los casos pendientes antes de resolverlos.|Una alerta requiere revisar el expediente y su contexto.
Agenda de hoy y aviso de las 8:00|Revise la fecha del consultorio, la hora y el paciente. A partir de las 8:00 aparece el aviso del día cuando hay citas aplicables.|Es una notificación del dashboard; no acredita envío de correo al paciente.
Tarjetas e indicadores|Lea el nombre del indicador y su periodo antes de comparar cantidades.|La cifra depende del registro y de los permisos; abra el detalle para actuar.
Ayuda|Abra Ayuda y elija Escuela completa, video general, guía o preguntas.|Puede retomar un capítulo sin modificar pacientes.
Campana, configuración y menú personal|La campana abre avisos; el engranaje abre Configuración; el menú personal permite gestionar su sesión.|Los controles administrativos pueden faltar según su rol.
Menú móvil|En pantallas pequeñas abra el menú para ver los destinos de navegación.|Cierre el menú después de elegir una sección.`,
'Abra Inicio, identifique la fecha y el estado de guardado y localice Pacientes, Agenda y Ayuda.','¿El aviso de las 8:00 prueba que se envió correo?',['No; el aviso corresponde al dashboard','Sí, se envía siempre','Solo si se recarga la página']),
chapter('directorio','Directorio y búsqueda de pacientes','patients',null,'patientsView','Busque primero para evitar expedientes duplicados. El directorio consulta la base completa y presenta resultados en páginas.',`
Buscar paciente|Escriba una parte del nombre o teléfono; espere el resultado antes de volver a escribir.|La consulta no se limita a las tarjetas de la página visible.
Recientes|Seleccione la cohorte de actividad reciente y lea la fecha de corte mostrada.|La fecha de actividad no equivale a la fecha de creación.
Todos|Use Todos cuando no encuentre a alguien en Recientes.|Un expediente antiguo puede existir aunque no tenga actividad reciente.
Sin actividad|Seleccione Sin actividad para localizar expedientes sin una actividad válida registrada.|Esto no significa que la persona no haya sido atendida: puede faltar evidencia utilizable.
En esta página y total no archivado|Lea el contador de tarjetas y el total del consultorio por separado.|El contador de la página no representa todos los pacientes de la base.
Archivados|Abra la vista de archivados para consultar expedientes retirados del listado activo.|Archivar conserva historia y no equivale a destruir al paciente.
Tarjeta del paciente|Compare nombre y contacto y pulse la tarjeta correcta.|Se carga ese expediente por su identificador.
Anterior y siguiente|Avance o retroceda en la paginación conservando los filtros.|La ausencia de una tarjeta en esta página no implica que se haya borrado.
Nuevo paciente|Pulse después de buscar nombre y teléfono. Complete los datos requeridos.|La base rechaza un duplicado activo con el mismo nombre y teléfono normalizados.
Abrir expediente existente|Si el formulario detecta coincidencia, elija la ficha existente y revise sus datos.|Evita repartir notas y medicamentos entre dos expedientes.
Reintentar|Si falla la búsqueda, compruebe conexión y pulse Reintentar.|Un error de carga no demuestra que el paciente no exista.`,
'Busque un paciente ficticio en el recorrido seguro y explique por qué debe probar Todos antes de crear otra ficha.','Si un paciente no aparece en Recientes…',['Buscar en Todos y comprobar el contacto','Crear inmediatamente otro expediente','Cambiar su nombre para poder guardarlo']),
chapter('ficha','Crear, editar y archivar pacientes','patients',null,'patientsCreate','La ficha identifica al paciente. Una corrección conserva el mismo expediente y sus recursos asociados.',`
Nombre completo|Escriba el nombre como consta en la identificación; revise apellidos antes de guardar.|Ayuda a localizar coincidencias con otros registros.
Edad y datos personales|Complete la edad conocida y los campos autorizados de identificación.|Una edad histórica distinta puede conservarse como dato anterior.
Teléfono y correo|Registre los contactos correctos; para números internacionales conserve el código de país.|El teléfono también ayuda a detectar duplicados.
Seguro médico|Indique si tiene seguro y complete aseguradora, plan, afiliación, póliza, copago y autorización si corresponden.|La información aparece en el expediente administrativo.
Tarifa habitual|Si tiene permiso, registre la tarifa del paciente en su campo específico.|La tarifa se guarda aparte del nombre.
Diagnóstico, código, riesgo y estado|Solo con permiso clínico, documente lo evaluado por el profesional.|Los datos clínicos no se entregan a Secretaría sin el acceso correspondiente.
Datos y seguro|Desde el expediente pulse Datos y seguro para corregir una ficha existente.|Guarde la corrección sobre el mismo paciente.
Foto del paciente|Pulse el control de cámara y elija una imagen autorizada.|Compruebe que pertenece al paciente antes de confirmar.
Crear paciente y Guardar cambios|Revise campos obligatorios y pulse una sola vez; espere confirmación del servidor.|Si falla, el formulario debe conservar lo escrito para corregir o reintentar.
Cancelar o X|Cierre el formulario si aún no quiere guardar.|Los cambios de ese formulario no se confirman.
Archivar paciente|Indique el motivo y revise la segunda confirmación con el nombre completo.|Retira la ficha de activos y conserva su historia; puede afectar citas futuras.
Error de duplicado o conflicto|Abra el expediente coincidente o actualice la ficha antes de continuar.|No cambie el nombre para eludir la comprobación.`,
'En la práctica cree Paciente Demo Linkare, revise el contacto y localice Datos y seguro. No use personas reales para ensayar.','Para corregir un teléfono…',['Editar Datos y seguro del mismo paciente','Crear otra ficha','Archivar y recrear siempre']),
chapter('resumen','Expediente: resumen y acciones frecuentes','patient','overview','clinicalView','Antes de actuar, compruebe el paciente en el encabezado. Cada pestaña muestra una parte de su expediente.',`
Volver al directorio|Pulse la flecha del encabezado para regresar a Pacientes.|Después seleccione otra ficha comprobando su identidad.
Encabezado y etiquetas|Lea nombre, edad, diagnóstico, riesgo y tratamiento principal.|Las etiquetas reflejan datos guardados; no sustituyen la revisión clínica.
Próxima cita y Agendar|Revise si ya existe una cita y pulse Agendar para crear otra cuando corresponda.|El formulario queda vinculado al paciente seleccionado.
Compartir sus citas|Cree un enlace solo para el alcance autorizado y entréguelo al destinatario correcto.|Un enlace de paciente debe mostrar únicamente sus propias citas.
Registrar evolución|Abra el registro de evolución y complete mediciones y contexto.|Queda una nueva observación fechada.
Agregar medicamento|Abra el formulario para documentar nombre, dosis y pauta.|La validación y el permiso determinan si queda activo o pendiente de revisión.
Cambiar dosis|Seleccione el medicamento correcto y una fecha efectiva.|El valor anterior se conserva en la historia de dosis.
Nueva receta|Abra una receta basada en el tratamiento revisado.|Emitir una receta requiere su permiso específico.
Iniciar consulta|Abra la libreta del paciente y revise su identificación antes de escribir.|La consulta queda ligada a este expediente.
Subir archivo y Datos y seguro|Use Subir archivo para un documento; use Datos y seguro para corregir identificación y póliza.|Son operaciones diferentes y tienen permisos propios.
Pestañas del expediente|Abra Resumen, Medicamentos, Seguimiento, Efectos y controles, Consultas, Documentos, Recetas, Historial y Sistema anterior cuando estén disponibles.|Cambiar de pestaña no significa guardar un formulario.
Modo post mortem|Revise la fecha y la fuente del registro de fallecimiento antes de generar documentación.|Este estado limita nuevas consultas y recordatorios.`,
'Identifique al paciente, abra tres pestañas y vuelva a Resumen. Explique qué acción necesita para una dosis nueva.','Antes de registrar una evolución debe…',['Comprobar la identidad del expediente','Elegir cualquier ficha abierta','Crear primero una receta']),
chapter('medicamentos','Medicamentos actuales y sus botones','patient','medications','clinicalView','El tratamiento muestra medicamentos registrados, sus dosis y estados. Revise nombre y pauta completa, especialmente si el mismo fármaco tiene tomas distintas.',`
Agregar medicamento|Complete nombre, clase, indicación, dosis, unidad, frecuencia, vía y fecha si se conoce.|El sistema conserva un identificador y metadatos de creación.
Nombre y clase|Escriba el producto registrado; los paréntesis permiten aclarar marca o principio activo.|La clase es una clasificación y no verifica equivalencias entre productos.
Dosis y unidad|Distinga concentración del producto de cantidad administrada. Escriba el valor y seleccione la unidad correspondiente.|Una cifra sin unidad puede interpretarse incorrectamente.
Frecuencia y frecuencia personalizada|Seleccione la pauta documentada. Use Otra cuando no exista una opción exacta y describa los horarios.|La pauta debe poder leerse sin tener que adivinar.
Vía y fecha de inicio|Seleccione la vía indicada y registre la fecha real si consta.|La fecha de captura no demuestra cuándo comenzó el paciente.
Principal y según necesidad|Principal elige la referencia del tablero. Según necesidad identifica una pauta PRN documentada.|Ninguna casilla completa por sí sola las instrucciones clínicas.
Notas clínicas|Escriba contexto, fuente y aclaraciones de la indicación.|No sustituyen los campos de dosis y frecuencia.
Editar|Corrija los datos del medicamento seleccionado y revise antes de guardar.|Se conserva la versión previa en su historial.
Cambiar dosis|Registre nueva dosis, unidad, frecuencia, fecha efectiva y motivo.|Permite comparar la pauta anterior y la nueva.
Suspender y Reactivar|Use Suspender para una pausa y Reactivar tras revisión clínica. Complete Fecha efectiva del cambio para indicar cuándo ocurrió.|El estado cambia conservando el evento, la fecha efectiva y su motivo.
Completar y Descontinuar|Complete un esquema terminado o descontinúe según lo documentado por el profesional.|El medicamento deja de ser tratamiento activo y permanece en historia.
Eliminar medicamento|Indique por qué fue agregado por error o está duplicado.|Se archiva con autor, fecha y motivo; no se destruye la evidencia.
Historia de tomas|Abra la cronología del medicamento para leer registros FoxPro y fechas añadidas en Linkare.|Diferencia primera mención, inicio real conocido y final documentado.
Medicamentos informados|Revise el registro pendiente de Secretaría antes de activarlo.|Capturar lo informado no equivale a prescribir.`,
'En el recorrido seguro agregue Medicamento ficticio y distinga dosis, unidad, frecuencia, vía y fecha.','Dos tomas del mismo nombre con dosis y horarios diferentes…',['Pueden ser parte de una pauta y requieren revisión','Siempre deben eliminarse como duplicados','Deben convertirse en una sola toma diaria']),
chapter('foxpro','Medicamentos e historia original de FoxPro','patient','medications','clinicalView','Las tarjetas reúnen las menciones del sistema anterior. El cotejo acredita que el texto existe en la historia del paciente.',`
Confirmado en FoxPro|Lea la etiqueta junto con el texto de origen y las fechas conservadas.|Confirma procedencia; una mención antigua no confirma uso actual.
Primera y última fecha conservada|Lea las fechas como límites de la documentación disponible.|No se convierten automáticamente en fecha de inicio o suspensión.
Concentración anotada|Revise la concentración de la última mención fechada disponible.|Puede ser distinta de la cantidad que tomaba en cada administración.
Indicación anotada en origen|Lea literalmente la pauta extraída y consulte la nota completa si es ambigua.|No se inventa una frecuencia cuando el origen no la expresa.
Texto de origen|Compare el nombre y la pauta mostrados con el fragmento de FoxPro.|Se conserva aunque se corrija la presentación de la tarjeta.
Historia de tomas|Abra los registros fechados y las anotaciones donde aparece ese medicamento.|Las notas que mencionan suspender se muestran con su texto, para contextualizarlas.
Editar listado|Corrija nombre visible, concentración o indicación cuando la extracción necesita ajuste.|La corrección no altera el texto FoxPro ni crea un tratamiento activo.
Eliminar del listado y Restaurar|Archive una tarjeta con motivo; use Restaurar para devolverla al listado.|Sus menciones originales y la auditoría permanecen.
Confirmar uso actual|Use el formulario solo después de verificar medicamento, dosis, frecuencia y vía actuales.|El profesional confirma explícitamente la incorporación al tratamiento vigente.
Ver más medicamentos y menciones|Avance para cargar los siguientes grupos o registros.|La primera página no contiene necesariamente toda la historia.
Sistema anterior|Abra esta pestaña para leer la historia completa, incluso textos que no generaron una tarjeta.|Las notas libres pueden contener información que el extractor no estructuró.
Prefijo Rp. y nombres parecidos|Las tarjetas omiten el prefijo de receta para evitar repeticiones. Revise marcas y genéricos con criterio profesional.|La agrupación no asume equivalencia entre medicamentos distintos.`,
'Compare una tarjeta histórica con su texto de origen y explique qué evidencia falta para afirmar una fecha de suspensión.','La última mención de un medicamento significa…',['La última documentación disponible','El día en que se suspendió necesariamente','Que continúa activo hoy']),
chapter('historia-tomas','Registrar inicio, cambios y final de tratamientos','patient','medications','clinicalView','La historia de tomas permite documentar cuándo comenzó una pauta, sus cambios, pausas y final, incluyendo episodios pasados.',`
Abrir historia de tomas|Pulse Historia de tomas en una tarjeta actual o FoxPro.|Se consulta solo el paciente y el medicamento elegidos.
Registros de FoxPro|Revise fecha de la nota, pauta extraída y texto original completo.|La fecha de la nota se identifica como documentación, no como inicio real.
Señales en el texto|Lea expresiones sobre inicio o suspensión dentro de la nota completa.|Una instrucción condicional no demuestra que el cambio ocurrió.
Registrar fecha o cambio|Abra el formulario para añadir información conocida del tratamiento.|Queda un evento propio de Linkare con autor y auditoría.
Registrar tratamiento pasado|En Medicamentos, escriba Nombre del tratamiento pasado y abra Registrar tratamiento pasado para un fármaco que no tenga tarjeta actual.|Permite documentar episodios antiguos sin activarlos como tratamiento vigente.
Ver más tratamientos documentados|Avance en el listado de fechas añadidas en Linkare y abra Historia de tomas del medicamento correspondiente.|Cada episodio conserva sus eventos, fechas conocidas y fuentes.
Tipo de evento|Elija Inicio, Suspensión temporal, Reinicio, Finalización, Cambio de pauta o Nota.|El tipo describe lo documentado para ese episodio.
Fecha efectiva conocida|Introduzca la fecha real del evento cuando conste; deje vacío si es desconocida.|La aplicación conserva explícitamente la ausencia de fecha.
Dosis registrada|Escriba la dosis tal como está documentada, incluyendo unidad y fracciones.|Este campo conserva la pauta histórica completa.
Cada cuánto lo toma|Escriba frecuencia, horarios y condiciones según la fuente.|Puede registrar mañana, noche, intervalos, días de semana o PRN con aclaraciones.
Vía y fuente o motivo|Indique la vía conocida y de dónde proviene el dato: nota, receta, paciente o revisión médica.|La fuente permite interpretar después una corrección.
Guardar evento|Revise paciente, medicamento, fecha y texto antes de enviar.|Espere la respuesta del servidor y compruebe que el evento aparece.
Editar evento|Abra el evento propio de Linkare, corrija los datos y guarde.|Si otra persona lo cambió primero, actualice antes de volver a enviar.
Retirar evento|Indique el motivo de retirar un evento erróneo.|Queda archivado con su versión anterior en auditoría.
Tratamiento vigente|Si además debe cambiar el estado actual del medicamento, use sus controles de estado tras la revisión clínica.|La cronología histórica y el estado vigente tienen efectos distintos.`,
'En un expediente ficticio registre un inicio y un final con sus fechas; recargue y confirme ambos. Pruebe también una fecha desconocida.','Si no consta la fecha real de inicio…',['Dejar la fecha desconocida y documentar la fuente','Usar la primera nota como inicio seguro','Usar siempre la fecha de hoy']),
chapter('seguimiento','Seguimiento y escalas','patient','followup','clinicalView','Las mediciones fechadas permiten comparar evolución. Complete el instrumento y sus condiciones con el contexto correspondiente.',`
Registrar evolución|Abra el formulario del paciente correcto.|Se crea una medición nueva y fechada.
Fecha de evaluación|Registre cuándo se evaluó, no solo cuándo se digitó.|Las gráficas usan la fecha para ordenar puntos.
Escala e ítems|Seleccione el instrumento y complete cada pregunta según la evaluación.|La puntuación deriva de las respuestas registradas.
Adherencia|Registre la estimación y su fuente si está disponible.|Una estimación no confirma dispensación ni administración.
Sueño, apetito y funcionamiento|Complete los campos conocidos y describa cambios relevantes.|Evite convertir datos faltantes en resultados normales.
Notas y observaciones|Añada contexto, limitaciones y fuente de la información.|Ayuda a interpretar diferencias entre evaluaciones.
Guardar evolución|Revise fecha y resultados y envíe una vez.|La nueva observación aparece en seguimiento e historial.
Gráfica y selector|Cambie el tipo de gráfica o instrumento visible cuando haya mediciones.|Una curva refleja datos guardados y no prueba causalidad.
Editar registro|Abra la medición que necesita corregirse y guarde su corrección.|Se conserva el contenido anterior.
Eliminar registro|Indique el motivo para retirarlo de la vista activa.|La auditoría permite reconstruir lo ocurrido.
Cancelar|Cierre el formulario si no está listo para documentar.|No se crea una nueva medición.`,
'Localice las mediciones y explique por qué dos puntuaciones requieren revisar fechas y contexto.','Una mejoría en una gráfica…',['Debe interpretarse con el contexto clínico','Prueba automáticamente la causa del cambio','Sustituye la valoración profesional']),
chapter('seguridad','Antecedentes, riesgo y datos sensibles','patient','overview','clinicalView','Distinga antecedentes históricos, situación actual y fuente documentada. Registre solo información que corresponde a la evaluación.',`
Datos clínicos y personales|Abra Datos y seguro con permiso clínico para los campos ampliados.|Las opciones visibles dependen del rol y los permisos.
Nombre preferido y pronombres|Registre cómo desea ser llamada la persona, conservando su identificación.|El encabezado puede mostrar el nombre preferido.
Sexo, identidad y orientación|Complete lo referido y pertinente, respetando opciones no registradas.|No infiera información ausente desde otros campos.
Antecedentes de ideación y autolesión|Diferencie antecedentes, situación actual y fuente.|Un antecedente no equivale por sí solo a riesgo actual.
Intentos previos y última fecha|Registre cantidad y fecha si constan; conserve desconocido cuando falten.|Cero y desconocido tienen significados distintos.
Contacto de emergencia y plan de seguridad|Registre datos autorizados y el plan acordado por el profesional.|Revise que los contactos sigan vigentes.
Riesgo y estado clínico|Actualice según la evaluación documentada.|Las etiquetas del tablero dependen de estos datos.
Notas de antecedentes|Explique fecha aproximada, fuente y contexto.|Facilita distinguir lo observado de lo referido.
Fallecimiento y documento de respaldo|Documente solo hechos conocidos y su fuente antes de activar el modo post mortem.|La manera de muerte no se infiere automáticamente.
Guardar cambios|Revise la sensibilidad y exactitud de lo escrito antes de confirmar.|El permiso de lectura clínica determina quién puede consultar.`,
'Explique la diferencia entre dato desconocido, antecedente y riesgo actual, sin introducir información real en la práctica.','Un dato de intentos previos ausente se registra como…',['Desconocido o no registrado','Cero por defecto','El valor más frecuente de otros pacientes']),
chapter('efectos','Efectos observados, controles y laboratorios','patient','safety','clinicalView','Registre observaciones fechadas y vinculadas al medicamento cuando corresponda. La relación temporal no prueba causalidad.',`
Registrar efecto observado|Abra el formulario y seleccione el medicamento relacionado si se conoce.|Se conserva una observación con fecha y contexto.
Nombre del efecto y Otro|Seleccione un nombre disponible o escriba uno en Otro.|Use una descripción entendible para futuras revisiones.
Severidad y estado|Indique severidad y si está activo, resuelto o sin confirmar según lo evaluado.|Un estado se interpreta junto con las notas.
Fecha de aparición|Registre cuándo empezó el efecto según la fuente.|La fecha ayuda a relacionarlo temporalmente con cambios de pauta.
Relación temporal y acción tomada|Explique qué ocurrió antes o después y qué acción se documentó.|No atribuya una causa que no consta.
Registrar control|Documente las mediciones físicas y su fecha con las unidades correspondientes.|El control aparece en el historial del paciente.
Nuevo laboratorio|Complete prueba, fecha, valor, unidad y rango del informe.|La bandera debe corresponder al laboratorio.
Estado del laboratorio|Seleccione en rango, alto, bajo o crítico según el resultado reportado.|Un valor crítico requiere el procedimiento clínico del consultorio.
Notas y rango de referencia|Transcriba el rango aplicable y las aclaraciones relevantes.|Los rangos pueden cambiar por prueba y laboratorio.
Editar efecto o control|Abra el registro específico y corrija sus campos.|La versión anterior permanece auditada.
Eliminar efecto, control o laboratorio|Indique el motivo de retirar un registro erróneo.|Se archiva sin destruir la evidencia.
Guardar y Cancelar|Guarde una vez después de revisar, o cancele para salir sin confirmar.|Espere el aviso de guardado antes de recargar.`,
'Ubique los formularios de efecto y laboratorio y explique por qué hay que conservar fecha, unidad y rango.','Una relación temporal demuestra…',['Solo una secuencia que requiere interpretación','Causalidad automática','Que siempre debe suspenderse el medicamento']),
chapter('consultas','Listado de consultas y correcciones','patient','consultations','clinicalView','Cada consulta conserva su estado y fecha. Los borradores y las notas firmadas requieren acciones diferentes.',`
Iniciar consulta|Abra una nueva libreta desde el paciente correcto.|Se genera un borrador asociado a ese expediente.
Abrir consulta|Seleccione una entrada y revise su fecha, estado y autor.|Puede ser editable, firmada o de solo lectura.
Borrador|Continúe una nota sin firmar cuando tenga permiso.|El autoguardado debe confirmarse antes de cerrar.
Nota firmada|Consulte el texto y los datos de firma.|La firma preserva el contenido de esa versión.
Corregir consulta|Use la acción de corrección para documentar información posterior o rectificar con motivo.|Se conserva el original firmado y se registra la versión o adenda.
Anular consulta|Indique el motivo cuando una nota debe retirarse de uso clínico.|El contenido firmado permanece y la anulación es visible.
Historial de versiones|Revise quién cambió qué información y cuándo.|No confunda fecha de atención con fecha de corrección.
Cerrar libreta|Vuelva al expediente comprobando el estado del borrador.|Cerrar no equivale a firmar.
Filtros o estados visibles|Revise si está viendo borradores, firmadas o registros retirados.|Una consulta puede conservarse aunque no esté en la vista activa.
Permisos de consulta|Si una acción falta, el propietario debe revisar acceso clínico y gestión de consultas.|No use otra cuenta compartida para eludir permisos.`,
'En la práctica abra una libreta, escriba una nota ficticia y vuelva al expediente.','Para cambiar una nota firmada debe…',['Usar una corrección o adenda con historia','Sobrescribir el texto original','Borrar la firma']),
chapter('libreta','Libreta clínica: escribir, guardar y firmar','notebook',null,'consultationsManage','La libreta reúne apartados clínicos y un estado de guardado. Revise siempre el paciente y el estado de la nota.',`
Panel del paciente|Compruebe nombre, diagnóstico y contexto antes de escribir.|Evita documentar en el expediente equivocado.
Notas libres|Escriba la narración pertinente de la consulta.|El borrador se guarda automáticamente si hay conexión y permisos.
Motivo y evolución|Organice la razón de consulta y los cambios desde la visita previa.|La información queda en apartados identificables.
Riesgo y seguridad|Documente la valoración y el plan según lo evaluado.|Los campos no calculan por sí solos una decisión clínica.
Medicamentos y tolerabilidad|Registre la discusión del tratamiento y efectos referidos.|Cambiar un texto de la consulta no sustituye editar la pauta del medicamento.
Otros apartados de la libreta|Abra cada sección visible y registre solo lo pertinente.|La disponibilidad depende de la plantilla y los permisos.
Estado Guardando|Espere a que cambie a Guardado en el servidor.|No cierre ni recargue mientras indique error o cambios pendientes.
Reintentar guardado|Si aparece un error, conserve la nota abierta y revise la conexión antes de reintentar.|Confirme después que el servidor aceptó el borrador.
Finalizar y firmar|Revise el texto completo, fecha y paciente antes de confirmar la firma.|La versión firmada queda protegida; cambios posteriores requieren corrección.
Cerrar y volver|Use el control de salida para regresar al expediente.|Compruebe si quedó borrador o firmada según su intención.
Solo lectura|Si la libreta está bloqueada, lea el estado y revise el permiso.|No intente modificar una nota firmada desde un campo deshabilitado.`,
'Complete Notas libres y Motivo en la práctica ficticia; identifique el estado de guardado antes de salir.','Cerrar una libreta significa…',['Salir de la vista; debe revisar si quedó borrador o firmada','Firmar automáticamente','Borrar la consulta']),
chapter('documentos','Documentos, archivos y plantillas','patient','documents','documentsView','Los documentos permanecen vinculados al paciente y protegidos según su confidencialidad.',`
Subir archivo|Seleccione el archivo correcto, categoría, fecha clínica y confidencialidad.|Se guarda en almacenamiento privado junto con sus metadatos.
Nombre y descripción|Use un nombre claro y describa el contenido sin sustituir el archivo.|Facilita localizarlo después.
Categoría y confidencialidad|Seleccione el tipo y nivel de acceso aplicables.|Un permiso administrativo no autoriza documentos clínicos privados.
Abrir o descargar|Abra el documento autorizado y compruebe nombre, paciente y versión.|El acceso se entrega mediante un enlace temporal protegido.
Editar datos del documento|Corrija nombre, categoría, fecha o descripción.|El archivo original y los datos anteriores se conservan.
Eliminar documento|Indique el motivo para retirarlo de la lista activa.|Se archiva con auditoría.
Nuevo documento|Elija una plantilla disponible de constancia, incapacidad, carta o formulario.|La clasificación de la plantilla controla los datos permitidos.
Plantilla y versión|Revise el nombre y versión antes de completar variables.|El documento guarda la versión exacta utilizada.
Variables del documento|Complete fechas, destinatario, días y contenido adicional según los campos que aparezcan.|Revise ortografía y fechas antes de generar.
Generar y guardar PDF|Pulse una vez y espere la confirmación.|Se guarda un PDF privado y una copia del texto generado.
Imprimir o guardar copia|Abra el PDF y compruebe los datos antes de entregar.|Proteja también las copias descargadas e impresas.
Cancelar|Cierre sin generar cuando la información esté incompleta.|No se crea un documento nuevo.`,
'En un expediente ficticio abra una plantilla, identifique sus variables y cancele antes de generar si no hay datos completos.','Editar datos del documento modifica…',['Su descripción y metadatos, conservando el original','Siempre todo el archivo original','Los datos de todos los pacientes']),
chapter('recetas','Recetas: crear, ordenar, corregir e imprimir','patient','prescriptions','prescriptionsEdit','La receta guarda una instantánea de sus medicamentos. Compruebe paciente, pauta y datos del profesional antes de emitir o imprimir.',`
Nueva receta|Con permiso de emisión, abra el formulario desde el paciente correcto.|Secretaría puede corregir o anular recetas existentes cuando tenga permiso; emitir es un permiso distinto.
Seleccionar medicamentos|Elija los tratamientos activos que deben figurar y revise cada pauta.|La receta conserva la información seleccionada en esa versión.
Orden de tomas|Ordene los renglones según los horarios indicados al paciente.|El orden clínico no depende del alfabeto.
Medicamento, dosis e indicación|Revise nombre, dosis, unidad e instrucciones de cada renglón.|No complete una pauta que no haya sido validada por el profesional.
Cantidad e instrucciones generales|Complete la cantidad y las instrucciones que correspondan.|Revise que no contradigan los renglones de medicamentos.
Observaciones internas|Use este campo para información interna permitida.|No aparece en la impresión destinada al paciente.
Fecha y datos del médico|Revise fecha, nombre profesional, especialidad y JVPM del encabezado.|Los datos del consultorio se gestionan en Configuración.
Guardar receta|Revise y guarde una vez.|Una receta nueva no sustituye la gestión del tratamiento del expediente.
Editar receta|Abra una receta existente y corrija los campos permitidos.|La corrección crea revisión y conserva la anterior.
Anular receta|Escriba el motivo de la anulación.|Permanece en historia y se imprime identificada como RECETA ANULADA.
Imprimir y Guardar PDF|Compruebe la vista final antes de entregar o descargar.|El JVPM figura en el encabezado y se deja el espacio para firma y sello.
Historial de la receta|Revise número, estado, autor y revisiones.|Una receta anulada no debe entregarse como receta vigente.
Cancelar o quitar un renglón|Cancele si no desea guardar; quite únicamente el renglón seleccionado antes de confirmar.|No elimina el medicamento del expediente clínico.`,
'Revise una receta ficticia y explique la diferencia entre quitar su renglón y suspender el tratamiento.','Anular una receta…',['Conserva la receta con motivo y estado de anulación','La destruye sin rastro','Suspende automáticamente todos los tratamientos']),
chapter('historial','Historial y línea de tiempo','patient','timeline','clinicalView','El historial reúne acontecimientos de recursos distintos. Lea tipo, fecha y detalle para reconstruir el contexto.',`
Todo|Seleccione Todo para volver a la secuencia completa disponible.|Se combinan registros autorizados del paciente.
Medicamentos y recetas|Filtre cada tipo para revisar sus cambios o emisiones.|La receta conserva una instantánea; el medicamento conserva su propia evolución.
Escalas y efectos|Filtre mediciones u observaciones para comparar el periodo pertinente.|Las fechas ayudan a interpretar la secuencia.
Controles y laboratorios|Revise resultados junto con unidades y fechas.|Un resultado aislado requiere contexto.
Documentos y consultas|Seleccione el filtro del recurso que desea localizar.|Abra el recurso específico para ver su contenido autorizado.
Citas|Revise eventos de agenda dentro de la secuencia.|Crear una cita no acredita que la consulta se realizó.
Fecha y hora|Distinga registros históricos con fecha sin hora de eventos modernos con hora.|No atribuya una hora inexistente al registro anterior.
Detalle del evento|Lea la explicación, motivo o valor que acompaña el título.|El título por sí solo puede ser insuficiente.
Registros retirados y versiones|Use los historiales del recurso para revisar correcciones o anulaciones.|La vista activa puede omitir un registro archivado.
Sistema anterior|Abra la pestaña correspondiente para la evidencia literal FoxPro.|La línea moderna no sustituye todos los textos del sistema anterior.`,
'Filtre Medicamentos, Recetas y Consultas en un paciente ficticio y describa qué representa cada tipo.','Una cita en el historial demuestra…',['Que hubo un evento de agenda registrado','Que siempre hubo atención médica','Que se administró el tratamiento']),
chapter('sistema-anterior','Sistema anterior y expedientes fusionados','patient','legacy','patientsView','Esta sección conserva la procedencia histórica y las diferencias entre expedientes fusionados.',`
Ficha administrativa histórica|Revise domicilio, teléfonos, profesión y otros campos de origen.|Pueden diferir de los datos actuales y se identifican como históricos.
Edad en expediente anterior|Lea la edad como dato del registro fusionado.|La edad actual procede de la ficha reciente.
Actividad de consulta en FoxPro|Revise movimientos marcados como consulta y último movimiento disponible.|Son marcas del origen, no un total clínico certificado de visitas.
Movimientos y anotaciones|Lea el título, fecha y alcance administrativo o clínico.|El contenido depende de sus permisos.
Texto original|Consulte el texto literal cuando una tarjeta estructurada sea ambigua.|Puede contener medicamentos o contexto no identificados automáticamente.
Cargar más|Pulse para consultar el siguiente grupo de registros del paciente.|El historial se carga por páginas.
Ficha histórica adicional|Revise los campos conservados de otro expediente fusionado.|La fusión preserva diferencias en lugar de inventar un dato único.
Expediente clínico anterior|Con acceso clínico, revise los tratamientos y datos del expediente anterior.|El tratamiento vigente conserva el expediente actualizado más recientemente.
Reintentar|Si una sección falla, pulse su botón Reintentar tras revisar conexión.|No duplique pacientes porque una carga haya fallado.
Acceso administrativo|Secretaría consulta únicamente el alcance permitido.|Las notas clínicas privadas siguen protegidas por el servidor.`,
'Localice una fecha histórica desconocida y explique por qué debe permanecer sin inventar.','Un tratamiento en Expediente clínico anterior…',['Se conserva como historia del registro previo','Es automáticamente la pauta actual','Debe borrarse al fusionar']),
chapter('agenda','Agenda: mes, semana, día y calendarios','agenda',null,'appointmentsManage','La agenda combina solo los calendarios que su cuenta puede consultar. Cada evento conserva su propio calendario.',`
Filtros Doctor, Esposa y General|Active o desactive cada calendario autorizado.|Ocultar un calendario no elimina sus eventos.
Mes|Seleccione Mes para ver la distribución mensual y los días con eventos.|Pulse un día o evento para inspeccionar su detalle.
Semana|Seleccione Semana para comparar horarios entre días.|La columna y posición corresponden a fecha y hora del evento.
Día|Seleccione Día para concentrarse en una fecha.|Revise duración y estado antes de modificar.
Hoy|Pulse Hoy para volver a la fecha actual del consultorio.|No cambia las fechas de citas guardadas.
Flechas anterior y siguiente|Avance por meses, semanas o días según la vista activa.|Lea el encabezado después de navegar.
Nuevo evento|Abra el formulario y seleccione primero el calendario.|Su permiso de creación debe existir para ese calendario.
Evento en la cuadrícula|Pulse la tarjeta y confirme calendario, paciente, fecha y estado.|Abre el detalle de ese evento.
Filtros de estado y revisión|Seleccione pendientes, confirmadas o marcas administrativas según necesite.|La selección modifica la vista, no el estado de las citas.
Exportar vista|Exporte únicamente el alcance visible autorizado cuando necesite un archivo de calendario.|Proteja el archivo; exportar no acredita sincronización automática.
Agenda del día|Use la sección de agenda imprimible para una fecha específica.|Tiene permiso propio y usa el calendario Doctor.
Compartir calendarios|Revise alcance y destinatario antes de copiar un enlace.|Los enlaces familiares muestran bloques ocupados sin información clínica.`,
'Active dos calendarios en la práctica y cambie de Mes a Día sin modificar eventos.','Ocultar General en un filtro…',['Cambia únicamente la vista','Borra todos sus eventos','Mueve sus citas a Doctor']),
chapter('cita-formulario','Crear y editar una cita o evento','agenda',null,'appointmentsManage','Seleccione el destino, la persona y el horario de forma explícita. Revise AM o PM y la fecha completa.',`
Calendario|Seleccione la tarjeta Doctor, Esposa o General autorizada.|La aplicación no debe elegir el destino por usted.
Clase de evento|Elija cita de paciente o evento general según corresponda.|Un evento general no incorpora información clínica.
Paciente y búsqueda|Busque y seleccione la ficha correcta; compruebe nombre y teléfono.|Escribir un nombre sin seleccionar una ficha no garantiza el vínculo.
Título|Use un título apropiado al tipo de evento y al alcance de privacidad.|Evite datos clínicos en títulos generales o compartidos.
Fecha|Elija el día y revise mes y año.|No confunda fecha de captura con fecha de atención.
Hora, minutos y AM o PM|Complete cada campo y confirme la representación de 12 horas.|12 a. m. corresponde a medianoche y 12 p. m. a mediodía.
Duración|Seleccione el intervalo previsto y compruebe la hora final.|Una duración distinta altera el bloque ocupado.
Tipo y modalidad|Registre el motivo administrativo y si corresponde presencial o remoto.|Ayuda a preparar la agenda.
Estado|Seleccione el estado documentado de la cita.|Confirmada no equivale a consulta completada.
Notas autorizadas|Escriba solo información permitida para su rol y calendario.|Secretaría no recibe por este formulario el expediente clínico privado.
Crear evento y Guardar cambios|Revise todo y confirme una sola vez.|Espere que el servidor responda y compruebe el evento.
Cancelar o X|Cierre si todavía no desea guardar.|El evento no se crea por abrir el formulario.
Conflicto entre ediciones|Revise los campos señalados y conserve o actualice su intención con la versión nueva.|No sobrescriba sin leer un cambio hecho por otra persona.`,
'En la práctica cree una cita futura del paciente demo a las 2:30 p. m. y confirme calendario y duración.','Una cita a las 2:30 p. m. corresponde a…',['14:30','02:30','12:30']),
chapter('cita-detalle','Detalle, estados y eliminación de citas','agenda',null,'appointmentsManage','El detalle permite gestionar una cita concreta. Cada acción puede requerir un permiso distinto por calendario.',`
Abrir detalle|Pulse el evento y compruebe paciente, calendario y horario.|Las acciones siguientes afectan a ese evento.
Editar|Abra el formulario si necesita corregir fecha, hora, duración o datos permitidos.|Guarde y compruebe la nueva posición en agenda.
Pendiente y Confirmada|Seleccione el estado que corresponda a la coordinación realizada.|La marca queda atribuida en el servidor.
Completada y No asistió|Registre el resultado administrativo cuando corresponda.|No asistió es distinto de cancelada.
Cancelar cita|Use la acción de cancelación y su confirmación.|Conserva el evento cancelado y no equivale a eliminarlo de la base.
Marcar revisión administrativa|Indique que necesita revisión o que ya se revisó según los controles visibles.|Alimenta el filtro Por revisar del directorio.
Iniciar consulta|Con permiso clínico, abra la consulta vinculada al paciente.|Verifique de nuevo la identidad en la libreta.
Eliminar evento|Revise la confirmación del evento correcto.|La eliminación es recuperable y depende de la revisión actual del evento.
Actualizar ante conflicto|Si la cita cambió mientras estaba abierta, vuelva a cargar el detalle.|Evita aplicar un estado o nota al paciente equivocado.
Agregar a Google|Abra el enlace del evento y revise los datos antes de guardarlo en su cuenta de Google.|El enlace no demuestra que el evento se haya incorporado.
Sincronizar con Google|Si la cuenta está conectada y el botón aparece, solicite la sincronización y compruebe el resultado.|No repita una sincronización de resultado incierto sin revisar su estado.
Agregar a Apple o ICS|Descargue el archivo autorizado e impórtelo en el calendario que corresponda.|El archivo puede contener datos sensibles de la cita.
Cerrar detalle|Pulse X o Cerrar para regresar a la agenda.|Cerrar no cambia por sí solo el estado.
Acciones ausentes|Solicite al propietario revisar permisos de Ver, Crear, Editar, Cancelar y Eliminar del calendario.|Poder ver una cita no concede todos los demás permisos.`,
'Abra una cita ficticia y distinga confirmar, cancelar y eliminar antes de usar cada acción.','Tener permiso de cancelar…',['No concede automáticamente permiso de editar','Permite cambiar cualquier campo','Permite ver notas clínicas privadas']),
chapter('agenda-impresa','Agenda del día, notas y PDF','agenda',null,'agendaSheetView','La hoja diaria organiza por hora las citas del calendario Doctor y los datos autorizados para preparar la jornada.',`
Fecha de la agenda|Seleccione el día que quiere revisar o imprimir.|El encabezado y los pacientes deben corresponder a esa fecha.
Hoy|Vuelva a la agenda de la fecha actual.|Revise también el calendario y los estados incluidos.
Actualizar|Recargue la hoja si hubo cambios en citas o tratamientos.|Compruebe el resultado antes de imprimir.
Orden por hora|Lea la secuencia de citas y sus horarios.|El orden no depende del nombre del paciente.
Tratamientos activos|Revise los medicamentos autorizados asociados al paciente.|Una mención FoxPro histórica no se convierte por sí sola en tratamiento activo.
Nota de la cita|Con permiso de edición, escriba la nota propia de esa cita y guarde.|Se guarda aparte de la historia clínica y conserva su revisión.
Guardar nota y conflicto|Espere confirmación; si otro usuario cambió la nota, revise la nueva versión.|No borre accidentalmente una actualización concurrente.
Imprimir|Prepare la vista y compruebe fecha, páginas y orientación antes de confirmar la impresión.|La hoja puede contener información sensible.
Guardar PDF|Descargue el archivo y abra una página para revisar contenido y cortes.|Conserve el PDF únicamente en un lugar autorizado.
Permiso de hoja diaria|El propietario puede conceder lectura y edición por separado.|Ver la agenda no siempre incluye la hoja ni su edición.`,
'Seleccione otra fecha, vuelva a Hoy y revise una vista de impresión con datos ficticios.','Antes de imprimir una agenda debe comprobar…',['La fecha, los pacientes y las páginas','Únicamente el nombre del archivo','Que haya un indicador en color verde']),
chapter('resultados','Resultados e indicadores','analytics',null,'analyticsView','Los resultados resumen los datos disponibles. Revise filtros, periodos y cantidad de observaciones antes de comparar.',`
Resultados en navegación|Abra la sección con el permiso correspondiente.|Se muestran indicadores del alcance autorizado.
Alcance de los indicadores|Lea las explicaciones del conjunto disponible; esta pantalla no ofrece un selector de periodo.|No suponga que una gráfica incluye años que no fueron cargados.
Tarjetas de indicadores|Lea el nombre y unidad de cada indicador.|No todas las tarjetas representan el mismo conjunto de pacientes.
Gráficas|Revise ejes, leyenda y número de puntos antes de interpretar una tendencia.|Pocos datos o fechas faltantes limitan una comparación.
Escalas|Compare mediciones del mismo instrumento y contexto.|Instrumentos distintos no son necesariamente intercambiables.
Adherencia y funcionamiento|Revise cómo fueron registrados y si son estimaciones.|Un porcentaje no acredita administración del fármaco.
Tratamientos y tolerabilidad|Consulte los datos del expediente que originan un resultado.|El resumen no demuestra causalidad.
Exportaciones disponibles|Si su cuenta permite exportar, revise el alcance antes de descargar.|Proteja el archivo y confirme que el periodo es el correcto.
Volver al expediente|Abra Pacientes y revise la fuente del indicador.|Las correcciones se realizan sobre el recurso correspondiente.`,
'Lea una gráfica y explique qué representan sus ejes y de dónde proceden los datos.','Una tendencia agregada…',['Requiere revisar periodo y calidad de los datos','Es una orden de tratamiento','Sustituye los expedientes']),
chapter('alertas','Alertas y pendientes','alerts',null,'alertsView','Las alertas orientan la revisión. Abra la ficha y lea el contexto antes de resolver un pendiente.',`
Abrir Alertas|Use la navegación y revise el alcance visible.|Las alertas dependen del registro y los permisos.
Grupos de prioridad y Revisadas|Lea las listas de prioridad alta, media, seguimiento y revisadas.|Mover una alerta de estado requiere su acción específica.
Tarjeta de alerta|Lea título, detalle, paciente y fecha.|La prioridad visual no sustituye una valoración clínica.
Abrir paciente|Revise el expediente relacionado antes de actuar.|Confirme la identidad y la información que originó el aviso.
Marcar revisada|Pulse después de completar la revisión correspondiente.|El cambio conserva el registro y lo muestra entre las revisadas.
Reabrir|En la lista Revisadas, pulse Reabrir si necesita volver a atender el pendiente.|La alerta regresa a estado abierto.
Volver a alertas|Regrese para continuar con el siguiente pendiente.|Compruebe que el estado se guardó.
Sin alertas visibles|Revise filtros y permisos antes de concluir que no hay pendientes.|La ausencia de una alerta no certifica ausencia de riesgo.
Reintentar o actualizar|Si la sección falla, conserve el contexto y vuelva a cargar.|No repita cambios ambiguos sin revisar el resultado.`,
'Identifique título, paciente, fecha y estado de una alerta ficticia.','Cambiar un filtro de alerta…',['Solo cambia lo mostrado','Resuelve las alertas ocultas','Firma una valoración clínica']),
chapter('plan','Mi plan y acceso del consultorio','payments',null,null,'Esta página informa el estado de acceso y las modalidades disponibles. Revise el estado real antes de iniciar cualquier operación de facturación.',`
Mi plan|Abra la sección desde navegación.|Consulte la modalidad y estado que muestra el servidor.
Acceso gratuito|Cuando se indique acceso gratuito, puede trabajar con las funciones concedidas por permisos.|No necesita generar un pago para guardar pacientes en esta configuración.
Comparar modalidades|Lea duración, importe y condiciones visibles.|La comparación no crea por sí sola una orden.
Elegir modalidad o generar pago|Solo si necesita contratar y la función está habilitada, revise importe, moneda y periodo antes de confirmar.|No use pagos reales para practicar el tutorial.
Enlace o código de pago|Verifique la referencia y el destinatario antes de continuar.|Abrir un enlace no acredita que una orden se pagó.
Estado de orden|Espere la confirmación del proveedor y servidor.|Un retorno a la página no sustituye la confirmación de pago.
Actualizar estado|Consulte la orden existente antes de generar otra si el resultado es ambiguo.|Evita órdenes o pagos duplicados.
Historial y vigencia|Revise fechas y referencias de las operaciones existentes.|La vigencia procede de registros validados.
Continuar pago en Wompi y Abrir pago|Abra únicamente la orden existente que haya revisado.|No genere otra orden si el resultado del pago es ambiguo.
Ver detalle|Abra una orden pagada para revisar importe, referencia y vigencia.|Este detalle no sustituye un documento fiscal.
Permisos de facturación|La administración del plan pertenece a las cuentas autorizadas.|Secretaría no puede atribuirse permisos o modificar precios.`,
'Localice el estado de acceso sin iniciar una operación de pago real.','Volver de un enlace de pago significa…',['Que debe comprobarse el estado validado','Que siempre se pagó','Que debe generarse inmediatamente otra orden']),
chapter('configuracion','Configuración: apariencia y preferencias','settings',null,'settingsManage','Las preferencias ayudan a adaptar el trabajo. Revise qué cambios son personales y cuáles pertenecen al consultorio.',`
Engranaje|Abra Configuración desde la barra superior.|Las secciones administrativas dependen de su rol.
Texto grande|Active esta opción si necesita mejorar la lectura.|Revise tablas y formularios después del cambio.
Reducir movimiento|Active la preferencia si las animaciones dificultan el uso.|La navegación debe continuar funcionando.
Anticipaciones de recordatorios|Las horas previas que aparecen son preferencias de recordatorio. El aviso diario de las 8:00 se muestra en el dashboard.|Una preferencia no acredita que exista un proveedor de envío externo activo.
Guardar y respuesta visual|Espere la confirmación del cambio.|Si falla el servidor, revise el aviso antes de repetir.
Perfil del consultorio|Abra el editor de identidad para datos de encabezados y recetas.|Use el capítulo Perfil para revisar teléfonos y datos profesionales.
Equipo|Busque las cuentas del consultorio y sus permisos.|Cada persona debe usar su propio acceso.
Calendarios e integraciones|Revise el alcance de enlaces o conexiones antes de compartir.|No incluya información de pacientes en un alcance familiar.
Ayuda y recorrido|Abra Escuela completa o el recorrido seguro para repetir prácticas.|El progreso de aprendizaje pertenece al dispositivo y cuenta utilizados.`,
'Pruebe texto grande y reducir movimiento, revise su efecto y restablezca la preferencia si corresponde.','Una preferencia visual…',['No concede permisos clínicos','Activa automáticamente el acceso de todos','Firma las notas pendientes']),
chapter('equipo','Equipo, invitaciones y permisos','settings',null,'usersManage','El propietario administra cuentas individuales y permisos por función y calendario. Revise cada acceso con la cuenta de la persona.',`
Agregar usuario|Escriba nombre, correo y rol de la persona.|La invitación permite establecer una contraseña propia.
Rol|Seleccione médico, enfermería o secretaría según la función real.|El rol no debe elegirse para eludir restricciones.
Permisos recomendados|Revise el conjunto sugerido antes de enviarlo.|Un permiso concedido debe corresponder al trabajo de la persona.
Personalizados|Abra las casillas y lea cada acción.|Ver, crear, editar y eliminar son capacidades diferentes.
Permisos clínicos|Conceda lectura y edición clínica solo a quien corresponda.|Las notas y diagnósticos permanecen protegidos para Secretaría.
Permisos de recetas|Secretaría autorizada puede corregir o anular una receta existente.|No equivale a emitir nuevas recetas ni leer todo el expediente.
Permisos por calendario|Revise Ver, Crear, Editar, Cancelar y Eliminar para Doctor, Esposa y General.|Conceder una acción requiere el alcance de calendario adecuado.
Enviar invitación|Compruebe el correo y pulse una vez.|Revise el estado de entrega; no comparta una contraseña por mensajes.
Reenviar o revocar invitación|Reenvíe si venció y revoque si ya no debe aceptarse.|La persona debe utilizar el enlace válido más reciente.
Editar usuario|Cambie los datos o permisos de una cuenta existente y guarde.|Compruebe el acceso después de actualizar la sesión.
Desactivar cuenta|Use la acción cuando una persona deba dejar de acceder.|No elimina sus autorías clínicas previas.
Cancelar|Cierre el formulario si todavía no debe enviarse la invitación.|Abrir el formulario no invita a nadie.
Prueba por rol|Ingrese con la cuenta autorizada de prueba para verificar qué ve y qué puede hacer.|No use la cuenta propietaria como sustituto de esa prueba.`,
'En la práctica abra Agregar usuario, revise Personalizados y cancele sin enviar una invitación real.','Permiso para editar recetas de Secretaría permite…',['Corregir recetas existentes autorizadas','Leer cualquier nota clínica','Emitir una receta nueva automáticamente']),
chapter('perfil','Perfil, teléfonos, enlaces y conexiones','settings',null,'settingsManage','Los datos del perfil aparecen en documentos y encabezados. Los enlaces compartidos deben corresponder al destinatario y alcance correctos.',`
Editar perfil|Abra el perfil del consultorio y revise nombre, especialidad y profesional.|Los documentos pueden conservar una instantánea de sus datos al emitirse.
JVPM|Escriba el registro profesional correcto.|En la receta se muestra arriba; el sello puede contenerlo también.
Dirección y correo|Registre datos de contacto que puedan entregarse a pacientes.|Revise su ortografía en la vista de impresión.
Agregar teléfono|Cree una fila por contacto: clínica, celular de clínica o médico.|Cada teléfono conserva su etiqueta.
Editar o eliminar teléfono|Corrija el número seleccionado o retire esa fila.|Revise el conjunto completo antes de guardar.
Logo|Cargue una imagen autorizada y compruebe su legibilidad.|Se usa en la identidad visual del consultorio.
Guardar perfil|Confirme y después revise una receta o documento de ejemplo.|El guardado debe ser aceptado por el servidor.
Google o Apple|Revise la conexión disponible, su cuenta y permisos antes de vincular.|Una conexión puede requerir autorización adicional del proveedor.
Copiar enlace de calendario|Seleccione el alcance correcto: paciente propio, completo autorizado o bloques familiares.|El destinatario del enlace puede consultar lo que permita ese alcance.
Enlaces de calendario y Revocar|Revise fecha, estado y alcance y revoque un enlace que ya no deba funcionar.|Revocar el acceso no borra citas de la clínica.
Contactos personales|Si la función está habilitada, registre solo un contacto autorizado para bloques de agenda.|Compruebe el proveedor y el alcance antes de esperar entregas.
Desconectar o cancelar|Cierre una conexión o formulario según su intención.|No repita una operación de resultado incierto sin revisar su estado.`,
'Revise tres etiquetas de teléfono y explique qué información puede contener un enlace familiar.','Un enlace familiar de agenda debe mostrar…',['Bloques Ocupado sin pacientes ni diagnósticos','La historia clínica completa','Todas las recetas']),
chapter('continuidad','Guardado, errores, privacidad y aprendizaje','dashboard',null,null,'Aprenda a reconocer qué se guardó y cómo continuar sin perder información o duplicar operaciones.',`
Cambios guardados|Espere esta confirmación después de una operación real.|Indica que el servidor aceptó los cambios enviados.
Guardando cambios|Mantenga la página abierta mientras termina.|Evite recargar o abrir otra cuenta durante el envío.
Sin conexión|Revise internet y conserve el formulario o borrador abierto.|Los datos escritos aún pueden estar pendientes.
Reintentar|Después de recuperar conexión, reintente y compruebe el resultado.|Un aviso de error no equivale a que deba repetir un pago o envío externo.
Conflicto de edición|Compare los campos cambiados por otra persona y conserve la intención correcta.|Actualizar ayuda a evitar sobrescribir información reciente.
Sesión vencida o permiso revocado|Vuelva a entrar cuando sea necesario y revise acceso con el propietario.|No copie datos clínicos a medios no autorizados para resolver el problema.
Escuela completa|Elija capítulo, lea cada control y marque la explicación como comprendida.|El progreso se conserva localmente por cuenta y dispositivo.
Video por pantalla|Reproduzca, pause, use subtítulos o descargue el capítulo.|El video incluye narración y ejemplos ficticios.
Comprobación del capítulo|Responda la pregunta final y revise la explicación si se equivoca.|Completar requiere leer los controles y acertar la comprobación.
Recorrido interactivo|Practique con Paciente Demo Linkare en la copia temporal.|Al salir se descartan los cambios de la práctica.
Reiniciar progreso|Use el control del capítulo si desea repasarlo desde cero.|Solo afecta su progreso de aprendizaje local.
Descargar manual completo|Use el enlace Manual completo de la escuela para guardar las explicaciones de todas las pantallas en HTML e imprimirlas desde el navegador.|La copia no contiene datos de pacientes y puede consultarse sin entrar a la aplicación.
Soporte|Describa la pantalla y el error exacto por el canal autorizado.|Evite enviar información identificable de pacientes.
Cerrar sesión|Revise primero el guardado y cierre su cuenta en equipos compartidos.|La privacidad también depende de las copias descargadas y los dispositivos.`,
'Complete un capítulo, cierre y vuelva a Ayuda para comprobar el progreso. Reproduzca un video con subtítulos.','Ante Guardando cambios debe…',['Esperar la confirmación y conservar la página abierta','Recargar inmediatamente','Crear otra ficha por si acaso']),
];

LEARNING_CHAPTERS.push(
chapter('secretaria-ficha','Secretaría: tablero y ficha administrativa','patient','overview','patientsView','Secretaría trabaja con identificación, agenda y recursos expresamente autorizados. La ficha administrativa protege el resto de la historia clínica.',`
Agenda del día en Inicio|Revise las citas del día y sus marcas administrativas.|El aviso de las 8:00 permanece en el dashboard.
Buscar y abrir paciente|Compruebe nombre y contacto antes de entrar a la ficha.|No necesita crear otra ficha para añadir una cita.
Datos de contacto y Editar|Corrija nombre, edad y contactos autorizados sobre el mismo expediente.|El servidor conserva la revisión del registro.
Seguro médico|Revise aseguradora, afiliación, autorización y copago si constan.|No infiera cobertura a partir de una consulta previa.
Tarifa habitual|Si tiene permiso, revise o corrija la tarifa en su campo específico.|La tarifa no forma parte del nombre del paciente.
Citas del paciente y Nueva cita|Revise las existentes y cree otra solo cuando corresponda.|Compruebe calendario, fecha, hora y paciente.
Registrar medicamento informado|Capture literalmente lo comunicado cuando tenga permiso.|El médico lo revisa antes de activarlo.
Recetas existentes|Si tiene permiso, abra, corrija o anule una receta existente con motivo.|La autorización no incluye emitir recetas nuevas.
Nuevo documento administrativo|Seleccione una plantilla autorizada y complete sus variables.|No incluye los datos clínicos que su cuenta no puede consultar.
Documentos y Sistema anterior|Abra solo los documentos e historia administrativa autorizados.|La ausencia de notas clínicas es una restricción de acceso deliberada.
Eliminar paciente|Use la gestión de expediente autorizada, con motivo y confirmación del nombre.|Antes compruebe que no se trate de una ficha válida con datos pendientes.
Permisos faltantes|Pida al propietario revisar el permiso específico y el calendario.|No comparta otra cuenta para acceder.`,
'En el recorrido de Secretaría localice ficha, citas, recetas y documentos permitidos sin usar información real.','Secretaría debe ver diagnósticos para gestionar una cita?',['No; puede trabajar con la ficha administrativa autorizada','Sí, siempre','Puede cambiar su rol desde el navegador']),
chapter('captura','Secretaría: medicamentos informados y revisión','patient','overview','medicationsCapture','Este formulario registra una comunicación del paciente. La aprobación clínica ocurre después y conserva la fuente.',`
Registrar medicamento informado|Abra la captura desde la ficha administrativa autorizada.|El registro se vincula a ese paciente.
Medicamento|Escriba el nombre tal como lo informa la persona.|Si hay dudas de escritura, aclárelas en la nota.
Dosis y unidad|Registre lo referido diferenciando la cantidad y la unidad.|No proponga ni complete una dosis que no le comunicaron.
Frecuencia|Seleccione la pauta referida; use Otra y texto libre si corresponde.|Conserve horarios o condiciones sin interpretarlos.
Vía|Registre la vía comunicada.|Si no está confirmada, indique la duda en la nota para revisión.
Fecha informada|Registre la fecha que corresponda al dato recibido.|No use una fecha para fingir un inicio clínicamente confirmado.
Nota de captura|Escriba la fuente y las dudas administrativas relevantes.|Evite diagnósticos privados en esta captura.
Enviar a revisión|Revise nombre del paciente y campos y pulse una vez.|Queda pendiente; no se activa el tratamiento.
Cancelar|Salga sin enviar cuando no haya datos suficientes.|No se crea la comunicación.
Revisar y activar|El médico autorizado abre el pendiente y valida los datos actuales.|La activación queda atribuida al profesional.
Corregir o retirar un error|El profesional usa los controles autorizados del recurso.|La captura y sus revisiones deben conservar trazabilidad.`,
'En la práctica de Secretaría capture Medicamento ficticio y compruebe que queda pendiente de revisión.','Enviar a revisión significa…',['Registrar lo comunicado para valoración del médico','Prescribir automáticamente','Confirmar que todos los medicamentos históricos están activos']),
chapter('cuenta','Mi cuenta y cambio de contraseña','dashboard',null,null,'La cuenta es individual. Compruebe correo y rol antes de operar y cierre la sesión cuando termine en un equipo compartido.',`
Menú del usuario|Abra el menú del encabezado y elija Mi cuenta.|Muestra la identidad de su sesión.
Rol y permisos asignados|Lea el rol que aparece y consulte al propietario si no corresponde.|El navegador no puede concederse permisos.
Contraseña actual|Escriba la clave vigente para validar el cambio.|No la envíe por correo o soporte.
Nueva contraseña|Use una clave propia de al menos 12 caracteres según la validación mostrada.|Evite reutilizar una contraseña compartida.
Confirmar contraseña|Repita la nueva clave y compruebe que coincide.|Una diferencia impide confirmar el cambio.
Mostrar u ocultar contraseñas|Use el ojo solo cuando sea seguro revisar lo escrito.|Ocúltelas antes de compartir pantalla.
Actualizar contraseña|Confirme una vez y espere la respuesta.|La clave cambia en Supabase Auth, no solo en la pantalla.
Configuración|Abra la sección si su cuenta tiene acceso.|Cambiar contraseña no concede administración del consultorio.
Cerrar sesión|Compruebe Cambios guardados antes de salir.|La próxima persona debe entrar con su propia cuenta.
Recuperar acceso|Si olvidó la clave actual, use la recuperación en la página de acceso.|Utilice el enlace más reciente enviado a su propio correo.`,
'Localice Mi cuenta y los tres campos de contraseña, sin modificar una clave real para practicar.','Cambiar su contraseña…',['Solo cambia su propia clave de acceso','Cambia todas las cuentas del consultorio','Concede permisos de propietario']),
chapter('informes','Resumen del paciente e informe post mortem','patient','overview','clinicalView','Los informes reúnen datos del expediente con una finalidad específica. Revise identidad, fechas y procedencia antes de imprimir.',`
Resumen del paciente|Abra el resumen descriptivo desde el control disponible del expediente.|El contenido depende de los registros autorizados.
Tratamiento y medición principal|Compruebe qué medicamento y escala fueron elegidos como referencia.|No representa necesariamente todos los episodios históricos.
Situación actual|Lea estado, riesgo, efectos y citas con sus datos de origen.|Un resumen no añade una evaluación clínica nueva.
Imprimir resumen|Revise paciente y páginas en la vista de impresión.|Proteja la copia al entregarla o archivarla.
Cerrar resumen|Regrese al expediente cuando haya terminado.|Cerrar no modifica el contenido clínico.
Estado vital y fuente|En Datos y seguro documente fallecimiento solo cuando corresponda y exista fuente.|Se preservan fechas, documento y persona que confirmó.
Manera documentada|Seleccione la manera que consta en la fuente o conserve pendiente.|No se deduce intención desde síntomas o tratamientos.
Generar paquete médico legal|Con permiso específico, abra el informe post mortem del expediente correcto.|Revise calidad, procedencia y limitaciones de cada dato.
Cronología y documentos de respaldo|Distinga fecha del hecho, fecha de información y fecha de captura.|Los textos de terceros deben conservar su atribución.
Exportar o imprimir informe|Revise el alcance autorizado y el destinatario antes de generar copias.|El informe conserva información sensible y requiere protección.`,
'Revise un resumen ficticio y explique la diferencia entre hecho documentado y conclusión no sustentada.','Una causa o intención ausente en la fuente debe…',['Permanecer pendiente o no registrada','Inferirse del medicamento','Copiarse de un paciente parecido'])
);

export function learningForView(view,tab){return LEARNING_CHAPTERS.find(item=>item.view===view&&(!tab||item.tab===tab))||LEARNING_CHAPTERS.find(item=>item.view===view)||LEARNING_CHAPTERS[1];}
export function chapterComplete(chapter,progress={}){return chapter.controls.every((_,i)=>progress.read?.includes(i))&&progress.passed===true;}
