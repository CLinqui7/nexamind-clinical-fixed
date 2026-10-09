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
5. Verificar conteos y huella de medicamentos idénticos antes/después, lectura del resumen por propietario y denegación a Secretaría. Después publicar el commit ya subido a GitHub en Vercel y comprobar el dominio productivo.

La contraseña de la cuenta del médico, la conexión temporal, los respaldos y los expedientes nunca se guardan en Git. Una prueba aislada o un despliegue de frontend, por sí solos, no prueban que un paciente real haya confirmado un tratamiento.
