# Tablet, capacitación y soporte

La prueba responsive cubre una tablet Samsung representativa en 800 × 1280 (vertical) y 1280 × 800 (horizontal). Recorre autenticación, pacientes y medicamentos, comprueba errores de JavaScript y detecta desbordamiento horizontal. Las capturas se guardan en `qa-results/tablet-portrait.png` y `qa-results/tablet-landscape.png`.

El Centro de ayuda muestra una guía distinta para Médico y Secretaría, preguntas frecuentes sobre guardado, recetas y permisos, y reserva una ubicación para tutoriales. El video no se inventa: aparece únicamente cuando se configura `VITE_TUTORIAL_URL` con una URL HTTPS real.

El soporte por WhatsApp usa `VITE_SUPPORT_WHATSAPP_NUMBER`, centralizado en la configuración de compilación y sin texto clínico precargado. El valor debe contener el número internacional. Si no está configurado, el botón no aparece.
