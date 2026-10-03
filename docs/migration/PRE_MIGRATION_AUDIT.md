# Auditoría previa de migración FoxPro

Fecha de auditoría: 2026-10-03. Esta auditoría no autoriza ni ejecuta una escritura en producción.

## Identidad y estado del código

- Repositorio: `CLinqui7/nexamind-clinical-fixed`.
- Rama base revisada: `main`.
- SHA base y `origin/main` al iniciar: `4ea1e6b8d4de820255edc1e57873319fad2fea36`.
- Rama de trabajo: `codex/foxpro-historical-migration`.
- El checkout se creó desde GitHub en una carpeta nueva; no se reutilizó una copia local anterior.
- La revisión base no tenía cambios posteriores en `main` al momento de clonar.
- El último trabajo de GitHub Actions no llegó a ejecutar pasos: GitHub informó que la cuenta estaba bloqueada por facturación. No fue un fallo de pruebas del repositorio.

## Integridad de las entradas

| Entrada | SHA-256 | Resultado |
|---|---|---|
| Paquete técnico sin pacientes | `0178c512e40113b2d9193ed592b44c36ec4680645cb31d6c67c623fc5046b0cf` | Leído; prompt, revisión y evidencias inspeccionados |
| Respaldo FoxPro | `f0054f84d8ade9bfb0c7e5551d99818cf14b9131f75dca06d0b70769b6197de9` | Coincide con el hash esperado; ZIP y CRC verificados |
| Prompt maestro externo | `db489dadaa61f41f6d770382189154ed2d3654a70bb88585835ae7a74deb7099` | Idéntico byte por byte al incluido en el paquete |

El respaldo se leyó directamente y no se extrajo dentro del repositorio. Ningún nombre, memo, identificador fuente ni fila clínica se incluyó en fixtures, commits o informes públicos.

## Inventario conciliado

| Tabla | Físicas | Borradas | Importables | Cuarentena | Referencia/excluidas |
|---|---:|---:|---:|---:|---:|
| `t_clientes` | 5,349 | 1 | 5,347 | 1 | 0 |
| `t_mov_diarios` | 46,286 | 40 | 46,141 | 105 | 0 |
| `t_esta_cli` | 47,148 | 0 | 46,837 | 311 | 0 |
| `t_bancos` | 20 | 3 | 0 | 0 | 17 |
| `t_correlativo` | 1 | 0 | 0 | 0 | 1 |
| `t_tablas` | 5 | 0 | 0 | 0 | 5 |
| `t_usuarios` | 4 | 0 | 0 | 0 | 4 excluidas |

Total físico conciliado: 98,813 filas. Destino del ensayo: 5,347 fichas, 92,978 eventos administrativos y 47,224 eventos clínicos históricos.

Hallazgos de calidad: 22 nombres ausentes preservados como valor desconocido explícito, 1 paciente sin identificador utilizable, 29 edades inválidas o ausentes, 13 fechas inválidas, 28 fechas implausibles, 105 movimientos sin paciente, 311 estadísticas sin paciente, 12 fechas estadísticas no utilizables y 13 filas con NUL FoxPro preservado como el marcador visible `␀`.

## Contraste con la aplicación y el esquema

El código base usa `public.linkare_records` con separación `patient_admin`/`patient_clinical`, control de revisiones, funciones `linkare_load_state_v3` y `linkare_save_changes_v3`, permisos por organización y calendarios Doctor, Esposa y General. La migración nueva se apoya en ese modelo y añade tablas privadas, no una segunda aplicación paralela.

Proyecto de referencia: `fvucylgrqgxjqabacnlt`; frontend: `https://nexamind-clinical.vercel.app`.

La comprobación autenticada del esquema desplegado sigue bloqueada:

- el conector Supabase respondió que el actor no tiene permiso para proyectos, migraciones, tablas, ramas y funciones;
- el perfil Chrome autorizado existe, pero no pudo reutilizarse mientras otra instancia lo mantiene bloqueado y no expone CDP;
- el frontend respondió correctamente y contiene una clave publicable válida, pero Supabase exige ahora una clave secreta para el catálogo OpenAPI (`401 Secret API key required`).

Por ello, la organización propietaria real, el UUID del consultorio y la versión de migraciones desplegada son condiciones obligatorias pendientes de la puerta final. No se intentó eludirlas ni se abrió ninguna fila de pacientes.

## Defectos reproducidos y correcciones

| Defecto previo | Corrección |
|---|---|
| Solo JSON y staging, sin importación final | Lector ZIP/DBF/FPT, plan campo por campo y RPC transaccional al modelo final |
| `raw_payload` y previews con datos personales | Informes públicos exclusivamente agregados; datos clínicos solo en memoria y esquema privado |
| Colecciones desconocidas omitidas | Toda tabla/fila recibe disposición; tablas desconocidas van a cuarentena |
| UUID permisivo y IDs truncados | UUID estricto; identidades deterministas sin truncar el material fuente |
| Huérfanos aceptados | Relaciones inválidas quedan en cuarentena y se verifican huérfanos en servidor |
| Dos POST masivos sin checkpoint | Lotes de 100, ledger privado, reanudación idempotente y bloqueo por identidad |
| Conteo importado calculado por cliente | Conciliación derivada de tablas destino y ledger del servidor |
| Defaults clínicos inventados | Perfil histórico conserva `null`/`unrecorded`/`unconfirmed`; recordatorios desactivados |
| Movimientos convertibles a citas | Se guardan como historia de fecha solamente; `nextVisit` permanece vacío |
| Memos convertibles a tratamiento activo | Texto verbatim de solo lectura con `treatmentStatus=unknown`; no se crea `patient_clinical` |
| Ausencia parcial interpretada como borrado | `diffRecords` admite colecciones incompletas sin emitir eliminaciones |
| Cancelar podía modificar campos ocultos | Guard SQL impide cambios distintos de metadatos de cancelación sin permiso Edit |

## Ensayo aislado

El respaldo completo se cargó en PostgreSQL PGlite en memoria usando las migraciones reales del repositorio. Resultado:

- 98,813/98,813 filas conciliadas;
- 5,347/5,347 pacientes visibles por `linkare_load_state_v3`;
- 140,202 eventos históricos; 0 huérfanos;
- una ficha muestreada conservó el marcador histórico y devolvió historial por el RPC del dashboard;
- 0 citas, 0 notificaciones, 0 tratamientos activos y 0 registros `patient_clinical` creados;
- reanudación, segregación por permisos y rollback probados también con datos sintéticos.

El informe público del ensayo no contiene datos de pacientes. Este ensayo valida lógica y volumen, pero no sustituye una rama Supabase autorizada con la configuración exacta de producción.

## Bloqueos para producción

No aplicar hasta resolver en una sola aprobación:

1. confirmar el UUID y nombre visible de la organización propietaria;
2. confirmar el esquema y las migraciones desplegadas en `fvucylgrqgxjqabacnlt`;
3. ejecutar la migración SQL y repetir el ensayo en una base Supabase aislada autorizada;
4. generar el `planSha` definitivo con el UUID real;
5. revisar las 417 cuarentenas y aceptar explícitamente los 22 nombres ausentes;
6. crear y verificar el respaldo previo del destino;
7. aprobar commit, hash del respaldo, ventana de corte y procedimiento de recuperación.
