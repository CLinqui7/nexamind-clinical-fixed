# Auditoría para evolución operativa y clínica de Linkare

## Conclusión

Linkare debe evolucionar sobre la arquitectura v3 existente. `linkare_records`, `linkare_load_state_v3`, `linkare_save_changes_v3`, `StateWriter` y las revisiones optimistas siguen siendo la fuente compatible para pacientes, citas y expediente clínico. Las nuevas tablas se limitarán a datos que requieren idempotencia, revocación, versionado independiente o procesamiento server-side: trabajos programados, plantillas/documentos generados, calendarios compartidos y mapeos de migración heredada.

La auditoría de producción del 21 de septiembre de 2026 confirmó cuatro organizaciones, siete membresías, 14 pacientes administrativos, 14 registros clínicos, 16 citas y 73 registros v3. No existen las tablas clínicas heredadas `patients`, `patient_medications`, `prescriptions`, `appointments` ni sus equivalentes enumerados en el encargo. Las tablas v1/v2 que sí permanecen están vacías y sin acceso del navegador. No se creará una tercera arquitectura clínica paralela.

## Estado de la versión y despliegue

- HEAD inicial: `f20ea2d268815f95ea111bf1494e39f2df93fc9e`.
- Baseline solicitado: `bd32ef414414f9e395eab9fb99e6df20ff8e21eb`.
- Cambios posteriores preservados: corrección del callback de sesión y archivo auditado de recetas.
- Migraciones remotas registradas: `20260921163356`, `20260921170106`, `20260921170933` y `20260921182203`.
- Las Edge Functions de pagos, equipo, recordatorios y calendarios están `ACTIVE`.
- No hay `pg_cron` ni `pg_net` instalados y no hay trabajos programados en PostgreSQL.

## Persistencia actual

`linkare_records` separa recursos por `organization_id`, `kind` e `id`. Los `kind` activos son `profile`, `settings`, `patient_admin`, `patient_clinical`, `appointment`, `appointment_clinical` y `alert`. Cada escritura usa `expectedRevision`; un conflicto produce error y evita sobrescrituras silenciosas.

El frontend proyecta el estado a recursos con `projectRecords()`, calcula cambios con `diffRecords()` y los serializa mediante `StateWriter`. `linkare_load_state_v3()` filtra por membresía y permiso. `linkare_save_changes_v3()` vuelve a validar cada campo, conserva los campos omitidos y protege notas firmadas y la identidad/historial de recetas.

## Módulos actuales y brechas

| Módulo | Implementación actual | Brecha comprobada | Evolución prevista |
|---|---|---|---|
| Citas | JSON administrativo `appointment`; notas separadas en `appointment_clinical` | El valor inicial es `confirmed`; no hay filtro explícito de pendientes ni estado administrativo de revisión | Mantener recurso v3; normalizar estados, agregar `adminReviewStatus`, filtros y auditoría |
| Medicamentos | Arreglo `medications` dentro de `patient_clinical`; historial de dosis embebido | Solo existe `medicationsManage`; Secretaría no puede capturar sin obtener edición clínica | Agregar `medicationsCapture`; crear elementos `pending_review` y operaciones médicas server-side protegidas |
| Recetas | Snapshot embebido con revisiones e historial | La entrega urgente anterior las ocultaba como archivo; el requisito actual exige anulación visible con motivo | Convertir archivo existente a estado `voided`, mantener contenido e historial, bloquear edición y marcar impresión |
| Recordatorios | `send-reminder`, `reminder-dispatch` y `linkare_notification_deliveries` | No existe cron; el dispatcher filtra por periodo pagado y por ello omite cuentas gratuitas; no hay política explícita de reintento | Usar dispatcher server-side, entitlement gratuito, dedupe estable, intentos controlados y programación diaria |
| Agenda diaria | Cálculo y vistas de agenda en React | No hay fuente única server-side ni versión clínica por permisos | Crear RPC `linkare_daily_agenda_v1`, UI de Inicio, impresión y mensaje manual |
| Documentos | Storage privado y metadata embebida en el paciente | No hay plantillas versionadas ni snapshots generados | Tablas nuevas de plantillas/versiones/documentos generados; RLS y Storage privado |
| Calendarios | Google por usuario y feed ICS completo ligado a `appointmentsManage` | No hay scopes de médico, staff, familiar o paciente; el token no expira ni rota | Tabla de shares con scope, expiración, revocación, hash de token y payload mínimo por alcance |
| Ayuda | Modal estático | Falta soporte centralizado, guías por rol y espacio para tutoriales | Configuración única y guías dentro de la app; sin inventar URL de video |
| Migración | Archivo privado único de v2 durante la instalación v3 | No hay staging reutilizable, dry-run ni mapeo de identificadores externos | Staging y `legacy_identifiers`; CLI de validación/importación en seco |

## Decisiones de esquema

Los campos administrativos `status`, `adminReviewStatus`, confirmación, reprogramación y cancelación permanecerán en `appointment.payload`. No contienen diagnóstico ni notas clínicas. La Secretaría puede recibirlos mediante `appointmentsManage`.

Los medicamentos y recetas permanecerán temporalmente en `patient_clinical.payload` para evitar una migración clínica masiva. La RPC devolverá a Secretaría únicamente la proyección mínima necesaria para `medicationsCapture` y `prescriptionsEdit`. El servidor fusionará los cambios permitidos con el expediente privado y rechazará campos ajenos.

