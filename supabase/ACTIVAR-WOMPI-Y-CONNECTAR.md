# Activar el aplicativo Wompi existente

1. Abra el aplicativo de Wompi que ya tiene.
2. Verifique que la cuenta bancaria seleccionada sea la correcta. Wompi advierte que después de asociarla no podrá cambiarla desde ese flujo.
3. En `URL relacionada al aplicativo` coloque la URL pública actual de Linkare, por ejemplo:
   `https://nexamind-clinical.vercel.app`
4. Presione `Activar`.
5. En la sección `API Rest`, copie:
   - `App ID` -> `WOMPI_CLIENT_ID`
   - `API Secret` -> `WOMPI_CLIENT_SECRET`

No necesita `VITE_WOMPI_PUBLIC_KEY`, `VITE_WOMPI_CHECKOUT_URL` ni `VITE_WOMPI_REDIRECT_URL` para la integración API de Wompi El Salvador.

El enlace genérico `https://s.wompi.sv/...` puede conservarse como respaldo manual, pero Linkare v1.6 genera enlaces individuales desde la API con el precio guardado en Supabase.

## Producción y prueba
- Mientras el aplicativo diga `Modo de prueba`, los enlaces serán de prueba.
- Después de activar el aplicativo y asociar la cuenta, la API reportará si el aplicativo está productivo.
- Linkare muestra ese estado en `Mi plan` / `Cobros Linkare`.
