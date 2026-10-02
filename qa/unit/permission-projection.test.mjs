import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calendarPermissionAllowed,changePermission,defaultPermissions,permissionAllowed} from '../../src/domain/permissions.js';
import {projectRecords} from '../../src/domain/records.js';
test('permission toggles keep prerequisite choices consistent',()=>{
 let p=changePermission({},'medicationsManage',true);assert.equal(p.clinicalView,true);assert.equal(p.patientsView,true);assert.equal(permissionAllowed({role:'nurse',permissions:p},'medicationsManage'),true);
 p=changePermission(p,'clinicalView',false);assert.equal(p.medicationsManage,false);
 p=changePermission(p,'documentsManage',true);assert.equal(p.documentsView,true);p=changePermission(p,'patientsView',false);assert.equal(p.documentsManage,false);assert.equal(p.documentsView,false);
});
test('calendar actions require view and Secretary agenda access is derived from calendar grants',()=>{
 let permissions=changePermission({},'calendarWifeEdit',true);assert.equal(permissions.calendarWifeView,true);const secretary={role:'secretary',active:true,permissions};assert.equal(calendarPermissionAllowed(secretary,'wife','Edit'),true);assert.equal(permissionAllowed(secretary,'appointmentsManage'),true);permissions=changePermission(permissions,'calendarWifeView',false);assert.equal(permissions.calendarWifeEdit,false);assert.equal(calendarPermissionAllowed({...secretary,permissions},'wife','Edit'),false);assert.equal(permissionAllowed({...secretary,permissions},'appointmentsManage'),false);
});
test('default Secretary grants all safe calendar actions but never owner or clinical secrets',()=>{
 const permissions=defaultPermissions('secretary');for(const code of ['Doctor','Wife','General'])for(const action of ['View','Create','Edit','Cancel','Delete'])assert.equal(permissions[`calendar${code}${action}`],true);for(const key of ['clinicalView','clinicalEdit','usersManage','settingsManage'])assert.equal(permissions[key],false);
});
test('delegated projections exclude unrelated and uneditable resource fields',()=>{
 const records=projectRecords({patients:[{id:'p',name:'Synthetic',diagnosis:'private',documents:[{id:'d'}],medications:[{name:'qa'}]}],appointments:[{id:'a',notes:'private'}]}, {medicationsManage:true});
 assert.equal(records.size,1);assert.deepEqual(records.get('patient_clinical:p').payload,{medications:[{name:'qa'}]});
 assert.equal(projectRecords({appointments:[{id:'a',notes:'private'}]},{clinicalEdit:true}).size,0);
});
