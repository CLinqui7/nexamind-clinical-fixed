import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../../src/app.js',import.meta.url),'utf8');
const method=source.slice(source.indexOf('  persistDataUpdate ='),source.indexOf('  savePatientForm ='));
const make=send=>{
 const Subject=new Function('saveProductionState','readableError',`return class {${method}}`)(send,e=>e.message);
 const app=new Subject();Object.assign(app,{state:{data:{patients:[]},remoteReady:true,remoteOrganizationId:'clinic-a',modal:{draft:{name:'New patient'}}},authEpoch:1,mounted:true,messages:[],notify(message){this.messages.push(message);},setState(patch,callback){Object.assign(this.state,patch);callback?.();}});return app;
};
test('patient success waits for the server acknowledgement',async()=>{let resolve;const app=make(()=>new Promise(r=>resolve=r));const patch={data:{patients:[{id:'p',name:'Patient'}]},modal:null};const pending=app.persistDataUpdate(patch,'Saved');assert.equal(app.messages.length,0);assert.equal(app.state.data.patients.length,0);assert.equal(app.state.formSaving,true);resolve();await pending;assert.equal(app.state.data.patients.length,1);assert.deepEqual(app.messages,['Saved']);assert.equal(app.state.remoteSaveStatus,'saved');});
test('failed patient save preserves the form and never announces success',async()=>{const app=make(async()=>{throw Error('Connection lost');});await app.persistDataUpdate({data:{patients:[{id:'p'}]},modal:null},'Saved');assert.equal(app.state.modal.draft.name,'New patient');assert.equal(app.state.data.patients.length,0);assert.equal(app.messages.length,0);assert.match(app.state.modalError,/No se guardó/);});
test('a late save response cannot restore a previous account patient',async()=>{let resolve;const app=make(()=>new Promise(r=>resolve=r));const pending=app.persistDataUpdate({data:{patients:[{id:'private-a'}]},modal:null},'Saved');app.authEpoch++;resolve();await pending;assert.equal(app.state.data.patients.length,0);assert.equal(app.messages.length,0);});
