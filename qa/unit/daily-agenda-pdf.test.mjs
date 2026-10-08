import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {jsPDF} from 'jspdf';
import {agendaPdfFileName,agendaTimeLabel,buildDailyAgendaPdfDocument,buildDailyAgendaPrintHtml,previousAppointmentLabel} from '../../src/daily-agenda-pdf.js';

test('the daily agenda PDF keeps chronological appointments and paginates long notes',()=>{
 const agenda={date:'2026-10-06',timezone:'America/El_Salvador',items:Array.from({length:24},(_,index)=>({
  appointmentId:`qa-${index}`,patientName:`Paciente sintético ${index+1}`,lastAppointmentOn:index===0?'2026-09-24':null,
  start:new Date(Date.UTC(2026,9,6,13+Math.floor(index/2),(index%2)*30)).toISOString(),
  end:new Date(Date.UTC(2026,9,6,13+Math.floor(index/2),(index%2)*30+30)).toISOString(),
  medications:[{name:'Sertralina',dose:'50 mg',frequency:'cada mañana',route:'oral'},{name:'Clonazepam',dose:'1/2 tableta',frequency:'cada noche'}],
  agendaNote:index===0?'Revisar evolución; '.repeat(80):'Traer resultados de laboratorio.'
 }))};
 agenda.items.reverse();
 const printed=[];
 const PdfConstructor=function(options){const doc=new jsPDF(options);const original=doc.text.bind(doc);doc.text=(value,...args)=>{printed.push(String(value));return original(value,...args);};return doc;};
 const doc=buildDailyAgendaPdfDocument(PdfConstructor,{name:'Consultorio QA'},agenda);
 assert.ok(doc.getNumberOfPages()>1);
 assert.ok(printed.includes('Última cita anterior: 24/09/2026'));
 assert.ok(printed.includes('Última cita anterior: No registrada'));
 assert.equal(previousAppointmentLabel('2026-09-24'),'24/09/2026');
 assert.equal(previousAppointmentLabel(null),'No registrada');
 assert.equal(agendaPdfFileName(agenda.date),'Agenda_del_dia_2026-10-06.pdf');
 assert.match(agendaTimeLabel('2026-10-06T14:00:00Z',agenda.timezone),/8:00/);
 const bytes=Buffer.from(doc.output('arraybuffer'));
 assert.equal(bytes.subarray(0,4).toString(),'%PDF');
 if(process.env.LINKARE_AGENDA_PDF_SAMPLE)fs.writeFileSync(process.env.LINKARE_AGENDA_PDF_SAMPLE,bytes);
});

test('the daily agenda print view is A4, chronological and escapes clinical text',()=>{
 const html=buildDailyAgendaPrintHtml({name:'Consulta <privada>'},{date:'2026-10-06',timezone:'America/El_Salvador',items:[
  {appointmentId:'later',patientName:'Paciente <img src=x>',start:'2026-10-06T15:00:00Z',end:'2026-10-06T15:45:00Z',medications:[{name:'Medicina <script>',dose:'5 mg'}],agendaNote:'Control <pendiente>'},
  {appointmentId:'earlier',patientName:'Paciente temprano',lastAppointmentOn:'2026-09-24',start:'2026-10-06T14:00:00Z',end:'2026-10-06T14:45:00Z',medications:[],agendaNote:''},
 ]});
 assert.match(html,/@page\{size:A4/);
 assert.match(html,/onclick="window\.print\(\)"/);
 assert.ok(html.indexOf('Paciente temprano')<html.indexOf('Paciente &lt;img src=x&gt;'));
 assert.match(html,/Consulta &lt;privada&gt;/);
 assert.match(html,/Medicina &lt;script&gt;/);
 assert.match(html,/Control &lt;pendiente&gt;/);
 assert.match(html,/Última cita anterior: 24\/09\/2026/);
 assert.match(html,/Última cita anterior: No registrada/);
 assert.ok(!html.includes('<img src=x>'));
 assert.ok(!html.includes('Medicina <script>'));
});
