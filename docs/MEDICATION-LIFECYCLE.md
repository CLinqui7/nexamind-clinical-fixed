# Ciclo de vida de medicamentos

## Estados

- `pending_review`: dato informado por el paciente y capturado por Secretaría; no es una prescripción.
- `active`: tratamiento revisado y activo.
- `suspended`: pausa reversible.
- `discontinued`: tratamiento descontinuado.
- `completed`: esquema completado.

Los medicamentos se conservan en `patient_clinical.payload.medications`. No se borran físicamente. Cada cambio agrega un evento con estado, dosis, frecuencia, autor y hora del servidor.

La acción visible **Eliminar** retira el medicamento del tratamiento activo mediante `linkare_archive_medication_v1`. El servidor fija `status=discontinued`, `archivedAt`, `archivedBy`, `archiveReason` y un evento `archived`; el registro aparece después en **Medicamentos eliminados**. Esto también funciona con medicamentos heredados que todavía no tenían identificador o metadatos de creación.

## Captura por Secretaría

La RPC `linkare_capture_medication_v1` exige membresía activa, acceso gratuito/vigente, `patientsView` y `medicationsCapture`. Valida el paciente y el tamaño del dato, bloquea el expediente, genera el identificador y fuerza `source=secretary_report`, `status=pending_review`, `createdBy` y `createdAt`. Secretaría solo recibe una proyección de esas capturas: nombre, dosis, frecuencia, vía, fecha y nota informada. No recibe diagnóstico, consultas, notas clínicas ni otros medicamentos.

El médico con `medicationsManage` revisa la captura y puede activarla. El servidor fija `reviewedBy`, `reviewedAt` y el evento `approved`. Cambiar dosis, frecuencia o estado conserva el registro previo en `events` y `doseHistory`. La vista administrativa de Secretaría presenta únicamente capturas todavía `pending_review`.

## Frecuencias

El formulario conserva el texto clínico y la estructura `frequencySlots` para mañana, mediodía, tarde y noche. `customFrequency` guarda una indicación distinta sin reemplazar el texto impreso.

## Recetas

Copiar un medicamento activo a una receta crea una instantánea. Los cambios posteriores al tratamiento no reescriben la receta. Un medicamento escrito manualmente solo se agrega al tratamiento si el usuario marca esa opción y tiene `medicationsManage`.

## Auditoría y reversión

Las capturas generan `medication.captured` y el retiro genera `medication.archived` en `linkare_audit_v3`; los demás guardados conservan el fingerprint y la revisión optimista del expediente. La compatibilidad de identidad acepta medicamentos antiguos sin `createdAt` o `createdBy`, pero sigue rechazando cambios de esos campos cuando ya existen. La migración es aditiva. Para una corrección se debe crear otra migración; no se debe eliminar el historial.
