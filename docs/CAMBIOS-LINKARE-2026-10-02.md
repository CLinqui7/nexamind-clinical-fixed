# Verificación de Cambios linkare

Fuente: `Cambios linkare.docx`, revisado el 2 de octubre de 2026. Esta lista distingue código y pruebas de una operación real con proveedores externos o datos históricos. No contiene expedientes ni credenciales.

| Solicitud | Estado verificable | Evidencia / límite |
|---|---|---|
| Recordatorios diarios a las 08:00, sin navegador | Infraestructura publicada | Vercel Cron `0 14 * * *` llama al dispatcher. Faltan credenciales de un proveedor de mensajería en Supabase; no se puede afirmar entrega real. |
| Citas sin confirmar y pendientes de revisión | Implementado | Inicio de Secretaría y filtros de Agenda. Pacientes ahora tiene un filtro separado **Por revisar** para la marca administrativa de citas, sin usar datos clínicos. |
| Permisos de Secretaría y captura de medicamentos | Implementado y probado en PostgreSQL aislado | Secretaría no recibe historia privada; puede capturar medicamentos pendientes de revisión, no activarlos. Permisos se comprueban en servidor. Prueba con cuentas reales de producción pendiente. |
| Medicamentos en receta, mediodía, notas, estados activo/suspendido | Implementado | Selector al crear receta, frecuencia de mediodía, notas visibles, historial de dosis y estados. Las recetas son instantáneas independientes. |
| Recetas asociadas al expediente, anulación sin borrado, impresión | Implementado | Historial y motivo de anulación; firma y sello; observaciones internas fuera de la impresión. Pruebas de base y de impresión pasan. |
| Agenda clínica del día en Inicio e impresión | Implementado | Hora real, paciente, medicamento activo y último cambio relevante desde RPC protegida. Envío manual por WhatsApp existe, pero no puede operar sin proveedor/teléfono. Envío **automático** diario de agenda no está habilitado. |
| Plantillas médicas y PDF privado | Implementado | Constancia, incapacidad, carta y formulario versionados. Generación queda vinculada al paciente y protegida por permisos. |
| Calendarios Doctor, Esposa y General | Implementado | Filtros combinables, permisos por calendario y selector obligatorio al crear. Recordatorio opcional a contactos personales requiere proveedor configurado. |
| Video, guía y tutorial interactivo | Implementado | Videos originales por rol, guía rápida y recorrido que no tapa los controles; pruebas de escritorio/tablet/móvil con datos ficticios. No sustituye una capacitación presencial. |
| WhatsApp de soporte | Preparado, no activo | Falta número de soporte autorizado en `VITE_SUPPORT_WHATSAPP_NUMBER`; la ayuda no muestra un enlace a un número inventado. |
| Validación Samsung | Parcial | Emulación táctil vertical 800×1280 y horizontal 1280×800; falta comprobación en un dispositivo Samsung físico. |
| Migración histórica FoxPro | Preparación, no importación | Herramienta de dry-run y staging con IDs anteriores; no se recibió un export validado ni se importaron pacientes a producción. Requiere respaldo, conciliación y ensayo antes de tocar expedientes reales. |
| Integración Calendar, seguros, alertas, reportes | Funcionalidad parcial existente | Sincronización Google saliente y feed ICS; seguro y reportes en UI. No existe sincronización bidireccional ni automatización integral de seguros. |

## Puertas de operación pendientes

1. Configurar credenciales reales del proveedor de recordatorios y su plantilla aprobada; ejecutar una prueba con consentimiento y número autorizados. No reintentar mensajes ambiguos sin verificar el proveedor.
2. Obtener el número de soporte autorizado; configurar la variable de Vercel y verificar el destino del botón.
3. Decidir si se autoriza el envío automático de la agenda clínica por WhatsApp: expone datos de pacientes y tratamientos fuera de Linkare. Requiere destino del médico, consentimiento/política de privacidad, proveedor y prueba controlada.
4. Para migración, recibir una exportación del sistema antiguo, validar la calidad, probar en staging y conciliar antes de cualquier importación real.
5. Realizar aceptación con las cuentas reales de doctor y dos secretarias, y una inspección en tablet Samsung física, sin usar pacientes reales de prueba.
