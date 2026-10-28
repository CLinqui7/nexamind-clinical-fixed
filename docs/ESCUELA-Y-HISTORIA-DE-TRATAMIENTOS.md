# Escuela y cronología de tratamientos

La escuela se abre desde Ayuda → Escuela completa. Incluye 32 capítulos,
365 controles explicados, ejercicios, preguntas de comprobación, progreso local
por cuenta y navegador, un manual HTML imprimible y 32 videos sin voz, con música instrumental suave, texto completo a un lado y
subtítulos. Usan exclusivamente pantallas de la base SQL aislada con datos ficticios.
El texto también aparece en un panel legible junto al reproductor (debajo en móvil),
con selector, anterior y siguiente; elegir un paso pausa el video para leer.
La música empieza a volumen bajo, sin reproducción automática, y se puede silenciar.
Son guías visuales de los controles; la práctica de operaciones se realiza en el recorrido temporal.

El capítulo inicial corresponde a la pantalla y pestaña abiertas. Los permisos
filtran los capítulos clínicos y administrativos; la escuela no modifica permisos.
La página de acceso ofrece un tutorial público específico de invitaciones y acceso.

## Contenido y medios

- `src/learning-content.js`: capítulos, controles, resultados esperados, ejercicios y preguntas.
- `src/learning.js`: navegación, lectura, comprobación y progreso.
- `public/tutorials/pages/manifest.json`: duración, controles y SHA-256 del contenido de cada video.
- `scripts/build-training-manual.mjs`: manual generado en cada build.
- `src/domain/learning-scenes.js`: copia íntegra y tiempos compartidos entre video y panel.
  Cada paso dispone de al menos 12 segundos, calculados a 135 palabras por minuto.
- `src/learning-video.js`: texto sincronizado, saltos con pausa, música y descarga.
- `scripts/compose-tutorial-music.py`: composición instrumental original, sin voz,
  grabaciones ni muestras externas. Requiere Python con NumPy (usado: 2.5.4).
- `qa/browser/build-page-videos.mjs`: capturas locales y MP4 con una única pista
  instrumental; no usa archivos de narración anteriores. Requiere Edge/Playwright
  y Python con imageio-ffmpeg 0.6.0.
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
node qa/browser/learning-video-reading.mjs
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


## Reconstrucción del audio y videos

Con el servidor QA local en otra terminal, genere el WAV con
`python scripts/compose-tutorial-music.py qa/results/page-videos/calm-reading.wav`.
Con FFmpeg normalice a -26 LUFS y codifique MP3 estéreo de 24 kHz / 96 kbps,
guardando `public/tutorials/calm-reading.mp3`. Luego ejecute
`node qa/browser/build-page-videos.mjs`. El generador integra solo esa música,
con entrada y salida gradual, en los 32 MP4. El manifiesto versión 2 registra
`narration: false`, hash de la música y duración por capítulo. Los JSON por capítulo
conservan todas las escenas y sus tiempos. No hace llamadas a proveedores de audio.

Cotización consultada el 28/10/2026, sin generar audio: narrar los 32 capítulos
con Dylan / Seed Audio (WAV, 48 kHz, velocidad -8) costaría 444,7 créditos según
Higgsfield, repartidos en 53 segmentos de hasta 2048 caracteres. Es una cotización
del contenido actual, sin reintentos ni cambios posteriores; no se convierte a
dólares. La versión publicada conserva texto y música, sin esa narración.
