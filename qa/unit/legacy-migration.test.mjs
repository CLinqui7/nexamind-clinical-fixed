import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDbf} from '../../scripts/lib/foxpro-reader.mjs';
import {buildLegacyPlan,deterministicUuid,isStrictUuid} from '../../scripts/lib/legacy-plan.mjs';
import {normalizeData} from '../../src/data.js';

const organizationId='20000000-0000-4000-8000-000000000001',backupSha='a'.repeat(64);
const table=rows=>({rows,fields:[],recordCount:rows.length});
const emptyTables=()=>new Map(['t_clientes','t_mov_diarios','t_esta_cli','t_bancos','t_correlativo','t_tablas','t_usuarios'].map(name=>[name,table([])]));

test('Visual FoxPro DBF/FPT reader handles binary memo pointers and Windows-1252 text',()=>{
 const fields=[{name:'NOMBRE',type:'C',length:10},{name:'MEMO',type:'M',length:4}],headerLength=97,recordLength=15;
 const dbf=Buffer.alloc(headerLength+recordLength+1,0);dbf[0]=0x30;dbf.writeUInt32LE(1,4);dbf.writeUInt16LE(headerLength,8);dbf.writeUInt16LE(recordLength,10);
 fields.forEach((field,index)=>{const offset=32+index*32;dbf.write(field.name,offset,'ascii');dbf[offset+11]=field.type.charCodeAt(0);dbf[offset+16]=field.length;});dbf[96]=0x0d;dbf[97]=0x20;Buffer.from([0x4a,0x6f,0x73,0xe9]).copy(dbf,98);dbf.fill(0x20,102,108);dbf.writeUInt32LE(1,108);dbf[112]=0x1a;
 const fpt=Buffer.alloc(1024,0);fpt.writeUInt16BE(512,6);const memo=Buffer.from([0x4e,0x6f,0x74,0x61,0x20,0x63,0x6c,0xed,0x6e,0x69,0x63,0x61]);fpt.writeUInt32BE(1,512);fpt.writeUInt32BE(memo.length,516);memo.copy(fpt,520);
 const parsed=parseDbf(dbf,{memoBuffer:fpt,fileName:'synthetic.dbf'});assert.equal(parsed.rows[0].NOMBRE,'José');assert.equal(parsed.rows[0].MEMO,'Nota clínica');assert.equal(parsed.rows[0].__deleted,false);
});

test('planner accounts for every row, preserves relationships and never leaks source content in its public report',()=>{
 const tables=emptyTables();tables.set('t_clientes',table([{__rowNumber:1,__deleted:false,ID_CLIE:1,NOM_CLI:'PRIVATE',APE_CLI1:'PERSON',EDAD:null,TRATAMIENT:'PRIVATE CLINICAL NOTE',RELIGION:'PRIVATE CONTEXT',FECHA_INIC:null,FECHA_ACTU:null,PROXIMA_CI:null},{__rowNumber:2,__deleted:false,ID_CLIE:2,NOM_CLI:'',APE_CLI1:'',EDAD:0,TRATAMIENT:null,FECHA_INIC:null,FECHA_ACTU:null,PROXIMA_CI:null},{__rowNumber:3,__deleted:false,ID_CLIE:null,NOM_CLI:'Missing id'}]));
 tables.set('t_mov_diarios',table([{__rowNumber:1,__deleted:false,CODIGO:10,ID_CLIE:1,FECHA_ACTU:'2020-01-01',TRATAMIENT:'PRIVATE MOVEMENT NOTE',PROXIMA_CI:null,PASO_CONSU:null,ID_BANCO:null,NUME_CHEQU:null,VAL_CHEQUE:null,VAL_CONSUL:null},{__rowNumber:2,__deleted:false,CODIGO:11,ID_CLIE:999,FECHA_ACTU:null,TRATAMIENT:null}]));
 tables.set('t_esta_cli',table([{__rowNumber:1,__deleted:false,ID_CLIE:2,ANO_CLI:'2020',MES_CLI:'01',DIA_CLI:'02',NUM_VIS:1,TOTPACI_PA:'5.00'}]));tables.set('unexpected',table([{__rowNumber:1,__deleted:false,SECRET:'DO NOT LEAK'}]));
 const {records,publicReport}=buildLegacyPlan({tables,organizationId,sourceSystem:'qa-foxpro',backupSha});const publicText=JSON.stringify(publicReport);
 assert.equal(publicReport.tables.t_clientes.physical,3);assert.equal(publicReport.tables.t_clientes.imported,2);assert.equal(publicReport.tables.t_clientes.quarantined,1);assert.equal(publicReport.tables.t_mov_diarios.quarantined,1);assert.equal(publicReport.tables.unexpected.quarantined,1);assert.equal(publicReport.destination.patients,2);assert.equal(publicReport.appointmentsCreated,0);assert.equal(publicReport.notificationsCreated,0);assert.equal(publicReport.activeMedicationsCreated,0);
 for(const secret of ['PRIVATE','PERSON','CLINICAL NOTE','DO NOT LEAK'])assert.doesNotMatch(publicText,new RegExp(secret));
 const incomplete=records.find(record=>record.disposition==='import_patient_incomplete');assert.equal(incomplete.payload.name,'Nombre no registrado (fuente histórica)');assert.equal(incomplete.payload.notificationPreferences.enabled,false);
 const movement=records.find(record=>record.sourceTable==='t_mov_diarios'&&record.disposition==='import_history');assert.equal(movement.historyEntries.some(entry=>entry.scope==='clinical'),true);assert.equal(records.some(record=>record.destinationKind==='appointment'),false);
});

test('stable identities are not truncated and UUID validation rejects dash-only or malformed values',()=>{
 const prefix='x'.repeat(180);assert.notEqual(deterministicUuid(organizationId,prefix+'A'),deterministicUuid(organizationId,prefix+'B'));assert.equal(isStrictUuid('------------------------------------'),false);assert.equal(isStrictUuid('20000000-0000-4000-8000-000000000001'),true);
});

test('historical normalization keeps unknown clinical values unknown and disables reminders',()=>{
 const patient=normalizeData({patients:[{id:'historical',name:'Historical QA',age:null,dataQuality:'historical',sourceSummary:{system:'FoxPro'},notificationPreferences:{enabled:true,channels:['whatsapp'],reminderHours:[24],consentStatus:'not_recorded'}}]}).patients[0];
 assert.equal(patient.age,null);assert.equal(patient.risk,'unrecorded');assert.equal(patient.status,'unrecorded');assert.equal(patient.lastVisit,null);assert.equal(patient.adherence,null);assert.equal(patient.functioningChange,null);assert.equal(patient.medication,null);assert.equal(patient.medications.length,0);assert.equal(patient.vitalStatus,'unconfirmed');assert.equal(patient.notificationPreferences.enabled,false);assert.deepEqual(patient.notificationPreferences.channels,[]);assert.equal(patient.createdAt,null);assert.equal(patient.updatedAt,null);
});
