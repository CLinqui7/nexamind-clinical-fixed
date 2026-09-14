# Browser QA

Se ejecutaron 12 comprobaciones de UI con Chromium y React/HTM reales, en un harness sin red y con SDK de Supabase simulado. `mock-sdk.js` no se importa desde src y no debe incorporarse a producción.

El runtime disponible bloquea navegación incluso a localhost; por eso inline-harness.py usa módulos data/importmap y normaliza la ruta a `/`. Esto NO prueba rutas HTTP, cabeceras de Vercel, Vite, RLS de PostgreSQL ni APIs externas.

El informe de entrega está en qa/results/browser-report.json. Para reproducir el harness, proporcione LINKARE_QA_RUNTIME con los módulos ESM preoptimizados de React/HTM y CHROMIUM_PATH. El smoke Selenium alternativo funciona con un servidor Vite real y no usa las antiguas credenciales demo.
