import { assertSupabaseConfigured, invokeAuthedFunction, supabaseConfigured } from '../lib/supabase.js';
export { supabaseConfigured };

async function invoke(name,body){
  const {data,error}=await invokeAuthedFunction(name,body);
  if(error){let message=error.message;try{const p=await error.context?.clone().json();message=p?.message||message;}catch{}throw new Error(message);}
  if(!data?.ok)throw new Error(data?.message||'La operación no se completó.');return data;
}
export async function fetchWompiAppInfo(organizationId){return (await invoke('wompi-app-info',{organizationId})).app;}
export async function createWompiPaymentLink({organizationId,planCode}){return invoke('wompi-create-link',{organizationId,planCode});}
export async function fetchBilling(organizationId){
 const client=assertSupabaseConfigured();
 const [plans,subscription,orders]=await Promise.all([
  client.from('linkare_plans_v3').select('code,name,amount_cents,months,currency').eq('active',true).order('months'),
  client.from('linkare_subscriptions_v3').select('plan_code,current_period_start,current_period_end').eq('organization_id',organizationId).maybeSingle(),
  client.from('linkare_orders_v3').select('id,plan_code,plan_name,amount_cents,months,status,payment_url,is_test,paid_at,period_start,period_end,created_at,external_reference').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(100),
 ]);
 for(const result of [plans,subscription,orders])if(result.error)throw new Error('No se pudo cargar su suscripción. Revise la conexión o la migración de la base.');
 return {plans:plans.data||[],subscription:subscription.data,orders:orders.data||[]};
}
export async function fetchSubscriptionInvoices(organizationId){const {orders}=await fetchBilling(organizationId);return orders.map(o=>({...o,amount:o.amount_cents/100,paymentUrl:o.payment_url,planName:o.plan_name,createdAt:o.created_at,paidAt:o.paid_at,periodStart:o.period_start,periodEnd:o.period_end}));}
