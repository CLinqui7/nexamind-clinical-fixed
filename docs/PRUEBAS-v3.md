# Pruebas de esta entrega

## Ejecutadas

- 28/28 pruebas unitarias y de handlers: identidades vacías, permiso restrictivo de secretaría, catálogos 40/220/400, meses calendario, firma de notas, preservación literal de notas firmadas, archivo documental, diferencias por recurso, cola serial y conflicto.
- Los handlers reales, transpilados desde TypeScript y atados a SHA-256, rechazan ausencia de sesión, membresía inactiva y secretaría intentando cobrar/invitar. Ignoran el importe enviado por el cliente, reutilizan el enlace existente y rechazan webhooks sin firma, con otra app o no productivos. Las respuestas de base/SDK/proveedor son simuladas.
- 12/12 comprobaciones de Chromium con React/HTM reales: login sin accesos demo, recuperación, registro, navegación médica, secretaría sin datos clínicos en su vista, lectura de notas firmadas, borrador/firma, conflicto que conserva texto, invitación individual, planes, móvil y cierre de sesión.
- Sintaxis JavaScript, imports locales y métodos de clase comprobados. Transpilación sintáctica de 23 archivos TypeScript.

Informes reproducibles en `qa/results`. El harness de navegador usa imports data porque la política del contenedor bloquea navegación, incluso localhost. No simula que se ejecutó Vite. No contacta pacientes, no envía correos y no cobra tarjetas.

## Pendientes en infraestructura propia

- `npm ci`/build Vite no pudo ejecutarse aquí: acceso al registro npm no disponible. El instalador exige el build real antes de aceptar los cambios. No afirmar `VITE_BUILD_OK` basándose en parseo.
- Migración, RLS, Storage y RPCs no fueron ejecutados en PostgreSQL. Usar `PRECHECK-v3.sql`, staging, `qa/sql/staging-smoke.sql` y `POSTCHECK-v3.sql`.
- Confirmación e invitación de correo con SMTP, roles desde API con JWTs reales de dos consultorios y documento privado.
- Flujo real Wompi: orden, enlace, pago, webhook y vigencia idempotente.
- Proveedores de recordatorio, Google OAuth y calendario Apple en dispositivos reales.
- Selenium alternativo incluido, no ejecutado en este entorno.

Pasar pruebas con mocks no demuestra conformidad normativa ni funcionamiento completo del entorno remoto. El paquete permite instalar y verificar la implementación; no declara el despliegue ya completado.
