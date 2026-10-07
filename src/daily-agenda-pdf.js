import { patientDisplayName } from './domain/consultation-fee.js';

const NAVY=[5,49,110];
const INK=[25,47,69];
const MUTED=[88,106,124];
const clean=value=>String(value??'').trim();

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
