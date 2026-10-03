# Fase 2 — línea base y resultados

Estado: **DEPLOYED_AND_VERIFIED**. Fecha de verificación productiva: 2026-10-03. Rama: `codex/patient-directory-performance`. SHA inicial: `954b0c737ca047200543c7fa011d0366ace835ff`; SHA de código desplegado: `877f0308065685da8b1b5bf0fa97b80eb93a3e3d`.

## Continuidad de Fase 1

- Fase 1 dejó código, pruebas y un ensayo completo en PGlite; no dejó evidencia verificable de una importación productiva.
- Ensayo Fase 1: 98,813 filas fuente, 5,347 pacientes, 140,202 entradas históricas y 417 filas en cuarentena; 0 huérfanos y 0 citas, recordatorios o tratamientos activos creados por inferencia.
- El proyecto productivo verificado es `fvucylgrqgxjqabacnlt`, región `us-east-1`. Se aplicaron las migraciones `20261003010000`, `20261003061842` y `20261003074514`; las cuatro organizaciones existentes quedaron con la proyección lista.
- Esta fase no releyó ni reimportó el ZIP FoxPro. Aplicar el esquema de compatibilidad histórica no equivale a ejecutar la importación: no existen lotes FoxPro productivos creados por esta publicación.
- El frontend productivo es el despliegue Vercel `dpl_8WCH7urdq7PtVKfbUeERGJQyxj1z`, alias `https://nexamind-clinical.vercel.app`. `main` no fue fusionado; se desplegó el artefacto validado de la rama autorizada.

## Verificación productiva

- Respaldo lógico previo cifrado con DPAPI: 29 tablas, 1,254,390 bytes, SHA-256 `a7fe3f43e4d7f23a047e6f62e64d156b4d3720c078dbe83219d7c457589ea895`; no fue añadido al repositorio.
- Los 157 registros canónicos conservaron conteo, revisiones y huella interna durante el backfill. Las proyecciones conciliaron 34 pacientes y 38 citas, distribuidos entre cuatro organizaciones.
- Bootstrap máximo después de optimizar imágenes: 3,128 bytes. La página principal del directorio: 7,963 bytes; las imágenes del perfil se solicitan después y no bloquean la lista.
- PostgreSQL remoto: `EXPLAIN ANALYZE` 0.070 ms; 20 sesiones TLS establecidas, 200 muestras, p50 82.17 ms, p95 100.32 ms, p99 105.61 ms y 0 errores.
- Web productiva: 10 solicitudes HTML, p50 72.93 ms y p95 325.20 ms; pantalla utilizable en Playwright en 1,313.12 ms, sin errores de página, consola ni solicitudes fallidas.
- Vercel no mostró errores de runtime desde el despliegue. Supabase no mostró bloqueos ni consultas largas. Persisten dos recomendaciones antiguas de `auth.uid()` en políticas ajenas al directorio nuevo.

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

## Límites restantes

- El detalle moderno todavía se carga como un solo paciente autorizado; el historial FoxPro sí está paginado a 20. Antes de considerar expedientes modernos con miles de elementos como objetivo cerrado, se requiere medir su tamaño real y, si excede límites, introducir mutaciones/lecturas por sección sin reserialización parcial.
- El respaldo total desde una vista paginada se deshabilitó para evitar un archivo falso. Un job privado de exportación total todavía debe implementarse/verificarse antes de declarar esa capacidad lista.
- No se inició sesión mediante un password humano en el navegador productivo. Los contratos autenticados, RLS, Doctor/Secretaría, detalle y agenda sí se ejecutaron directamente contra el PostgreSQL productivo con identidades existentes y sin registrar contenido clínico.
