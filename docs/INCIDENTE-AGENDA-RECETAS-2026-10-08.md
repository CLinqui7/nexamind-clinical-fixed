# Citas y edición de recetas: corrección del 8 de octubre de 2026

Base verificada: `db826e68012948901099bc3cd64789e1066e8464` en `codex/agenda-print`, el mismo SHA que servía `nexamind-clinical.vercel.app` antes de este cambio. La rama `main` no se modificó.

## Causa y alcance

Una respuesta tardía del directorio reemplazaba `data.patients` con la página recibida. Si el formulario de cita tenía seleccionado un paciente fuera de esa página, el guardado fallaba con «Selecciona un paciente». Además, la vista podía intentar calcular la tarifa de un paciente ya ausente, lo que terminaba en el límite de error global. La prueba de navegador reproduce la pérdida de selección y el fallo de guardado; la segunda ruta se corrige preventivamente, pero no se dispone de la traza original del navegador del usuario.

Ahora la página del directorio conserva el paciente seleccionado en una cita y el expediente abierto, sin mantener el directorio entero en memoria. El guardado usa también la selección del buscador como respaldo y conserva el paciente en el estado tras la confirmación del servidor. La tarifa nunca se calcula sobre un paciente ausente.

La edición de una receta existente ocultaba el selector de medicamentos activos. El médico ahora puede añadir un medicamento registrado después de la receta al editarla; el número e ID de la receta se conservan y las indicaciones previas permanecen. No se agrega automáticamente a recetas ya emitidas. Secretaría mantiene la facultad de corregir/anular recetas existentes, pero no recibe el selector del tratamiento clínico ni permiso para emitir una receta nueva.

No hay migración SQL, modificación de expedientes clínicos ni ampliación de permisos de producción. Los permisos de calendario y edición de recetas ya estaban otorgados a las dos secretarias activas del consultorio verificado; no se cambió ningún rol.

## Validación

- `npm run check`: 151 pruebas, compilación de producción y escaneo del bundle correctos.
- `node qa/browser/secretary-appointment.mjs`: selección durante una respuesta tardía del directorio, cita visible y exactamente una cita persistida en PostgreSQL aislado.
- `node qa/browser/prescriptions.mjs`: medicamento posterior seleccionable, mismo ID/número, correcciones médicas y de Secretaría persistentes, anulación auditada.
- `node qa/browser/critical-ui.mjs` y `node qa/browser/calendars.mjs`: flujo principal de citas, tiempos, calendarios y persistencia correctos.

Todas las pruebas de escritura usaron identidades y datos sintéticos en la base aislada de QA. La comprobación HTTP del sitio público no sustituye una prueba autenticada con las cuentas reales; si el error persiste, recopilar la primera excepción de Consola y el identificador de la petición fallida, sin datos de pacientes.
