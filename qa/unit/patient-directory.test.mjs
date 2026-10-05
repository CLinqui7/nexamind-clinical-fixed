import test from 'node:test';
import assert from 'node:assert/strict';
import {directoryPatient,directoryRange,PatientPageCache,PAGE_LIMIT} from '../../src/domain/patient-directory.js';
import {projectRecords} from '../../src/domain/records.js';

test('directory summaries cannot be projected into clinical or administrative writes',()=>{
 const patient=directoryPatient({id:'p1',name:'Resumen',lastActivityOn:'2026-04-03',consultationFeeCents:12000});
 assert.equal(patient.__summaryOnly,true);
 assert.equal(projectRecords({patients:[patient]},true).size,0);
 assert.equal(PAGE_LIMIT,20);
 assert.equal(patient.consultationFeeCents,12000);
});

test('patient page cache is LRU bounded',()=>{
 const cache=new PatientPageCache(4);
 for(let page=0;page<6;page++)cache.set(['org','all',page],{page});
 assert.equal(cache.size,4);
 assert.equal(cache.get(['org','all',0]),null);
 assert.equal(cache.get(['org','all',5]).page,5);
});

test('agenda ranges are bounded to visible day, week and six-row month',()=>{
 const cursor=new Date('2026-10-14T12:00:00-06:00');
 const day=directoryRange(cursor,'day'),week=directoryRange(cursor,'week'),month=directoryRange(cursor,'month');
 assert.equal((new Date(day.end)-new Date(day.start))/86400000,1);
 assert.equal((new Date(week.end)-new Date(week.start))/86400000,7);
 assert.equal((new Date(month.end)-new Date(month.start))/86400000,42);
});
