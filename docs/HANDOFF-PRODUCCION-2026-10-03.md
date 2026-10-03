# Traspaso técnico de producción — Linkare / NexaMind Clinical

Fecha de corte: 2026-10-03  
Propósito: permitir que otro Codex o responsable técnico continúe sin repetir la migración, perder correcciones ni confundir un reporte histórico con el estado productivo.

## Estado canónico

- Repositorio: `https://github.com/CLinqui7/nexamind-clinical-fixed.git`
- Rama con todo el trabajo: `codex/patient-directory-performance`
- Commit funcional y de base: `e87a382` (`perf: harden database access and expose legacy history`)
- HEAD documentado y desplegado: `8acd957` (`chore: exclude private reports from deployments`)
- `origin/main` observado al cierre: `7386c28`; no se hizo merge directo a `main`.
- Producción: `https://nexamind-clinical.vercel.app`
- Despliegue productivo: `dpl_GAgTivRXFb7CwSAmcTrmaDMrJp2o`
- URL inmutable del despliegue: `https://nexamind-clinical-dhmmdeqly-clinqui7s-projects.vercel.app`
- Proyecto Vercel: `nexamind-clinical`
- Proyecto Supabase: `fvucylgrqgxjqabacnlt`
- API Supabase: `https://fvucylgrqgxjqabacnlt.supabase.co`

Para continuar:

```powershell
git fetch origin
git switch codex/patient-directory-performance
git status --short --branch
git log -12 --oneline
npm ci --include=dev
npm run check
```

No asumir que `main` contiene estos cambios hasta que se revise y fusione explícitamente la rama.

## Qué se desplegó

### Agenda y citas

- Guardado de citas mediante una operación acotada; ya no reescribe el estado completo del consultorio.
- Eliminación de la contención global de guardado.
- Una sola escritura en vuelo y conflictos de revisión tipados, sin ciclo automático infinito.
- Selector explícito de calendario Doctor, Esposa o General.
- Fecha, hora, minutos y selector AM/PM explícitos.
- Búsqueda y selección del paciente en un único combobox remoto.
- Auditoría de `appointment.saved`, `appointment.deleted` y `appointment.reminder_updated`.
- La proyección de agenda y la próxima cita se actualizan sin reescribir al paciente.

Archivos principales:

- `src/app.js`
- `src/services/appState.js`
- `supabase/migrations/20261002174319_secretary_multi_calendar.sql`
- `supabase/migrations/20261003183511_optimize_appointment_save.sql`
- `supabase/migrations/20261003195000_controlled_revision_conflicts.sql`

### Pacientes y formularios

- Corrección del botón `+` de seguro médico y del formulario que quedaba en blanco.
- Directorio paginado por cursor, máximo 20 pacientes por página.
- Filtro reciente de seis meses conservado; “Todos” y búsqueda encuentran pacientes antiguos.
- Carga del expediente completo solo al abrir un paciente.
- Acceso visible desde el resumen: **Abrir datos e historia de FoxPro**.
- Secretaría recibe únicamente campos administrativos; la historia clínica histórica depende de `clinicalView`.

### Medicamentos y recetas

- Dosis como texto; acepta formatos con guion como `1-2` y `1-0-1`.
- La receta selecciona medicamentos activos ya existentes.
- Crear una receta no crea ni activa un tratamiento.
- Edad, diagnóstico y seguro se quitaron del formulario y de la impresión de receta.
- Se preserva una instantánea inmutable del medicamento usado en cada receta.

### Recordatorios

- Configuración por paciente de 72, 48, 24, 8 o 2 horas.
- Se respetan canal, consentimiento, zona horaria y horario de descanso.
- Claves de entrega idempotentes impiden duplicar avisos.
- Los pacientes importados conservan recordatorios desactivados porque la fuente no registra consentimiento.

### CORS y previews

- Los previews confiables del proyecto Vercel están permitidos.
- Orígenes externos permanecen rechazados.
- Producción no depende de abrir CORS globalmente.

## Migraciones de base relevantes y estado

Estas migraciones están en Git y constaban aplicadas en el historial remoto al cierre:

| Migración | Resultado |
|---|---|
| `20261003010000_historical_migration_v2.sql` | Lote FoxPro reanudable, idempotente, conciliable y reversible. |
| `20261003061842_patient_directory_performance.sql` | Proyecciones del directorio, detalle y agenda paginados. |
| `20261003074514_lazy_profile_assets.sql` | Recursos grandes del perfil se cargan bajo demanda. |
| `20261003180559_deferred_directory_version_bump.sql` | Agrupa el cambio de versión del directorio al cierre de transacción. |
| `20261003183511_optimize_appointment_save.sql` | Guardado directo y acotado de citas. |
| `20261003195000_controlled_revision_conflicts.sql` | Conflictos obsoletos dejan de inundar logs PostgreSQL. |
| `20261003200901_optimize_rls_and_rpc_surface.sql` | Optimiza `auth.uid()` en RLS y retira acceso anónimo a helpers `SECURITY DEFINER`. |

