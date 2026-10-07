# Agenda del día imprimible

La sección **Agenda → Agenda del día** permite elegir una fecha y descargar `Agenda_del_dia_YYYY-MM-DD.pdf`. Incluye únicamente citas de pacientes del calendario Doctor, ordenadas por inicio en la zona horaria del consultorio. Se omiten eventos generales, cancelados y ausencias. El encabezado indica la fecha; cada bloque muestra horario, paciente, todos los medicamentos activos registrados (nombre, dosis, frecuencia y vía) y la nota de agenda de esa cita. Una agenda sin citas también produce un PDF explícito.

La nota de agenda es distinta de la nota privada de preparación clínica y del expediente. Se guarda por `organization_id` y `appointment_id` en `linkare_private.appointment_agenda_note_v1`; cada cambio conserva autor, fecha, revisión y un registro en `appointment_agenda_note_audit_v1`. La escritura exige revisión esperada para impedir que una pestaña sobreescriba otra. El PDF vuelve a consultar el servidor al descargar, de modo que incluye las citas y los tratamientos actuales. Deben guardarse las notas editadas antes de descargarlo.

`linkare_printable_agenda_v1` consulta la proyección indexada `appointment_directory_v1` para un solo día y extrae únicamente los campos activos de medicamentos necesarios para la hoja. Comprueba membresía, permiso `agendaSheetView`, permiso de ver el calendario Doctor y consultorio. `linkare_save_agenda_note_v1` comprueba además `agendaSheetEdit` y edición del calendario Doctor. Secretaría puede recibir estos dos permisos desde Equipo sin acceso al resto del expediente clínico. La migración habilita el acceso para membresías existentes con permisos adecuados, sin cambiar un `false` explícito.

La migración `20261007052123_printable_daily_agenda.sql` debe aplicarse al proyecto `fvucylgrqgxjqabacnlt` antes de publicar el frontend; GitHub y Vercel no aplican SQL. No requiere migrar citas ni pacientes. La hoja se genera en el navegador con jsPDF, sin subir el PDF a Storage ni enviarlo a terceros.

Verificación: `npm run check` cubre permisos, separación entre consultorios, orden, medicamentos, revisión de notas y paginación del PDF. `node qa/browser/server.mjs` junto a `node qa/browser/daily-agenda.mjs` comprueba selección de fecha, guardado persistente y descarga con PostgreSQL aislado y datos sintéticos. No se deben insertar pacientes de prueba en producción.

## Despliegue verificado (2026-10-07 UTC)

- Código funcional: commit `8e34bb2fb298db8a8e98c60e7c0f26aa0d732474` en `codex/patient-directory-performance`.
- Base de datos `fvucylgrqgxjqabacnlt`: se aplicó **solo** `20261007052123_printable_daily_agenda.sql`; `supabase migration list --linked` confirmó la misma versión local y remota.
- Función `linkare-team`: se publicó la versión 18, activa, para que Equipo reconozca los nuevos permisos. No se desplegaron otras funciones.
- Vercel: deployment `dpl_2sQPqBqzsNLEQo9yLto1cmEuFCZn`, estado `READY`, alias productivo `https://nexamind-clinical.vercel.app`. El HTML y su JS principal respondieron HTTP 200 a la comprobación protegida.
- `npm run check`: 150 pruebas aprobadas y build completado. Prueba de navegador aislada: médico y Secretaría pudieron ver medicamentos, guardar la nota y descargar el PDF; la nota persistió tras recargar. PDF sintético de cinco páginas A4 renderizado e inspeccionado.
- No se hizo una prueba autenticada con datos clínicos reales en producción ni se crearon pacientes o citas de prueba. El acceso productivo del usuario debe verificarse desde su propia sesión.
