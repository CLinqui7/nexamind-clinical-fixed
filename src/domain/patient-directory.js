const PAGE_LIMIT=20;

export function directoryPatient(row={}){
  return {
    id:String(row.id||''),name:row.name||'Paciente sin nombre',phone:row.phone||'',email:row.email||'',
    insurance:{hasInsurance:Boolean(row.insuranceProvider),provider:row.insuranceProvider||'',plan:'',memberId:''},
    archived:row.archived===true,dataQuality:row.dataQuality||null,hasLegacyRecord:row.hasLegacyRecord===true,
    lastActivityOn:row.lastActivityOn||null,lastActivityAt:row.lastActivityAt||null,
    lastActivityPrecision:row.lastActivityPrecision||null,lastActivityOrigin:row.lastActivityOrigin||null,
    nextVisit:row.nextAppointmentAt||null,
    consultationFeeCents:row.consultationFeeCents!==null&&row.consultationFeeCents!==undefined&&row.consultationFeeCents!==''&&Number.isSafeInteger(Number(row.consultationFeeCents))?Number(row.consultationFeeCents):null,
    __summaryOnly:true,
  };
}

export function mergePatients(current=[],incoming=[]){
  const byId=new Map(current.map(patient=>[patient.id,patient]));
  for(const patient of incoming)byId.set(patient.id,patient);
  return [...byId.values()];
}

export function directoryRange(cursor,view='month'){
  const start=new Date(cursor);start.setHours(0,0,0,0);
  if(view==='month'){
    start.setDate(1);start.setDate(start.getDate()-start.getDay());
    const end=new Date(start);end.setDate(end.getDate()+42);
    return {start:start.toISOString(),end:end.toISOString()};
  }
  if(view==='week')start.setDate(start.getDate()-start.getDay());
  const end=new Date(start);end.setDate(end.getDate()+(view==='week'?7:1));
  return {start:start.toISOString(),end:end.toISOString()};
}

/** Keeps only a few directory responses in memory; clinical detail is never cached here. */
export class PatientPageCache{
  constructor(maxPages=4){this.maxPages=maxPages;this.pages=new Map();}
  key(parts){return JSON.stringify(parts);}
  get(parts){const key=this.key(parts);const value=this.pages.get(key);if(value){this.pages.delete(key);this.pages.set(key,value);}return value||null;}
  set(parts,value){const key=this.key(parts);this.pages.delete(key);this.pages.set(key,value);while(this.pages.size>this.maxPages)this.pages.delete(this.pages.keys().next().value);return value;}
  clear(){this.pages.clear();}
  get size(){return this.pages.size;}
}

export {PAGE_LIMIT};
