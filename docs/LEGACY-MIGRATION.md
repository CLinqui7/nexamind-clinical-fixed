# Migración histórica FoxPro

La migración ya no es una carga JSON a staging. El flujo actual lee el ZIP FoxPro canónico, valida DBF/FPT y CRC, mapea cada campo, importa por RPC transaccional al modelo final, conserva un ledger privado, permite reanudar/verificar/recuperar y muestra el historial bajo demanda en el dashboard.

Documentación operativa:

- [Auditoría previa](migration/PRE_MIGRATION_AUDIT.md)
- [Mapeo campo por campo](migration/FIELD_MAPPING.md)
- [Runbook y puerta de aprobación](migration/RUNBOOK.md)

El modo predeterminado es `dry-run` y no abre una conexión de base de datos. Los modos `apply`, `verify` y `rollback` exigen credenciales de servicio y un archivo privado de aprobación que coincida exactamente con organización, respaldo, plan y commit.

No se ha aplicado esta migración a producción. La verificación de la organización propietaria y del esquema realmente desplegado sigue siendo una condición bloqueante de la puerta final.
