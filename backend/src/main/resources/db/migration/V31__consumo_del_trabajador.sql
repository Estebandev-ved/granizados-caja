-- Consumo del trabajador: se toma (o compra) un granizado de su carga. Es una venta con método CONSUMO: baja el stock
-- y cuenta el costo, no entra plata ni a caja ni a Nequi, y lo que pase de los gratis del día se le descuenta de su pago.
ALTER TABLE venta DROP CONSTRAINT ck_venta_metodo;
ALTER TABLE venta ADD CONSTRAINT ck_venta_metodo CHECK (metodo IN ('NEQUI', 'EFECTIVO', 'FIADO', 'MIXTO', 'REGALO', 'CONSUMO'));

-- Lo que se le descuenta al trabajador por esa venta (0 = era de los gratis del día, o no es un consumo).
ALTER TABLE venta ADD COLUMN cargo_vendedor BIGINT NOT NULL DEFAULT 0;

-- Lo que se le descontó por consumos en ese pago, para que quede en la constancia.
ALTER TABLE pago_vendedor ADD COLUMN consumos BIGINT NOT NULL DEFAULT 0;
