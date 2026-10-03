# Linkare: arquitectura de CPU, capacidad y alternativas de infraestructura

Fecha de corte: 2026-10-03  
Producción evaluada: `https://nexamind-clinical.vercel.app`  
Supabase evaluado: `fvucylgrqgxjqabacnlt`

## Decisión ejecutiva

No conviene migrar la base clínica por el incidente de hoy. El pico no demostró falta estructural de capacidad: provino de un ciclo defectuoso que produjo aproximadamente 317 mil solicitudes PostgreSQL. Ese ciclo fue eliminado y la base volvió a operar sin consultas bloqueadas ni una tormenta sostenida.

La decisión recomendada es:

1. Mantener por ahora Vercel + Supabase administrado.
2. Medir siete días de carga normal, sin contar el incidente ni las consultas administrativas de auditoría.
3. Pasar de Free/Nano a Pro/Micro antes de considerar Linkare un servicio clínico estable; Pro incorpora respaldos de siete días y un crédito de cómputo que cubre una instancia Micro. No efectuar ese cambio de facturación sin aprobación del propietario.
4. Escalar a Small o Medium solo si, después de las optimizaciones, la CPU normal supera 60 % durante 15 minutos, el p95 de lectura supera 500 ms de forma sostenida o se agotan conexiones.
5. Utilizar VPS económicos para workers, staging y otros proyectos; no colocar la única base clínica en un VPS barato autogestionado.

