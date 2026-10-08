# Enriquecimiento histórico FoxPro: medicamentos y visitas

La importación original ya preservó 5,347 pacientes y 140,202 entradas de historia del ZIP autorizado. Esta fase no reimporta ni modifica pacientes modernos: crea un índice clínico de **menciones candidatas** a medicamentos, enlazadas a las anotaciones originales. La ficha de medicamentos activos, recetas, citas, recordatorios y sincronizaciones externas no cambian.

## Fuente y significado

- ZIP SHA-256: `f0054f84d8ade9bfb0c7e5551d99818cf14b9131f75dca06d0b70769b6197de9`.
- Lote FoxPro completado: `b121a91d-c2cc-4685-9b56-9856d1689924` en la organización `2ca5b8d4-d711-4ec7-833a-9d018ef067ca`.
- El extracto usa encabezados con nombre y concentración (por ejemplo, `Medicamento 20 mg`) y, cuando existe, conserva la instrucción próxima. La concentración del producto no se equipara automáticamente a la dosis administrada.
- Toda mención permanece `unreviewed`: no afirma uso actual, duración, inicio, adherencia ni receta. El médico debe contrastar el texto original antes de incorporarla al tratamiento actual.
- Las notas sin patrón claro permanecen completas en `legacy_history_v1` y se contabilizan; no se descartan ni se rellenan con inferencias.
- Para visitas, se muestra la cantidad de movimientos `PASO_CONSU=true`, su última fecha y el número de registros de `t_esta_cli`, separados y rotulados por origen. `NUM_VIS` no es fiable como total histórico acumulado.
- Los teléfonos existentes en `t_clientes` ya se importaron. El DBF no contiene un campo de correo electrónico; no se generan correos ficticios.

## Seguridad y rendimiento

- `legacy_medication_mentions_v1` vive en `linkare_private`; la lectura pasa por un RPC con `clinicalView`, paginado a 20. Secretaría no recibe el contenido.
- `linkare_legacy_medication_summary_v1` agrupa por nombre exacto normalizado (minúsculas y espacios), únicamente dentro del paciente y consultorio autorizados. Devuelve 20 grupos por página con conteo, primeras/últimas fechas conservadas y última concentración e indicación anotadas. No mezcla automáticamente marcas con genéricos ni identifica uso actual. Cada grupo muestra un extracto; todas las menciones y el texto original siguen disponibles por separado.
- La pestaña «Medicamentos» consulta el resumen y las menciones solo al abrir el expediente histórico; al cerrar sesión se eliminan ambas cachés de la memoria del cliente. El resumen de visitas aparece en la cabecera del expediente, siempre rotulado como marcas del origen y no como un total médico confirmado.
- La identidad de cada mención deriva de lote, anotación y línea; la carga valida organización, lote completo, hash del memo y plan. Repetir lotes de aplicación no crea duplicados.
- `legacy_visit_summary_v1` consulta únicamente la historia administrativa indexada por organización y paciente, no toda la clínica. El expediente solicita datos históricos bajo demanda.
- La carga se fracciona y se pausa entre lotes para limitar CPU. No se reactiva la importación FoxPro original ni la escritura masiva de proyecciones del directorio.

## Operación

1. Comprobar correo exacto del propietario, membresía activa, organización y lote completado en producción.
2. Ejecutar `scripts/backup-production.ps1` hacia un directorio privado temporal. Conservar su archivo DPAPI y el respaldo anterior.
3. Ejecutar `scripts/verify-backup-restore.ps1` con el ZIP opcional de enriquecimiento para restaurar y ensayar la carga completa en PGlite. Exigir `BACKUP_RESTORE_VERIFIED` e `ISOLATED_ENRICHMENT_VERIFIED`.
4. Ejecutar `node scripts/legacy-medication-enrichment.mjs --mode dry-run` y conciliar `manifestSha`, fuentes y candidatos.
5. Aplicar la migración SQL `20261008170915_historical_medication_mentions.sql`, después `scripts/run-legacy-medication-enrichment.ps1 -Mode apply` con el mismo lote, hash, plan y reporte de restauración. El proceso persiste cada lote; ante interrupción, repetir exactamente los mismos parámetros.
6. Ejecutar `-Mode verify`, comprobar `actual=expected`, permisos médico/Secretaría y apertura de expedientes recientes y antiguos en producción.

Los reportes de respaldo, restauración y carga se guardan fuera de Git. Nunca subir ZIP, memo, credenciales ni pacientes como fixtures.

## Reanudación para visualización integrada, 8 de octubre de 2026

La fuente y el lote original ya estaban cargados antes de esta continuación: 5,347 pacientes, 140,202 entradas de historia y 63,911 menciones estructuradas de medicamentos procedentes de 25,823 memorandos, repartidas entre 2,475 pacientes. Por ello **no se vuelve a ejecutar la importación** ni se escriben tratamientos o recetas modernos. La migración `20261008191908_historical_medication_summary.sql` añade solo una lectura privada y paginada; el frontend muestra los medicamentos históricos agrupados en la misma pestaña «Medicamentos», sin dejar de mostrar cada mención y el texto FoxPro original. Las fechas, visitas y contactos se presentan como datos de origen, sin inventar correos ni fechas actuales.

Las pruebas de base verifican agrupación, idempotencia, permisos de propietario/Secretaría y ausencia de tratamiento activo; el navegador aislado comprueba que el expediente y la sección sobreviven una recarga. No usar pacientes productivos como fixtures ni convertir la concentración histórica en dosis actual.
