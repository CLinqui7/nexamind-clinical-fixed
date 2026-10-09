# Revisión clínica de medicamentos históricos

Este cambio no repite la carga FoxPro ni transforma automáticamente anotaciones antiguas en tratamientos activos. En la organización propietaria de `clinicafortinmagana@gmail.com` el lote fuente `b121a91d-c2cc-4685-9b56-9856d1689924` ya está completado. Las menciones históricas permanecen en `linkare_private.legacy_medication_mentions_v1` y las notas textuales en `legacy_history_v1`.

## Flujo y límites

- La pestaña **Medicamentos** presenta la mención histórica y el texto original. El médico propietario o un doctor con `clinicalView` y `medicationsManage` puede pulsar **Verificar medicamento**.
- **No, solo histórico** marca esa mención como no vigente, sin alterar el expediente moderno. **Sí, incorporar medicamento** exige una casilla de confirmación de uso actual y nombre, dosis, unidad, frecuencia y vía confirmados. La fecha de inicio es opcional y no se infiere de la nota FoxPro.
- El RPC `linkare_review_legacy_medication_v1` comprueba organización, paciente, membresía, permiso, mención y duplicados; actualiza el expediente y la revisión en una sola transacción, con auditoría e idempotencia. Secretaría y Enfermería no pueden ejecutarlo. No se cambia ningún medicamento previo ni la selección del medicamento principal.
- Cada decisión aplica a **una mención**, no a todas las ocurrencias agrupadas. La procedencia del nuevo medicamento (`sourceMentionId`, `sourceHistoryId`, `sourceBatchId`) es inmutable. Las anotaciones originales nunca se editan.
- La revisión clínica no envía mensajes, crea citas ni recetas. Las menciones ambiguas o no reconocidas siguen en el texto histórico para evaluación humana.

## Verificación y publicación

1. `npm run check` y `node qa/browser/legacy-history.mjs` con `node qa/browser/server.mjs` en una base sintética aislada. El caso SQL comprueba permisos, confirmación, duplicados, inmutabilidad y preservación del tratamiento existente.
2. Ejecutar `phase3-production-control.ps1 -Mode preflight` para el correo exacto y hash del ZIP. Comprobar lote y organización; no elegir la primera organización disponible.
3. Generar respaldo lógico actual cifrado con `backup-production.ps1` fuera de Git y comprobarlo mediante `verify-backup-restore.ps1`. Nunca incluir los JSON de respaldo ni los reportes privados en el repositorio.
4. No usar `supabase db push --include-all`: el historial remoto omite antiguas migraciones locales. Aplicar **solo** `20261009054502_historical_medication_clinician_review.sql`, junto con su fila de historial, mediante `deploy-legacy-medication-review.ps1 -Mode apply -PreflightReport ... -RestoreReport ...`.
   El inicio de sesión temporal del CLI asume `postgres` únicamente durante esta conexión para poder validar `auth.users` y la referencia de auditoría; el script no imprime ni persiste su contraseña.
5. Verificar conteos y huella de medicamentos idénticos antes/después, lectura del resumen por propietario y denegación a Secretaría. Después publicar el commit ya subido a GitHub en Vercel y comprobar el dominio productivo.

La contraseña de la cuenta del médico, la conexión temporal, los respaldos y los expedientes nunca se guardan en Git. Una prueba aislada o un despliegue de frontend, por sí solos, no prueban que un paciente real haya confirmado un tratamiento.

## Resultado productivo verificado (2026-10-09)

- Código publicado primero en GitHub, rama `codex/foxpro-structured-migration`, commit funcional `cd75365476ba2d81a1c9bae2669ed05d5f0b83c5` (incluye el flujo y el ajuste del rol temporal del despliegue).
- Destino comprobado por el correo exacto `clinicafortinmagana@gmail.com`: propietario activo de “Clinica Fortin Magaña”, organización `2ca5b8d4-d711-4ec7-833a-9d018ef067ca`. No se cambió su cuenta, contraseña, rol ni permisos.
- Respaldo lógico previo cifrado con DPAPI, fuera de Git: `%TEMP%\linkare-clinician-review-backup-20261008\production-logical-backup.dpapi`, SHA-256 cifrado `ff60ca36d4e9c10908091deb3d2d187aba10d7bd22ccde1e3e4bbab36b644a71`. Restauración aislada comprobada: 42 tablas, 334,726 filas y cero diferencias de conteo. Está ligado al usuario de Windows que lo cifró; no reemplaza la política de respaldos periódicos de la plataforma.
- Migración `20261009054502` aplicada y registrada de forma atómica, sin `db push --include-all`. Antes/después: 5,372 pacientes, 140,202 entradas históricas, 46 expedientes clínicos modernos, 132 medicamentos modernos y 63,911 menciones históricas del consultorio principal; huella de medicamentos idéntica. Las 63,911 menciones siguen `unreviewed`: **ningún tratamiento fue activado automáticamente**.
- El RPC de resumen devolvió el identificador de la mención al propietario y rechazó a Secretaría. `npm run check`: 169 pruebas y build satisfactorios. Playwright aislado: 13 comprobaciones, incluida confirmación explícita, persistencia tras recarga y bloqueo para Secretaría.
- Vista previa protegida `dpl_7TyJGr7J4odxLCYQ68m5zD65PpmT` verificada con `vercel curl`: HTML y JavaScript contenían el botón y RPC nuevos. Promovida a `https://nexamind-clinical.vercel.app`; alias productivo `dpl_FbxNZf7HjjW3BFBAmkj8hDqiHgYd`, estado Ready, sirve el nuevo archivo `index-CCJjQ2bp.js` y no el anterior.
- No se hizo una sesión de navegador productivo con un expediente real ni se aprobó un medicamento real: esa decisión corresponde al médico tras verificar su uso actual. El ensayo visual fue sintético y la comprobación productiva de permisos fue de solo lectura.
