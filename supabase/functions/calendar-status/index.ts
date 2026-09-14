import {serveAction} from '../_shared/http.ts';
import {requireMember} from '../_shared/auth.ts';
serveAction('calendar-status',async(request,{organizationId})=>{
 const {db,user}=await requireMember(request,organizationId,'appointmentsManage');
 const {data:google,error}=await db.from('calendar_connections').select('provider_account_email,active,updated_at').eq('organization_id',organizationId).eq('user_id',user.id).eq('provider','google').maybeSingle();if(error)throw error;
 const {data:feed,error:e}=await db.from('calendar_feed_tokens').select('token,active').eq('organization_id',organizationId).eq('created_by',user.id).eq('active',true).order('created_at',{ascending:false}).limit(1).maybeSingle();if(e)throw e;
 const base=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'');
 return {ok:true,status:{google:{configured:Boolean(Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID')),connected:Boolean(google?.active),email:google?.provider_account_email||'',updatedAt:google?.updated_at||null},apple:{connected:Boolean(feed?.active),feedUrl:feed?.token?`${base}/functions/v1/calendar-feed?token=${feed.token}`:''}}};
});
