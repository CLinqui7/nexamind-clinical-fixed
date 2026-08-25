# Supabase para Linkare v1.7.0

## Producción nueva

En SQL Editor ejecute una sola vez:

`LINKARE-PRODUCTION-SETUP-FRESH.sql`

No ejecute `seed.sql` en producción.

## Demo

Use otro proyecto Supabase separado y allí puede ejecutar:

1. `LINKARE-PRODUCTION-SETUP-FRESH.sql`
2. `seed.sql`

## Después del SQL

1. Cree el primer usuario en Authentication > Users.
2. Configure Vercel con `VITE_APP_MODE=production`, URL y publishable key.
3. Inicie sesión. Linkare creará la organización y guardará el estado remoto.
4. Configure App ID y API Secret como Supabase Edge Function secrets.
5. Despliegue las funciones Wompi.

Consulte:
- `SQL-EDITOR-PRODUCCION.md`
- `ACTIVAR-WOMPI-Y-CONNECTAR.md`
- `DEPLOY-WOMPI.ps1`

## v1.8.0: registro de usuarios

Para permitir que un psiquiatra cree su propia cuenta:

1. En Supabase > Authentication > Providers > Email, deje habilitado Email.
2. En Supabase > Authentication > URL Configuration:
   - Site URL: su URL de producción de Vercel.
   - Redirect URLs: agregue la misma URL y, si usa previews, las que necesite.
3. Ejecute `migrations/20260821_v1_8_self_signup_and_price.sql`.
4. La primera sesión autenticada de cada usuario ejecuta `linkare_bootstrap_organization` y crea su organización aislada.
5. El precio inicial del plan se crea en US$40 mensuales.
