# Linkare v1.6.0

Plataforma de gestión psiquiátrica con agenda, pacientes, recetas, tutorial visible y cobro de la suscripción Linkare mediante Wompi El Salvador.

## Flujo de cobro
1. Administración Linkare inicia sesión con la cuenta propietaria.
2. Modifica precio, plan, correo y fecha límite.
3. Supabase guarda la factura.
4. El psiquiatra abre `Mi plan` y presiona `Pagar con Wompi`.
5. La Edge Function crea el enlace con el monto de la base de datos.
6. El webhook actualiza el estado a pagado.

## Wompi
Use únicamente App ID y API Secret en Supabase Edge Function Secrets. Nunca ponga el API Secret en Vercel, React o GitHub.

## SQL
Ejecute `supabase/SQL-EDITOR-PRODUCCION.sql`.
No ejecute `supabase/seed.sql` en producción.

## Demo
- Administración Linkare: `admin@linkare.app` / `LinkareAdmin2026!`
- Médico: `doctora@nexamind.demo` / `NexaMind2026!`
- Secretaría: `secretaria@nexamind.demo` / `Agenda2026!`

Estas credenciales locales son solo para demostración. Antes de usar datos clínicos reales debe conectarse Supabase Auth y RLS para la capa clínica.
