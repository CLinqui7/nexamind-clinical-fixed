# Calendarios compartidos y recordatorios personales

Los enlaces iCalendar usan tokens aleatorios de 256 bits, duran 90 días y tienen un alcance explícito:

- `doctor_full`: agenda del médico con nombre del paciente y tipo de consulta.
- `staff_busy`: horarios de consulta sin identidad del paciente.
- `family_busy`: únicamente bloques `Ocupado`.
- `patient_own`: solamente las citas del paciente asociado al token.

El creador debe conservar acceso activo a la organización y permiso para administrar citas. Cada solicitud también verifica la fecha de vencimiento. Los enlaces se pueden revocar y rotar; estas acciones se registran en `linkare_audit_v3`. Un token debe tratarse como una contraseña y compartirse solo con la persona indicada.

Los recordatorios personales son opt-in y se guardan en `linkare_personal_reminder_recipients_v1` con destinatario, canal, estado, creador y fechas. El proceso diario envía exclusivamente una frase como `Mañana tiene agenda clínica de 09:00 a 16:00.`. No consulta ni incorpora nombres, diagnósticos, medicamentos o notas.

La aceptación real del mensaje depende de las credenciales del proveedor configurado. Un fallo se conserva en `linkare_notification_deliveries` y no debe reintentarse a ciegas. Para cortar acceso de inmediato, revoque el enlace desde Configuración; para suspender avisos, elimine el contacto personal.
