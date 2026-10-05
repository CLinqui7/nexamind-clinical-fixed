# Verificación de Cambios linkare

Fuente: `Cambios linkare.docx`, revisión integral actualizada el 5 de octubre de 2026. Esta lista distingue código y pruebas de una operación real con proveedores externos o datos históricos. No contiene expedientes ni credenciales.

| Solicitud | Estado verificable | Evidencia / límite |
|---|---|---|
| Recordatorios diarios a las 08:00, sin navegador | Infraestructura publicada | Vercel Cron `0 14 * * *` llama al dispatcher. Faltan credenciales de un proveedor de mensajería en Supabase; no se puede afirmar entrega real. |
| Citas sin confirmar y pendientes de revisión | Implementado | Inicio de Secretaría y filtros de Agenda. Pacientes ahora tiene un filtro separado **Por revisar** para la marca administrativa de citas, sin usar datos clínicos. |
| Permisos de Secretaría y captura de medicamentos | Implementado y probado en PostgreSQL aislado | Secretaría no recibe historia privada; puede capturar medicamentos pendientes de revisión, no activarlos. Permisos se comprueban en servidor. Prueba con cuentas reales de producción pendiente. |
| Medicamentos en receta, mediodía, notas, estados activo/suspendido | Implementado | Selector al crear receta, frecuencia de mediodía, notas visibles, historial de dosis y estados. Las recetas son instantáneas independientes. |
| Recetas asociadas al expediente, anulación sin borrado, impresión | Implementado y protegido por regresión | Historial y motivo de anulación; firma y sello; observaciones internas fuera de la impresión. La receta impresa recibe únicamente el nombre del paciente: no imprime edad, diagnóstico, código DX, seguro ni sus valores. |
| Agenda clínica del día en Inicio e impresión | Implementado | Hora real, paciente, medicamento activo y último cambio relevante desde RPC protegida. Envío manual por WhatsApp existe, pero no puede operar sin proveedor/teléfono. Envío **automático** diario de agenda no está habilitado. |
| Plantillas médicas y PDF privado | Implementado | Constancia, incapacidad, carta y formulario versionados. Generación queda vinculada al paciente y protegida por permisos. |
| Calendarios Doctor, Esposa y General | Implementado | Filtros combinables, permisos por calendario y selector obligatorio al crear. Recordatorio opcional a contactos personales requiere proveedor configurado. |
| Video, guía y tutorial interactivo | Implementado y corregido | Videos originales por rol, guía rápida y recorrido sin escrituras remotas. El recorrido ahora usa el formulario vigente, enseña AM/PM, acepta dosis con guiones y encuentra su paciente ficticio aun con el directorio paginado. Validado en escritorio, tablet y móvil. No sustituye una capacitación presencial. |
| WhatsApp de soporte | Preparado, no activo | Falta número de soporte autorizado en `VITE_SUPPORT_WHATSAPP_NUMBER`; la ayuda no muestra un enlace a un número inventado. |
| Validación Samsung | Parcial | Emulación táctil vertical 800×1280 y horizontal 1280×800; falta comprobación en un dispositivo Samsung físico. |
| Migración histórica FoxPro | Completada y conciliada | Lote `b121a91d-c2cc-4685-9b56-9856d1689924`: 5,347 pacientes, 140,202 entradas históricas y 98,813 filas conciliadas. Se preservaron 417 excepciones. Los 21 pacientes y 90 registros modernos preexistentes conservaron su huella. La fuente no contiene correo y no se inventaron direcciones. Los tratamientos de texto quedaron como historia de estado desconocido, no como medicación activa. |
| Integración Calendar, seguros, alertas, reportes | Funcionalidad parcial existente | Sincronización Google saliente y feed ICS; seguro y reportes en UI. No existe sincronización bidireccional ni automatización integral de seguros. |

## Puertas de operación pendientes

1. Configurar credenciales reales del proveedor de recordatorios y su plantilla aprobada; ejecutar una prueba con consentimiento y número autorizados. No reintentar mensajes ambiguos sin verificar el proveedor.
2. Obtener el número de soporte autorizado; configurar la variable de Vercel y verificar el destino del botón.
3. Decidir si se autoriza el envío automático de la agenda clínica por WhatsApp: expone datos de pacientes y tratamientos fuera de Linkare. Requiere destino del médico, consentimiento/política de privacidad, proveedor y prueba controlada.
4. No volver a ejecutar la importación FoxPro completada. Las 417 excepciones deben conservarse para revisión humana; no relacionarlas por similitud de nombre o teléfono.
5. Realizar aceptación con las cuentas reales de doctor y dos secretarias, y una inspección en tablet Samsung física, sin modificar pacientes reales como prueba.

## Revisión de regresión del 4 de octubre de 2026

- Suite estática, unitaria y de compilación: `npm run check`.
- Citas, AM/PM, búsqueda en un solo control, persistencia y recordatorios: `qa/browser/critical-ui.mjs` (9/9).
- Correcciones de medicamentos, controles y borrados auditados: `qa/browser/corrections.mjs` (8/8).
- Recetas desde tratamiento activo: `qa/browser/prescriptions.mjs` (5/5) e impresión/membrete (2/2).
- Calendarios y permisos: `qa/browser/calendars.mjs` (15/15).
- Módulos, permisos y persistencia: 11/11 y 9/9.
- Historia FoxPro: 8/8.
- Tablet Samsung equivalente: vertical y horizontal sin desbordamiento ni errores de ejecución.
- Tutorial completo por rol: escritorio, tablet y móvil; paciente, medicamento, cuaderno y cita ficticios sin escrituras remotas.

Las pruebas de navegador usan PostgreSQL aislado y datos sintéticos. La verificación productiva posterior al despliegue es de solo lectura.

## Revisión de receta del 5 de octubre de 2026

La fotografía reportada corresponde a la plantilla anterior a `53c1487`, que todavía mostraba Edad, Diagnóstico y Seguro médico. El código y el bundle productivo posteriores ya habían retirado esos campos, pero una pestaña abierta antes del despliegue puede seguir generando ventanas `about:blank` con el JavaScript antiguo hasta recargarse.

- El generador de impresión ahora reduce explícitamente el paciente a `name` antes de construir el documento.
- La prueba unitaria inyecta edad, diagnóstico, DX, aseguradora y plan con marcadores únicos y exige que ninguno aparezca en el HTML.
- La prueba real de navegador crea un paciente sintético con esos datos, genera una receta desde tratamiento activo y verifica la ventana imprimible.
- Resultado: el nombre y los medicamentos aparecen; edad, diagnóstico, DX y seguro no aparecen.
- La página principal y `index.html` se sirven con `Cache-Control: no-store, max-age=0` para evitar reutilizar HTML anterior al abrir o recargar la aplicación.
