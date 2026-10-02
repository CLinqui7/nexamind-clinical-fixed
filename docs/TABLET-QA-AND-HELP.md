# Tablet, capacitación y soporte

El Centro de ayuda incluye dos videos propios (`public/tutorials/secretaria.webm` y `public/tutorials/doctor.webm`), guía rápida específica del rol, preguntas frecuentes y un recorrido interactivo. Los videos usan únicamente la base PostgreSQL aislada de QA y un paciente ficticio; no contienen capturas de producción. El video de Secretaría sirve para ambas secretarias, pero cada una debe entrar con su cuenta y contraseña individual.

El recorrido tiene pasos para cada rol. Solo muestra pantallas a las que el usuario tiene permiso. En escritorio reserva una columna lateral; en tablet y móvil coloca la explicación en una bandeja inferior y desplaza el objetivo por encima de ella. Los controles de la aplicación siguen disponibles, y cambiar de paso no cierra formularios sin guardar. Se puede abandonar con «Cerrar recorrido» o Escape. La preferencia «Reducir movimiento» se respeta.

Reproducción de los videos: iniciar `node qa/browser/server.mjs` y luego ejecutar `node qa/browser/record-tutorials.mjs`. El script crea una ficha de demostración solo en el PostgreSQL en memoria y graba los videos; nunca escribe en Supabase. Después ejecutar `node qa/browser/training.mjs` para comprobar reproducción, pestañas, pasos, botones y ausencia de errores. Los videos son WebM sin voz: todo el texto explicativo está integrado visualmente en el cuadro, separado de la pantalla del sistema.

La validación responsive automatizada emula tamaños de tablet Samsung 800 × 1280 (vertical) y 1280 × 800 (horizontal), con eventos táctiles, más un móvil de 390 × 844. Comprueba controles del recorrido, selector de calendario, ausencia de desbordamiento horizontal y errores de JavaScript. No equivale a una prueba en hardware Samsung físico; esa comprobación final necesita un dispositivo real del consultorio.

El soporte por WhatsApp usa `VITE_SUPPORT_WHATSAPP_NUMBER` en la compilación, sin texto clínico precargado. Debe ser el número internacional autorizado. Mientras no se proporcione, la ayuda muestra que está pendiente y no abre un destino falso. Tras configurar el número, ejecutar el build y comprobar el enlace en una cuenta de prueba.
