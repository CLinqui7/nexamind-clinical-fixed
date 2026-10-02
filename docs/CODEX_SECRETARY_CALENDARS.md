# Secretaría configurable y calendarios internos

Fecha de implementación local: 2026-10-02. Esta rama no ejecutó migraciones ni despliegues en producción.

## Auditoría previa

- La aplicación ya persistía permisos granulares en `organization_members.permissions` y los validaba en UI, funciones Edge y SQL.
- Secretaría tenía una lista segura fija, pero no existían los modos «todos»/«personalizados», selección masiva ni permisos por calendario.
- La agenda era un conjunto de recursos JSON `appointment`; no existía una entidad de calendario interno.
- Google Calendar, ICS y feeds privados ya existían como integraciones externas y no equivalían a Doctor/Esposa/General.
- La inspección agregada de producción encontró 36 citas activas: 36 tenían `patientId` y ninguna tenía `calendarId`, `doctorId`, `ownerUserId` o `eventType`. No se leyó información clínica identificable.

## Modelo implementado

`linkare_calendars_v1` crea tres filas por organización:

| Código | Nombre | Uso |
|---|---|---|
| `doctor` | Doctor | Agenda clínica heredada y nuevas citas |
| `wife` | Esposa | Agenda personal independiente |
| `general` | General | Eventos compartidos; permite eventos sin paciente |

Las citas y eventos siguen usando el recurso versionado `appointment`, ahora con `calendarId` y `eventType`. `eventType=appointment` exige paciente; `eventType=general` elimina `patientId`, exige título y solo se acepta en General. No hay conversión automática entre ambos tipos.

## Permisos

Cada calendario tiene acciones independientes `View`, `Create`, `Edit`, `Cancel` y `Delete`. Secretaría solo recibe claves administrativas seguras y estas 15 claves de calendario. Los permisos propietarios, facturación, configuración, gestión de usuarios y expediente clínico privado continúan bloqueados por lista permitida del servidor aunque el cliente intente forjarlos.

Una acción de calendario requiere también `View`. El permiso histórico `appointmentsManage` se conserva como compatibilidad para personal clínico; para Secretaría se deriva de tener al menos un calendario visible y no otorga acceso global.

## Migración y retrocompatibilidad

La migración `20261002174319_secretary_multi_calendar.sql`:

1. crea y protege la tabla de calendarios con RLS y privilegios explícitos;
2. crea las tres filas para organizaciones existentes y un trigger para organizaciones nuevas;
3. asigna a Doctor únicamente las citas antiguas sin `calendarId`;
4. conserva el alcance de secretarias que ya tenían `appointmentsManage` asignándoles las acciones equivalentes en los tres calendarios;
5. filtra la carga por calendario autorizado;
6. envuelve el escritor histórico para validar calendario, tipo de evento y acción exacta sin reescribir la lógica clínica existente.

## Integraciones

Google Calendar conserva la misma conexión y tabla de enlaces. La sincronización ahora comprueba permiso `Edit` sobre el calendario interno y usa una descripción privada distinta para eventos generales. Los feeds ICS filtran las filas según los calendarios que su creador todavía puede ver; los feeds de paciente excluyen eventos generales.

## Verificación

- `npm run check`: 118 pruebas aprobadas, compilación Vite y escaneo de distribución aprobados.
- Base aislada PostgreSQL/PGlite: casos de todos los permisos, permisos personalizados, solo lectura, creación autorizada, evento general, denegación RPC/directa y revocación tras una sesión nueva.
- Navegador real: tres filtros combinables, selector obligatorio, evento General sin paciente, persistencia tras recarga y cierre/inicio de sesión, y ausencia de desbordamiento horizontal a 768 px y 390 px.

## Publicación segura

Antes de producción: generar respaldo verificable, aplicar primero la migración en staging, repetir consultas agregadas de conteo/backfill, ejecutar la aceptación de propietario y Secretaría, desplegar las funciones Edge modificadas, desplegar el frontend y comprobar carga/edición tras cerrar sesión. La migración es aditiva; no debe eliminarse la columna lógica `calendarId` ni restaurarse el escritor anterior mientras existan eventos nuevos.
