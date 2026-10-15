-- Cuándo se le recordó la deuda por WhatsApp (el bot no repite el aviso el mismo día)
ALTER TABLE deuda ADD COLUMN recordado_en TIMESTAMP WITH TIME ZONE;

-- Dónde te pueden pagar: va dentro del mensaje de cobro. Los negocios que ya existen los reciben vacíos
-- (los nuevos los siembra NegocioService).
INSERT INTO config (negocio_id, clave, valor, nota)
SELECT DISTINCT negocio_id, 'PAGO_NEQUI', '', 'Tu número de Nequi para que te paguen lo fiado. Ej: 3001234567'
FROM config;
INSERT INTO config (negocio_id, clave, valor, nota)
SELECT DISTINCT negocio_id, 'PAGO_BREB', '', 'Tu llave Bre-B para que te paguen lo fiado'
FROM config;
INSERT INTO config (negocio_id, clave, valor, nota)
SELECT DISTINCT negocio_id, 'PAGO_PRESENCIAL', '', 'Dónde te pueden pagar en persona. Ej: en la U, bloque 4, en horas de almuerzo'
FROM config;
