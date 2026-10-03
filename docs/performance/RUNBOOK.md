# Runbook de backfill y publicación compatible

Estado actual: **DEPLOYED_AND_VERIFIED** desde 2026-10-03. Este documento no autoriza una importación FoxPro ni cambios productivos adicionales.

## Puerta única de aprobación

Antes de DDL, backfill, frontend o importación real se debe entregar y aprobar en conjunto:

1. commit exacto validado y artefactos de CI;
2. proyecto `fvucylgrqgxjqabacnlt` accesible y organización destino confirmada por ID/propietario;
3. estado real de Fase 1 y lotes/conciliación, con conteos privados actuales;
4. respaldo recuperable **actual** del destino y restauración ensayada;
5. resultado de ensayo en Supabase aislado, planes y asesores RLS/seguridad;
6. ventana de corte, responsable, monitoreo y criterios de abortar/recuperar;
7. solución aprobada para exportación total y, si el tamaño real lo exige, paginación de secciones clínicas modernas.

## Secuencia autorizada posterior

1. Registrar SHA, proyecto, organización, conteos y `listing_version`. No registrar PHI en logs.
2. Aplicar solo `20261003061842_patient_directory_performance.sql`. Mantener frontend v3 activo.
3. Ejecutar `linkare_projection_backfill_v1(org,'appointments',cursor,1000)` hasta `hasMore=false`; persistir `nextId` tras cada bloque.
4. Ejecutar fase `patients` igual. Las mutaciones concurrentes siguen actualizando la proyección mediante trigger; la revisión canónica evita que el backfill vuelva a escribir una versión antigua.
5. Conciliar una fila de directorio por `patient_admin` no eliminado, citas por intervalo, muestras de última actividad y cero acceso cruzado. Confirmar `projection.ready=true`.
6. Ejecutar pruebas RLS, propietario/Doctor/Secretaría, búsqueda, ID antiguo, agenda y `EXPLAIN (ANALYZE, BUFFERS)` en el entorno aislado y luego smoke autorizado.
7. Publicar frontend v4 coordinado. Los clientes v3 continúan disponibles; v4 se bloquea limpiamente si la proyección no está lista.
8. Vigilar errores, p50/p95/p99, bytes y `CURSOR_STALE`; no ejecutar recordatorios, correos, recetas ni sincronizaciones como parte del backfill.

## Recuperación

- Antes de activar v4: detener backfill y reanudar desde el último cursor; no hay que revertir expedientes.
- Después de activar: volver temporalmente al frontend compatible solo si ese escritor no interpreta páginas parciales como borrados. Conservar tablas/funciones derivadas para diagnóstico.
- No restaurar un backup anterior a Fase 1 ni borrar pacientes importados/trabajo moderno. Una recuperación de datos requiere el respaldo actual aprobado y conciliación explícita.
- No eliminar migraciones, funciones v3 ni proyecciones durante la primera publicación. Su retiro exige otra ventana y evidencia de que no quedan clientes antiguos.

## Registro de publicación 2026-10-03

- Respaldo previo: archivo lógico DPAPI local, SHA-256 `a7fe3f43e4d7f23a047e6f62e64d156b4d3720c078dbe83219d7c457589ea895`.
- Proyecto: `fvucylgrqgxjqabacnlt`, región `us-east-1`; 157 registros canónicos antes y después.
- Migraciones aplicadas: `20261003010000_historical_migration_v2.sql`, `20261003061842_patient_directory_performance.sql` y `20261003074514_lazy_profile_assets.sql`.
- Frontend activo: `dpl_8WCH7urdq7PtVKfbUeERGJQyxj1z`; artefacto anterior conservado: `dpl_7714tidLwx8EpALAS4dPANaasRFf`.
- Para recuperar solo el frontend, reasignar el alias productivo al artefacto anterior. No revertir las tablas aditivas: el cliente v3 permanece compatible y las proyecciones no son expedientes editables.
- Si se detectara una alteración canónica, detener escrituras y usar el respaldo cifrado actual; no restaurar una copia anterior ni ejecutar el rollback FoxPro sin conciliación explícita.
