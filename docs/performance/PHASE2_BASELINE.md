# Fase 2 — línea base y resultados

Estado: **IMPLEMENTED_NOT_DEPLOYED**. Fecha de verificación: 2026-10-03. Rama: `codex/patient-directory-performance`. SHA inicial: `954b0c737ca047200543c7fa011d0366ace835ff`.

## Continuidad de Fase 1

- Fase 1 dejó código, pruebas y un ensayo completo en PGlite; no dejó evidencia verificable de una importación productiva.
- Ensayo Fase 1: 98,813 filas fuente, 5,347 pacientes, 140,202 entradas históricas y 417 filas en cuarentena; 0 huérfanos y 0 citas, recordatorios o tratamientos activos creados por inferencia.
- El proyecto de referencia `fvucylgrqgxjqabacnlt` respondió `permission denied` a inspección de tablas/migraciones con los accesos disponibles. La organización propietaria, el esquema aplicado y cualquier carga productiva siguen sin verificar.
- Esta fase no releyó ni reimportó el ZIP FoxPro, no escribió en Supabase/Vercel productivos y no modificó `main`.

## Ensayo sintético

Motor: PGlite/PostgreSQL embebido, una conexión local; no representa región, red, pool, arranque frío ni capacidad real de Supabase. Cada respuesta devolvió 20 resúmenes. Bootstrap: 1,449 bytes; página: 9,289 bytes, por debajo de la meta inicial de 64 KB.

| Pacientes | Citas sintéticas | Lista p50/p95/p99 ms | Búsqueda p95 ms | Agenda 200 p95 ms | 20 lecturas p95 ms | 20 escrituras p95 ms |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 5,347 | 100,000 | 1.89 / 2.85 / 2.88 | 5.79 | 1.98 | 32.23 | 40.44 |
| 10,000 | 100,000 | 1.84 / 2.81 / 3.08 | 9.66 | 2.60 | 30.81 | 31.21 |
| 50,000 | 100,000 | 1.94 / 2.90 / 3.10 | 2.98 | 1.83 | 29.14 | 37.65 |

Las concurrencias son solicitudes simultáneas sobre una sola conexión embebida y por tanto se serializan; son una regresión determinista, no una prueba de 20 sesiones de red. Los resultados completos, condiciones y `EXPLAIN (ANALYZE, BUFFERS)` están en `outputs/phase2-load-*.json`. Se reproducen con `node scripts/rehearse-patient-directory.mjs --patients=5347 --events=100000`.

## Evidencia funcional

- 56 pruebas de base/RLS: corte inclusivo de seis meses calendario, final de mes/bisiesto, futuro, desconocido, cohortes 0/1/19/20/21/45, deduplicación, límite 20, keyset, `CURSOR_STALE`, recálculo al retractar, backfill reanudable/idempotente, detalle/agenda por permisos y aislamiento de tenant.
- Pruebas de dominio: caché LRU de cuatro páginas, resúmenes no escribibles, intervalos acotados y ausencia no interpretada como borrado.
- Playwright aislado: bootstrap v4 sin `linkare_load_state_v3`, 20/segunda página, búsqueda `nunez`→`Núñez`, apertura por ID y Secretaría sin diagnóstico. El historial FoxPro administrativo/clínico también pasó por rol.

## Límites pendientes de entorno real

- No se midieron latencia cliente↔Supabase, región, pool, cold start ni planes sobre el PostgreSQL remoto.
- No se pudieron ejecutar asesores RLS/índices contra `fvucylgrqgxjqabacnlt`.
- El detalle moderno todavía se carga como un solo paciente autorizado; el historial FoxPro sí está paginado a 20. Antes de considerar expedientes modernos con miles de elementos como objetivo cerrado, se requiere medir su tamaño real y, si excede límites, introducir mutaciones/lecturas por sección sin reserialización parcial.
- El respaldo total desde una vista paginada se deshabilitó para evitar un archivo falso. Un job privado de exportación total todavía debe implementarse/verificarse antes de declarar esa capacidad lista.
