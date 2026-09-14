import {serveAction} from '../_shared/http.ts';
import {requireMember} from '../_shared/auth.ts';
import {configuredProviders} from '../_shared/reminders.ts';
serveAction('reminder-provider-status',async(request,input)=>{await requireMember(request,input.organizationId,'remindersManage');return {ok:true,providers:configuredProviders()};});
