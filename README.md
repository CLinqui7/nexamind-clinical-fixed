# Linkare 2.0

Plataforma React/Vite para gestión psiquiátrica: expedientes, tratamientos, agenda, recetas, libreta de consulta, documentos privados, recordatorios, calendarios y suscripción anual por Wompi.

## Funciones principales

- Plan Profesional Linkare: **US$400 por año**.
- Registro real con Supabase Auth y organización aislada.
- Accesos demo separados para Médico y Secretaría.
- Expediente longitudinal, medicamentos, escalas, efectos, laboratorios y recetas.
- Documentos privados en Supabase Storage.
- Libreta virtual al llegar la hora de la cita.
- Identidad personal opcional y antecedentes de seguridad documentados.
- Estado vital, cierre post mortem y resumen para revisión médico-legal.
- Recordatorios por correo, SMS y WhatsApp, manuales o mediante proveedores.
- Google Calendar y Apple Calendar.

## Validación

```powershell
npm run check
```

## Producción

1. Ejecute `supabase/SQL-EDITOR-LINKARE-v2.0.0.sql` en SQL Editor.
2. Ejecute `supabase/DEPLOY-LINKARE-v2.0.0.ps1`.
3. Configure las cuatro variables públicas de Vercel indicadas en `.env.example`.
4. Haga `git push origin main`.

Lea `docs/LINKARE-V2-GUIA-PRODUCCION.md` para la configuración completa.

> No use datos reales hasta validar seguridad, privacidad, consentimiento, auditoría, respaldos, políticas internas y requisitos legales aplicables. El resumen post mortem no sustituye un dictamen forense.
