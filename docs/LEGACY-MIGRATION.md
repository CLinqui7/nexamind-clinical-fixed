# Migración histórica

No se ejecutó ninguna importación clínica en producción. El proceso preparado sigue estas etapas: exportar, cargar a staging, limpiar, transformar, validar, importar y reconciliar.

`scripts/legacy-migration.mjs` acepta JSON con colecciones `patients`, `appointments`, `medications`, `prescriptions`, `diagnoses`, `notes`, `documents` e `insurance`. También acepta un arreglo plano con `entity_type`. Cada fila necesita un `legacy_id`; los pacientes necesitan nombre.

## Dry-run obligatorio

```powershell
node scripts/legacy-migration.mjs --input export.json --organization 00000000-0000-0000-0000-000000000000 --source sistema-anterior --output reporte.json
```

Sin `--apply` el script no abre conexión de red ni modifica una base. Informa total fuente, válidos, inválidos, importados, omitidos, duplicados y errores. Los identificadores nuevos son deterministas por organización, sistema, entidad e ID anterior, lo cual permite repetir el análisis y reconciliar resultados.

## Aplicación futura controlada

La opción `--apply` requiere explícitamente `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Solo escribe filas en `linkare_private.legacy_staging_v1` y mapeos en `legacy_identifiers`; todavía no crea expedientes clínicos. Debe ejecutarse primero en un proyecto de ensayo, revisar el reporte, resolver duplicados y validar recuentos por entidad antes de construir o autorizar el paso IMPORT hacia `linkare_records`.

`legacy_identifiers` conserva `organization_id`, sistema fuente, tipo de entidad, ID anterior, ID nuevo, metadatos y fecha. Sus grants están limitados al rol de servicio. Nunca debe usarse una clave pública para la herramienta.

## Reconciliación

Compare totales de origen, staging válido, mapeos únicos y futuros registros importados por organización. Tome una muestra de pacientes con citas, medicamentos, recetas, diagnósticos, notas, documentos y seguro. Las notas firmadas y recetas históricas deben conservar autor, fecha, estado y versión; una discrepancia detiene la importación.
