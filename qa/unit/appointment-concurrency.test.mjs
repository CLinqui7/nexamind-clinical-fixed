import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appointmentEditPatch,appointmentConflictGroups,rebaseAppointmentDraft} from '../../src/domain/appointment-concurrency.js';

const original={id:'synthetic',calendarId:'doctor',eventType:'appointment',patientId:'patient',title:'Synthetic patient',start:'2099-01-02T15:00:00.000Z',end:'2099-01-02T15:45:00.000Z',type:'Seguimiento',modality:'Presencial',status:'pending',adminReviewStatus:'none',notes:'Original'};

test('appointment edit sends only changed fields, including a complete time slot',()=>{
 const edited={...original,start:'2099-01-02T16:00:00.000Z',end:'2099-01-02T16:45:00.000Z',title:'Updated directory display'};
 const patch=appointmentEditPatch(original,edited,{canEditNotes:true});
 assert.deepEqual(Object.keys(patch.changes).sort(),['end','start']);
 assert.equal(patch.base.start,original.start);
 assert.equal(patch.base.patientId,original.patientId);
 assert.equal(patch.base.calendarId,original.calendarId);
 assert.equal(patch.changes.end,edited.end);
});

test('secretary without clinical editing cannot submit notes',()=>{
 const patch=appointmentEditPatch(original,{...original,type:'Prioritaria',notes:'Do not send'}, {canEditNotes:false});
 assert.deepEqual(patch.changes,{type:'Prioritaria'});
});

test('rebase retains independent local choices while taking concurrent server values',()=>{
 const local={...original,type:'Prioritaria',status:'pending',start:'2099-01-02T09:00',duration:45};
 const current={...original,status:'confirmed',notes:'New server note'};
 const rebased=rebaseAppointmentDraft(local,current,['type'],[],true);
 assert.equal(rebased.type,'Prioritaria');
 assert.equal(rebased.status,'confirmed');
 assert.equal(rebased.notes,'New server note');
});

test('same-field choices preserve the draft until the editor decides',()=>{
 const local={...original,status:'completed',type:'Prioritaria'};
 const current={...original,status:'confirmed'};
 assert.equal(rebaseAppointmentDraft(local,current,['status','type'],['status'],true).status,'completed');
 const server=rebaseAppointmentDraft(local,current,['status','type'],['status'],false);
 assert.equal(server.status,'confirmed');
 assert.equal(server.type,'Prioritaria');
 assert.deepEqual(appointmentConflictGroups(['start','end','notes']),['time','notes']);
});
