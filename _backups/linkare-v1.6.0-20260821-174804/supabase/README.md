# Linkare + Supabase + Wompi v1.6.0

## En SQL Editor
Para esta fase de cobro de la suscripción, ejecute solamente:

`supabase/SQL-EDITOR-PRODUCCION.sql`

No ejecute `seed.sql` en producción. Ese archivo contiene datos clínicos ficticios para demo.

La migración crea:
- `linkare_billing_accounts`
- `linkare_billing_invoices`

El precio y la factura se guardan en Supabase. El psiquiatra no puede cambiar el monto al pagar.

## En Vercel
Agregue solo:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

No agregue el App ID o API Secret de Wompi en Vercel.

## En Supabase Edge Function Secrets
Agregue:
- `WOMPI_CLIENT_ID` = App ID de Wompi
- `WOMPI_CLIENT_SECRET` = API Secret de Wompi
- `WOMPI_AUTH_URL` = `https://id.wompi.sv/connect/token`
- `WOMPI_API_URL` = `https://api.wompi.sv`
- `WOMPI_AUDIENCE` = `wompi_api`
- `APP_PUBLIC_URL` = URL pública de Linkare/Vercel
- `WOMPI_NOTIFICATION_EMAIL` = correo de la plataforma
- `LINKARE_ADMIN_KEY` = clave privada larga para modificar precios
- `LINKARE_BILLING_ACCOUNT_SLUG` = `consultorio-demo`

## Funciones a desplegar
- `wompi-app-info`
- `linkare-billing-summary`
- `linkare-billing-admin`
- `linkare-create-payment-link`
- `wompi-webhook`

Puede usar `supabase/DEPLOY-WOMPI.ps1` para guardar secretos y desplegar todas las funciones.
