# Linkare v1.6.0

## Suscripción de la clínica
- La pantalla de Cobros ahora sirve para que el psiquiatra pague la plataforma Linkare.
- Ya no genera cobros para pacientes ni consultas clínicas.
- La cuenta de administración Linkare modifica el precio y la fecha límite.
- Supabase guarda la cuenta, factura, monto, estado y enlaces Wompi.
- El psiquiatra no puede modificar el monto al pagar.

## Wompi El Salvador
- App ID = `WOMPI_CLIENT_ID`.
- API Secret = `WOMPI_CLIENT_SECRET`.
- No se usan variables `VITE_WOMPI_*`.
- El enlace se crea desde una Supabase Edge Function usando el monto guardado en la factura.
- Webhook HMAC actualiza la factura a pagada.

## Supabase
- Nueva migración `20260821_v1_6_platform_billing.sql`.
- Archivo directo para SQL Editor: `supabase/SQL-EDITOR-PRODUCCION.sql`.
- No se agregan pacientes demo a producción.

## Tutorial
- Permanece visible, compacto y sin desenfoque.
- Nueva clave `linkare-tutorial-v4`.
