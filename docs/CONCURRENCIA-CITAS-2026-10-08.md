# Edición simultánea de citas — 2026-10-08

## Problema

El formulario de edición enviaba la cita completa con una revisión tomada al abrirla. Un cambio concurrente en otro campo (por ejemplo, estado frente a hora) causaba `REVISION_CONFLICT`; el navegador preservaba el borrador, pero no podía combinar ediciones compatibles. La revisión administrativa también dependía de la página visible y del guardador de estado parcial.

## Contrato nuevo

`linkare_patch_appointment_v1(org, id, expectedRevision, base, changes)` recibe únicamente los campos modificados y los valores que el editor vio al abrir el evento. Bajo bloqueo transaccional de esa cita:

- Si el valor actual de un campo coincide con `base`, aplica `changes`.
- Si ya coincide con `changes`, no vuelve a escribirlo.
- Si difiere de ambos, devuelve `FIELD_CONFLICT` y la versión actual autorizada, sin modificar nada.
- Los campos distintos se combinan; fecha/hora/duración se envían como una unidad lógica (`start` + `end`).
- La identidad del evento (paciente, clase y calendario) se compara en toda edición. Si cambió mientras alguien escribía, no se aplica automáticamente su borrador a otro paciente.
- Notas clínicas usan el registro privado `appointment_clinical`, con verificación de permiso clínico y comparación independiente.
- Mantiene `reminderLog`, metadatos de creación y demás campos no editados; no crea recordatorios ni mensajes. El disparador existente conserva los metadatos de confirmación y revisión.
- La pertenencia activa, la organización, el derecho a ver/editar el calendario y la autorización de notas se verifican en el servidor. `anon` y `PUBLIC` no ejecutan la función.
- Si ambas personas cambian el mismo campo, el formulario conserva el borrador y permite elegir explícitamente el valor reciente o el propio. Rebasar el formulario conserva los demás cambios locales y exige pulsar Guardar de nuevo. Una tercera edición concurrente vuelve a solicitar decisión; no hay sobreescritura silenciosa.

Los botones rápidos de estado y revisión usan la misma comparación. Cuando hay disputa, muestran el valor reciente y permiten repetir la acción conscientemente. El servidor sigue siendo la fuente de verdad; no se mantienen bloqueos de minutos mientras alguien tiene el formulario abierto.

## Pruebas y despliegue

`npm run check` ejecuta las pruebas unitarias y de base aislada; `qa/browser/appointment-concurrency.mjs` prueba dos usuarios sintéticos y ambas decisiones de conflicto. La migración es aditiva y no modifica citas existentes al instalarse.

Orden de publicación: publicar el commit en GitHub; aplicar y verificar la función en Supabase; desplegar una compilación productiva sin dominio, probarla y promoverla. No ampliar permisos ni usar pacientes reales como fixtures.
