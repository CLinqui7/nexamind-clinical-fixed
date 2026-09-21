# Entrega urgente: plan gratuito

El acceso gratuito se decide en PostgreSQL con `linkare_subscriptions_v3.complimentary_access`, valor predeterminado `true`. Se agrega una suscripción para cada organización que no tenga una. El bootstrap existente ya crea la suscripción para los nuevos consultorios. El acceso no requiere `current_period_end`, checkout ni una orden Wompi. Se conservan las vigencias pagadas y los tres planes.

La migración modifica únicamente las suscripciones y las funciones de entitlement/carga; no modifica expedientes. Antes: ejecutar PRECHECK-FREE-ACCESS.sql y respaldar esquema y suscripciones. Después: ejecutar POSTCHECK-FREE-ACCESS.sql. Aplicar únicamente la migración `enable_free_access`, nunca las migraciones históricas en bloque.

Reactivar pago en el futuro exige una decisión administrativa explícita del servidor: establecer `complimentary_access=false` para las organizaciones elegidas y cambiar el valor predeterminado de la columna para nuevas cuentas. El cliente no tiene permiso UPDATE sobre suscripciones.

Esta entrega no cambia los roles existentes. La ampliación a Doctor/Enfermería y permisos individuales se entrega posteriormente.

Mensaje sugerido: “Esta es tu cuenta de prueba de Linkare. Por ahora tienes acceso completo al sistema para que puedas conocer todos sus módulos y probar su funcionamiento.”
