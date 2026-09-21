# Acceso gratuito, persistencia y equipo

## Comportamiento

`complimentary_access` pertenece al servidor, vale `true` por defecto y habilita escritura sin órdenes ni período pagado. Se conserva el catálogo mensual/semestral/anual, los webhooks y la validación de pagos. No se genera un checkout al iniciar sesión o guardar. Mi plan muestra Gratuito / US$0 al propietario.

El alta y la edición esperan la confirmación de PostgreSQL antes de mostrar éxito. Un error conserva el formulario y presenta el motivo. La libreta mantiene guardado automático con estado visible y aviso antes de abandonar cambios pendientes. Cada escritura usa diferencias por recurso y revisión; no reemplaza todo el consultorio. Un conflicto no se sobrescribe automáticamente.

Cerrar sesión intenta guardar, llama a Supabase Auth, limpia datos, organización, formularios y escritor. Una respuesta de la sesión anterior no puede restaurar sus pacientes. Los permisos se consultan nuevamente cada 30 segundos y al recuperar el foco; SQL y Edge los comprueban en cada operación.

## Permisos

| Capacidad | Propietario (`owner`) | Doctor (`psychiatrist`) | Enfermería (`clinical_assistant`) | Secretaría |
|---|---|---|---|---|
| Pacientes y agenda | Sí | JSON configurable | JSON configurable | JSON administrativo |
| Lectura clínica | Sí | `clinicalView` | `clinicalView` | Nunca |
| Evolución, controles, resultados | Sí | Permiso correspondiente | Permiso correspondiente | Nunca |
| Medicamentos, nuevas recetas, consultas | Sí | Cada permiso por separado | Cada permiso por separado | Nunca |
| Editar y borrar recetas existentes | Sí | `prescriptionsEdit` | `prescriptionsEdit` | `prescriptionsEdit` |
| Firmar nota médica | Sí | `consultationsManage`, autor autenticado | Nunca | Nunca |
| Documentos | Sí | Ver/gestionar por separado | Ver/gestionar por separado | Nunca |
| Equipo, plan, clínica y acceso gratis | Sí | No | No | No |

Solo se reconocen claves del catálogo. Valores distintos de `true` no conceden acceso. Editar clínica necesita ver clínica y pacientes; gestionar documentos necesita ver documentos y pacientes. Los controles de la interfaz ajustan esas dependencias. Revocar lectura revoca también las capacidades dependientes.

El médico existente conserva una sola vez sus permisos clínicos anteriores mediante un JSON explícito, respetando los `false` ya guardados. Los nuevos miembros reciben exactamente los permisos de su invitación. El rol de doctor ya no concede administración implícita.

`linkare_load_state_v3` filtra clínica, documentos, alertas y revisiones antes de responder. Los roles delegados no pueden seleccionar directamente el JSON clínico completo; acceden por RPC. `linkare_save_changes_v3` valida recurso y campo, conserva campos omitidos, revisiones y notas firmadas. Las políticas del bucket privado validan consultorio y paciente. El navegador archiva documentos; no destruye objetos.

## Migraciones y respaldo

Esta entrega presupone que la migración v3 del 8 de septiembre ya está aplicada. No ejecutar nuevamente BASE, v1/v2/v3, reset ni seeds en producción.

Orden de estas migraciones:

1. `20260921163356_enable_free_access.sql`: agrega acceso gratuito a suscripciones existentes y futuras, redefine entitlement y expone el estado gratuito.
2. `20260921170106_free_access_and_team_permissions.sql`: agrega rol, teléfono y cargo a invitaciones; convierte permisos de médicos existentes; redefine RPC, políticas, acceso documental y autorización de facturación. Agrega verificación de acceso y provisión administrativa.
3. `20260921170933_secretary_prescription_corrections.sql`: excepción solicitada posteriormente por el usuario para que Secretaría pueda corregir recetas existentes. Activa `prescriptionsEdit` en secretarías y doctores existentes/invitados, y en enfermería con creación de recetas; incorpora filtrado y validación de correcciones. El propietario puede revocar el permiso desde Equipo.
4. `20260921182203_archive_prescriptions.sql`: permite retirar recetas de la interfaz con `prescriptionsEdit`. El servidor fija quién y cuándo hizo el borrado, preserva el registro y bloquea su restauración, edición o eliminación física.

