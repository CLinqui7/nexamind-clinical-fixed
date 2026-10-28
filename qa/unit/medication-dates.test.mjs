import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeData} from '../../src/data.js';
import {setMedicationStatus} from '../../src/clinical.js';
test('A retrospective medication status uses the documented effective date',()=>{
 const data=normalizeData({patients:[{id:'p',name:'Synthetic',medications:[{id:'m',name:'Synthetic QA',dose:'1 mg',startDate:'2020-01-01',status:'active'}]}]});
 const result=setMedicationStatus(data,'p','m','discontinued','Final documentado','2021-06-12');
 assert.equal(result.data.patients[0].medications[0].endDate.slice(0,10),'2021-06-12');
 assert.equal(result.data.patients[0].medications[0].events.at(-1).date.slice(0,10),'2021-06-12');
 assert.throws(()=>setMedicationStatus(data,'p','m','completed','','2099-01-01'),/futura/);
});
