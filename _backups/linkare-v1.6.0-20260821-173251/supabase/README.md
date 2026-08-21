Ejecute en SQL Editor:
1. schema.sql
2. seed.sql (opcional para demo)
3. migrations/20260814_v1_2_practice_features.sql
4. migrations/20260821_v1_3_payments.sql

Variables en Vercel:
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_WOMPI_PUBLIC_KEY
VITE_WOMPI_CHECKOUT_URL
VITE_WOMPI_REDIRECT_URL

La interfaz todavía conserva almacenamiento local como fallback. Para datos reales, conecte CRUD/Auth/Storage/RLS antes de introducir información clínica real.