La receta conserva ID, número, fecha de creación y autor original. SQL registra revisiones, autor autenticado y contenido previo de cada corrección, aunque el cliente intente borrar ese historial. El borrado la oculta mediante archivo, pero no destruye el registro; una receta archivada no se puede restaurar, editar ni imprimir. El permiso tampoco permite crear una receta nueva. Secretaría recibe el contenido de la receta (que puede incluir su diagnóstico e indicaciones), pero no el resto del JSON clínico, notas de consulta ni tratamientos fuera de ella. Las notas médicas firmadas continúan inmutables.

No reescriben expedientes clínicos ni eliminan tablas, personas, pagos o documentos. Tablas cuyos datos/esquema cambian: `linkare_subscriptions_v3`, `linkare_invites_v3`, `organization_members`. Políticas actualizadas en `linkare_records` y `patient_document_audit`; los helpers existentes mantienen las políticas Storage.

Antes de aplicar se inspeccionaron columnas, enum, constraints, índices/políticas, grants y definiciones reales. Se conservaron fuera de Git las definiciones y los snapshots de suscripciones y miembros afectados. Esos archivos no son un respaldo completo de expedientes ni de Storage. El servicio no reportó un snapshot físico/PITR disponible al consultar; no se debe prometer restauración total con estos respaldos parciales.

## Verificación local

```powershell
npm ci --include=dev
node scripts/refresh-backend-tests.cjs
npm run check
npx --yes deno check supabase/functions/linkare-team/index.ts supabase/functions/wompi-create-link/index.ts supabase/functions/google-calendar-callback/index.ts supabase/functions/calendar-feed/index.ts
```

`npm run check` incluye pruebas de lógica/handlers y PostgreSQL aislado con PGlite y las migraciones reales. Prueba escritura gratuita, cuatro roles, RLS, aislamiento, invitaciones, firma inmutable, provisión vacía y acceso desactivado. Los fixtures Edge se regeneran con TypeScript fijado; `.gitattributes` mantiene sus hashes iguales en Windows y Linux.

Prueba de navegador, en dos terminales:

```powershell
node qa/browser/server.mjs
```

```powershell
node qa/browser/persistence.mjs
node qa/browser/modules.mjs
node qa/browser/prescriptions.mjs
```

Usa Edge instalado; para otro navegador configure `LINKARE_BROWSER` y su instalación compatible con Playwright. El servidor escucha solo en 127.0.0.1:4173 y utiliza PostgreSQL en memoria. Auth, proveedores y bytes del archivo se simulan: esto demuestra flujos de interfaz, SQL y políticas de inserción, pero no entrega SMTP ni almacenamiento físico Supabase. No publicar este servidor; nunca se importa desde `src`.

## Despliegue incremental

Después de revisar diff y comprobaciones, ejecutar desde el repositorio vinculado al proyecto correcto:

```powershell
npx --yes supabase db query --linked --file supabase/PRECHECK-FREE-ACCESS.sql --output json
# Ejecutar SOLO la migración pendiente, luego registrar su versión en el historial.
npx --yes supabase db query --linked --file supabase/migrations/20260921170106_free_access_and_team_permissions.sql --output json
npx --yes supabase migration repair 20260921170106 --status applied --linked
npx --yes supabase db query --linked --file supabase/POSTCHECK-FREE-ACCESS.sql --output json
npx --yes supabase functions deploy linkare-team --project-ref fvucylgrqgxjqabacnlt --use-api --no-verify-jwt
```

`--no-verify-jwt` solo deshabilita la comprobación de la pasarela; los endpoints privados siguen validando el token con `supabaseAdmin().auth.getUser(token)`, miembro activo y permiso. Conservar `publicKey`, `requireUser`, `requireMember`, `limitAction`, `safeApiMessage`.

