-- Comisión distinta para las ventas en promoción (el margen es menor) y cómo prefiere cobrar cada trabajador.
-- COMISION_PROMO en 0 = en promoción gana la tarifa normal. Dopamina arranca con $700 por granizado en promo.
ALTER TABLE vendedor ADD COLUMN frecuencia_pago VARCHAR(10);
ALTER TABLE vendedor ADD CONSTRAINT ck_vendedor_frecuencia
    CHECK (frecuencia_pago IS NULL OR frecuencia_pago IN ('DIARIO', 'SEMANAL', 'QUINCENAL'));

INSERT INTO config (negocio_id, clave, valor, nota)
SELECT DISTINCT negocio_id, 'COMISION_PROMO', '0', 'Pesos que gana el trabajador por cada granizado vendido en promoción. 0 = gana la tarifa normal'
FROM config;
UPDATE config SET valor = '700' WHERE negocio_id = 1 AND clave = 'COMISION_PROMO' AND valor = '0';
