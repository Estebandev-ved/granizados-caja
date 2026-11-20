-- El premio del reto ahora se gana por pasos: empieza desde `desde` granizados (un poco menos de lo que el trabajador
-- vende normalmente) y va subiendo con cada uno hasta llegar completo a la meta. Queda congelado al escoger la meta.
-- 0 = metas de antes: todo o nada, el premio solo se paga al cumplirla.
ALTER TABLE meta_vendedor ADD COLUMN desde INT NOT NULL DEFAULT 0;
