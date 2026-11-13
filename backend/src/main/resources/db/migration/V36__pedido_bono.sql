-- Bono/descuento del proveedor en un pedido. Pediste $290.000 y te lo dejó en $240.000: aquí quedan los $50.000.
-- No baja plata adicional: solo achica lo que se le paga al recibir (bruto − bono). Visible en el cierre del mes.
ALTER TABLE pedido_proveedor ADD COLUMN bono BIGINT NOT NULL DEFAULT 0;
ALTER TABLE pedido_proveedor ADD CONSTRAINT ck_pedido_bono CHECK (bono >= 0);
