# Agenda diaria por correo para Secretaría

Vercel Cron llama a /api/reminder-dispatch una vez al día con 0 14 * * *. Son las 08:00 en America/El_Salvador. En el plan Hobby de Vercel, la ejecución puede ocurrir entre las 08:00 y las 08:59; la expresión no garantiza el minuto exacto. La ruta exige CRON_SECRET y reenvía a la Edge Function reminder-dispatch, que valida LINKARE_CRON_SECRET. No depende de que alguien abra la página.

El correo contiene la agenda **de hoy** del calendario Doctor: hora y nombre administrativo del paciente, en orden cronológico. No incluye diagnóstico, medicamentos, notas, teléfono ni datos del expediente clínico. Se envía únicamente a miembros activos de Secretaría del consultorio configurado en LINKARE_DAILY_AGENDA_ORG_ID que conserven patientsView y calendarDoctorView. Si no hay citas, el correo lo indica. Los cambios posteriores al envío deben consultarse en Linkare.

La función registra una entrega por secretaria y fecha en linkare_notification_deliveries. La clave única evita un segundo correo por una ejecución repetida; si Gmail acepta el mensaje pero falla la actualización del registro, no se reintenta a ciegas. El estado sent significa aceptación de Gmail, no lectura ni entrega final. Un fallo devuelve HTTP 503 y conserva el registro para revisión. El trabajo programado ya no envía automáticamente recordatorios individuales a pacientes ni la agenda de mañana a contactos personales. El envío manual de recordatorios al paciente conserva su flujo y consentimiento propios.

## Transporte Gmail API

Las invitaciones a Secretaría usan Supabase Auth inviteUserByEmail, que puede tener SMTP configurado, pero no ofrece una API de correo arbitrario a las Edge Functions. La agenda diaria usa Gmail API con el alcance mínimo https://www.googleapis.com/auth/gmail.send y requiere una autorización OAuth separada para la cuenta remitente. No se usan correos de invitación como recordatorios.

Guardar estos valores **solo** en Supabase Edge Function Secrets:

- LINKARE_DAILY_AGENDA_ORG_ID: ID verificado del consultorio que recibirá la agenda.
- GMAIL_CLIENT_ID y GMAIL_CLIENT_SECRET: cliente OAuth de Google habilitado para Gmail API.
- GMAIL_REFRESH_TOKEN: token de actualización de la cuenta remitente, concedido con gmail.send.
- GMAIL_SENDER_EMAIL: dirección de esa misma cuenta o un alias autorizado.
- LINKARE_CRON_SECRET y CLINIC_TIMEZONE, ya usados por el despachador.

En Vercel Production se conservan CRON_SECRET, LINKARE_CRON_SECRET y VITE_SUPABASE_URL. Nunca poner credenciales Gmail en variables VITE_*, Git o un informe. Sin la configuración Gmail completa, la función devuelve DAILY_AGENDA_NOT_CONFIGURED y **no registra un envío exitoso**. Probar la autorización con una cuenta y agenda sintéticas antes de permitir correos con pacientes reales.

Para comprobar la operación, inspeccionar el cron activo en Vercel, consultar únicamente conteos/estados de linkare_notification_deliveries y revisar las respuestas de la función. Una repetición manual del cron en producción puede enviar correos reales; usar primero la base aislada de QA. El plan Hobby limita la precisión del horario y la retención de logs.
