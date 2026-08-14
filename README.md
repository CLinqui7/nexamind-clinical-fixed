# NexaMind Clinical 1.2.0

Aplicación React/Vite para demostrar seguimiento longitudinal en psiquiatría, gestión de tratamientos, agenda, recordatorios, recetas membretadas y una vista administrativa con permisos para secretaría.

> **Datos sintéticos solamente.** Esta versión guarda la información en el navegador (`localStorage`). No debe usarse con pacientes reales hasta conectar Supabase, autenticación, almacenamiento seguro, auditoría y controles legales/operativos.

## Instalación rápida en Windows

### Opción 1: doble clic

1. Extraiga completamente el ZIP.
2. Abra la carpeta `NexaMind-Clinical-Completo-v1.2.0`.
3. Ejecute `INSTALAR-Y-ABRIR.bat`.

El instalador comprueba Node.js, intenta instalar Node.js LTS mediante `winget` cuando hace falta, descarga las dependencias, ejecuta pruebas y genera el build de producción.

### Opción 2: PowerShell

```powershell
cd "C:\Users\aleja\Downloads\NexaMind-Clinical-Completo-v1.2.0"
Set-ExecutionPolicy -Scope Process Bypass
.\setup.ps1
.\run.ps1
```

La aplicación abre en:

```text
http://localhost:4173
```

Después de la primera instalación, basta con ejecutar `ABRIR-NEXAMIND.bat` o `./run.ps1`.

## Funciones incluidas

### Seguimiento clínico

- Dashboard con pacientes prioritarios, agenda y avisos.
- Registro y edición de pacientes.
- Fotografía del paciente, optimizada antes de guardarse.
- Diagnóstico, escala basal y seguimiento longitudinal.
- Medicamentos activos, dosis, frecuencia, vía e indicación.
- Aumento o reducción de dosis con historial y motivo.
- Registro de evolución, adherencia, funcionamiento, sueño y riesgo.
- Signos vitales, IMC, efectos observados y laboratorios.
- Línea de tiempo unificada.
- Analíticas descriptivas de cambio basal frente a valor actual.
- Lenguaje prudente: cambio observado y asociación temporal, sin afirmar causalidad automática.

### Agenda y recordatorios

- Calendario mensual, semanal y diario.
- Crear, editar, completar, cancelar o eliminar citas.
- Recordatorios configurables a 72, 48, 24, 8 o 2 horas.
- Cola de recordatorios: programado, listo, pendiente o enviado.
- Mensaje preparado para WhatsApp y registro manual del envío.
- Exportación `.ics` y apertura de eventos en Google Calendar.

### Clínica, usuarios y documentos

- Paleta profesional: Milk `#FCFDF6`, Ceil `#8FACCB` y Dark Midnight Blue `#05316E`.
- Logo de clínica y fotografía del médico.
- Datos profesionales, licencia, contacto y pie de receta.
- Seguro médico, plan, afiliado, póliza, copago y autorización.
- Generador de recetas A4 con membrete, múltiples medicamentos, firma y sello.
- Historial de recetas en el expediente.
- Usuario de secretaría con vista simplificada.
- Permisos configurables por función.
- Selector para probar la vista del médico o de la secretaria.
- Tutorial inicial guiado y repetible desde Ayuda.

## Archivos principales

```text
NexaMind-Clinical-Completo-v1.2.0/
├── INSTALAR-Y-ABRIR.bat
├── ABRIR-NEXAMIND.bat
├── setup.ps1
├── run.ps1
├── package.json
├── index.html
├── styles.css
├── src/
│   ├── app.js          # Pantallas, formularios, tutorial y navegación
│   ├── clinical.js     # Operaciones clínicas y agenda
│   ├── data.js         # Seed sintético y normalización
│   ├── practice.js     # Clínica, fotos, recetas, recordatorios y permisos
│   └── utils.js        # Fechas, cálculos y exportaciones
├── scripts/
│   └── validate-domain.mjs
├── supabase/
│   ├── schema.sql
│   ├── seed.sql
│   ├── attach_user.sql
│   └── migrations/
└── docs/
```

## Validación

```powershell
npm run check
```

El comando realiza:

1. Revisión de sintaxis de todos los módulos.
2. Pruebas de dominio con datos ficticios.
3. Build de producción con Vite.

También puede usar `VERIFICAR-PROYECTO.bat` después de instalar.

## Reiniciar los datos de demostración

Desde la configuración del sistema puede restaurar el seed. También puede borrar el almacenamiento del sitio desde las herramientas del navegador. Esto elimina solamente datos ficticios guardados en ese navegador.

## Publicación en Vercel

```powershell
npm run check
npx vercel@latest --prod
```

Vercel debe usar:

```text
Build command: npm run build
Output directory: dist
```

## GitHub después de verificarlo

Cuando quiera reemplazar el contenido del repositorio con esta versión:

```powershell
cd "C:\Users\aleja\Downloads\NexaMind-Clinical-Completo-v1.2.0"
git init
git branch -M main
git remote add origin https://github.com/CLinqui7/nexamind-clinical-fixed.git
git add .
git commit -m "feat: NexaMind Clinical 1.2.0"
git push -u origin main --force-with-lease
```

No ejecute el último comando sin revisar antes `git status`. Si desea conservar el historial remoto sin forzar, clone el repositorio y copie encima estos archivos antes de hacer commit.

## Siguiente fase de producción

La interfaz ya demuestra los flujos, pero la operación clínica real requiere:

- Supabase Auth y MFA.
- PostgreSQL compartido.
- Row Level Security.
- Supabase Storage para fotografías y logos.
- Usuarios reales y recuperación de acceso.
- Auditoría de lecturas y cambios.
- Envío real de recordatorios mediante un proveedor autorizado.
- Revisión clínica, legal, de privacidad y seguridad.
