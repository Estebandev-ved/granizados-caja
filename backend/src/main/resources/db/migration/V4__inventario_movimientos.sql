-- Fase 1: entrada_inventario pasa a ser el registro de TODOS los movimientos de stock.
-- La cantidad guarda el delta aplicado: puede ser 0 (conteo que no cambió nada) o negativo (merma).

ALTER TABLE entrada_inventario ADD COLUMN tipo VARCHAR(10) NOT NULL DEFAULT 'ENTRADA';
ALTER TABLE entrada_inventario ADD COLUMN motivo VARCHAR(10);
ALTER TABLE entrada_inventario ADD COLUMN pedido_id BIGINT;

-- Un conteo cuadrado puede dar delta 0 y se queda igual para la auditoría
ALTER TABLE entrada_inventario DROP CONSTRAINT ck_entrada_cantidad;

ALTER TABLE entrada_inventario ADD CONSTRAINT ck_entrada_tipo
    CHECK (tipo IN ('ENTRADA', 'CONTEO', 'MERMA'));
ALTER TABLE entrada_inventario ADD CONSTRAINT ck_entrada_motivo
    CHECK (motivo IS NULL OR motivo IN ('DANADO', 'REGALADO', 'VENCIDO'));
