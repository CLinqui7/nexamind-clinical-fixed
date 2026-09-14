# Linkare 3.0.0

Gestión del consultorio con Supabase Auth, cuentas individuales y separación entre datos administrativos y clínicos. Basado en el ZIP `Linkare-Codigo-Actual-20260908-225532.zip` del usuario (base Git `0e3499ac723d211480ce5d21dd4ad29f9a7a68a0`).

## Inicio

Node 24 recomendado. `npm ci --include=dev`, configurar `.env.local` según `.env.example`, `npm run check`, `npm run dev`. Se usa el puerto 4173. La aplicación requiere una base con la migración v3; no se inicializan pacientes, cuentas ni contraseñas de prueba.

## Guías

- `docs/DESPLIEGUE-v3.md`: orden de migración y publicación, invitaciones, secretos e integraciones.
- `docs/ARQUITECTURA-v3.md`: límites y controles de acceso.
- `docs/PRUEBAS-v3.md`: comprobaciones realizadas y pendientes, sin certificaciones ficticias.
- `supabase/PRECHECK-v3.sql`, migración `202609080001_linkare_v3.sql`, `supabase/POSTCHECK-v3.sql`.
- `qa/sql/staging-smoke.sql`: pruebas transaccionales de permisos e idempotencia para ejecutar en staging.

## Planes

US$40 por 1 mes, US$220 por 6 meses o US$400 por 12 meses. Mismas funciones, distinta modalidad. Renovación manual por Wompi El Salvador; no se debita una tarjeta automáticamente. El servidor toma importe/duración del catálogo y la firma del webhook no sustituye la comprobación de importe, referencia e idempotencia.

## Alcance de esta entrega

Código de la implementación, no un despliegue ya realizado. El paquete no contiene claves, usuarios reales, base de datos ni node_modules. Se debe ejecutar la migración primero en un entorno de pruebas y validar Auth, Storage, permisos y pagos en infraestructura propia antes del corte definitivo. No es una certificación regulatoria, una firma electrónica cualificada ni un sistema offline.

Las pruebas unitarias usan fixtures aislados y las pruebas de navegador usan respuestas simuladas de Supabase. Las cuentas de QA nunca se importan en el frontend ni se crean en producción.
