# Linkare v3.0.2 — sesión Wompi y persistencia

Este hotfix no cambia precios ni la migración principal. Corrige el transporte explícito del token de Supabase a Edge Functions y valida la sesión con el cliente administrativo del backend.

También incluye una consulta de solo lectura para verificar que pacientes, datos clínicos, citas, alertas, órdenes y auditoría se estén persistiendo en Supabase.

Después de aplicar:
1. Cierre sesión en Linkare y vuelva a entrar.
2. Despliegue las Edge Functions con DEPLOY-AUTH-WOMPI-v3.0.2.ps1.
3. Ejecute DIAGNOSTICAR-WOMPI-v3.0.2.ps1 antes de probar desde la UI.
4. Ejecute POSTCHECK-PERSISTENCIA-v3.0.2.sql en SQL Editor.
