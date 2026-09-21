# Agenda diaria

`linkare_daily_agenda_v1(org, agenda_date)` es la fuente única del resumen clínico diario. La función exige usuario autenticado, membresía activa y permisos `clinicalView` y `appointmentsManage`. Filtra siempre por `organization_id` y usa la fecha solicitada en el huso horario configurado; el valor por defecto es `America/El_Salvador`.

Cada fila contiene la hora real de la cita, paciente, tratamiento activo principal y el último cambio relevante disponible. Las citas canceladas o marcadas como no asistió no aparecen. Secretaría sigue usando la agenda administrativa y no puede ejecutar la RPC clínica.

La pantalla Inicio carga la RPC después de autenticar y permite abrir la cita o imprimir una versión limpia. La impresión se genera desde la misma respuesta de backend, con las columnas hora, paciente, medicamento actual y cambio relevante.

La agenda no depende de datos duplicados en React. Los medicamentos siguen viniendo de `patient_clinical`; las citas, de `appointment`; y el nombre, de `patient_admin`.

## Operación y fallos

Si la RPC no está disponible, Inicio conserva el resto del dashboard y muestra la agenda vacía; no usa una proyección clínica calculada para Secretaría. Una corrección debe publicarse con una migración nueva y mantener el contrato JSON.

## Verificación

Las pruebas cubren fecha correcta, tratamiento actual, aislamiento por organización y rechazo de usuarios sin permiso clínico. La QA de navegador comprueba que Inicio conserva su funcionamiento y la compilación valida el HTML imprimible.
