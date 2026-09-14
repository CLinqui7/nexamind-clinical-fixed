import {serveAction} from '../_shared/http.ts';
import {requireMember,limitAction} from '../_shared/auth.ts';
serveAction('calendar-feed-token',async(request,{organizationId,action})=>{
 const {db,user}=await requireMember(request,organizationId,'appointmentsManage');await limitAction(db,'calendar-token',user.id,30);
 if(action==='revoke'){const {error}=await db.from('calendar_feed_tokens').update({active:false}).eq('organization_id',organizationId).eq('created_by',user.id);if(error)throw error;return {ok:true,feedUrl:''};}
 let {data:row,error}=await db.from('calendar_feed_tokens').select('id,token').eq('organization_id',organizationId).eq('created_by',user.id).eq('active',true).order('created_at',{ascending:false}).limit(1).maybeSingle();if(error)throw error;
 if(!row){const result=await db.from('calendar_feed_tokens').insert({organization_id:organizationId,created_by:user.id}).select('id,token').single();if(result.error)throw result.error;row=result.data;}
 const base=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'');return {ok:true,feedUrl:`${base}/functions/v1/calendar-feed?token=${row.token}`};
});
