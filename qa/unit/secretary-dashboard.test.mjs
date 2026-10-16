import test from 'node:test';
import assert from 'node:assert/strict';
import {clinicDayAndMinutes, secretaryTodayAppointments, showSecretaryAgendaNotice} from '../../src/domain/secretary-dashboard.js';

const doctor='doctor-calendar';
const appointment=(id,start,overrides={})=>({id,start,calendarId:doctor,patientId:'patient-'+id,status:'confirmed',...overrides});
const now='2026-10-16T14:00:00Z'; // 08:00 in El Salvador

test('daily notice begins at 08:00 clinic time, independent of browser timezone',()=>{
  assert.equal(clinicDayAndMinutes('2026-10-16T13:59:59Z').day,'2026-10-16');
  assert.equal(showSecretaryAgendaNotice('2026-10-16T13:59:59Z'),false);
  assert.equal(showSecretaryAgendaNotice(now),true);
  assert.equal(showSecretaryAgendaNotice('2026-10-17T05:59:00Z'),true);
  assert.equal(showSecretaryAgendaNotice('2026-10-17T06:00:00Z'),false);
});

test('three, four and five same-day doctor appointments remain in chronological order',()=>{
  const items=[
    appointment('five','2026-10-16T22:00:00Z'),
    appointment('two','2026-10-16T15:00:00Z'),
    appointment('one','2026-10-16T14:00:00Z'),
    appointment('four','2026-10-16T20:00:00Z'),
    appointment('three','2026-10-16T18:00:00Z'),
  ];
  for(const count of [3,4,5]){
    const selected=secretaryTodayAppointments(items.slice(0,count),doctor,now);
    assert.equal(selected.length,count);
    assert.deepEqual(selected.map(item=>item.id),items.slice(0,count).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)).map(item=>item.id));
  }
});

test('exclude other calendars, cancelled/no-show events and adjacent clinic days',()=>{
  const items=[
    appointment('before','2026-10-16T05:59:00Z'),
    appointment('today','2026-10-16T06:00:00Z'),
    appointment('end','2026-10-17T05:59:00Z'),
    appointment('tomorrow','2026-10-17T06:00:00Z'),
    appointment('other','2026-10-16T14:00:00Z',{calendarId:'private'}),
    appointment('cancelled','2026-10-16T14:00:00Z',{status:'cancelled'}),
    appointment('missed','2026-10-16T14:00:00Z',{status:'no_show'}),
    appointment('blocked','2026-10-16T14:00:00Z',{patientId:null}),
  ];
  assert.deepEqual(secretaryTodayAppointments(items,doctor,now).map(item=>item.id),['today','end']);
  assert.deepEqual(secretaryTodayAppointments(items,null,now),[]);
});
