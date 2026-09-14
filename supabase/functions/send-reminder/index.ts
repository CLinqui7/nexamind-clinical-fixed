import {serveAction} from '../_shared/http.ts';
import {requireMember,limitAction} from '../_shared/auth.ts';
import {deliverReminder} from '../_shared/reminders.ts';
serveAction('send-reminder',async(request,input)=>{
 const {user,db}=await requireMember(request,input.organizationId,'remindersManage');
 await limitAction(db,'reminder-user',user.id,60);
 return deliverReminder(input.organizationId,input.appointmentId,input.channel,Number(input.hours||24),user.id);
});
