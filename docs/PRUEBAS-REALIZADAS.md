# Pruebas realizadas para la versión 1.2.0

## Automatizadas

- Sintaxis de `app.js`, `clinical.js`, `data.js`, `practice.js`, `utils.js` y `vite.config.js`.
- Creación de paciente con seguro médico.
- Registro de medicamento y cambio de dosis con historial.
- Registro de escala clínica, adherencia, funcionamiento y sueño.
- Registro de signos vitales e IMC.
- Registro de efecto observado y laboratorio.
- Creación y edición de cita conservando recordatorios enviados.
- Configuración de clínica, logo y fotografía del médico.
- Creación de secretaria y actualización de permisos.
- Generación de receta y HTML A4 membretado.
- Cola de recordatorios y marcado de envío.
- Analíticas y resumen longitudinal.
- Normalización de datos importados.

## Renderizado de interfaz

Se ejecutó una prueba de renderizado sobre:

- Inicio.
- Pacientes.
- Agenda mensual, semanal y diaria.
- Analíticas.
- Avisos.
- Configuración.
- Seis pestañas del expediente.
- Formularios de paciente, tratamiento, dosis, evolución, signos vitales, efectos, laboratorio, receta, clínica, secretaria, permisos y citas.
- Detalle de cita.
- Tutorial inicial y recorrido guiado.

## Validación final en la computadora del usuario

El instalador ejecuta `npm run check`, que además produce el build real de Vite con las dependencias instaladas. Antes de usar el sistema, pruebe en Chrome o Edge los flujos principales y mantenga datos ficticios hasta completar la fase de producción.