La última migración se aplicó mediante un workdir temporal que contenía únicamente el historial remoto reconocido y la migración nueva. El dry-run mostró un solo archivo antes del `db push`. Después de aplicarla, `supabase db advisors --linked --type performance` devolvió **No issues found** y desaparecieron los avisos de ejecución anónima.

Los avisos de funciones `SECURITY DEFINER` ejecutables por `authenticated` no deben eliminarse en bloque: varias son la API/RPC intencional y validan membresía/permisos internamente. La protección contra contraseñas filtradas seguía desactivada en Auth y requiere una decisión de configuración del propietario.

## Importación FoxPro productiva

Destino verificado:

- Cuenta: `clinicafortinmagana@gmail.com`
- `user_id`: `bafe1bf9-144b-4fc1-8ffd-21a1b3f3e137`
- `organization_id`: `2ca5b8d4-d711-4ec7-833a-9d018ef067ca`
- Consultorio: `Clinica Fortin Magaña`
- Rol: `owner`, membresía activa y acceso clínico efectivo.

Fuente autorizada:

- SHA-256 del ZIP: `f0054f84d8ade9bfb0c7e5551d99818cf14b9131f75dca06d0b70769b6197de9`
- El ZIP y sus DBF/FPT no están ni deben subirse a GitHub.

Lote aplicado:

- `batch_id`: `b121a91d-c2cc-4685-9b56-9856d1689924`
- Fuente lógica: `foxpro-linkare`
- Estado: `completed`
- Filas del ledger: 98,813 de 98,813.
- Pacientes importados: 5,347.
- Historia administrativa: 92,978.
- Historia clínica: 47,224.
- Historia total: 140,202.
- Textos/memos históricos: 45,374.
- Fichas sin nombre pero con ID válido: 22, conservadas como incompletas.
- Excepciones sin relación segura: 417 (1 sin ID de paciente y 416 sin paciente relacionado), preservadas y contabilizadas.
- Huérfanos de historia: 0.
- Diferencias de contenido contra el manifiesto: 0.
- Citas históricas inventadas: 0.
- Notificaciones activadas por la importación: 0.
- Medicamentos activos creados por la importación: 0.

### Información administrativa migrada

- El teléfono público toma primero celular, luego casa y luego oficina.
- La ficha histórica conserva por separado celular, teléfono de casa, teléfono de oficina, dirección, profesión, estado civil, referido por y fechas de origen.
- Conteos de origen observados: 4,556 fichas con algún teléfono, 3,877 celulares, 1,575 teléfonos de casa, 529 teléfonos de oficina, 1,392 direcciones, 3,071 profesiones, 3,404 estados civiles y 4,260 referencias.
- La fuente no contiene columna de correo: email quedó vacío deliberadamente; no inventar correos.

### Tratamientos históricos

Los textos de `TRATAMIENT` se guardaron como historia clínica de solo lectura con `treatmentStatus: unknown`. No deben convertirse automáticamente en medicamentos activos: la fuente no proporciona una identidad farmacológica estructurada ni acredita que el tratamiento siga vigente. El médico puede revisar la anotación en **Sistema anterior** y registrar después un medicamento moderno confirmado.

### Protección de pacientes existentes

La verificación independiente ejecutada inmediatamente después del lote probó:

- 21 pacientes preexistentes.
- 90 registros preexistentes.
- Suma de revisiones antes/después excluyendo el lote: 327 / 327.
- Huella antes/después: `d2aff43b4a3d148b95481fc516eacc0c`.
- `targetRecordsUnchanged: true`.
- `otherOrganizationsUnchanged: true`.
- Citas, expedientes clínicos modernos, medicamentos, recetas y notificaciones preexistentes sin cambios por la importación.

No volver a ejecutar el importador con otra identidad. El mismo ZIP, organización y hash ya tienen un lote completado.

## Incidente de CPU del 2026-10-03

### Causa

Un flujo de guardado global reaccionaba a hidratación/sincronización y conflictos entre pestañas. Clientes antiguos recibían `REVISION_CONFLICT`, repetían escrituras y produjeron aproximadamente 317 mil solicitudes PostgreSQL. No fue una carga normal de 5,347 pacientes.

### Correcciones

- Se eliminó el autosave global inducido por hidratación.
- Se retiró la contención cruzada por Web Locks del flujo global.
- Se usa escritura por cambios parciales y operaciones directas para citas.
- Un wrapper de compatibilidad convierte excepciones obsoletas en conflictos tipados para pestañas antiguas.
- Los clientes nuevos no avanzan baseline ni reintentan indefinidamente después de un conflicto.
- Se optimizaron dos políticas RLS y se retiró ejecución anónima de cuatro helpers privilegiados.

Commits clave:

- `5cc5fc3` — detener escrituras descontroladas entre pestañas.
- `4311f72` — recordatorios personalizados.
- `4bc6fe5` — contener tormentas de conflictos de clientes antiguos.
- `e87a382` — endurecimiento RLS y acceso visible a historia migrada.

