# Linkare 2.0.0

## Suscripción anual

- Plan Profesional Linkare por **US$400 al año**.
- Pantalla de plan actual con estado, periodo vigente, próxima renovación, días restantes e historial.
- Renovación manual anual mediante Wompi.
- El backend vuelve a leer el precio guardado en Supabase antes de crear el checkout.
- El webhook activa el periodo anual y define la siguiente renovación.

## Expediente ampliado

- Documentos privados: recetas externas, medicamentos, cartas, laboratorios, consentimientos e informes.
- Supabase Storage privado, URLs firmadas y auditoría de subir, abrir, descargar y eliminar.
- Identidad y contexto personal con campos opcionales y respetuosos.
- Antecedentes de seguridad separados del riesgo actual.
- Estado vital y modo post mortem sin inferir causa o manera de muerte.
- Resumen clínico post mortem para revisión médico-legal, con fuentes, cronología y advertencia de alcance.

## Consulta y libreta virtual

- Aviso al llegar la hora de una cita: “¿Ya está con el paciente?”.
- Libreta clínica de consulta con temporizador, guardado automático, secciones estructuradas y adjuntos.
- Borradores, firma/finalización y versiones.

## Recordatorios y calendarios

- Preferencias por paciente: correo, SMS, WhatsApp, consentimiento y destino.
- Envío automático opcional mediante Resend, Twilio y Meta WhatsApp Business.
- Modo manual disponible cuando no hay proveedor conectado.
- Google Calendar mediante OAuth y sincronización de citas.
- Apple Calendar mediante archivo ICS y feed privado de suscripción.

## Seguridad

- Médico y Secretaría como accesos demo separados.
- Secretaría sin documentos clínicos, notas de consulta ni exportación post mortem por defecto.
- Sin secretos de proveedores dentro de React o Vercel.
- RLS, bucket privado y auditoría para archivos.
