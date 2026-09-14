# Despliegue de Linkare 3.0.0

## 0. Antes del corte

No aplicar hotfixes 1.x/2.x encima de esta versión. Usar el ZIP actual y un clon limpio del SHA de base. La migración revoca accesos antiguos: coordinar una ventana sin ediciones en la web v2. Respaldar la base y los archivos Storage con el mecanismo disponible en su plan de Supabase. Un ZIP de GitHub no es un respaldo de expedientes.

Revisar primero en un proyecto Supabase de staging/restauración, no en pacientes reales. La migración y las pruebas RLS no pudieron ejecutarse en el entorno de entrega. El flujo Wompi de producción tampoco fue cobrado aquí.

## 1. Código local

Aplicar `APLICAR-EN-CLON.ps1` del paquete sobre el clon indicado. Conserva `.env.local`, `.git` y el directorio de dependencias. Exige Git limpio, crea un respaldo externo y restaura los archivos si falla instalación/validación. No ejecuta SQL, no publica GitHub y no toca secretos.

Ejecutar `npm ci --include=dev` y `npm run check` (el instalador lo hace). `npm run check` incluye sintaxis, 28 pruebas automáticas y un build de Vite con inspección del bundle. Nunca omita una validación para publicar.

Variables locales y en Vercel Production:

```
VITE_PUBLIC_APP_URL=https://nexamind-clinical.vercel.app
VITE_SUPABASE_URL=https://fvucylgrqgxjqabacnlt.supabase.co
VITE_SUPABASE_ANON_KEY=SU_CLAVE_PUBLICA
```

Un proyecto staging debe usar sus propias URLs y claves. Reiniciar Vite después de editar .env.local. No usar service_role/secret como clave del navegador.

## 2. Base de datos

En el proyecto correcto, ejecutar `supabase/PRECHECK-v3.sql` (solo lectura). Revisar los mensajes de facturas previas pagadas/pendientes antes de cambiar la integración.

- Proyecto existente de Linkare: ejecutar SOLO `supabase/migrations/202609080001_linkare_v3.sql`.
- Proyecto totalmente nuevo: ejecutar primero `supabase/00_BASE.sql`, después la migración v3.
- Nunca ejecutar todos los SQL antiguos, seed.sql, db reset o db push sin revisar el historial.

La migración abre una transacción. Un error evita confirmar los cambios. Se archiva el antiguo JSON en un esquema privado y se separan sus registros. No se migran las contraseñas o usuarios locales a Auth. Las cuentas antiguas de Auth permanecen y las nuevas secretarías se invitan desde Equipo.

No se borran automáticamente pacientes antiguos por parecer ficticios: revisar y archivar los registros no reales mediante decisión explícita. Mantener las notas de pacientes reales. El frontend no crea nuevas muestras ni inicia sesión con usuarios de prueba.

Ejecutar `supabase/POSTCHECK-v3.sql`. En staging ejecutar también `qa/sql/staging-smoke.sql`, habilitando expresamente su confirmación. Este test hace ROLLBACK y comprueba rol, dos consultorios, precios, firma inmutable, revisión e idempotencia; no realiza pagos ni envía correos.

Las vigencias previamente pagadas no se infieren del JSON anterior. Verificar cada pago productivo con Wompi y, cuando corresponda, usar `supabase/RECONCILIAR-VIGENCIA.sql` completando valores revisados. Conciliar/cerrar enlaces de pago anteriores antes del corte, porque un webhook de una orden heredada no activa automáticamente una orden v3.

## 3. Auth y correo

En Supabase habilitar email + confirmación. Configurar SMTP propio, remitente y dominio verificado para enviar a usuarios reales. El servicio de email de desarrollo de Supabase no debe considerarse un servicio de producción.

Site URL: `https://nexamind-clinical.vercel.app`.
Redirect URLs: `https://nexamind-clinical.vercel.app/**` y, solo en desarrollo, `http://localhost:4173/**`.

Confirmación, invitación y recuperación usan enlaces de Supabase que vuelven al dominio público. Ese dominio debe ser accesible en incógnito sin login de Vercel. No desactivar la protección de todo el proyecto: revisar específicamente el dominio de producción.

