# Arquitectura propuesta de producción

## Objetivo

Convertir el prototipo estático en una aplicación multiusuario para una práctica psiquiátrica, manteniendo aislamiento por clínica, trazabilidad y reglas clínicas versionadas.

## Stack recomendado

```text
Vercel
└── Next.js App Router + TypeScript
    ├── Server Components
    ├── Route Handlers / Server Actions
    ├── Auth middleware
    └── UI React

Supabase
├── PostgreSQL
├── Auth + MFA
├── Row Level Security
├── Storage
├── Realtime opcional
└── Edge Functions/Cron opcional
```

## Capas

1. **Interfaz clínica:** dashboard, expediente, agenda, alertas y analíticas.
2. **Servicios de aplicación:** validación, cálculos, auditoría y acceso a datos.
3. **Datos clínicos:** esquema PostgreSQL normalizado.
4. **Motor de monitoreo:** protocolos, reglas y tareas pendientes.
5. **Integraciones:** Google Calendar, correo/SMS y futuros estándares FHIR.

## Regla de diseño

Los cálculos clínicos importantes no deben existir únicamente en componentes React. Las vistas SQL y servicios server-side deben producir resultados reproducibles y auditables.

## Vistas recomendadas

- `patient_latest_assessment_v`
- `patient_current_medications_v`
- `upcoming_appointments_v`
- `patient_monitoring_status_v`
- `psychiatrist_patient_priority_v`
- `patient_timeline_v`

## Seguridad mínima antes de datos reales

- MFA obligatorio para personal clínico.
- RLS en todas las tablas expuestas.
- Service Role exclusivamente server-side.
- Auditoría de lectura y modificación de expedientes.
- Sesiones seguras y expiración apropiada.
- Backups, recuperación, gestión de incidentes y política de retención.
- Cifrado de información sensible adicional cuando corresponda.
- Evaluación legal de HIPAA, normativa local y contratos con proveedores.