Se crearán tablas independientes solo cuando el ciclo de vida lo exige:

- trabajos programados y configuración de automatización;
- plantillas, versiones y documentos generados;
- calendar shares revocables y auditables;
- staging y mapeos de migración heredada.

Todas las tablas nuevas incluirán `organization_id`, RLS, revocación a `PUBLIC`, grants explícitos y políticas basadas en membresía activa. Las funciones `SECURITY DEFINER` usarán `SET search_path=''` y validarán `auth.uid()` y permisos.

## Seguridad y privacidad

El owner conserva acceso completo. Los doctores y Enfermería continúan con permisos seleccionables. Secretaría recibe solo datos administrativos, recetas autorizadas y medicamentos capturados cuando se habilita `medicationsCapture`; no recibe diagnóstico, riesgo, consultas, evaluaciones, laboratorios ni notas internas.

Los feeds familiares solo mostrarán bloques ocupado/libre. Los feeds de pacientes solo mostrarán citas del paciente asociado. La agenda clínica del médico requerirá `clinicalView`; el formato operativo sin datos clínicos seguirá `appointmentsManage`. Los tokens de calendario se almacenarán como hash, serán rotables, revocables y tendrán vencimiento.

Los mensajes a pacientes contendrán únicamente fecha/hora y datos operativos. Los mensajes de agenda personal nunca incluirán pacientes cuando el destinatario sea un contacto familiar. Ningún audit payload guardará tokens, contraseñas o credenciales de proveedor.

## Hallazgos de seguridad

- Las tablas públicas actuales tienen RLS habilitado.
- `linkare_load_state_v3`, `linkare_save_changes_v3` y los helpers v3 usan `search_path=''`.
- `linkare_set_updated_at` y helpers históricos conservan `search_path=public`; se corregirá el trigger seguro sin cambiar su comportamiento.
- La protección de contraseñas filtradas es una configuración externa de Auth. Al 21 de septiembre de 2026, la CLI y las respuestas administrativas disponibles no exponen su estado, por lo que queda **no verificada**; no se cambió desde SQL ni se afirma que esté activa. Debe comprobarse en Supabase Dashboard → Authentication → Security cuando una persona con acceso al panel pueda revisarla.
- El bucket `patient-documents` es privado y no contiene objetos en producción.
- Las tablas clínicas heredadas enumeradas en el requisito no existen. Las tablas v1/v2 presentes están vacías, con RLS y sin permisos de escritura del cliente.

## Recordatorios y automatización

`linkare_notification_deliveries` ya tiene `dedupe_key` único por organización. La clave actual incluye cita, inicio, ventana y canal, pero debe incluir receptor normalizado para evitar colisiones semánticas durante cambios de contacto. El dispatcher no reenvía filas duplicadas y registra fallos, pero no posee un estado de reintento controlado.

La automatización se separará en dos pasos: una función idempotente que selecciona trabajo vencido y una programación server-side. La zona horaria predeterminada será `America/El_Salvador`; cada organización podrá definir la suya. No se activarán entregas reales si el proveedor o destinatario autorizado no están configurados.

## Capacidad de respaldo y recuperación

`supabase backups list` devolvió `backups: null`, `pitr_enabled: false`, `walg_enabled: true`. No existe evidencia de un backup físico restaurable ni de PITR disponible para este proyecto. Por tanto:

- no se afirmará recuperación total;
- cada fase usará migraciones aditivas y pre/postchecks agregados;
- los cambios de datos existentes serán normalizaciones idempotentes y conservadoras;
- el rollback preferido será desactivar el código nuevo o hacer forward-fix;
- una restauración destructiva requeriría soporte/backup externo verificado y aprobación explícita.

## Riesgos de regresión y mitigación

| Riesgo | Mitigación |
|---|---|
| Secretaría recibe PHI por una proyección amplia | Pruebas de carga/RPC con campos centinela y allowlists server-side |
| Un cambio de tratamiento modifica recetas históricas | Copia profunda al crear la receta y pruebas de snapshot inmutable |
| Doble recordatorio | Reserva única antes del proveedor y pruebas concurrentes/idempotentes |
| Feed familiar filtra nombres | Constructor de ICS por scope y tests que buscan PHI conocida |
| Una receta anulada vuelve a editarse | Guard server-side y estado visible en impresión/historial |
| Un cambio de plantilla altera un documento emitido | Guardar versión y snapshot renderizado inmutable |
| Importación duplica pacientes | Staging, hash/mapeo de legacy ID, dry-run y reconciliación |
| Crecimiento ilimitado del JSON | Mantener compatibilidad ahora y medir tamaño; extraer solo mediante migración futura explícita |

## Estrategia de entrega

Cada fase tendrá migración nueva, tests PGlite/RLS, tests unitarios y browser cuando corresponda, `npm run check`, pre/postcheck de producción y revisión del diff. Las migraciones históricas no se reaplicarán. Los despliegues de Edge Functions se harán antes del frontend que dependa de ellas. Si una fase falla pruebas, no se desplegará.

El rollback de UI/Edge será promover el deployment anterior. Las migraciones aditivas permanecerán sin uso hasta un forward-fix. No se eliminarán columnas, tablas, expedientes, usuarios, pagos ni archivos.
