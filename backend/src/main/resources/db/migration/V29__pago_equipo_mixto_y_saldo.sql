-- Pago al trabajador en dos partes y abonos.
-- MIXTO: una parte en efectivo (monto_efectivo) y el resto (monto - monto_efectivo) por Nequi.
-- saldo: lo que el dueño quedó debiendo después de este pago (le dio menos y lo paga después). 0 = quedó a paz y salvo.
ALTER TABLE pago_vendedor ADD COLUMN monto_efectivo BIGINT NOT NULL DEFAULT 0;
UPDATE pago_vendedor SET monto_efectivo = monto WHERE metodo = 'EFECTIVO';
ALTER TABLE pago_vendedor ADD COLUMN saldo BIGINT NOT NULL DEFAULT 0;
ALTER TABLE pago_vendedor DROP CONSTRAINT ck_pago_vendedor_metodo;
ALTER TABLE pago_vendedor ADD CONSTRAINT ck_pago_vendedor_metodo CHECK (metodo IN ('EFECTIVO', 'NEQUI', 'MIXTO'));
