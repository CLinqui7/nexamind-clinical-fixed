# Preparación de Supabase

La aplicación local todavía no ejecuta estas consultas. Los archivos preparan la siguiente fase multiusuario.

Orden sugerido en un proyecto Supabase nuevo:

1. `schema.sql`
2. `migrations/20260814_v1_2_practice_features.sql`
3. `seed.sql` solamente en un entorno de demostración
4. Crear usuarios en Supabase Auth
5. Ejecutar `attach_user.sql` con los identificadores correctos

Antes de datos reales deben configurarse MFA, RLS, Storage privado, auditoría, backups, retención y revisión legal.

No coloque la clave `service_role` en variables `VITE_*` ni en el navegador.