Flujo médico: Crear consultorio, confirmar correo, ingresar, escoger plan. Flujo de equipo: Configuración, Invitar a secretaría, correo de invitación, elegir contraseña, acceder al mismo consultorio. No compartir contraseñas ni insertar roles desde el navegador.

La invitación dura siete días. Reenviar desde Equipo si vence o falla SMTP. Un correo ya unido a otro consultorio requiere gestión administrativa; no se mueve silenciosamente a otro tenant.

## 4. Backend

Con el código aplicado, ejecutar `scripts/DEPLOY-BACKEND-v3.ps1 -Project <clon> -ProjectRef fvucylgrqgxjqabacnlt` después de confirmar la migración y el respaldo. Usa npx; no necesita CLI global. Los secretos existentes de Wompi se conservan.

El script despliega funciones privadas con validación de JWT en su propio código, webhook firmado, callback OAuth, feed privado y dispatcher por secreto. También retira los handlers antiguos publicando una respuesta 410. No saltarse esos cuatro endpoints.

Secrets obligatorios del servidor:
- WOMPI_CLIENT_ID y WOMPI_CLIENT_SECRET ya guardados, más APP_PUBLIC_URL.
- Claves SUPABASE_* proporcionadas por la plataforma, nunca copiadas al frontend.

Plantilla de integraciones en `supabase/SECRETS-v3.example.txt`. Las credenciales de correo de Auth se configuran en Auth/SMTP, independientemente de Resend para recordatorios.

## 5. Integraciones opcionales

Google: habilitar Calendar API y configurar OAuth web con callback `https://<ref>.supabase.co/functions/v1/google-calendar-callback`. Para personas fuera del equipo de pruebas de Google revisar publicación/verificación del consentimiento. En Configuración conectar la cuenta y usar Sincronizar en la cita. No se implementó Google -> Linkare bidireccional.

Apple: descargar .ics o suscribirse al feed privado. Actualizaciones dependen de la frecuencia de la app de calendario. El feed no permite editar citas en Linkare.

Recordatorios: conectar Resend/Twilio/Meta según canal. Meta requiere una plantilla aprobada con un parámetro de cuerpo y versión Graph explícita. Registrar consentimiento, teléfono E.164 y horario del paciente.

Para envío programado configurar un job cada 5 minutos que haga POST a `/functions/v1/reminder-dispatch` con `Authorization: Bearer <LINKARE_CRON_SECRET>`. Guardar ese secreto en el almacén seguro del programador, no en Git ni en el historial SQL. Una longitud mínima de 32 caracteres es obligatoria. No se creó ningún job remoto durante esta entrega. El dispatcher procesa hasta 50 envíos por corrida, 100 consultorios; revisar escalado del scheduler si se supera ese volumen. No reintentar ciegamente un envío ambiguo para evitar duplicados.

## 6. Prueba de aceptación y publicación

En staging comprobar cuenta nueva sin datos, acceso de secretaría, archivo privado, nota firmada, conflicto, reset de contraseña y separación entre DOS consultorios. Verificar sin sesión que los endpoints privados rechacen 401/403, sin llamar a un checkout de producción.

La prueba real final de Wompi requiere aprobación del titular: un enlace, un pago, una vigencia y reenvío del mismo webhook sin sumar tiempo extra. El estado del aplicativo en modo productivo no prueba este circuito. No usar tarjetas inventadas en producción.

Con backend y comprobaciones aprobados, ejecutar `npm run check`, revisar `git diff`, commit y push. GitHub/Vercel despliega el frontend; no las migraciones. Mantener deshabilitado el tráfico de edición v2 durante la ventana de corte.

Si algo falla en SQL, no publicar v3. Si hay un problema después del corte, bloquear nuevas escrituras y revisar base/backup antes de restaurar una versión vieja que usa permisos obsoletos. No restaurar únicamente archivos frontend y asumir que eso revierte la base.

## Fuentes técnicas

- Supabase funciones/autorización: https://supabase.com/docs/guides/functions/auth
- Supabase SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase Storage RLS: https://supabase.com/docs/guides/storage/security/access-control
- Vercel Git: https://vercel.com/docs/git
- Wompi El Salvador: documentación del portal de comercio y API de Wompi SV. No usar la API colombiana para esta integración.