Supabase recomienda primero localizar consultas excesivas/lentas, índices faltantes y conexiones, y escalar cómputo después de optimizar. Fuentes: [diagnóstico de CPU](https://supabase.com/docs/guides/troubleshooting/high-cpu-usage), [reportes de observabilidad](https://supabase.com/docs/guides/observability/reports), [cómputo y disco](https://supabase.com/docs/guides/platform/compute-and-disk) y [precios](https://supabase.com/pricing).

## Estado medido después del incidente

- Directorio: p50 81.63 ms; p95 82.74 ms; páginas de 20 pacientes.
- Historia paginada: p50 84.47 ms; un arranque frío llevó el máximo/p95 de la muestra a 961.32 ms.
- Bootstrap: 165.68 ms.
- Resumen de dashboard: 377.94 ms.
- Plan SQL del directorio: 14.33 ms de planificación y 32.23 ms de ejecución; sin lecturas de disco en la muestra.
- Smoke web posterior a la optimización RLS: p50 72.98 ms, p95 313.75 ms, interfaz utilizable en 1.23 s, cero errores de página, consola o red.
- Asesor de rendimiento de Supabase después de la migración `20261003200901`: cero advertencias.

Estos números no justifican una mudanza urgente. Sí justifican controles que impidan que un error de cliente vuelva a multiplicar escrituras.

## Arquitectura propuesta

```text
Navegador
  ├─ lecturas: debounce + cancelación + caché corta
  └─ escrituras: acción explícita + una solicitud en vuelo + idempotencia
            │
            ▼
Vercel CDN / SPA
            │
            ▼
Supabase API / RPC autenticados
  ├─ proyecciones de lectura paginadas
  ├─ transacciones cortas para cambios
  ├─ RLS optimizado y separación por consultorio
  ├─ auditoría inmutable de operaciones clínicas
  └─ cola de trabajos pendientes
            │
            ▼
Worker programado
  ├─ recordatorios vencidos (`FOR UPDATE SKIP LOCKED`)
  ├─ máximo de intentos y backoff
  └─ deduplicación por cita/canal/anticipación
```

### Reglas que evitan otra tormenta de CPU

- Nunca guardar por montar, hidratar, renderizar o recibir cambios de otra pestaña.
- Guardar únicamente por una acción explícita o un autosave clínico acotado y observable.
- Mantener una sola escritura en vuelo por consultorio/navegador y una clave idempotente por operación.
- Un conflicto de revisión no se reintenta en ciclo: se recarga/combina y se permite como máximo un reintento controlado.
- Búsqueda con 300 ms de debounce, `AbortController`, límite de 20 resultados y paginación por cursor.
- Directorio, agenda y dashboard leen proyecciones pequeñas; el expediente completo se carga solo al abrir un paciente.
- Workers y scripts usan el pool transaccional de Supavisor/PgBouncer; el navegador usa PostgREST, no conexiones PostgreSQL directas.
- Recordatorios se calculan por `due_at` indexado y se procesan en lotes; no hay bucles de navegador consultando continuamente.
- Alerta operativa: CPU >60 % por 15 min, >75 % por 5 min, incremento anómalo de RPC de escritura, conflictos repetidos o saturación de conexiones.
- Límite y circuito por usuario/organización: al repetirse el mismo conflicto o error, detener escrituras y mostrar una acción manual.
- Respaldo lógico cifrado diario más el respaldo/PITR del proveedor; restauración real trimestral.

Estas decisiones siguen las prácticas de medir con `pg_stat_statements`, paginar por cursor, agrupar escrituras, mantener transacciones breves, optimizar RLS y usar pooling de conexiones.

## Comparativa de infraestructura

Precios representativos consultados el 2026-10-03; pueden variar por región, impuestos, disco, tráfico y plazo. Para El Salvador se prioriza una región de Estados Unidos.

| Alternativa | Precio representativo | Qué resuelve | Riesgo/costo oculto | Uso recomendado |
|---|---:|---|---|---|
| Supabase Pro + Micro | USD 25/mes por organización; incluye USD 10 de crédito de cómputo que cubre Micro | PostgreSQL, Auth, Storage, API, RLS, backups de 7 días y pool | Dependencia del proveedor; el PITR ampliado y más cómputo cuestan aparte | Mejor opción actual para Linkare |
| Supabase Small / Medium | Small ~USD 15 de cómputo; Medium ~USD 60, además del plan aplicable | Más memoria/CPU sin reescribir Auth, Storage ni RPC | Escalar no corrige consultas defectuosas | Escalar solo con umbrales sostenidos |
| DigitalOcean Managed PostgreSQL HA + Droplet | HA mínimo aproximado: USD 60/mes para primario 2 GB + standby; Droplet 4 GB/2 vCPU USD 24; total base ~USD 84 | Base administrada y app/worker separados | Hay que sustituir Supabase Auth, Storage, RLS/API y operación de Edge Functions | Segunda opción si se busca independencia |
| Neon Launch + Vercel | Cómputo USD 0.14 por CU-hora; almacenamiento USD 0.35/GB-mes | PostgreSQL serverless con autoscaling y restore configurable | Es base de datos, no reemplazo directo maduro de todo Supabase; backend adicional aún tiene componentes beta | Proyectos nuevos o DB desacoplada, no mudanza inmediata |
| DigitalOcean Droplet autogestionado | 4 GB/2 vCPU/80 GB USD 24; 8 GB/4 vCPU/160 GB USD 48 | VM simple y predecible | Parcheo, réplica, backups, cifrado, monitoreo y guardias recaen en el equipo | Workers, staging o servicios no clínicos |
| Akamai/Linode VM | 4 GB/2 vCPU/80 GB USD 24; 8 GB/4 vCPU/160 GB USD 48 | VM con precios comparables y SLA de cómputo | Base clínica autogestionada conserva los mismos riesgos operativos | Alternativa para workers/VM generales |
| AWS Lightsail | 4 GB/2 vCPU/80 GB USD 24; 8 GB/2 vCPU/160 GB USD 44 | VM, snapshots y ecosistema AWS | La HA de PostgreSQL y toda la operación clínica no vienen resueltas | Proyectos generales que ya usan AWS |
| OVH VPS | VPS-2 desde USD 8.50 con 4 vCore, 8 GB y 75 GB NVMe | Mucha capacidad nominal a bajo costo | Recurso compartido, precio “desde”, región/condiciones variables; una sola VM no es HA | Desarrollo, backups secundarios, workers; no base clínica única |
| Hetzner Cloud EE. UU. | CPX21 desde USD 37.49/mes después del ajuste de junio de 2026 | VM de buena relación precio/rendimiento | Precio/región cambió fuertemente; base y seguridad siguen siendo autogestionadas | VM secundaria si la latencia y disponibilidad se validan |

Fuentes oficiales: [DigitalOcean Droplets](https://www.digitalocean.com/pricing/droplets), [DigitalOcean Managed PostgreSQL](https://docs.digitalocean.com/products/databases/postgresql/details/pricing/), [Akamai Cloud](https://www.akamai.com/cloud/pricing), [AWS Lightsail](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html), [OVH VPS](https://www.ovhcloud.com/en/vps/), [ajuste 2026 de Hetzner](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/) y [Neon](https://neon.com/blog/new-usage-based-pricing).

## Plan de migración preparado, no ejecutado

Una migración segura no es solo `pg_dump`/`pg_restore`, porque Linkare usa Auth, Storage, RLS, funciones, cron, secretos y APIs de Supabase.

1. **Inventario:** extensiones, funciones, políticas, buckets, usuarios, jobs, Edge Functions, secretos, URLs firmadas y dependencias del frontend.
2. **Destino aislado:** PostgreSQL 17, pooler, almacenamiento privado, servicio de identidad y worker; nunca reutilizar producción para el ensayo.
3. **Restauración:** esquema, datos, roles equivalentes y objetos; comparar conteos, hashes y permisos por consultorio.
4. **Compatibilidad:** reemplazar RPC/API, Auth y Storage; ejecutar las 143 pruebas, pruebas de navegador y pruebas de restauración.
5. **Carga:** reproducir búsquedas, expediente histórico profundo, citas y escrituras concurrentes; comparar p50/p95, CPU, I/O y conexiones.
6. **Corte:** respaldo verificable, ventana de solo lectura, delta final, cambio de variables/DNS, verificación médica y de Secretaría.
7. **Rollback:** conservar Supabase sin nuevas escrituras durante la validación; volver variables/DNS y aplicar el delta inverso si falla un criterio.

Si se autohospeda Supabase, hay cambios de plataforma que deben incorporarse al ensayo: PostgreSQL 17 para el stack self-hosted, Envoy en lugar de Kong y cambios de propiedad de Studio/postgres-meta. Fuentes: [cambio a PostgreSQL 17](https://supabase.com/changelog/46080-self-hosted-supabase-upgrading-from-pg-15-to-17-breaking-change) y [cambios incompatibles](https://supabase.com/changelog?types=breaking-change).

## Auditoría funcional solicitada

| Requisito | Estado verificado |
|---|---|
| AM/PM al crear cita | Implementado con fecha, hora, minutos y selector AM/PM; conversión reversible probada. |
| Pacientes previos sin tocar | Verificación independiente: 21 pacientes y 90 registros; revisión total 327 y huella `d2aff43b4a3d148b95481fc516eacc0c` idénticas antes/después, excluyendo el lote. |
| Datos completos de FoxPro | 5,347 pacientes y 140,202 entradas reconciliadas; teléfonos/dirección/profesión/referidos están en “Sistema anterior”. La fuente no contiene columna de correo, por lo que no se inventaron emails. |
| Tratamientos históricos | 45,374 textos se conservaron con estado desconocido. No se convirtieron en medicamentos activos porque la fuente no acredita identidad/estado terapéutico. |
| Guiones en dosis | Acepta texto como `1-2` y `1-0-1`; prueba automática aprobada. |
| Receta usa tratamiento activo | La receta selecciona medicamentos activos existentes y no crea/activa tratamientos. |
| Quitar edad, diagnóstico y seguro de receta | Eliminados de formulario/impresión; prueba automática aprobada. |
| Registro al crear cita | La transacción guarda auditoría `appointment.saved`; también existen eventos de eliminación y recordatorio. |
| Buscar paciente en una sola fila | Un único combobox remoto busca y selecciona por nombre/teléfono/correo/seguro. |
| Recordatorio personalizado | Configuración por paciente de 72, 48, 24, 8 o 2 horas, con canales, consentimiento y horario de descanso; no depende de un único envío diario a las 8:00. |

La nueva pantalla agrega además un acceso visible desde el resumen de cada paciente migrado hacia “Datos e historia de FoxPro”, para que la información importada no quede escondida detrás de una pestaña poco evidente.