Comprobar primero OPTIONS y `linkare-team` autenticado. Después desplegar `wompi-app-info`, `wompi-create-link`, `calendar-status`, `calendar-feed-token`, `calendar-feed`, `google-calendar-auth-url`, `google-calendar-callback`, `google-calendar-sync`, `send-reminder` y `reminder-provider-status`, porque cada función incorpora su copia de los helpers compartidos. Wompi webhook y dispatcher conservan su autenticación existente y se comprueban sin producir pagos ni envíos.

Mantener `CORS_ORIGINS` como lista explícita de producción, URL main y los dos localhost. Nunca usar `*` con peticiones privadas. Los secretos de pagos/proveedores existentes permanecen en Supabase.

```powershell
./scripts/VERIFY-PRODUCTION-FREE.ps1
```

Para el canary autenticado, proporcionar `LINKARE_VERIFY_TOKEN`, `LINKARE_VERIFY_ORG` y `SUPABASE_ANON_KEY` solo mediante entorno. El script informa si no se ejecutó esa parte. No confundir HTTP 200 del frontend con guardado o acceso autenticado. Después publicar commit en main y comprobar que Vercel está Ready con ese SHA.

Ante fallo de SQL la transacción no se confirma. Ante fallo posterior, revisar el componente afectado y hacer una corrección hacia adelante; no restaurar un frontend con roles incompatibles ni reaplicar migraciones históricas.

## Crear una cuenta gratuita vacía

```powershell
./scripts/CREAR-CUENTA-GRATUITA.ps1 -Email 'persona@su-dominio.com' -FullName 'Nombre del profesional' -ClinicName 'Nombre del consultorio'
```

Solicita clave administrativa y contraseña con entrada oculta. La alternativa Node recibe `--email`, `--fullName`, `--clinicName` y las variables administrativas `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (o `SUPABASE_SECRET_KEY`) y `LINKARE_TEMP_PASSWORD`. Sin contraseña solo puede generar una en terminal interactiva, donde la muestra una vez. Nunca escribe claves o contraseñas en archivos.

Auth se crea primero; una RPC disponible solo para `service_role` crea atómicamente organización, propietario, perfil, configuración, suscripción gratuita y auditoría. No crea pacientes, órdenes ni pagos. Si el paso SQL falla, conserva Auth y muestra el ID para `--resume-user-id` / `-ResumeUserId`. No elimina ni sobrescribe cuentas existentes automáticamente.

Texto de entrega: «Esta es tu cuenta de prueba de Linkare. Por ahora tienes acceso completo al sistema para que puedas conocer todos sus módulos y probar su funcionamiento.»

## Volver a exigir pago más adelante

No se hizo durante esta entrega. Requiere decisión comercial explícita: modificar el default de `complimentary_access` para nuevas organizaciones y desactivarlo únicamente en las organizaciones seleccionadas, con respaldo y revisión de vigencia. `linkare_entitled_v3` volverá a exigir su período pagado y gracia existente. Precios y snapshots de órdenes permanecen en servidor. No basta cambiar una variable VITE.

## Límites de la evidencia

El canary real verifica Supabase Auth, bootstrap, lectura gratuita, logout y cuatro endpoints autenticados, sin escribir pacientes. La entrega de invitaciones/recuperación depende de SMTP; no se enviaron correos a personas para probar. Google OAuth requiere la cuenta y consentimiento del titular; sin conexión es opcional y no bloquea el dashboard. Apple/ICS y recordatorios conservan sus permisos. No se ejecutó un pago real, checkout productivo, mensaje automático ni callback externo de Google.

El postcheck reporta usuarios sin membership: los dos encontrados son cuentas con correo todavía sin confirmar, no registros huérfanos de pacientes. No se borraron. Los avisos heredados del asesor de Supabase se documentan en el informe de despliegue; los RPC `SECURITY DEFINER` son puntos de entrada explícitos con comprobación de miembro/permiso.
