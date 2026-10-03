# Mapa de lectura y escritura

| Acción | Lectura | Escritura canónica | Efecto en proyección |
| --- | --- | --- | --- |
| Iniciar sesión | `linkare_bootstrap_state_v4` | ninguna | ninguna |
| Listar/buscar | `linkare_patient_directory_v1` | ninguna | ninguna |
| Abrir expediente | `linkare_patient_detail_v1` por ID | ninguna | ninguna |
| Historia FoxPro | `linkare_legacy_patient_history_v2` | ninguna | ninguna |
| Agenda | `linkare_agenda_range_v1` | ninguna | ninguna |
| Editar paciente/consulta/cita | `linkare_save_changes_v3` con revisión esperada | `public.linkare_records` | trigger recalcula solo paciente/cita afectada en la misma transacción |
| Archivar | RPC explícita con permiso/auditoría | registro canónico | trigger elimina/recalcula proyección |
| Importación Fase 1 por lote | `linkare_legacy_apply_v2` | registros e historia canónicos | wrapper refresca solo pacientes afectados |
| Backfill de proyección | `linkare_projection_backfill_v1` | solo tablas derivadas | keyset reanudable; no cambia el expediente |

Los objetos con `__summaryOnly=true` no entran en `projectRecords`. `StateWriter` opera con `allowDeletes=false` para colecciones parciales y fusiona la revisión únicamente al cargar detalle/agenda. Filtrar, buscar, paginar, abortar red o cerrar una ficha no produce mutaciones.

La caché del directorio contiene como máximo cuatro páginas, separadas por organización, usuario, permisos, alcance, búsqueda y cursor. Se invalida en mutaciones/permisos y se destruye —junto con resultados y controladores pendientes— al cerrar sesión.
