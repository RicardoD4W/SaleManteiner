-- Migración 002: agregar purchase_date.
--
-- El campo es TEXT NULL con formato 'YYYY-MM-DD' (día local, sin hora, sin zona).
-- Nullable porque una venta puede existir sin fecha de compra conocida al cargarla
-- (ej. ventas heredadas de un Excel anterior al MVP).
--
-- El formato 'YYYY-MM-DD' se valida en Zod (ver `LocalDate` en common.ts).
-- SQLite no tiene DATE nativo: guardamos ISO-8601 día para poder ordenar
-- lexicográficamente como si fuera una fecha, y mostrar `dd/MM/yyyy` en UI.
--
-- El comportamiento de `sold_at` ya existía en la migración 001. Lo que cambia
-- en esta fase es que el server deja de auto-gestionarlo y respeta el input del
-- cliente. Esa lógica vive en el repo, no acá — el SQL no se toca.

ALTER TABLE sales ADD COLUMN purchase_date TEXT;
