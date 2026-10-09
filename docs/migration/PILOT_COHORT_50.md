# Cohorte piloto FoxPro de 50 expedientes

Esta herramienta copia una cohorte clínica **real** solo cuando el dueño autoriza expresamente que el consultorio de destino y sus miembros activos accedan a ella. El origen es el ZIP inmutable de FoxPro; nunca se guarda en Git. La cohorte es adicional al lote completo ya importado al consultorio de origen y no mueve, borra ni modifica sus registros.

## Identidad y alcance

- Proyecto Supabase: `fvucylgrqgxjqabacnlt`.
- Origen: Clínica Fortín Magaña; destino: consultorio Linkare del usuario `linquicarloss@gmail.com`.
- Fuente: respaldo SHA-256 `f0054f84d8ade9bfb0c7e5551d99818cf14b9131f75dca06d0b70769b6197de9`.
- Fuente lógica del piloto: `foxpro-linkare-pilot50`, separada de `foxpro-linkare` para que el ledger del consultorio original siga intacto.
- Selección determinista: 25 pacientes con evidencia de medicamentos y actividad más reciente, más 25 de los más antiguos con evidencia de medicamentos. Cada paciente conserva todas sus filas vinculadas de movimientos y estadísticas, sin incluir las de terceros.
- Menciones de medicamentos: evidencia histórica no verificada, **no** tratamiento activo ni receta. No se crean citas, mensajes ni recordatorios.
- Un futuro importador de **todo** el respaldo al mismo destino debe conciliar esta fuente piloto antes de ejecutarse; no se debe correr otro importador que duplique los 50 pacientes.

## Controles de aplicación

1. Comprobar correo, membresía activa, rol y nombre exacto de ambas organizaciones. Confirmar el acceso de los otros miembros activos del destino.
2. Hacer respaldo lógico cifrado actual y restaurarlo en una base aislada. Guardar el informe de restauración fuera del repositorio.
3. Ejecutar `scripts/legacy-migration.mjs` con `--source foxpro-linkare-pilot50 --cohort-size 50 --mode dry-run`. El informe agregado no debe incluir nombres, teléfonos ni texto clínico.
4. Ensayar importación y enriquecimiento en la restauración aislada con `scripts/verify-backup-restore.ps1`, usando `-EnrichmentSourceSystem foxpro-linkare-pilot50 -EnrichmentCohortSize 50`.
5. Registrar `batch_id` y archivo privado de aprobación con `organizationId`, `backupSha`, `planSha` y `commitSha`. La aprobación de los miembros que pueden ver la copia debe constar por separado.
6. Aplicar con `scripts/run-pilot-cohort.ps1 -Mode apply`; repetir el mismo comando y lote para reanudar. `-Mode verify` concilia ledger, pacientes, historia y huérfanos.
7. Ejecutar `scripts/legacy-medication-enrichment.mjs` con la misma fuente y cohorte, solo después de pasar su puerta de restauración aislada; verificar menciones y permisos.
8. Comparar los 13 pacientes preexistentes del destino por ID, revisión y hash antes/después. Verificar los conteos del origen también.
9. Probar en navegador búsqueda, apertura, historia y medicamentos de un caso reciente y otro antiguo. No usar nombres ni capturas con datos clínicos en GitHub o reportes públicos.

El rollback automatizado solo es seguro mientras no existan cambios modernos dependientes ni se haya enriquecido; antes de intentarlo, verificar las referencias de medicamentos y el fingerprint. Conservar el respaldo cifrado y usar recuperación selectiva si los pacientes piloto fueron editados.

## Resultado del piloto autorizado (2026-10-08)

- Destino verificado: `f5cf65b6-284d-4454-9285-4035b90f7db7`, propiedad del usuario `2145feac-5306-494a-bb06-cd1d227d162f`. La copia real a sus tres miembros activos fue autorizada en el chat antes de escribir.
- Lote: `8319278d-16f4-41d7-ae54-5b90330548a6`; plan SHA-256: `d8059306fe140fe327645bddf2568f2bb62084f98a5591e204b279381ac73cbb`.
- Respaldo lógico actual restaurado en PostgreSQL aislado: 42 tablas, 325,529 filas, cero diferencias de recuento. En esa restauración también se ensayó la cohorte completa y su enriquecimiento de medicamentos.
- Aplicación conciliada: 50 fichas, 2,513 filas de origen, 3,711 entradas históricas, cero huérfanos, cero citas/avisos/tratamientos activos creados.
- Medicamentos: 2,771 menciones históricas no verificadas de 1,230 textos fuente; 304 textos no permitieron extracción estructurada y siguen íntegros en la historia. Ninguna mención se activó como tratamiento actual.
- Antes/después: 13 pacientes del destino pasaron a 63. Se compararon por fingerprint los 5,564 registros preexistentes de ambos consultorios: cero modificados, cero faltantes, cero colisiones con el piloto.
- Permisos: la cuenta propietaria pudo leer las menciones clínicas; la secretaria activa no pudo consultarlas.
- Las capturas de navegador y los informes detallados permanecen privados fuera de GitHub; no se publican datos de pacientes reales.

## Verificación visual y publicación

- El frontend con la corrección del contador de historia paginada y el estado vacío de tratamientos actuales se publicó en Vercel como despliegue `dpl_2Z3shqpocaFZfCv5r8tZ8t7J9EQV` y se promovió al dominio principal `https://nexamind-clinical.vercel.app`. El dominio sirvió el bundle `/assets/index-CvcOcYmH.js` tras la promoción.
- `qa/browser/production-cohort.mjs` pasó en el dominio principal con la cuenta propietaria: búsqueda individual de un paciente reciente y uno antiguo, apertura del expediente, lectura de historia clínica y de menciones históricas no verificadas, contador correcto de entradas paginadas y ausencia de errores JavaScript. Las capturas quedaron en almacenamiento temporal privado, no en Git.
- El dominio temporal del despliegue exige autenticación propia de Vercel y no fue usado como prueba clínica: la prueba autenticada se ejecutó sobre el dominio principal después de la promoción. No se cambió la protección del despliegue temporal.
- Esta prueba visual cubre dos muestras de la cohorte, no una revisión médica de las 2,771 menciones. Ninguna debe tratarse como medicación actual hasta que el profesional la verifique.
