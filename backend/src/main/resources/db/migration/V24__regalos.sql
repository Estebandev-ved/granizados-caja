-- Regalos (sellos de fidelización, cortesías): una venta con método REGALO baja el stock y cuenta el costo, pero no entra plata.
ALTER TABLE venta DROP CONSTRAINT ck_venta_metodo;
ALTER TABLE venta ADD CONSTRAINT ck_venta_metodo CHECK (metodo IN ('NEQUI', 'EFECTIVO', 'FIADO', 'MIXTO', 'REGALO'));
