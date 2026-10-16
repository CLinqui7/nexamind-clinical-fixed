# Agenda de hoy en el dashboard de Secretaría

La agenda del calendario Doctor se consulta con los permisos de la Secretaría que inició sesión. A partir de las 08:00, hora de El Salvador, aparece un aviso en el dashboard con el número de citas de **hoy** y un acceso a la lista. La lista y el contador usan la misma consulta dedicada; se actualizan al iniciar sesión, al volver al dashboard, al guardar o cambiar una cita y cada cinco minutos mientras Linkare esté abierto. La pantalla revisa la hora cada 30 segundos y actualiza el día al cruzar medianoche.

La consulta pagina todas las citas autorizadas y muestra solo las del calendario Doctor con paciente y estado vigente. Si falla, muestra un error y permite reintentar, sin presentar una agenda incompleta como si estuviera vacía. El aviso no envía correo, SMS ni WhatsApp y no funciona como notificación push cuando la aplicación está cerrada.

Las invitaciones a Secretaría siguen usando Supabase Auth y su SMTP configurado. El envío **manual** de recordatorios individuales a pacientes conserva sus propias reglas de consentimiento y proveedor.
