# Contratos de lectura Fase 2

Todas las RPC son `SECURITY DEFINER`, fijan `search_path=''`, validan `auth.uid()`, membresía, permiso y organización, revocan `PUBLIC/anon` y limitan `EXECUTE`. Las tablas de proyección viven en `linkare_private`, tienen RLS y no conceden acceso directo a `authenticated`.

| RPC | Respuesta y límite | Errores relevantes |
| --- | --- | --- |
| `linkare_bootstrap_state_v4(org)` | Perfil, ajustes, usuario/equipo permitido, calendarios y estado de proyección; pacientes/citas/alertas vacíos | `ACCESS_DENIED` |
| `linkare_patient_directory_v1` | `recent/all/no_activity/archived`, búsqueda prefijo normalizada, máximo 20, 21 filas ligeras para `hasMore`, cursor keyset | `DIRECTORY_NOT_READY`, `CURSOR_STALE`, `INVALID_DIRECTORY_REQUEST` |
| `linkare_patient_detail_v1` | Un paciente por ID, campos proyectados por permiso y revisiones de ese paciente | `PATIENT_NOT_FOUND`, `ACCESS_DENIED` |
| `linkare_legacy_patient_history_v2` | Historia FoxPro de un paciente/sección, máximo 20 y cursor | `PATIENT_NOT_FOUND`, `ACCESS_DENIED` |
| `linkare_agenda_range_v1` | Eventos que intersectan `[start,end)`, calendarios autorizados, máximo 200 y cursor | `INVALID_RANGE`, `CURSOR_STALE`, `ACCESS_DENIED` |
| `linkare_dashboard_summary_v1` | Totales de pacientes y citas calculados sobre toda la proyección autorizada | `ACCESS_DENIED` |
| `linkare_projection_backfill_v1` | Solo `service_role`; fases `appointments` y `patients`, máximo 1,000 por bloque | `INVALID_BACKFILL_REQUEST` |

Los contratos v3 permanecen sin cambios para clientes anteriores. El frontend nuevo solo usa v4 después de `projection.ready=true`.

Índices principales: directorio reciente `(organization_id,last_activity_on desc,patient_id)` parcial; todos `(organization_id,archived,name_sort,patient_id)`; sin actividad parcial; búsqueda GIN `tsvector`; agenda `(organization_id,calendar_id,start_at,appointment_id)` y paciente/fecha.
