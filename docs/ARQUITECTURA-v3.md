# Arquitectura y límites de Linkare 3

## Identidad y autorización

Solo Supabase Auth valida contraseñas. No hay acceso local, cuentas públicas de demostración ni contraseñas incrustadas en producción. El médico crea un consultorio sin pacientes. La secretaría se incorpora mediante una invitación de siete días, elige contraseña y recibe una membresía administrativa. Un correo ya asociado a un consultorio no se reasigna automáticamente a otro. El registro no puede elegir su rol mediante metadata.

La autoridad es `organization_members`, no un rol guardado en localStorage ni en el antiguo JSON. El servidor vuelve a verificar usuario, membresía activa y permiso en cada mutación. Los cinco permisos de secretaría son datos de pacientes (ver/crear/editar), agenda y recordatorios. No incluyen diagnósticos, identidad sexual, notas, medicamentos, documentos clínicos, precio del plan ni administración del equipo.

Supabase mantiene el token de sesión según su SDK. Linkare ya no guarda expedientes completos en localStorage. Datos cargados permanecen en memoria; una cuenta desactivada no puede realizar nuevas solicitudes aunque conserve información que antes estuvo autorizada a leer.

## Persistencia

`linkare_records` separa `patient_admin` de `patient_clinical`, y la cita administrativa de sus notas clínicas. La aplicación envía diferencias por recurso, con revisión esperada. Una escritura conflictiva se rechaza: no se mezcla ni sobrescribe silenciosamente. En una nota clínica pendiente, copie el contenido y recargue antes de reconciliar un conflicto.

No se hace una escritura de toda la clínica por pulsación. Los cambios se agrupan durante 900 ms, se serializan y se confirman antes de mostrar Guardado. El temporizador de la libreta actualiza solo su componente. React y Supabase se separan en chunks durante el build y no se publican sourcemaps.

El primer acceso todavía carga el conjunto de registros autorizado del consultorio; no se implementó paginación completa del expediente ni una comparación de rendimiento sobre una clínica grande. Para gran volumen se deberá añadir paginación/búsqueda remota y mediciones con datos representativos.

No hay sincronización en tiempo real de todos los usuarios. Los conflictos se detectan al guardar. Use recarga después de guardar para ver cambios de otras personas. No cierre una ventana con un conflicto o sin conexión: no se promete recuperación offline de texto no guardado.

## Notas y documentos

Las notas firmadas permanecen idénticas al recargarlas y el RPC impide editarlas o quitarlas. La firma identifica al usuario autenticado, no una firma electrónica certificada. Información posterior debe registrarse como una nueva consulta/adenda. Los datos clínicos originales se conservan en la migración.

Storage `patient-documents` es privado, con máximo de 20 MB y URLs firmadas de 60 segundos. El control de lectura se aplica al médico del consultorio, no solo a la interfaz. Se admite archivado de metadatos, sin destrucción física desde el navegador. La auditoría documental registra subida/apertura/descarga/archivo.

La lista de extensiones/MIME no equivale a un antivirus. No hay análisis antimalware, CDR, DLP ni cadena de custodia judicial certificada. No abra archivos de fuentes no confiables sin un análisis independiente. Las imágenes o documentos antiguos embebidos en JSON no se convierten automáticamente a Storage: conservar y migrar desde el archivo privado según revisión.

Las políticas restrictivas de Storage evitan que una política genérica de otra app reabra el bucket clínico. No se otorgan permisos directos de actualización de roles, catálogo u órdenes al navegador.

## Facturación

Catálogo servidor: monthly 4000 centavos/1 mes, semiannual 22000/6 meses, annual 40000/12 meses. Órdenes congelan precio y duración. Una orden en creación/revisión impide duplicar checkout si se corta la conexión con Wompi. Un enlace pendiente de otra modalidad requiere conciliación antes de crear otro; no se cancela silenciosamente un enlace que aún podría cobrarse.

El webhook verifica HMAC del cuerpo exacto, aplicativo, aprobación productiva, monto, referencia y transacción. La función SQL aplica los meses una sola vez. Renovación anticipada extiende la fecha existente. Confirmación por URL de retorno no activa planes. No hay débito recurrente automático ni prorrateo.

Se mantienen siete días de gracia para escritura. Después, los registros permanecen consultables; no se permiten nuevas mutaciones clínicas ni envío de recordatorios. El perfil del consultorio, invitaciones y acceso al pago se mantienen disponibles. Las órdenes y vigencias anteriores requieren conciliación con el proveedor: no se confía en fechas antiguas editables desde el JSON.

## Integraciones

Google es sincronización de Linkare hacia el calendario, no una importación bidireccional completa. Usa OAuth, estados de un solo uso, tokens del servidor y eventos discretos. Los identificadores de eventos se verifican por usuario y consultorio. Apple ofrece .ics y suscripción de solo lectura mediante un token privado revocable; cualquiera que posea ese enlace puede ver sus eventos discretos, por lo que debe tratarse como una credencial.

Recordatorios: preferencias y consentimiento se leen en el servidor. Se omiten pacientes fallecidos/archivados y citas canceladas/pasadas. Hay deduplicación, límites, horario de descanso y un dispatcher para cron. El envío requiere proveedor y programador configurados. La aceptación del proveedor se registra como enviada; no se promete entrega/lectura sin callbacks específicos. El modo manual abre la aplicación de mensajes y requiere confirmar que se envió.

## Corte de versión

Retirar los handlers heredados es obligatorio: los cuatro endpoints de bootstrap/facturación antiguos retornan 410. Publicar solamente React deja incompleta la transición de seguridad. Todas las funciones privadas validan su JWT dentro del handler y vuelven a consultar permisos. `verify_jwt=false` en config no representa acceso anónimo a esas acciones.

Copias de seguridad, retención legal, consentimiento, revisión de escalas clínicas, verificación de proveedor y monitorización deben completarse con los responsables del consultorio. El software no diagnostica, no recomienda dosis automáticamente y el resumen post mortem no sustituye una pericia.
