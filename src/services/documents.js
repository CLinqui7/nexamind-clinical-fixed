import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { productionMode } from './appState.js';
import { uid } from '../utils.js';

const BUCKET = 'patient-documents';
const DEMO_MAX_BYTES = 4 * 1024 * 1024;
const PRODUCTION_MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'text/plain', 'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

function safeFileName(value = 'documento') {
  return String(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'documento';
}

function validateFile(file, maxBytes) {
  if (!file) throw new Error('Seleccione un archivo.');
  if (file.size > maxBytes) throw new Error(`El archivo supera ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  if (!ALLOWED_TYPES.has(file.type) && !/\.(pdf|png|jpe?g|webp|txt|csv|docx?|xlsx?)$/i.test(file.name || '')) {
    throw new Error('Formato no permitido. Use PDF, imagen, texto, Word o Excel.');
  }
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export async function createPatientDocument({
  file,
  organizationId,
  patientId,
  uploadedBy,
  category = 'Otro',
  description = '',
  clinicalDate = new Date().toISOString().slice(0, 10),
  confidentiality = 'Clínico',
}) {
  const remote = Boolean(productionMode && supabaseConfigured && supabase && organizationId);
  validateFile(file, remote ? PRODUCTION_MAX_BYTES : DEMO_MAX_BYTES);
  const createdAt = new Date().toISOString();
  const id = uid('document');
  const cleanName = safeFileName(file.name);
  let storagePath = '';
  let dataUrl = '';

  if (remote) {
    storagePath = `${organizationId}/${patientId}/${createdAt.slice(0, 10)}/${id}-${cleanName}`;
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      cacheControl: '3600',
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (error) throw new Error(error.message || 'No se pudo subir el archivo a Supabase Storage.');
  } else {
    dataUrl = await readAsDataUrl(file);
  }

  const document = {
    id,
    organizationId: organizationId || null,
    patientId,
    name: file.name || cleanName,
    fileName: file.name || cleanName,
    category,
    description: String(description || '').trim(),
    clinicalDate: clinicalDate ? new Date(`${clinicalDate}T12:00:00`).toISOString() : createdAt,
    confidentiality,
    mimeType: file.type || 'application/octet-stream',
    size: Number(file.size) || 0,
    storagePath,
    dataUrl,
    uploadedBy: uploadedBy || null,
    createdAt,
    updatedAt: createdAt,
  };
  if (remote) await logPatientDocumentAction(document, 'upload').catch(() => null);
  return document;
}

async function logPatientDocumentAction(document, action) {
  if (!productionMode || !supabaseConfigured || !supabase || !document?.organizationId || !document?.patientId) return;
  const { data } = await supabase.auth.getUser();
  await supabase.from('patient_document_audit').insert({
    organization_id: document.organizationId,
    patient_id: String(document.patientId),
    document_id: String(document.id),
    action,
    storage_path: document.storagePath || null,
    actor_id: data?.user?.id || null,
    metadata: { name: document.name, category: document.category, confidentiality: document.confidentiality },
  });
}

export async function getPatientDocumentUrl(document) {
  if (document?.dataUrl) return document.dataUrl;
  if (!document?.storagePath) throw new Error('El documento no tiene contenido disponible.');
  if (!supabaseConfigured || !supabase) throw new Error('Supabase no está conectado.');
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(document.storagePath, 300, {
    download: false,
  });
  if (error || !data?.signedUrl) throw new Error(error?.message || 'No se pudo abrir el documento.');
  return data.signedUrl;
}

export async function openPatientDocument(document) {
  const url = await getPatientDocumentUrl(document);
  await logPatientDocumentAction(document, 'open').catch(() => null);
  window.open(url, '_blank', 'noopener,noreferrer');
  return url;
}

export async function downloadPatientDocument(document) {
  const url = await getPatientDocumentUrl(document);
  await logPatientDocumentAction(document, 'download').catch(() => null);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = document.fileName || document.name || 'documento';
  anchor.target = '_blank';
  anchor.rel = 'noopener';
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function deletePatientDocumentFile(document) {
  if (!document?.storagePath || !supabaseConfigured || !supabase) return;
  const { error } = await supabase.storage.from(BUCKET).remove([document.storagePath]);
  if (error) throw new Error(error.message || 'No se pudo eliminar el archivo de Supabase Storage.');
  await logPatientDocumentAction(document, 'delete').catch(() => null);
}

export const patientDocumentsBucket = BUCKET;
