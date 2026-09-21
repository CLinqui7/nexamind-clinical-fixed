# Ciclo de vida de recetas

## Regla principal

Una receta nunca se elimina. Puede estar `active` o `voided`. La anulación requiere un motivo y conserva el número, la fecha, el contenido, el historial de correcciones y el autor original.

## Creación y corrección

Solo `prescriptionsCreate` permite emitir una receta nueva. `prescriptionsEdit` permite corregir una receta activa existente a Doctor y Secretaría. El servidor mantiene `createdBy`, aumenta `revision` y agrega en `history` la versión previa con `correctedBy` y `correctedAt`. No se puede cambiar la identidad de la receta ni retirar una receta del arreglo.

Los renglones copiados desde medicamentos son instantáneas. Mantienen `sourceMedicationId` como referencia, pero nombre, dosis, frecuencia e indicaciones impresas no cambian cuando cambia el tratamiento.

## Anulación

Doctor o Secretaría con `prescriptionsEdit` pueden anular una receta activa. Deben escribir un motivo. La base fija `status=voided`, `voidedBy` y `voidedAt`; ignora autor y hora enviados por el cliente. Una receta anulada queda visible, no puede editarse ni reactivarse y puede imprimirse únicamente con la marca grande `RECETA ANULADA` y el motivo.

## Impresión y privacidad

La impresión incluye clínica, profesional, licencia, paciente, fecha, medicamentos, indicaciones generales y espacio de firma y sello. `observations` es un campo interno y nunca se imprime. Las recetas anuladas siempre llevan la marca de anulación.

## Compatibilidad

Las recetas archivadas por versiones anteriores se interpretan como anuladas y permanecen inmutables. La migración retira el disparador anterior de archivo y lo sustituye por el ciclo de vida de anulación, sin borrar datos históricos.
