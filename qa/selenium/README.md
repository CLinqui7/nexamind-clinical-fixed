# Selenium QA de NexaMind Clinical

La suite abre Chrome y prueba los flujos que más riesgo tienen en la demostración:

1. Login médico y rechazo de contraseña incorrecta.
2. Tutorial completo hasta Pacientes, Nuevo paciente y Seguro médico.
3. El spotlight apunta al control correcto y la tarjeta no lo cubre.
4. El paso Guardar o cancelar queda visible.
5. El paso Fotografía del paciente encuentra el objetivo en el expediente clínico.
6. La barra superior del tutorial permite arrastrar el panel y el botón Auto lo devuelve a su posición calculada.
7. Tutorial en tamaño móvil sin pantalla blanca.
8. Login de secretaría y ocultamiento de módulos sin permiso.

## Ejecutar en Windows

Desde la raíz del proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File .\qa\selenium\RUN-SELENIUM-QA.ps1
```

Para observar cada clic:

```powershell
powershell -ExecutionPolicy Bypass -File .\qa\selenium\RUN-SELENIUM-QA.ps1 -Headed
```

La primera ejecución crea `.qa-selenium-venv` e instala Selenium. Selenium Manager usa el Chrome instalado para resolver el controlador compatible.

Los resultados, el reporte JSON y las capturas de cualquier fallo quedan en `qa\selenium\artifacts`.
