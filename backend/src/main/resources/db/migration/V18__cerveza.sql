-- Cerveza como un tipo más de producto (la marca va en "sabor"): se vende, descuenta stock y cuenta ganancia igual.
ALTER TABLE producto DROP CONSTRAINT ck_producto_tipo;
ALTER TABLE producto ADD CONSTRAINT ck_producto_tipo CHECK (tipo IN ('NORMAL', 'CREMOSO', 'GRANDE', 'CERVEZA'));
