# Activar Wompi y conectar Linkare

## Lo que Wompi sí entrega

En el panel de Wompi El Salvador encontrará:
- **App ID** → se guarda como `WOMPI_CLIENT_ID`
- **API Secret** → se guarda como `WOMPI_CLIENT_SECRET`

Wompi no entrega `VITE_WOMPI_PUBLIC_KEY` para este flujo.

Tampoco necesita un `VITE_WOMPI_CHECKOUT_URL` cuando usa la API: cada enlace se genera dinámicamente mediante `POST /EnlacePago` según el precio que usted escriba en Linkare.

La URL de retorno no la entrega Wompi. Es la URL pública de su propia aplicación, configurada como `APP_PUBLIC_URL` en Supabase Secrets.

## Activar el aplicativo que ya tiene

1. Abra el aplicativo en `panel.wompi.sv`.
2. Antes de activarlo, confirme el nombre y logo. El psiquiatra verá ese nombre al pagar.
3. Seleccione cuidadosamente la cuenta bancaria. El panel advierte que después de asociarla no podrá cambiarse.
4. En **URL relacionada al aplicativo** coloque la URL pública de Linkare, por ejemplo:
   `https://nexamind-clinical.vercel.app`
5. Presione **Activar**.
6. Copie App ID y API Secret desde la sección API Rest.
7. No comparta el API Secret por chat, correo, GitHub ni Vercel público.

## Supabase SQL Editor

En un proyecto de producción nuevo y vacío ejecute una sola vez:
- `supabase/LINKARE-PRODUCTION-SETUP-FRESH.sql`

No ejecute `seed.sql` en producción.

## Variables en Vercel

```env
VITE_APP_MODE=production
VITE_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_PUBLISHABLE_KEY
```

## Secretos en Supabase Edge Functions

```env
WOMPI_CLIENT_ID=APP_ID_DE_WOMPI
WOMPI_CLIENT_SECRET=API_SECRET_DE_WOMPI
WOMPI_AUTH_URL=https://id.wompi.sv/connect/token
WOMPI_API_URL=https://api.wompi.sv
WOMPI_AUDIENCE=wompi_api
APP_PUBLIC_URL=https://TU_DOMINIO.vercel.app
WOMPI_NOTIFICATION_EMAIL=TU_CORREO
WOMPI_REQUIRE_AUTH=true
```

## Desplegar funciones

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\supabase\DEPLOY-WOMPI.ps1 -ProjectRef "TU_PROJECT_REF" -PublicUrl "https://TU_DOMINIO.vercel.app"
```
