// Display values only. The payment API looks up the selected code in its server catalog.
export const PLAN_OPTIONS = Object.freeze([
  { code:'monthly',label:'Mensual',amount:40,months:1,cycle:'mes',description:'Un mes de acceso.' },
  { code:'semiannual',label:'Semestral',amount:220,months:6,cycle:'6 meses',description:'Seis meses en un solo pago.' },
  { code:'annual',label:'Anual',amount:400,months:12,cycle:'año',description:'Doce meses en un solo pago.' },
]);
export function subscriptionView(subscription, now=new Date()) {
  if(subscription?.complimentary_access === true) return {label:'Plan gratuito',tone:'success',days:null,active:true,free:true};
  if(!subscription?.current_period_end) return {label:'Sin suscripción activa',tone:'neutral',days:0,active:false};
  const end=new Date(subscription.current_period_end);
  const delta=end-now;if(!Number.isFinite(delta))return {label:'Periodo no verificado',tone:'warning',days:0,active:false};
  const days=Math.ceil(delta/86400000);
  return {label:delta<=-7*86400000?'Vencido':delta<=0?'Periodo de gracia':days<=30?'Próximo a renovar':'Activo',tone:delta<=-7*86400000?'danger':days<=30?'warning':'success',days:Math.max(0,days),active:delta>-7*86400000};
}
export function addCalendarMonths(iso, months) {
  const d=new Date(iso); const day=d.getUTCDate(); d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);
  const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString();
}
