import { patientDisplayName } from './domain/consultation-fee.js';

const NAVY=[5,49,110];
const INK=[25,47,69];
const MUTED=[88,106,124];
const clean=value=>String(value??'').trim();
const escapeHtml=value=>clean(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function dateLabel(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(clean(value)))throw new Error('Seleccione una fecha válida para la agenda.');
  const date=new Date(`${value}T12:00:00`);
  if(Number.isNaN(date.getTime()))throw new Error('Seleccione una fecha válida para la agenda.');
  return new Intl.DateTimeFormat('es-SV',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(date);
}

export function agendaTimeLabel(value,timezone){
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return 'Hora no registrada';
  try{return new Intl.DateTimeFormat('es-SV',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:timezone||'America/El_Salvador'}).format(date);}
  catch{return new Intl.DateTimeFormat('es-SV',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:'America/El_Salvador'}).format(date);}
}

export function agendaPdfFileName(date){return `Agenda_del_dia_${clean(date)}.pdf`;}

export function buildDailyAgendaPrintHtml(clinic,agenda){
  const date=dateLabel(agenda?.date);
  const items=[...(agenda?.items||[])].sort((a,b)=>new Date(a.start)-new Date(b.start)||clean(a.appointmentId).localeCompare(clean(b.appointmentId)));
  const rows=items.map((item,index)=>{
    const medicines=Array.isArray(item.medications)?item.medications:[];
    const medicineList=medicines.length
      ? `<ul>${medicines.map(med=>`<li>${escapeHtml([med.name,med.dose,med.frequency,med.route].filter(Boolean).join(' · '))}</li>`).join('')}</ul>`
      : '<p class="muted">Sin tratamiento activo registrado.</p>';
    return `<article class="appointment"><div class="appointment-head"><span class="time">${index+1}. ${escapeHtml(agendaTimeLabel(item.start,agenda.timezone))} – ${escapeHtml(agendaTimeLabel(item.end,agenda.timezone))}</span><h2>${escapeHtml(patientDisplayName({name:item.patientName||'Expediente sin nombre'}))}</h2></div><div class="appointment-body"><div><h3>Tratamiento activo</h3>${medicineList}</div><div><h3>Nota de agenda</h3><p class="note">${escapeHtml(item.agendaNote)||'Sin nota de agenda.'}</p></div></div></article>`;
  }).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(`Agenda del día - ${date}`)}</title><style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#19304b;background:#fff;margin:0}.toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 24px;background:#edf5f8}.toolbar button{border:0;border-radius:10px;background:#05316e;color:#fff;padding:11px 20px;font:700 14px Arial;cursor:pointer}.sheet{max-width:900px;margin:auto;padding:24px}.sheet-head{border-bottom:3px solid #05316e;padding-bottom:16px;margin-bottom:20px}.clinic{font-size:12px;font-weight:700;color:#05316e}.sheet-head h1{font-size:27px;color:#05316e;margin:6px 0}.sheet-head p{margin:4px 0;color:#586a7c}.appointment{border:1px solid #d2deea;border-radius:12px;margin:0 0 16px;overflow:hidden;break-inside:avoid;page-break-inside:avoid}.appointment-head{background:#f1f6fb;padding:12px 16px}.time{font-size:12px;font-weight:700;color:#05316e}.appointment h2{font-size:17px;margin:5px 0 0;color:#19304b}.appointment-body{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:14px 16px}.appointment h3{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#586a7c;margin:0 0 8px}.appointment ul{margin:0;padding-left:18px;font-size:12px;line-height:1.5}.appointment li{margin:0 0 5px}.appointment p{font-size:12px;line-height:1.5;margin:0}.note{white-space:pre-wrap;overflow-wrap:anywhere}.muted{color:#586a7c}.empty{padding:18px;border:1px solid #d2deea;border-radius:12px;color:#586a7c}.footer{border-top:1px solid #d2deea;color:#586a7c;font-size:10px;margin-top:24px;padding-top:8px}@media(max-width:650px){.appointment-body{grid-template-columns:1fr}}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.toolbar{display:none}.sheet{max-width:none;padding:0}.appointment{border-radius:0}.footer{break-inside:avoid}}
  </style></head><body><div class="toolbar"><span>Vista de impresión · información clínica confidencial</span><button type="button" onclick="window.print()">Imprimir</button></div><main class="sheet"><header class="sheet-head"><div class="clinic">${escapeHtml(clinic?.name)||'Consultorio'}</div><h1>Agenda del día</h1><p>${escapeHtml(date)} · Calendario Doctor · ${items.length} cita${items.length===1?'':'s'}</p></header>${rows||'<p class="empty">No hay citas de pacientes para esta fecha en el calendario Doctor.</p>'}<footer class="footer">Documento clínico confidencial · Conservar bajo resguardo</footer></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),180));</script></body></html>`;
}

export function buildDailyAgendaPdfDocument(PdfConstructor,clinic,agenda){
  if(typeof PdfConstructor!=='function')throw new Error('No se pudo iniciar el generador PDF.');
  const date=dateLabel(agenda?.date);
  const items=[...(agenda?.items||[])].sort((a,b)=>new Date(a.start)-new Date(b.start)||clean(a.appointmentId).localeCompare(clean(b.appointmentId)));
  const doc=new PdfConstructor({orientation:'portrait',unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
  doc.setProperties({title:`Agenda del día - ${date}`,subject:'Agenda clínica del Doctor',author:clean(clinic?.name)||'Linkare',creator:'Linkare'});
  let y=0;
  const addPage=(continuation=false)=>{
    if(y)doc.addPage();
    doc.setFillColor(...NAVY);doc.rect(0,0,210,14,'F');
    doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(10);
    doc.text(clean(clinic?.name)||'Consultorio',16,9);
    doc.setTextColor(...NAVY);doc.setFontSize(19);doc.text('Agenda del día',16,25);
    doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(date,16,32);
    doc.setTextColor(...MUTED);doc.setFontSize(8);
    doc.text(`${items.length} cita${items.length===1?'':'s'} · Calendario Doctor${continuation?' · Continuación':''}`,194,32,{align:'right'});
    doc.setDrawColor(210,222,234);doc.line(16,37,194,37);y=44;
  };
  const writeLines=(value,{indent=0,bold=false,color=INK,size=9}={})=>{
    doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...color);
    const lines=doc.splitTextToSize(clean(value),174-indent);
    for(const line of lines){
      if(y>267)addPage(true);
      doc.text(line,18+indent,y);y+=4.5;
    }
  };
  addPage();
  if(!items.length){
    writeLines('No hay citas de pacientes para esta fecha en el calendario Doctor.',{color:MUTED,size:10});
  }
  for(const [index,item] of items.entries()){
    if(y>247)addPage(true);
    const start=agendaTimeLabel(item.start,agenda.timezone);
    const end=agendaTimeLabel(item.end,agenda.timezone);
    doc.setFillColor(241,246,251);doc.roundedRect(16,y-3,178,9,1.5,1.5,'F');
    writeLines(`${index+1}.  ${start} - ${end}  ${patientDisplayName({name:item.patientName||'Expediente sin nombre'})}`,{bold:true,color:NAVY,size:10});
    y+=3;
    const medicines=Array.isArray(item.medications)?item.medications:[];
    writeLines('TRATAMIENTO ACTIVO',{bold:true,color:MUTED,size:7.5});
    if(medicines.length){
      for(const med of medicines){
        const summary=[clean(med.name),clean(med.dose),clean(med.frequency),clean(med.route)].filter(Boolean).join(' · ');
        writeLines(`• ${summary}`,{indent:4});
      }
    }else writeLines('Sin tratamiento activo registrado.',{indent:4,color:MUTED});
    y+=1;
    writeLines('NOTA DE AGENDA',{bold:true,color:MUTED,size:7.5});
    writeLines(clean(item.agendaNote)||'Sin nota de agenda.',{indent:4,color:clean(item.agendaNote)?INK:MUTED});
    y+=7;
  }
  const total=doc.getNumberOfPages();
  for(let page=1;page<=total;page++){
    doc.setPage(page);doc.setDrawColor(210,222,234);doc.line(16,278,194,278);
    doc.setTextColor(...MUTED);doc.setFont('helvetica','normal');doc.setFontSize(7.5);
    doc.text('Documento clínico confidencial · Conservar bajo resguardo',16,284);
    doc.text(`Página ${page} de ${total}`,194,284,{align:'right'});
  }
  return doc;
}

export async function downloadDailyAgendaPdf(clinic,agenda){
  const {jsPDF}=await import('jspdf');
  const doc=buildDailyAgendaPdfDocument(jsPDF,clinic,agenda);
  const filename=agendaPdfFileName(agenda.date);
  await doc.save(filename,{returnPromise:true});
  return filename;
}
