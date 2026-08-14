# Gobierno clínico y seguridad del producto

## Posicionamiento

NexaMind debe presentarse como una herramienta de apoyo a decisiones y seguimiento longitudinal. No diagnostica, prescribe ni sustituye la valoración del psiquiatra.

## Reglas obligatorias

1. Cada resultado debe conservar timestamp, fuente, unidad y contexto.
2. Toda escala debe tener definición, versión, dirección y umbrales configurables.
3. El baseline debe ser explícito y no inferirse silenciosamente.
4. Los cambios porcentuales solo deben usarse cuando sean clínicamente interpretables.
5. Las alertas deben mostrar la regla y versión que las generó.
6. El médico debe poder reconocer, descartar, posponer y documentar resolución.
7. La atribución a medicamento debe utilizar lenguaje de asociación temporal.
8. Deben registrarse adherencia, titulación, suspensión, confusores y eventos concurrentes.
9. Las reglas de laboratorio y periodicidad deben variar por fármaco, paciente y guía adoptada.
10. No debe existir un único “AI score” de salud mental.

## Validación antes de producción

- Revisión por psiquiatra responsable.
- Revisión farmacológica.
- Revisión legal y de privacidad.
- Pruebas con casos clínicos sintéticos y casos límite.
- Pruebas de alert fatigue.
- Validación de accesibilidad.
- Prueba de recuperación ante errores de integración.

## Fuentes de referencia inicial

- NICE: Bipolar disorder, assessment and management.
- NICE: Psychosis and schizophrenia in adults.
- NICE: Attention deficit hyperactivity disorder.
- FDA: boxed warning for benzodiazepines.
- Documentación oficial de Supabase, Next.js, Vercel y Google Calendar.

Las fuentes deben registrarse dentro de cada protocolo y actualizarse con control de versiones.
