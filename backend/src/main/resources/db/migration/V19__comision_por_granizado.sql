-- Comisión del trabajador por granizado vendido, según el tipo (Normal, Cremoso, Grande, Cerveza).
-- Se congela en la venta, así cambiar las tarifas no reescribe lo que ya se pagó. NULL = venta vieja o negocio sin tarifas:
-- esas se siguen liquidando con el porcentaje del trabajador. Las tarifas nacen en 0 (apagadas): el dueño las pone en Ajustes.
ALTER TABLE venta ADD COLUMN comision_unitaria BIGINT;
ALTER TABLE venta ADD CONSTRAINT ck_venta_comision CHECK (comision_unitaria IS NULL OR comision_unitaria >= 0);

INSERT INTO config (negocio_id, clave, valor, nota)
SELECT DISTINCT negocio_id, 'COMISION_NORMAL', '0', 'Pesos que gana el trabajador por cada granizado Normal. Con todas en 0 se usa su porcentaje'
FROM config;
INSERT INTO config (negocio_id, clave, valor, nota)
SELECT DISTINCT negocio_id, 'COMISION_CREMOSO', '0', 'Pesos que gana el trabajador por cada granizado Cremoso'
FROM config;
INSERT INTO config (negocio_id, clave, valor, nota)
SELECT DISTINCT negocio_id, 'COMISION_GRANDE', '0', 'Pesos que gana el trabajador por cada granizado Grande'
FROM config;
INSERT INTO config (negocio_id, clave, valor, nota)
SELECT DISTINCT negocio_id, 'COMISION_CERVEZA', '0', 'Pesos que gana el trabajador por cada cerveza'
FROM config;
