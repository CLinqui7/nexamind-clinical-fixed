# Linkare 2.0 · Guía de producción

## 1. Actualizar el proyecto

Aplique el ZIP sobre la carpeta existente y ejecute `npm run check`. El instalador incluido crea un respaldo antes de reemplazar archivos.

## 2. Base de datos

En Supabase, abra **SQL Editor → New query**, copie todo el archivo:

`supabase/SQL-EDITOR-LINKARE-v2.0.0.sql`

y presione **Run**. No ejecute `seed.sql` en producción.

La migración crea/actualiza el plan anual, documentos privados, auditoría, entregas de recordatorios, conexiones de calendario y feed privado para Apple.

## 3. Edge Functions

Ejecute:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\supabase\DEPLOY-LINKARE-v2.0.0.ps1" -ProjectRef "fvucylgrqgxjqabacnlt" -PublicUrl "https://nexamind-clinical.vercel.app"
```

El script no reemplaza el App ID ni el API Secret de Wompi ya guardados.

## 4. Variables de Vercel

```env
VITE_APP_MODE=production
VITE_PUBLIC_APP_URL=https://nexamind-clinical.vercel.app
VITE_SUPABASE_URL=https://fvucylgrqgxjqabacnlt.supabase.co
VITE_SUPABASE_ANON_KEY=SU_CLAVE_PUBLICA
```

No agregue secretos de Wompi, service role ni credenciales de proveedores a Vercel.

## 5. Recordatorios automáticos opcionales

La interfaz funciona sin proveedores: prepara el mensaje, copia texto y abre WhatsApp manualmente. Para automatizar, agregue los secretos descritos en `supabase/LINKARE-v2.0-SECRETS.example.txt`.

- Correo: Resend.
- SMS: Twilio.
- WhatsApp: Meta WhatsApp Business con plantilla aprobada.

## 6. Google Calendar

Cree credenciales OAuth Web en Google Cloud y agregue como URI de redirección:

`https://fvucylgrqgxjqabacnlt.supabase.co/functions/v1/google-calendar-callback`

Guarde `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` y `GOOGLE_CALENDAR_REDIRECT_URI` en Supabase Secrets.

## 7. Apple Calendar

Linkare permite descargar una cita `.ics` y generar un feed privado. El feed es una suscripción de lectura. La URL contiene un token; trátela como información confidencial.

## 8. Archivos del paciente

Los archivos se guardan en el bucket privado `patient-documents`. La aplicación acepta PDF, imágenes, texto, Word y Excel, con límite de 20 MB en producción. Las aperturas, descargas, cargas y eliminaciones se auditan.

## 9. Alcance médico-legal

El resumen post mortem organiza hechos documentados y fuentes. No determina causa o manera de muerte, no sustituye una autopsia psicológica, investigación forense, dictamen pericial ni certificación oficial.

## 10. Prueba de aceptación

1. Médico demo entra y ve la experiencia clínica.
2. Secretaría demo entra y no ve información clínica restringida.
3. Cuenta real registra un paciente y los cambios sobreviven una recarga.
4. Se sube y abre un PDF privado.
5. Una cita cercana muestra el aviso y abre la libreta.
6. La nota se guarda, firma y aparece en Consultas.
7. Se genera un enlace Wompi por US$400.
8. El webhook actualiza el plan a Activo con renovación a 12 meses.
9. Apple ICS funciona.
10. Google, correo, SMS y WhatsApp se prueban cuando existan credenciales reales.
