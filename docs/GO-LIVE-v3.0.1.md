# Linkare v3.0.1 - Bootstrap de producción

Este paquete NO aplica la migración v3 automáticamente. Primero ejecute la migración `supabase/migrations/202609080001_linkare_v3.sql` en el proyecto correcto y valide `POSTCHECK-v3.sql`.

Después copie los dos scripts de este paquete al proyecto y ejecute `scripts/CREAR-USUARIOS-PRODUCCION.ps1`.

Usuarios por defecto:
- Administrador/owner: linquicarloss@gmail.com
- Médico: linquicarloss+doctor@gmail.com
- Secretaría: linquicarloss+secretaria@gmail.com

Los alias `+doctor` y `+secretaria` llegan a la misma bandeja Gmail, pero Supabase los trata como cuentas distintas.

El usuario owner se muestra en Linkare como acceso clínico/administrador. No es un superadministrador global de todas las clínicas.

El script no activa una suscripción sin pago. Los planes son los del servidor: US$40 mensual, US$220 semestral, US$400 anual.
