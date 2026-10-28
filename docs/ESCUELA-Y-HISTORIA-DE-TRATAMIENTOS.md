# Escuela y cronología de tratamientos

La escuela se abre desde Ayuda → Escuela completa. Incluye 32 capítulos,
365 controles explicados, ejercicios, preguntas de comprobación, progreso local
por cuenta y navegador, un manual HTML imprimible y 32 videos narrados en español
con subtítulos. Los videos suman aproximadamente 87 minutos y usan exclusivamente
pantallas de la base SQL aislada con datos ficticios. Son guías visuales narradas
de los controles; la práctica de operaciones se realiza en el recorrido temporal.

El capítulo inicial corresponde a la pantalla y pestaña abiertas. Los permisos
filtran los capítulos clínicos y administrativos; la escuela no modifica permisos.
La página de acceso ofrece un tutorial público específico de invitaciones y acceso.

## Contenido y medios

- `src/learning-content.js`: capítulos, controles, resultados esperados, ejercicios y preguntas.
- `src/learning.js`: navegación, lectura, comprobación y progreso.
- `public/tutorials/pages/manifest.json`: duración, controles y SHA-256 del contenido de cada video.
- `scripts/build-training-manual.mjs`: manual generado en cada build.
- `qa/browser/build-page-videos.mjs`: capturas locales, narración SAPI y codificación MP4.
  Requiere Edge/Playwright, Microsoft Sabina Desktop y Python con imageio-ffmpeg 0.6.0.
  Solo se conecta a `127.0.0.1:4173`; nunca usar producción como origen de capturas.
  Reutiliza videos vigentes; `LINKARE_REBUILD_CHAPTERS` fuerza capítulos concretos.

## Cronología

Historia de tomas consulta las menciones y las notas originales del mismo paciente
que contienen el nombre normalizado del medicamento. Incluye notas sin una dosis
estructurada, por lo que también permite encontrar textos de suspensión que no
generaron una tarjeta de medicamento. La paginación devuelve 20 entradas y conserva
fechas desconocidas. No se equiparan marcas y principios activos automáticamente.

Las pautas se muestran literalmente desde la instrucción extraída o el texto que
sigue a la concentración. Los encabezados explícitos de consulta se muestran como
fechas escritas en la nota; se excluyen encabezados de próxima cita o cita programada.
Las expresiones directas de inicio o suspensión se identifican como indicaciones
documentadas, conservando su frase y contexto. No se infiere suspensión por ausencia
de menciones, ni se convierte la primera mención en fecha real de inicio.

Registrar tratamiento pasado permite crear una cronología sin activar un medicamento.
Los eventos de Linkare admiten inicio, pausa, reinicio, final, cambio de pauta y nota;
registran fecha efectiva opcional, dosis, frecuencia, vía y fuente. Se pueden corregir
con revisión esperada y retirar con motivo. Se conserva auditoría privada de cada
versión. Las creaciones repetidas con el mismo UUID y contenido son idempotentes.
También se puede indicar fecha efectiva en el cambio de estado de una ficha actual.

## Verificación reproducible

```powershell
node qa/browser/server.mjs
node qa/browser/school-and-courses.mjs
node qa/browser/verify-page-videos.mjs
node qa/browser/training.mjs
npm run check
```

No ejecutar generador de medios o build mientras se realiza una prueba de navegador:
Vite puede recargar las páginas al cambiar archivos públicos. Los informes y capturas
de ejecución se guardan en `qa/results/`, excluido de Git.

Se comprueban lectura y progreso de todos los capítulos, persistencia tras recarga,
ausencia de escrituras clínicas desde la escuela, permisos de Secretaría, geometría
móvil, creación/corrección/retiro de eventos, fechas desconocidas, conflictos,
idempotencia y conservación de recetas y tratamientos. Cada video se decodifica y
se prueba al inicio y cerca del final en el navegador, con audio y subtítulos.

La prueba de producción consulta la cronología de un expediente autorizado y verifica
permisos y RLS. No inserta ejemplos clínicos en producción. Proveedores externos de
pagos, correos o calendarios no se ejercitan con operaciones reales como parte de la
escuela. Las fechas y pautas ausentes o ambiguas en FoxPro requieren documentación
adicional; permanecen identificadas como desconocidas.
