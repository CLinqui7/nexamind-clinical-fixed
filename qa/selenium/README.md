# Selenium smoke

Reemplaza la suite histórica basada en cuentas demo y spotlight. Comprueba exclusivamente acceso público, recuperación y ancho móvil; no crea ni modifica datos. No fue ejecutada en el entorno de entrega; las pruebas de navegador registradas en PRUEBAS-v3 usan Playwright/Chromium con respuestas de Supabase simuladas.

Con Vite abierto, ejecutar `powershell -NoProfile -ExecutionPolicy Bypass -File qa/selenium/RUN-SELENIUM-QA.ps1 -Headed`. Requiere Python 3, Chrome y red para Selenium Manager/dependencias.
