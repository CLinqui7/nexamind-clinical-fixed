# AGENTS.md — NexaMind Clinical

## Objetivo
Construir una plataforma profesional de seguimiento farmacoterapéutico y agenda para psiquiatría. El producto es apoyo a decisiones, no diagnostica, prescribe ni atribuye causalidad automática.

## Stack actual
- React 18 con HTM y Vite.
- JavaScript ES modules.
- CSS propio responsive.
- Seed sintético en `src/data.js`.
- Esquema futuro de Supabase en `supabase/`.
- Despliegue previsto en Vercel.

## Comandos obligatorios
```bash
npm install
npm run dev
npm run check
npm run build
```

## Reglas
1. No introducir datos reales de pacientes ni secretos.
2. No exponer claves `service_role` en frontend.
3. Mantener lenguaje clínico prudente: “cambio observado”, “asociación temporal”, “requiere revisión”.
4. No mostrar porcentajes como eficacia causal del medicamento.
5. Conservar experiencia responsive en móvil y escritorio.
6. Antes de terminar una tarea, ejecutar `npm run check`.
7. No eliminar seed, SQL o documentación sin justificarlo.
8. Para cambios grandes, trabajar en una rama Git y resumir archivos modificados, pruebas y riesgos.

## Próxima arquitectura
Migrar gradualmente a Next.js + Supabase Auth/PostgreSQL/RLS cuando el prototipo visual sea aprobado. No mezclar esa migración con cambios cosméticos menores.
