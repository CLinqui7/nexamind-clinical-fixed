import crypto from 'node:crypto';

export const CANONICAL_TABLES=Object.freeze(['t_clientes','t_mov_diarios','t_esta_cli','t_bancos','t_correlativo','t_tablas','t_usuarios']);
const STRICT_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function stableJson(value){
  if(Array.isArray(value))return `[${value.map(stableJson).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>`${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
export function deterministicUuid(...parts){
  const hex=sha256(parts.join('\u001f'));
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-${((parseInt(hex[16],16)&3)|8).toString(16)}${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
export function isStrictUuid(value){return STRICT_UUID.test(String(value||''));}

const text=value=>typeof value==='string'?value.trim():'';
const memo=value=>typeof value==='string'&&value.trim()?value:null;
const positiveId=value=>Number.isSafeInteger(Number(value))&&Number(value)>0?String(Number(value)):null;
const present=value=>value!==null&&value!==undefined&&value!=='';
const rawValue=value=>value&&typeof value==='object'?(value.invalid??value.invalidMemoPointer??null):value;
const hasNulMarker=value=>Object.values(value||{}).some(item=>typeof item==='string'&&item.includes('\u2400'));
const dateRange=(value,issues,field)=>{
  if(!value)return null;
  if(typeof value!=='string'){
    issues.push({code:'invalid_date',field});return null;
  }
  const year=Number(value.slice(0,4)),maxYear=new Date().getUTCFullYear()+2;
  if(year<1900||year>maxYear){issues.push({code:'implausible_date',field});return null;}
  return value;
};
const initials=name=>name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join('');

function aggregate(){return {physical:0,deleted:0,imported:0,quarantined:0,excluded:0,reference:0};}
function increment(report,table,disposition){
  const target=report.tables[table]||(report.tables[table]=aggregate());
  if(disposition==='deleted_source')target.deleted+=1;
  else if(disposition.startsWith('quarantine_'))target.quarantined+=1;
  else if(disposition.startsWith('import_'))target.imported+=1;
  else if(disposition.startsWith('reference_'))target.reference+=1;
  else target.excluded+=1;
  report.dispositions[disposition]=(report.dispositions[disposition]||0)+1;
}

function sourceRecord({organizationId,sourceSystem,backupSha,table,row,key,disposition,destinationKind=null,destinationId=null,payload=null,historyEntries=[]}){
  const sourceKeyHash=sha256(`${backupSha}\u001f${sourceSystem}\u001f${table}\u001f${key}`);
  return {
    sourceTable:table,
    sourceRow:row.__rowNumber,
    sourceKeyHash,
    sourceFingerprint:sha256(stableJson(row)),
    disposition,
    destinationKind,
    destinationId,
    payload,
    historyEntries,
    organizationId,
  };
}

function history({organizationId,sourceSystem,table,key,patientId,scope,occurredOn,title,payload}){
  return {id:deterministicUuid(organizationId,sourceSystem,table,key,scope),patientId,scope,occurredOn,title,payload};
}

export function buildLegacyPlan({tables,organizationId,sourceSystem='foxpro-linkare',backupSha}){
  if(!isStrictUuid(organizationId))throw new Error('ORGANIZATION_UUID_INVALID');
  if(!/^[a-f0-9]{64}$/i.test(String(backupSha||'')))throw new Error('BACKUP_SHA256_INVALID');
  if(!/^[a-z0-9][a-z0-9._-]{1,79}$/i.test(sourceSystem))throw new Error('SOURCE_SYSTEM_INVALID');
  const report={schemaVersion:2,mode:'dry-run',sourceSystem,organizationId,backupSha,tables:{},dispositions:{},qualityIssues:{},destination:{patients:0,administrativeHistory:0,clinicalHistory:0},notificationsCreated:0,appointmentsCreated:0,activeMedicationsCreated:0};
  for(const [name,table] of tables){report.tables[name]={...aggregate(),physical:table.rows.length};}
  const records=[],patientIds=new Map(),bankNames=new Map();
  const issue=code=>{report.qualityIssues[code]=(report.qualityIssues[code]||0)+1;};
  const add=record=>{records.push(record);increment(report,record.sourceTable,record.disposition);for(const entry of record.historyEntries||[])report.destination[entry.scope==='clinical'?'clinicalHistory':'administrativeHistory']+=1;};

  for(const row of tables.get('t_bancos')?.rows||[]){
    const id=positiveId(row.ID_BANCO),name=text(row.NOM_BANCO),key=id||`row:${row.__rowNumber}`;
    if(!row.__deleted&&id&&name)bankNames.set(id,name);
    add(sourceRecord({organizationId,sourceSystem,backupSha,table:'t_bancos',row,key,disposition:row.__deleted?'deleted_source':'reference_bank_lookup'}));
  }

  for(const row of tables.get('t_clientes')?.rows||[]){
    if(hasNulMarker(row))issue('nul_byte_preserved_as_marker');
    const legacyId=positiveId(row.ID_CLIE),key=legacyId||`row:${row.__rowNumber}`;
    if(row.__deleted){add(sourceRecord({organizationId,sourceSystem,backupSha,table:'t_clientes',row,key,disposition:'deleted_source'}));continue;}
    const sourceName=[text(row.NOM_CLI),text(row.APE_CLI1),text(row.APE_CLI2)].filter(Boolean).join(' ').replace(/\s+/g,' ');
    if(!legacyId){issue('patient_id_missing');add(sourceRecord({organizationId,sourceSystem,backupSha,table:'t_clientes',row,key,disposition:'quarantine_patient_id_missing'}));continue;}
    const nameMissing=!sourceName;
    if(nameMissing)issue('patient_name_missing');
    const name=sourceName||'Nombre no registrado (fuente histórica)';
    const patientId=deterministicUuid(organizationId,sourceSystem,'t_clientes',legacyId),dateIssues=[];
    const createdAt=dateRange(row.FECHA_INIC,dateIssues,'FECHA_INIC'),updatedAt=dateRange(row.FECHA_ACTU,dateIssues,'FECHA_ACTU'),nextVisit=dateRange(row.PROXIMA_CI,dateIssues,'PROXIMA_CI');
    for(const entry of dateIssues)issue(entry.code);
    const sourceAge=Number(row.EDAD),age=Number.isInteger(sourceAge)&&sourceAge>0&&sourceAge<=130?sourceAge:null;
    if(present(row.EDAD)&&age===null)issue('patient_age_invalid');
    const phone=[text(row.TELE_CEL),text(row.TELE_CASA),text(row.TELE_OFICI)].find(Boolean)||'';
    const payload={
      id:patientId,name,initials:initials(name),age,phone,email:'',nextVisit:null,
      dataQuality:'historical',
      sourceSummary:{system:'FoxPro',table:'t_clientes',hasHistoricalRecord:true},
      historicalProfile:{
        registeredOn:createdAt,sourceUpdatedOn:updatedAt,civilStatus:text(row.ESTA_CIVIL)||null,profession:text(row.PROFESION_)||null,
        address:text(row.DIRECCION_)||null,homePhone:text(row.TELE_CASA)||null,officePhone:text(row.TELE_OFICI)||null,mobilePhone:text(row.TELE_CEL)||null,
        referredBy:text(row.REFERIDO_P)||null,scheduledAppointmentText:text(row.CITA_PROGR)||null,
        sourceDates:{registered:rawValue(row.FECHA_INIC),updated:rawValue(row.FECHA_ACTU),nextAppointment:rawValue(row.PROXIMA_CI)},nextAppointmentDate:nextVisit,dateIssues,nameMissing,
      },
      notificationPreferences:{enabled:false,channels:[],reminderHours:[],consentStatus:'not_recorded'},
      createdAt,updatedAt,
    };
    const treatment=memo(row.TRATAMIENT),historyEntries=[];
    if(text(row.RELIGION))historyEntries.push(history({organizationId,sourceSystem,table:'t_clientes',key:`${legacyId}:context`,patientId,scope:'clinical',occurredOn:updatedAt||createdAt,title:'Contexto histórico del expediente anterior',payload:{religion:text(row.RELIGION),provenance:'t_clientes.RELIGION'}}));
    if(treatment)historyEntries.push(history({organizationId,sourceSystem,table:'t_clientes',key:legacyId,patientId,scope:'clinical',occurredOn:updatedAt||createdAt,title:'Nota histórica del expediente anterior',payload:{text:treatment,sourceDate:rawValue(row.FECHA_ACTU),provenance:'t_clientes.TRATAMIENT',treatmentStatus:'unknown'}}));
    patientIds.set(legacyId,patientId);report.destination.patients+=1;
    add(sourceRecord({organizationId,sourceSystem,backupSha,table:'t_clientes',row,key,disposition:nameMissing?'import_patient_incomplete':'import_patient',destinationKind:'patient_admin',destinationId:patientId,payload,historyEntries}));
  }

  for(const row of tables.get('t_mov_diarios')?.rows||[]){
    if(hasNulMarker(row))issue('nul_byte_preserved_as_marker');
    const movementId=positiveId(row.CODIGO),legacyPatientId=positiveId(row.ID_CLIE),key=movementId||`row:${row.__rowNumber}`;
    if(row.__deleted){add(sourceRecord({organizationId,sourceSystem,backupSha,table:'t_mov_diarios',row,key,disposition:'deleted_source'}));continue;}
    const patientId=legacyPatientId?patientIds.get(legacyPatientId):null;
    if(!patientId){issue('movement_patient_unmatched');add(sourceRecord({organizationId,sourceSystem,backupSha,table:'t_mov_diarios',row,key,disposition:'quarantine_patient_unmatched'}));continue;}
    const dateIssues=[],occurredOn=dateRange(row.FECHA_ACTU,dateIssues,'FECHA_ACTU'),nextVisit=dateRange(row.PROXIMA_CI,dateIssues,'PROXIMA_CI');for(const entry of dateIssues)issue(entry.code);
    const bankId=positiveId(row.ID_BANCO),entries=[];
    entries.push(history({organizationId,sourceSystem,table:'t_mov_diarios',key,patientId,scope:'administrative',occurredOn,title:'Movimiento histórico del sistema anterior',payload:{
      sourceDate:rawValue(row.FECHA_ACTU),nextAppointmentDate:nextVisit,nextAppointmentSource:rawValue(row.PROXIMA_CI),passedConsultation:typeof row.PASO_CONSU==='boolean'?row.PASO_CONSU:null,
      bankId,bankName:bankId?bankNames.get(bankId)||null:null,checkNumber:rawValue(row.NUME_CHEQU),checkAmount:rawValue(row.VAL_CHEQUE),consultationAmount:rawValue(row.VAL_CONSUL),dateIssues,
      schedulingSemantics:'date_only_not_appointment',notificationsEnabled:false,
    }}));
    const treatment=memo(row.TRATAMIENT);
    if(treatment)entries.push(history({organizationId,sourceSystem,table:'t_mov_diarios',key,patientId,scope:'clinical',occurredOn,title:'Anotación histórica del sistema anterior',payload:{text:treatment,sourceDate:rawValue(row.FECHA_ACTU),provenance:'t_mov_diarios.TRATAMIENT',treatmentStatus:'unknown'}}));
    add(sourceRecord({organizationId,sourceSystem,backupSha,table:'t_mov_diarios',row,key,disposition:'import_history',destinationKind:'legacy_history',destinationId:entries[0].id,historyEntries:entries}));
  }

  for(const row of tables.get('t_esta_cli')?.rows||[]){
    const legacyPatientId=positiveId(row.ID_CLIE),key=`${legacyPatientId||'missing'}:${text(row.ANO_CLI)}:${text(row.MES_CLI)}:${text(row.DIA_CLI)}:${rawValue(row.NUM_VIS)??''}:${row.__rowNumber}`;
    if(row.__deleted){add(sourceRecord({organizationId,sourceSystem,backupSha,table:'t_esta_cli',row,key,disposition:'deleted_source'}));continue;}
    const patientId=legacyPatientId?patientIds.get(legacyPatientId):null;
    if(!patientId){issue('statistics_patient_unmatched');add(sourceRecord({organizationId,sourceSystem,backupSha,table:'t_esta_cli',row,key,disposition:'quarantine_patient_unmatched'}));continue;}
    const rawDate=`${text(row.ANO_CLI).padStart(4,'0')}-${text(row.MES_CLI).padStart(2,'0')}-${text(row.DIA_CLI).padStart(2,'0')}`,issues=[];
    const parsed=/^\d{4}-\d{2}-\d{2}$/.test(rawDate)?dateRange(rawDate,issues,'ANO_MES_DIA'):null;
    if(!parsed)issue('statistics_date_unusable');
    const entry=history({organizationId,sourceSystem,table:'t_esta_cli',key,patientId,scope:'administrative',occurredOn:parsed,title:'Estadística histórica del sistema anterior',payload:{sourceDateParts:{year:text(row.ANO_CLI)||null,month:text(row.MES_CLI)||null,day:text(row.DIA_CLI)||null},visitNumber:rawValue(row.NUM_VIS),patientTotal:rawValue(row.TOTPACI_PA),dateIssues:issues}});
    add(sourceRecord({organizationId,sourceSystem,backupSha,table:'t_esta_cli',row,key,disposition:'import_history',destinationKind:'legacy_history',destinationId:entry.id,historyEntries:[entry]}));
  }

  for(const tableName of ['t_correlativo','t_tablas'])for(const row of tables.get(tableName)?.rows||[])add(sourceRecord({organizationId,sourceSystem,backupSha,table:tableName,row,key:`row:${row.__rowNumber}`,disposition:row.__deleted?'deleted_source':'reference_operational_only'}));
  for(const row of tables.get('t_usuarios')?.rows||[])add(sourceRecord({organizationId,sourceSystem,backupSha,table:'t_usuarios',row,key:`row:${row.__rowNumber}`,disposition:row.__deleted?'deleted_source':'excluded_legacy_credentials'}));
  for(const [tableName,table] of tables)if(!CANONICAL_TABLES.includes(tableName))for(const row of table.rows)add(sourceRecord({organizationId,sourceSystem,backupSha,table:tableName,row,key:`row:${row.__rowNumber}`,disposition:'quarantine_unknown_table'}));

  for(const [tableName,stats] of Object.entries(report.tables)){
    const accounted=stats.deleted+stats.imported+stats.quarantined+stats.excluded+stats.reference;
    if(accounted!==stats.physical)throw new Error(`SOURCE_RECONCILIATION_FAILED:${tableName}:${accounted}:${stats.physical}`);
  }
  const planSha=sha256(stableJson(records));
  return {records,publicReport:{...report,sourceRows:records.length,planSha,generatedAt:new Date().toISOString()}};
}
