# Auditoría de «Eliminar evento»

## Hallazgo

El detalle de la cita puede seguir abierto después de cargar otro mes. El botón usaba solo `data.appointments` (la página de agenda actual) para buscar la cita y mostraba un falso error de permisos si esta ya no estaba en esa lista. Cuando sí estaba, `persistDataUpdate` anunciaba éxito, pero el guardador general utiliza `allowDeletes:false` para impedir que las listas parciales borren registros no cargados. Por eso la eliminación no llegaba a PostgreSQL.

Antes de la corrección, la lectura de producción mostró 65 citas activas, ninguna cita con `deleted=true` y ningún evento de auditoría `appointment.deleted`. Las proyecciones de agenda coincidían con los registros activos por organización: 48 en Fortín Magaña, 16 en Linkare y 1 en otro consultorio. Esos conteos no contienen información clínica. La cuenta `linquicarloss@gmail.com` pertenece al consultorio Linkare; no es miembro del consultorio Fortín Magaña. No se mezclaron los datos de ambos.

## Corrección

- `linkare_delete_appointment_v1` borra una cita concreta con revisión optimista, membresía activa y permisos `View` + `Delete` sobre su propio calendario. No recibe colecciones parciales del navegador.
- El borrado es lógico: la cita deja de aparecer en la agenda, pero se conservan su payload original, la nota clínica privada, el autor, la fecha y una entrada de auditoría para recuperación controlada. No modifica el expediente del paciente ni otros eventos.
- Una revisión antigua devuelve `REVISION_CONFLICT` sin modificar datos; repetir un borrado ya confirmado no crea otra revisión ni otra entrada de auditoría.
- La interfaz espera la confirmación del servidor antes de cerrar el detalle o mostrar éxito. Si falla, mantiene el detalle visible y muestra el error.

## Verificación

- `npm run check`: 155 pruebas unitarias y de base aprobadas; compilación aprobada.
- PostgreSQL aislado: propietario y Secretaría con permiso `Delete` pueden borrar; una Secretaría sin ese permiso y otra organización no pueden. Se comprueban el tombstone, la auditoría, la proyección y que el paciente no cambia.
- Playwright con datos sintéticos: el detalle queda abierto tras cambiar de mes, «Eliminar evento» usa una sola RPC, desaparece de la agenda persistida y el paciente sigue presente. La prueba de cambio de estado continúa pasando.
- No se borraron citas ni pacientes reales durante las pruebas. La migración FoxPro permanece pausada.
