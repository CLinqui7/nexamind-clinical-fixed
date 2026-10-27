import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../../src/app.js',import.meta.url),'utf8');
const method=source.slice(source.indexOf('  savePatientForm ='),source.indexOf('  savePatientEditForm ='));
const createApp=lookup=>{
  const calls=[];
  const Subject=new Function('findMatchingPatient','createPatient','DEMO_PATIENT_NAME',`return class {${method}}`)(
    lookup,
    (_,draft)=>{calls.push(draft);return {patientId:'new-patient',data:{patients:[{id:'new-patient'}]}};},
    'Paciente ficticio'
  );
  const app=new Subject();
  app.state={data:{patients:[]},modal:{type:'patient',draft:{name:'Ana Pérez',phone:'7000-0000'}},formSaving:false,tourSandbox:false,remoteOrganizationId:'clinic-a'};
  app.authEpoch=1;
  app.setState=patch=>Object.assign(app.state,patch);
  app.persistDataUpdate=async patch=>{app.savedPatch=patch;return true;};
  app.handleFormError=error=>{app.error=error;};
  return {app,calls};
};
const event={preventDefault(){}};

test('a matching patient keeps the form and offers the existing chart',async()=>{
  const {app,calls}=createApp(async()=>({id:'existing',name:'Ana Pérez',phone:'7000-0000'}));
  await app.savePatientForm(event);
  assert.equal(calls.length,0);
  assert.equal(app.state.modal.duplicatePatient.id,'existing');
  assert.equal(app.state.modal.draft.name,'Ana Pérez');
  assert.equal(app.state.formSaving,false);
  assert.equal(app.savedPatch,undefined);
});

test('a new identity continues to the normal server-acknowledged save',async()=>{
  const {app,calls}=createApp(async()=>null);
  await app.savePatientForm(event);
  assert.equal(calls.length,1);
  assert.equal(app.savedPatch.selectedPatientId,'new-patient');
});

test('an obsolete lookup cannot save after the form changes',async()=>{
  let resolve;
  const {app,calls}=createApp(()=>new Promise(done=>{resolve=done;}));
  const pending=app.savePatientForm(event);
  app.state.modal={...app.state.modal,draft:{...app.state.modal.draft,phone:'7111-2222'}};
  resolve(null);
  await pending;
  assert.equal(calls.length,0);
  assert.equal(app.state.formSaving,false);
});
