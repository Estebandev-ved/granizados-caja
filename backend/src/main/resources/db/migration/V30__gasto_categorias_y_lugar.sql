-- Gastos: categorías libres (las de siempre más las que cada negocio escriba) y de dónde salió la plata.
-- Los gastos de antes quedan como salidos de la caja, que era lo que se asumía.
ALTER TABLE gasto DROP CONSTRAINT ck_gasto_categoria;
ALTER TABLE gasto ADD COLUMN lugar VARCHAR(10) NOT NULL DEFAULT 'CAJA';
ALTER TABLE gasto ADD CONSTRAINT ck_gasto_lugar CHECK (lugar IN ('CAJA', 'CASA', 'NEQUI'));
