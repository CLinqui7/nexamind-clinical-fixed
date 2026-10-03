# Mapeo campo por campo FoxPro → Linkare

Los campos administrativos se guardan en `patient_admin` o en historia privada con alcance `administrative`. Los memos y datos sensibles se guardan en `linkare_private.legacy_history_v1` con alcance `clinical`. Ningún campo fuente activa recordatorios, citas, medicamentos o integraciones.

## `t_clientes`

| Campo FoxPro | Destino | Regla |
|---|---|---|
| `ID_CLIE` | identidad privada + UUID destino | Entero positivo; UUID determinista por organización/sistema/tabla/ID. Ausente: cuarentena |
| `FECHA_INIC` | `historicalProfile.registeredOn` | Solo fecha plausible; valor original se conserva en `sourceDates` |
| `FECHA_ACTU` | `historicalProfile.sourceUpdatedOn` | Igual; no se convierte en “última visita” |
| `NOM_CLI`, `APE_CLI1`, `APE_CLI2` | `patient_admin.name` | Unión normalizada. Ausente con ID válido: “Nombre no registrado (fuente histórica)” y `nameMissing=true` |
| `EDAD` | `patient_admin.age` | 1–130; cualquier otro valor queda `null` |
| `ESTA_CIVIL` | `historicalProfile.civilStatus` | Administrativo, sin inferencia |
| `PROFESION_` | `historicalProfile.profession` | Administrativo, sin inferencia |
| `RELIGION` | historia `clinical` | Contexto histórico privado; no se proyecta a Secretaría |
| `DIRECCION_` | `historicalProfile.address` | Administrativo histórico |
| `TELE_CASA`, `TELE_OFICI`, `TELE_CEL` | perfil histórico; `phone` toma el primero disponible celular/casa/oficina | Se conservan por separado |
| `REFERIDO_P` | `historicalProfile.referredBy` | Texto administrativo histórico |
| `TRATAMIENT` | historia `clinical.payload.text` | Verbatim; `treatmentStatus=unknown`; nunca medicamento activo |
| `CITA_PROGR` | `historicalProfile.scheduledAppointmentText` | Texto histórico; no crea cita |
| `PROXIMA_CI` | `historicalProfile.nextAppointmentDate` + valor fuente | No alimenta `nextVisit`; no se inventa hora |

Todos los pacientes históricos quedan con `risk=unrecorded`, `status=unrecorded`, `vitalStatus=unconfirmed`, adherencia/funcionamiento/última visita en `null` cuando no constan, y recordatorios desactivados sin consentimiento inferido.

## `t_mov_diarios`

| Campo FoxPro | Destino | Regla |
|---|---|---|
| `CODIGO` | identidad privada del movimiento | Preferido como clave; sin truncamiento |
| `ID_CLIE` | `patient_id` por ledger | Debe resolver a paciente importado; de lo contrario, cuarentena |
| `FECHA_ACTU` | `occurred_on` + `payload.sourceDate` | Solo fecha; valores inválidos/implausibles se conservan como evidencia sin normalizar |
| `TRATAMIENT` | evento separado `clinical.payload.text` | Verbatim; estado terapéutico desconocido |
| `PROXIMA_CI` | evento `administrative` | Fecha histórica; `schedulingSemantics=date_only_not_appointment` |
| `PASO_CONSU` | `payload.passedConsultation` | `true`, `false` o `null`; no se fuerza `false` |
| `ID_BANCO` | `bankId` + `bankName` | Resuelve contra bancos activos cuando existe |
| `NUME_CHEQU` | `checkNumber` | Histórico administrativo |
| `VAL_CHEQUE` | `checkAmount` | Se preserva como decimal fuente |
| `VAL_CONSUL` | `consultationAmount` | Se preserva como decimal fuente |

## `t_esta_cli`

| Campo FoxPro | Destino | Regla |
|---|---|---|
| `ID_CLIE` | `patient_id` por ledger | Huérfano: cuarentena |
| `ANO_CLI`, `MES_CLI`, `DIA_CLI` | `sourceDateParts`; `occurred_on` solo si es fecha utilizable | No se rellena ningún fragmento faltante |
| `NUM_VIS` | `payload.visitNumber` | Histórico administrativo |
| `TOTPACI_PA` | `payload.patientTotal` | Histórico administrativo; no se transforma en cobro moderno |

## Tablas de referencia y operación

| Tabla/campo | Disposición |
|---|---|
| `t_bancos.ID_BANCO`, `NOM_BANCO` | Lookup consumido para enriquecer movimientos; filas borradas quedan marcadas como tales |
| `t_correlativo.CODIGO`, `ID_CLIE`, `ID_BANCO` | Referencia operativa auditada; no controla secuencias modernas |
| `t_tablas.NOMBRE`, `DESCRIPCIO` | Referencia operativa auditada; no crea configuración paralela |
| `t_usuarios.USUARIO`, `NIVEL` | Excluidos: no se crean cuentas ni permisos desde el sistema anterior |
| `t_usuarios.CLAVE` | Excluido de forma absoluta: nunca se migra, reporta ni persiste |

## Borrados, objetos desconocidos y bytes especiales

- Las filas con marcador DBF de borrado no se importan; se contabilizan en el ledger.
- Toda tabla no canónica entra en cuarentena y aparece en la conciliación.
- Un NUL incrustado en un memo se representa como `␀`, porque PostgreSQL JSON no admite `U+0000`; el hash fuente y el contador de calidad conservan trazabilidad.
- Los archivos `.bak`/`.tbk` no son fuente canónica.
