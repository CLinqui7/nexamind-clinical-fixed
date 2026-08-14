# Google Calendar

## Lo que ya funciona

El prototipo no depende de credenciales externas:

1. Genera un enlace `calendar.google.com/calendar/render?action=TEMPLATE` para abrir una cita en Google Calendar.
2. Genera un archivo `.ics` compatible con Google Calendar, Outlook y Apple Calendar.

Esto evita bloquear el MVP por OAuth.

## Sincronización bidireccional

Para crear, leer, actualizar o eliminar eventos automáticamente:

1. Crear un proyecto en Google Cloud.
2. Habilitar Google Calendar API.
3. Configurar la pantalla de consentimiento OAuth.
4. Crear credenciales OAuth 2.0 para aplicación web.
5. Definir URIs de redirección para desarrollo y Vercel.
6. Solicitar únicamente los scopes necesarios.
7. Guardar access/refresh tokens cifrados y asociados al usuario.
8. Implementar renovación de tokens y revocación.
9. Guardar `google_event_id` en `appointments`.
10. Manejar errores, reintentos y cuotas.

## Scopes sugeridos

Para una agenda clínica propia, minimizar permisos. Valorar un scope limitado a eventos creados por la aplicación en lugar de acceso amplio a todos los calendarios.

## Consideraciones

- Nunca exponer Client Secret en el navegador.
- No escribir PHI innecesaria en títulos o descripciones externas.
- Mantener una opción para desactivar sincronización por clínica/usuario.
- Definir qué sistema es fuente de verdad cuando hay ediciones en ambos lados.
- Usar notificaciones push o sincronización incremental en lugar de sondeo constante.
