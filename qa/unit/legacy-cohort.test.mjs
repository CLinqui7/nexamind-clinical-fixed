import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLegacyPlan} from '../../scripts/lib/legacy-plan.mjs';
import {buildLegacyCohort} from '../../scripts/lib/legacy-cohort.mjs';

const org='20000000-0000-4000-8000-000000000001',backupSha='a'.repeat(64);
const table=rows=>({rows,fields:[],recordCount:rows.length});

test('pilot selects whole patient histories without leaking other patients or creating active treatment',()=>{
  const clients=[1,2,3,4].map(id=>({__rowNumber:id,__deleted:false,ID_CLIE:id,NOM_CLI:`Synthetic${id}`,APE_CLI1:'Test',FECHA_INIC:'2010-01-01',FECHA_ACTU:null,TRATAMIENT:null}));
  const movements=[1,2,3,4].map(id=>({__rowNumber:id,__deleted:false,CODIGO:id,ID_CLIE:id,FECHA_ACTU:`202${id}-01-01`,TRATAMIENT:'Sertralina 50 mg\nTomar 1 cada mañana.'}));
  movements.push({__rowNumber:5,__deleted:false,CODIGO:5,ID_CLIE:1,FECHA_ACTU:'2025-01-01',TRATAMIENT:'Sertralina 50 mg'});
  const tables=new Map([['t_clientes',table(clients)],['t_mov_diarios',table(movements)],['t_esta_cli',table([])],['t_bancos',table([])],['t_correlativo',table([])],['t_tablas',table([])],['t_usuarios',table([])]]);
  const full=buildLegacyPlan({tables,organizationId:org,sourceSystem:'foxpro-linkare-pilot50',backupSha});
  const cohort=buildLegacyCohort(full,2),selected=new Set(cohort.records.filter(item=>item.destinationKind==='patient_admin').map(item=>item.destinationId));
  assert.equal(cohort.publicReport.destination.patients,2);
  assert.equal(cohort.records.filter(item=>item.destinationKind==='patient_admin').length,2);
  assert.equal(cohort.records.every(item=>selected.has(item.destinationId)||(item.historyEntries||[]).every(entry=>selected.has(entry.patientId))),true);
  assert.equal(cohort.publicReport.sourceRows,cohort.records.length);
  assert.equal(cohort.publicReport.activeMedicationsCreated,0);
  assert.equal(cohort.publicReport.appointmentsCreated,0);
  assert.equal(cohort.publicReport.notificationsCreated,0);
  assert.equal(JSON.stringify(cohort.publicReport).includes('Synthetic'),false);
  assert.equal(buildLegacyCohort(full,2).publicReport.planSha,cohort.publicReport.planSha);
});
