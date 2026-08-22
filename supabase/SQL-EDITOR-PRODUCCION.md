# Qué pegar en Supabase SQL Editor

## Caso A: proyecto Supabase nuevo y vacío

En SQL Editor abra un query nuevo, copie TODO el contenido de:

`supabase/LINKARE-PRODUCTION-SETUP-FRESH.sql`

Presione **Run** una sola vez.

Este archivo crea:
- organizaciones y miembros;
- pacientes y datos clínicos;
- medicamentos, escalas, citas y alertas;
- recetas, fotografías, seguro y preferencias;
- `linkare_app_state`, donde la interfaz guarda el estado remoto actual;
- configuración del precio de la licencia Linkare;
- facturas de suscripción;
- eventos y confirmaciones Wompi;
- RLS y políticas de acceso.

## Caso B: ya ejecutó antes `schema.sql` y las migraciones anteriores

NO vuelva a pegar el archivo completo. Ejecute únicamente:

`supabase/migrations/20260821_v1_7_platform_billing_and_state.sql`

## No ejecutar en producción

No ejecute `supabase/seed.sql` en la base productiva. Contiene pacientes ficticios.

## Prueba / demo separada

Cree un segundo proyecto Supabase, por ejemplo `linkare-demo`.

En ese proyecto ejecute:
1. `supabase/LINKARE-PRODUCTION-SETUP-FRESH.sql`
2. `supabase/seed.sql`

En producción use otro proyecto, por ejemplo `linkare-production`, y ejecute únicamente el setup sin seed.

## Después del SQL

1. Vaya a Authentication > Users y cree el primer usuario administrador.
2. Configure Vercel con `VITE_APP_MODE=production`, URL de Supabase y publishable key.
3. Inicie sesión con ese usuario. Linkare ejecutará `linkare_bootstrap_organization` y lo registrará como `owner`.
4. En **Mi plan**, administración modifica el precio que pagará el psiquiatra.
5. Configure App ID y API Secret de Wompi en Supabase Edge Function Secrets.
6. Despliegue las tres funciones Wompi.

## Nota de seguridad actual

La versión v1.7 guarda el estado operativo de la interfaz en `linkare_app_state` y las facturas Wompi en tablas dedicadas. Para una demostración y primera puesta en marcha funciona con Supabase Auth y RLS. Antes de cargar expedientes clínicos reales a gran escala, debe completarse la separación granular de permisos clínicos por rol y una revisión legal/técnica de privacidad.
