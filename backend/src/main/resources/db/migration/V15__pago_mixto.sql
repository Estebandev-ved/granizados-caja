-- Pago dividido: una venta pagada parte en efectivo y parte por Nequi.
-- Con método MIXTO, monto_efectivo es lo que entró a la caja y el resto (total - monto_efectivo) entró por Nequi.
-- Para los demás métodos queda en NULL.
ALTER TABLE venta ADD COLUMN monto_efectivo BIGINT;
ALTER TABLE venta DROP CONSTRAINT ck_venta_metodo;
ALTER TABLE venta ADD CONSTRAINT ck_venta_metodo CHECK (metodo IN ('NEQUI', 'EFECTIVO', 'FIADO', 'MIXTO'));
