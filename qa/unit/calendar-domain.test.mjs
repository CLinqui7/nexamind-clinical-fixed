import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeData} from '../../src/data.js';
import {appointmentFormDefaults,saveAppointment} from '../../src/clinical.js';
import {appointmentReadyForConsultation} from '../../src/v2features.js';
import {patientsNeedingAdministrativeReview} from '../../src/practice.js';

const calendars=[
 {id:'10000000-0000-4000-9000-000000000001',code:'doctor',name:'Doctor',visualKey:'stethoscope'},
 {id:'10000000-0000-4000-9000-000000000002',code:'wife',name:'Esposa',visualKey:'heart'},
 {id:'10000000-0000-4000-9000-000000000003',code:'general',name:'General',visualKey:'users'},
];
const data=normalizeData({calendars,patients:[{id:'patient',name:'Paciente QA'}],appointments:[]});

test('appointment form requires an explicit selected calendar',()=>{
 const draft=appointmentFormDefaults(data,new Date('2026-11-01T09:00:00'),null,'patient');assert.equal(draft.calendarId,'');assert.throws(()=>saveAppointment(data,draft),/calendario/);
});
test('patient appointments persist their calendar identity',()=>{
 const draft={...appointmentFormDefaults(data,new Date('2026-11-01T09:00:00'),null,'patient',calendars[0].id),status:'confirmed'};const result=saveAppointment(data,draft);assert.equal(result.appointment.calendarId,calendars[0].id);assert.equal(result.appointment.eventType,'appointment');assert.equal(result.appointment.patientId,'patient');
});
test('General event stays non-clinical and cannot be placed in a personal calendar',()=>{
 const base={...appointmentFormDefaults(data,new Date('2026-11-02T09:00:00'),null,null,calendars[2].id),eventType:'general',title:'Reunión familiar',type:'Evento general'};const result=saveAppointment(data,base);assert.equal(result.appointment.patientId,undefined);assert.equal(result.appointment.eventType,'general');assert.equal(result.appointment.title,'Reunión familiar');assert.equal(appointmentReadyForConsultation({...data,appointments:[{...result.appointment,start:new Date().toISOString()}]}),null);assert.throws(()=>saveAppointment(data,{...base,calendarId:calendars[1].id}),/calendario General/);
});
test('Secretary patient review queue uses only explicit administrative appointment marks',()=>{
 const review=patientsNeedingAdministrativeReview([
  {patientId:'first',adminReviewStatus:'pending',status:'confirmed'},
  {patientId:'second',adminReviewStatus:'pending',status:'cancelled'},
  {patientId:'third',adminReviewStatus:'pending',status:'no_show'},
  {patientId:'fourth',adminReviewStatus:'reviewed',status:'confirmed'},
  {adminReviewStatus:'pending',status:'confirmed'},
 ]);
 assert.deepEqual([...review],['first']);
});
