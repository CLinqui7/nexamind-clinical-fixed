# AGENTS.md — NexaMind Clinical

## Objetivo
Mantener una aplicación profesional y sencilla para seguimiento farmacoterapéutico psiquiátrico, agenda, recetas y operación administrativa. Es apoyo a decisiones: no diagnostica, no prescribe automáticamente y no atribuye causalidad por sí sola.

## Stack actual
- React 19 + HTM.
- Vite 7.
- JavaScript ES modules.
- CSS propio responsive.
- Datos sintéticos en `src/data.js`.
- Persistencia demo en `localStorage`.
- Esquema futuro de Supabase en `supabase/`.
- Despliegue en Vercel.

## Módulos
- `src/app.js`: interfaz, formularios, navegación y tutorial.
- `src/clinical.js`: pacientes, medicamentos, dosis, mediciones, seguridad y citas.
- `src/practice.js`: identidad de clínica, imágenes, recetas, recordatorios, usuarios y permisos.
- `src/data.js`: seed y normalización compatible.
- `src/utils.js`: fechas, analíticas y exportaciones.

## Comandos obligatorios
```bash
npm install
npm run dev
npm run check
npm run build
```

## Reglas
1. No introducir datos reales de pacientes, credenciales ni secretos.
2. No exponer una clave Supabase `service_role` en el frontend.
3. Usar lenguaje prudente: “cambio observado”, “asociación temporal”, “requiere revisión”.
4. No presentar porcentajes como eficacia causal del medicamento.
5. Conservar fecha, dosis previa, dosis nueva y motivo en cada ajuste.
6. Mantener la vista de secretaría más simple y respetar permisos.
7. Mantener accesibilidad para usuarios de mayor edad: texto legible, botones claros y acciones principales visibles.
8. Las animaciones deben ser discretas y respetar `prefers-reduced-motion`.
9. Ejecutar `npm run check` antes de dar una tarea por terminada.
10. No borrar seed, SQL, scripts de instalación o documentación sin justificación.
11. Para cambios grandes, usar una rama y resumir archivos, pruebas, riesgos y migraciones.

## Paleta
- Milk: `#FCFDF6`
- Ceil: `#8FACCB`
- Dark Midnight Blue: `#05316E`

## Próxima arquitectura
Migrar gradualmente a Supabase Auth/PostgreSQL/RLS/Storage. No mezclar esa migración con cambios cosméticos pequeños. La demo local y la implementación multiusuario deben mantenerse separadas hasta que la segunda esté validada.
