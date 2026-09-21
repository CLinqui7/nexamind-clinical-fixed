import {test} from 'node:test';
import assert from 'node:assert/strict';
import {savePrescription} from '../../src/practice.js';
const old={id:'rx-1',number:'RX-2026-0001',date:'2026-09-21T12:00:00.000Z',createdAt:'2026-09-20T00:00:00.000Z',createdBy:'doctor',doctorName:'Doctor QA',items:[{id:'i',medication:'Synthetic medication',directions:'Original text'}]};
const data=role=>({organization:{clinician:'Doctor QA'},settings:{activeUserId:role},users:[{id:role,role,active:true,permissions:{patientsView:true,prescriptionsEdit:true}}],patients:[{id:'p',name:'Synthetic',prescriptions:[old]}]});
for(const role of ['doctor','secretary'])test(role+' can correct an existing prescription without creating a duplicate',()=>{
 const d=data(role);const r=savePrescription(d,'p',{...old,date:'2026-09-21',items:[{...old.items[0],directions:'Corrected text'}]});assert.equal(r.data.patients[0].prescriptions.length,1);assert.equal(r.prescription.id,old.id);assert.equal(r.prescription.number,old.number);assert.equal(r.prescription.createdBy,old.createdBy);assert.equal(r.prescription.updatedBy,role);assert.equal(r.prescription.items[0].directions,'Corrected text');assert.equal(d.patients[0].prescriptions[0].items[0].directions,'Original text');
});
test('secretary correction capability does not allow issuing a new prescription',()=>{assert.throws(()=>savePrescription(data('secretary'),'p',{date:'2026-09-21',items:old.items}),/permiso/);});
