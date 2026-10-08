# Cambio de estado de citas: corrección del aviso falso de permisos

## Causa

El detalle de una cita podía permanecer abierto mientras la consulta del mes reemplazaba `data.appointments`. Los botones se mostraban porque el usuario sí tenía permiso sobre el calendario, pero al pulsarlos `updateAppointmentStatus` buscaba la cita solamente en la lista recién reemplazada. Al no encontrarla, mostraba incorrectamente «Su cuenta no tiene permiso».

En el consultorio Fortín Magaña se verificó antes del cambio que la cuenta propietaria está activa y que las dos cuentas activas de Secretaría ya tienen `calendarDoctorView`, `calendarDoctorEdit` y `calendarDoctorCancel`. No se cambiaron roles, contraseñas ni permisos de miembros.

## Corrección

- El cliente toma el detalle abierto como fuente de la cita y envía una operación puntual `linkare_set_appointment_status_v1`, en lugar de calcular diferencias sobre toda la agenda visible.
- La función bloquea la fila de esa cita, valida la membresía activa y los permisos `View` más `Edit` o `Cancel` del calendario, y modifica únicamente `status` y `updatedAt`. Conserva título, paciente, fecha, notas y demás campos. El trigger existente registra autor y hora de confirmación/cancelación; se guarda auditoría de la transición. Un clic repetido sobre el mismo estado no incrementa la revisión.
- La respuesta actualiza solo la revisión de esa cita en el cliente. Cambiar el mes con el detalle abierto ya no produce el aviso falso.
- No se amplía el acceso clínico ni se conceden permisos globales a `anon` o a otros consultorios. Los miembros con solo `View` continúan sin poder cambiar estados.

## Verificación y recuperación

- Pruebas de base aislada: propietario y Secretaría autorizada pueden cambiar; Secretaría de solo lectura y otra organización no pueden. Se comprueban revisión, auditoría y preservación del resto de la cita.
- Prueba Playwright con PostgreSQL aislado: abrir detalle, cambiar el mes para retirar la cita de la lista y confirmar; el cambio persiste.
- Recuperación del backend, si fuera necesaria: revocar `EXECUTE` a `authenticated` y retirar la función nueva. El frontend anterior continúa usando `linkare_save_changes_v3`; ningún registro existente se reescribe por instalar la función.
