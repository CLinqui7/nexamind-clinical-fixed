# Política de actividad válida v1

Zona de decisión: `America/El_Salvador`. El servidor congela `as_of` al iniciar la navegación. El corte inclusivo es `fecha_local(as_of) - interval '6 months'`; no son 180 días.

## Incluido

1. Consulta moderna con estado `signed` o `completed`, no archivada/retractada, cuya fecha real sea `startedAt`, o en su ausencia `endedAt`, o `signedAt`. La fecha debe ser válida y no futura.
2. Historia FoxPro de `t_mov_diarios` con `passedConsultation=true`, `occurred_on` conocido y no futuro. Se conserva precisión `date`; nunca se inventa hora.

Se elige el máximo válido y se guarda referencia del evento, origen y precisión. Ante corrección, retractación o anulación del máximo, la proyección recalcula todas las candidatas de ese paciente dentro de la misma transacción.

## Excluido

- `imported_at`, `updated_at`, hora del backfill, abrir ficha, autosave, login o cambio de formato.
- Citas futuras o citas pasadas sin evidencia válida de consulta.
- Movimientos administrativos sin `passedConsultation=true`, estadísticas, notificaciones, recordatorios o sincronizaciones.
- Fechas desconocidas, imposibles o futuras. Una anomalía no eclipsa una fecha válida anterior.

La actividad solo ordena una vista. No borra, archiva ni desactiva pacientes, historia o tratamientos.