### Estado posterior

- No había consultas bloqueadas ni de larga duración.
- El contador de llamadas PostgREST aumentó solo una vez durante una muestra aproximada de 20 segundos.
- Capturas posteriores mostraron CPU entre 3.96 % y 17.66 %, red casi nula, I/O mínimo y 12 conexiones.
- `Memory usage` real: 433.65 MB.
- `Memory committed` alrededor de 1.15–1.22 GB representa reserva/compromiso virtual; no equivale a RAM física usada.
- Quedaron aproximadamente 497 MB de swap, que PostgreSQL/Linux pueden retener hasta reutilización o reinicio.
- El banner de CPU usa una ventana histórica y puede tardar en desaparecer.

No se cambió el plan ni se generó un cargo. El plan de capacidad y comparación de proveedores está en `docs/performance/INFRASTRUCTURE_AND_CPU_PLAN_2026-10-03.md`.

## Rendimiento y pruebas finales

### Suite local

- `npm run check`: 143/143 pruebas aprobadas.
- Build Vite aprobado.
- Escaneo de distribución aprobado.
- Prueba aislada de historia FoxPro: 8/8 verificaciones aprobadas.
- La prueba usa PostgreSQL aislado y datos sintéticos; no escribe en producción.

### Producción

Último smoke posterior al despliegue:

- HTML p50: 93.87 ms.
- HTML p95/máximo de la muestra: 329.23 ms.
- Interfaz utilizable: 1,195.84 ms.
- `DOMContentLoaded`: 485.70 ms.
- Errores de página: 0.
- Errores de consola: 0.
- Solicitudes fallidas: 0.
- Logs de error Vercel posteriores: ninguno encontrado.
- Bundle productivo comprobado: `/assets/index-DWBQl7W7.js` contiene el acceso visible a historia FoxPro y el selector AM/PM.

Medición SQL/productiva adicional:

- Directorio p50: 81.63 ms; p95: 82.74 ms; 20 elementos.
- Historia p50: 84.47 ms; una lectura fría llegó a 961.32 ms.
- Bootstrap: 165.68 ms.
- Dashboard: 377.94 ms.
- Página SQL directa: 14.33 ms de planificación y 32.23 ms de ejecución, sin lecturas de disco en la muestra.

## Archivos de continuidad

- `docs/performance/INFRASTRUCTURE_AND_CPU_PLAN_2026-10-03.md`: arquitectura, umbrales, proveedores y runbook de migración de infraestructura.
- `docs/migration/PRE_MIGRATION_AUDIT.md`: auditoría previa.
- `docs/migration/FIELD_MAPPING.md`: mapeo de fuente a destino.
- `docs/migration/RUNBOOK.md`: ejecución y recuperación.
- `scripts/phase3-production-control.cjs`: preflight, progreso, backfill, rendimiento y verificación.
- `scripts/build-legacy-verification-manifest.mjs`: conciliación de contenido sin publicar PHI.
- `qa/browser/critical-ui.mjs`: citas, AM/PM, búsqueda, persistencia y recordatorios.
- `qa/browser/legacy-history.mjs`: historia administrativa/clínica y separación de permisos.
- `qa/browser/prescriptions.mjs`: receta basada en tratamiento activo.
- `qa/browser/production-smoke.mjs`: contrato y rendimiento productivo sin escritura.

## Reglas para el siguiente Codex

1. No reimportar el ZIP ni crear un segundo lote.
2. No editar ni borrar pacientes históricos para “normalizarlos”.
3. No convertir textos de tratamiento en medicamentos activos sin revisión médica.
4. No inventar emails, fechas, edades, riesgo, estabilidad ni horarios.
5. No usar `main` como estado productivo hasta fusionar esta rama.
6. Antes de cualquier migración SQL, ejecutar `supabase db push --dry-run` con un historial local que coincida con remoto.
7. No subir archivos `.env`, `.vercel`, `supabase/.temp`, ZIP/DBF/FPT, respaldos, tokens ni reportes crudos que puedan contener identificadores.
8. Después de un cambio: `npm run check`, prueba de navegador pertinente, despliegue verificable y `production-smoke`.
9. Para investigar CPU, excluir el pico de 317 mil errores y medir al menos siete días de carga normal.
10. No eliminar RPCs `SECURITY DEFINER` autenticados en bloque; revisar propósito, validación interna y dependencia RLS antes de cambiar permisos.

## Elementos deliberadamente no versionados

- `outputs/current-preflight-20261003.json`: reporte operativo privado con identificadores del destino.
- `outputs/current-performance-20261003.json`: captura puntual de observabilidad.
- `supabase/.temp/cli-latest`: metadato generado por Supabase CLI.
- `.vercel/.env.production.local`: variables descargadas por Vercel CLI.

Toda la evidencia no sensible necesaria para reproducir conclusiones está resumida en este documento; los secretos y la información clínica permanecen fuera de GitHub.
