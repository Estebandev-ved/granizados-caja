-- El pasaje que se le devuelve al trabajador (salida de prueba o vendió menos del mínimo) entra a su liquidación:
-- se suma a lo que se le paga en «Ya le pagué» y se resta de lo que entrega al cerrar el día.
-- Las salidas de antes se devolvían a mano: quedan por fuera para no pagarlas dos veces.
ALTER TABLE salida_calle ADD COLUMN pasaje_en_pago BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE salida_calle SET pasaje_en_pago = FALSE;

-- Lo que se le devolvió de pasajes en cada pago (sale en el paz y salvo)
ALTER TABLE pago_vendedor ADD COLUMN pasajes BIGINT NOT NULL DEFAULT 0;
