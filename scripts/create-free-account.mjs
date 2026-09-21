import {createClient} from '@supabase/supabase-js';
import {randomBytes} from 'node:crypto';
const arg=name=>{const i=process.argv.indexOf('--'+name);return i<0?'':process.argv[i+1]||'';};
const email=arg('email').trim().toLowerCase(),fullName=arg('fullName').trim(),clinicName=arg('clinicName').trim();
const url=process.env.SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!fullName||!clinicName||fullName.length>160||clinicName.length>160)throw Error('Use --email, --fullName y --clinicName válidos.');
if(!url||!secret)throw Error('Configure SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SECRET_KEY solo en el entorno administrativo.');
const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const schema=await db.from('linkare_subscriptions_v3').select('complimentary_access').limit(0);if(schema.error)throw Error('Aplique primero las migraciones de acceso gratuito y permisos.');
let id=arg('resume-user-id'),generated=false,password=process.env.LINKARE_TEMP_PASSWORD;
if(!id){
 if(!password){if(!process.stdout.isTTY)throw Error('En ejecución sin terminal, proporcione LINKARE_TEMP_PASSWORD; no se escriben contraseñas en archivos.');password=randomBytes(24).toString('base64url');generated=true;}
 if(password.length<12)throw Error('Use una contraseña temporal de al menos 12 caracteres.');
 const result=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:fullName,clinic_name:clinicName}});
 if(result.error)throw Error('No se creó la cuenta: '+result.error.message+' No se modificaron usuarios existentes.');id=result.data.user.id;
}else{
 const result=await db.auth.admin.getUserById(id);if(result.error||result.data.user?.email?.toLowerCase()!==email)throw Error('La cuenta de recuperación no corresponde al correo solicitado.');
}
const result=await db.rpc('linkare_provision_free_account_v3',{account_id:id,full_name:fullName,clinic_name:clinicName});
if(result.error){console.error('No se completó el consultorio. Auth se conserva; no se borró ninguna cuenta. Para revisar/reanudar use --resume-user-id '+id);throw Error(result.error.message);}
console.log(JSON.stringify({ok:true,organizationId:result.data,userId:id,email,plan:'Gratuito',amount:0,patients:0,message:'Esta es tu cuenta de prueba de Linkare. Por ahora tienes acceso completo al sistema para que puedas conocer todos sus módulos y probar su funcionamiento.'},null,2));
if(generated)console.log('Contraseña temporal (solo en esta terminal): '+password);
password=undefined;delete process.env.LINKARE_TEMP_PASSWORD;
