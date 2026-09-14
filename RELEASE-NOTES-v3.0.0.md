# Linkare 3.0.0

- Sin acceso demo ni contraseñas locales; registro, recuperación, confirmación e invitación con Supabase Auth.
- Equipo real con secretarías vinculadas y permisos de servidor, sin acceso clínico por defecto.
- Catálogo servidor US$40 mensual, US$220 semestral, US$400 anual; renovación manual y periodo confirmado por webhook.
- Estado por recurso, revisiones optimistas y guardado serializado; no se reemplaza el JSON completo del consultorio.
- Documentos privados, permisos restrictivos y archivo sin destrucción física desde el navegador.
- Notas firmadas visibles, inmutables en el RPC y preservadas exactamente al recargar.
- UI de carga, errores, recuperación, estado de guardado, móvil y guía contextual sin bloqueos.
- Temporizador aislado y chunks separados; sin métricas de velocidad inventadas.
- Google hacia calendario externo, feed Apple y adaptadores de recordatorios con consentimiento/horario/dedupe. Requieren proveedores, OAuth y cron para operar.
- Endpoints antiguos retirados con HTTP 410; migración con archivo privado del legado.

Consultar docs/PRUEBAS-v3.md. El paquete no es un despliegue remoto ni una certificación de seguridad/regulatoria. Se requiere staging y prueba de aceptación en infraestructura propia.
