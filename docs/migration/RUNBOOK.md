# Runbook de migración histórica

Este procedimiento separa análisis, ensayo y producción. Ningún comando de producción debe ejecutarse antes de la aprobación única final.

## 1. Preparación inmutable

1. Trabajar en una rama distinta de `main` y confirmar `git status`, `git branch --show-current`, `git rev-parse HEAD` y `git remote -v`.
2. Mantener el ZIP fuera del repositorio y abrirlo solo en lectura.
3. Calcular SHA-256 y compararlo con el valor aprobado.
4. No guardar claves en `.env` versionados. La clave `service_role` solo se inyecta al proceso de aplicación.
5. Confirmar mediante metadatos autenticados el proyecto, la organización propietaria y las migraciones desplegadas.

## 2. Dry-run del respaldo completo

```powershell
node scripts/legacy-migration.mjs `
  --source-zip "RUTA_PRIVADA\respaldo.zip" `
  --organization "UUID_ORGANIZACION" `
  --source "foxpro-linkare" `
  --backup-sha "SHA256_APROBADO" `
  --output "reporte-publico.json"
```

El archivo de salida contiene solo agregados. Deben cumplirse:

- todas las filas físicas están en una disposición;
- no hay `stagingPreview`, `raw_payload`, nombres, memos ni IDs fuente;
- `appointmentsCreated`, `notificationsCreated` y `activeMedicationsCreated` son cero;
- las cuarentenas coinciden con el análisis aprobado.

## 3. Ensayo aislado completo

Para el ensayo local en PostgreSQL en memoria:

```powershell
node scripts/rehearse-legacy-migration.mjs `
  --source-zip "RUTA_PRIVADA\respaldo.zip" `
  --backup-sha "SHA256_APROBADO" `
  --output "reporte-ensayo-publico.json"
```

Después debe repetirse en una rama/proyecto Supabase aislado autorizado. Aplicar primero todas las migraciones hasta `20261003010000_historical_migration_v2.sql`; ejecutar el importador contra ese destino; iniciar sesión como médico y Secretaría; comprobar búsqueda, apertura de ficha, pestaña “Sistema anterior”, paginación, cierre/reingreso, permisos y persistencia.

No promover el ensayo si hay huérfanos, diferencias de recuento, datos clínicos visibles para Secretaría, citas o recordatorios creados, valores clínicos inventados o pérdida de texto.

## 4. Puerta única de aprobación

La aprobación se entrega fuera del repositorio como JSON privado:

```json
{
  "approvedForProduction": true,
  "organizationId": "UUID_ORGANIZACION_CONFIRMADA",
  "backupSha": "SHA256_RESPALDO",
  "planSha": "SHA256_PLAN_DEFINITIVO",
  "commitSha": "SHA_GIT_VALIDADO_DE_40_CARACTERES",
  "approvedAt": "FECHA_ISO",
  "approvedBy": "RESPONSABLE"
}
```

Antes de aprobar se presenta conjuntamente: commit, organización, hash del respaldo, resultado del ensayo Supabase, 417 cuarentenas/casos pendientes, snapshot del destino, ventana de corte y plan de recuperación.

## 5. Corte y aplicación

1. Detener temporalmente altas/ediciones de pacientes o establecer una ventana sin cambios.
2. Crear un respaldo verificable del destino y registrar su identificador.
3. Confirmar nuevamente proyecto, organización, `backupSha`, `planSha` y commit.
4. Inyectar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` solo en la sesión del proceso.
5. Ejecutar con un UUID de lote conservado para poder reanudar:

```powershell
node scripts/legacy-migration.mjs `
  --mode apply `
  --source-zip "RUTA_PRIVADA\respaldo.zip" `
  --organization "UUID_ORGANIZACION_CONFIRMADA" `
  --source "foxpro-linkare" `
  --backup-sha "SHA256_RESPALDO" `
  --batch "UUID_LOTE" `
  --approval-file "aprobacion-privada.json" `
  --output "reporte-aplicacion-publico.json"
```

Cada lote es transaccional. Repetir exactamente el comando con el mismo `--batch` reanuda y omite filas ya confirmadas. Un cambio de identidad o fingerprint detiene el lote.

## 6. Verificación posterior

Ejecutar `--mode verify` con `--batch`, `--backup-sha`, `--plan-sha` y el mismo archivo de aprobación. Revisar:

- `sourceRows == expectedSourceRows`;
- `orphanHistory == 0`;
- pacientes e historia coinciden con el plan;
- cero citas, notificaciones y medicamentos activos creados;
- el dashboard devuelve todas las fichas y abre historia de muestras aprobadas;
- Secretaría ve solo historia administrativa; los roles clínicos autorizados ven la clínica;
- abrir, editar un campo administrativo permitido, guardar y volver a iniciar sesión no elimina el marcador/historia.

## 7. Recuperación

El rollback automatizado solo elimina fichas creadas por el lote si siguen en revisión 1, con fingerprint idéntico y sin expedientes clínicos modernos ni citas dependientes. Cualquier modificación posterior produce `ROLLBACK_CONFLICT` y obliga a recuperación desde el respaldo/snapshot.

```powershell
node scripts/legacy-migration.mjs `
  --mode rollback `
  --organization "UUID_ORGANIZACION_CONFIRMADA" `
  --batch "UUID_LOTE" `
  --backup-sha "SHA256_RESPALDO" `
  --plan-sha "SHA256_PLAN_DEFINITIVO" `
  --approval-file "aprobacion-privada.json" `
  --output "reporte-rollback-publico.json"
```

Tras rollback, verificar recuentos, auditoría y restauración de servicio. Nunca resolver un conflicto borrando o sobrescribiendo expedientes modernos.
