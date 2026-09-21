# Plantillas y documentos generados

Linkare conserva las plantillas como registros versionados en `linkare_document_templates_v1`. Una corrección crea otra versión; no modifica el PDF ni el texto de documentos que ya fueron emitidos.

Cada generación produce un PDF en el bucket privado `patient-documents`, agrega su referencia al expediente clínico y registra en `linkare_generated_documents_v1` la versión de plantilla, variables autorizadas, texto final, ruta, autor y fecha. El RPC `linkare_attach_generated_document_v1` bloquea la fila del expediente y exige su revisión vigente para que el archivo y sus metadatos no se separen silenciosamente.

## Permisos

- `documentsGenerateAdministrative`: constancias e incapacidades con datos administrativos. Puede asignarse a Secretaría.
- `documentsGenerateClinical`: cartas y formularios que usan información clínica. Requiere `clinicalView` y no está disponible para Secretaría.
- `documentsView` y `documentsManage`: conservan su alcance para consultar, subir o archivar archivos clínicos.

El Edge Function `document-templates` obtiene los datos protegidos en el servidor, sustituye solo las variables declaradas, genera el PDF y devuelve un enlace firmado de 60 segundos. El diagnóstico no se envía al navegador de Secretaría. Los PDFs no son públicos y no deben copiarse a enlaces permanentes.

## Plantillas iniciales

La migración instala constancia médica, incapacidad, carta médica y formulario configurable. Para cambiar un texto en producción, inserte una fila con el mismo `template_key` y un `version` superior; desactive la versión anterior solo cuando deba dejar de ofrecerse. No actualice el cuerpo de una versión que ya haya generado documentos.

## Recuperación

Si falla la generación después de subir el archivo, la función intenta eliminar el objeto huérfano. Si la migración debe revertirse, primero desactive la interfaz y la Edge Function; conserve las tablas y el bucket para no perder la trazabilidad de documentos ya emitidos.
