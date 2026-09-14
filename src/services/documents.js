import { assertSupabaseConfigured } from '../lib/supabase.js';
import { uid } from '../utils.js';
const BUCKET='patient-documents';
const MIME_BY_EXTENSION={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',txt:'text/plain',csv:'text/csv',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
export function validateDocumentFile(file){
 if(!file)throw new Error('Seleccione un archivo.');
 if(!file.size || file.size>20*1024*1024)throw new Error('El archivo debe tener contenido y pesar como máximo 20 MB.');
 const ext=String(file.name||'').split('.').pop().toLowerCase(),mime=MIME_BY_EXTENSION[ext];
 if(!mime || (file.type && file.type!==mime && !(ext==='csv'&&['text/plain','application/vnd.ms-excel'].includes(file.type))))throw new Error('Formato no permitido. Use PDF, imagen, Word, Excel, CSV o texto, sin macros.');
 return mime;
}
async function audit(doc,action){
 const client=assertSupabaseConfigured();const {data,error:authError}=await client.auth.getUser();
 if(authError||!data.user)throw new Error('Su sesión venció.');
 const {error}=await client.from('patient_document_audit').insert({organization_id:doc.organizationId,patient_id:String(doc.patientId),document_id:String(doc.id),action,storage_path:doc.storagePath||null,actor_id:data.user.id,metadata:{category:doc.category||'Otro'}});
 if(error)throw new Error('No se pudo registrar la auditoría documental. Intente nuevamente.');
}
export async function createPatientDocument({file,organizationId,patientId,category='Otro',description='',clinicalDate,confidentiality='Clínico'}){
 const client=assertSupabaseConfigured();if(!organizationId||!patientId)throw new Error('Guarde primero el paciente en su consultorio.');
 const mime=validateDocumentFile(file),id=uid('document'),createdAt=new Date().toISOString();
 const ext=file.name.split('.').pop().toLowerCase();const storagePath=`${organizationId}/${patientId}/${id}.${ext}`;
 const {data:user,error:authError}=await client.auth.getUser();if(authError||!user.user)throw new Error('Su sesión venció.');
 const {error}=await client.storage.from(BUCKET).upload(storagePath,file,{contentType:mime,upsert:false,cacheControl:'0'});if(error)throw new Error('No se pudo subir el documento. Revise conexión, permiso y tamaño.');
 const document={id,organizationId,patientId,name:file.name,fileName:file.name,category,description:String(description).trim(),clinicalDate:clinicalDate?`${clinicalDate}T12:00:00.000Z`:createdAt,confidentiality,mimeType:mime,size:file.size,storagePath,uploadedBy:user.user.id,createdAt,updatedAt:createdAt};
 await audit(document,'upload');return document;
}
export async function getPatientDocumentUrl(document,download=false){
 if(!document?.storagePath)throw new Error('Este archivo antiguo no está en Storage. Solicite su migración desde el respaldo.');
 const client=assertSupabaseConfigured();const {data,error}=await client.storage.from(BUCKET).createSignedUrl(document.storagePath,60,{download:download?(document.fileName||'documento'):false});
 if(error||!data?.signedUrl)throw new Error('No se pudo obtener el archivo. Revise su permiso o inicie sesión de nuevo.');return data.signedUrl;
}
export async function openPatientDocument(document){
 const popup=window.open('about:blank','_blank');if(popup)popup.opener=null;
 try{await audit(document,'open');const url=await getPatientDocumentUrl(document);if(popup)popup.location.href=url;else{const a=window.document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.click();}return url;}catch(error){popup?.close();throw error;}
}
export async function downloadPatientDocument(document){await audit(document,'download');const url=await getPatientDocumentUrl(document,true);const a=window.document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.click();}
// Archive only. Never destroy clinical evidence from a browser action.
export async function deletePatientDocumentFile(document){await audit(document,'archive');}
export const patientDocumentsBucket=BUCKET;
