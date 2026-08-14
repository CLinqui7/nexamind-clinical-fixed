# NexaMind Clinical

Prototipo funcional en React para seguimiento farmacoterapéutico psiquiátrico, analíticas longitudinales, alertas y agenda clínica.

> Todos los pacientes y resultados son sintéticos. Esta versión es una demostración y no debe almacenar información clínica real.

## Inicio rápido en Windows

1. Descomprime el ZIP.
2. Entra en la carpeta que contiene `package.json`.
3. Haz clic derecho dentro de la carpeta y abre PowerShell, o navega a ella.
4. Ejecuta:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\setup.ps1
.\run.ps1
```

El instalador comprobará Node.js y, cuando sea necesario, intentará instalar Node.js LTS mediante `winget`. La aplicación abrirá en `http://localhost:4173`.

## Inicio manual

```powershell
npm install
npm run check
npm run dev
```

## Estructura

```text
nexamind-clinical/
├── AGENTS.md
├── index.html
├── package.json
├── setup.ps1
├── run.ps1
├── vite.config.js
├── vercel.json
├── styles.css
├── src/
│   ├── app.js
│   ├── data.js
│   └── utils.js
├── supabase/
│   ├── schema.sql
│   ├── seed.sql
│   └── attach_user.sql
└── docs/
```

## Funciones del prototipo

- Dashboard priorizado.
- Expediente longitudinal de nueve pacientes ficticios.
- Escalas PHQ-9, GAD-7, YMRS, ASRS, PANSS, ISI, SDS y Y-BOCS.
- Cambio basal frente a valor actual.
- Adherencia, funcionamiento, sueño, biometría y efectos adversos.
- Alertas clínicas con revisión humana.
- Calendario mensual, semanal y diario.
- Creación de citas y persistencia local.
- Exportación `.ics` y apertura en Google Calendar.
- Esquema Supabase con RLS y seed sintético.

## Verificación

```powershell
npm run check
```

Este comando valida los archivos JavaScript y produce el build de Vite.

## Despliegue en Vercel

1. Sube la carpeta a GitHub con `package.json` en la raíz.
2. Importa el repositorio en Vercel.
3. Vercel detectará Vite.
4. Build command: `npm run build`.
5. Output directory: `dist`.

## Codex

Abre esta carpeta como proyecto en Codex. El archivo `AGENTS.md` contiene las reglas, comandos y límites clínicos del proyecto. Pide cambios pequeños y verificables, y exige `npm run check` antes de aceptar cada tarea.
