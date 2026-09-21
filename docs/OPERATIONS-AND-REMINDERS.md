# Operaciones y recordatorios

## Ejecución automática

Vercel Cron llama `/api/reminder-dispatch` todos los días a las 14:00 UTC, que corresponde a las 08:00 de `America/El_Salvador`. La ruta exige `CRON_SECRET` y reenvía la solicitud a la Edge Function `reminder-dispatch` con `LINKARE_CRON_SECRET`. La Edge Function vuelve a validar el secreto y trabaja sin que el navegador esté abierto.

El dispatcher incluye organizaciones con acceso gratuito o periodo pagado vigente. Lee citas futuras y preferencias del paciente, respeta consentimiento, canal y horario de descanso. Un fallo de proveedor se registra como `failed` y no modifica ni cancela la cita.

## Idempotencia

La clave de una entrega incluye organización, cita, destinatario, canal, ventana y hora programada. El índice único `(organization_id, dedupe_key)` evita envíos duplicados incluso si dos ejecuciones se solapan. Una clave existente se reporta como duplicada y no vuelve a llamar al proveedor.

## Agenda por WhatsApp

`send-daily-agenda` exige dos permisos (`clinicalView` y `appointmentsManage`), limita la frecuencia y obtiene la agenda mediante `linkare_daily_agenda_v1` usando el JWT del usuario. Solo envía al teléfono del mismo miembro médico autenticado. Registra una entrega con `type=daily_agenda` y una entrada `daily_agenda.sent` después de la aceptación del proveedor.

El botón solo aparece cuando Meta WhatsApp está configurado. Esta entrega configura la infraestructura y el cron; no se afirma que exista una entrega real si faltan credenciales o una plantilla aprobada.

## Variables

En Vercel: `CRON_SECRET`, `LINKARE_CRON_SECRET`, `SUPABASE_URL` (o `VITE_SUPABASE_URL`). En Supabase: `LINKARE_CRON_SECRET`, `META_WHATSAPP_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_TEMPLATE_NAME`, `META_WHATSAPP_TEMPLATE_LANGUAGE` y `META_GRAPH_VERSION`.

Los dos secretos del cron deben contener el mismo valor de alta entropía. La aplicación nunca los recibe.

## Supervisión

Revise los estados `queued`, `sent` y `failed` en `linkare_notification_deliveries`, los logs de la función y las ejecuciones de Vercel Cron. Antes de reintentar una entrega `failed`, confirme en el proveedor que no fue aceptada.
