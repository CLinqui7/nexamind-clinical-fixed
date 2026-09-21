import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changePermission,permissionAllowed} from '../../src/domain/permissions.js';
import {projectRecords} from '../../src/domain/records.js';
test('permission toggles keep prerequisite choices consistent',()=>{
 let p=changePermission({},'medicationsManage',true);assert.equal(p.clinicalView,true);assert.equal(p.patientsView,true);assert.equal(permissionAllowed({role:'nurse',permissions:p},'medicationsManage'),true);
 p=changePermission(p,'clinicalView',false);assert.equal(p.medicationsManage,false);
 p=changePermission(p,'documentsManage',true);assert.equal(p.documentsView,true);p=changePermission(p,'patientsView',false);assert.equal(p.documentsManage,false);assert.equal(p.documentsView,false);
});
test('delegated projections exclude unrelated and uneditable resource fields',()=>{
 const records=projectRecords({patients:[{id:'p',name:'Synthetic',diagnosis:'private',documents:[{id:'d'}],medications:[{name:'qa'}]}],appointments:[{id:'a',notes:'private'}]}, {medicationsManage:true});
 assert.equal(records.size,1);assert.deepEqual(records.get('patient_clinical:p').payload,{medications:[{name:'qa'}]});
 assert.equal(projectRecords({appointments:[{id:'a',notes:'private'}]},{clinicalEdit:true}).size,0);
});
