-- Reto personal del trabajador (premio tipo DiDi): la meta que se pone cada día ahora paga un premio calculado con sus
-- propias ventas de las últimas semanas. El premio queda congelado al escogerla, así cambiar tarifas o costos después
-- no reescribe lo prometido. `premio_previo` guarda lo que ya se ganó con la meta anterior si la sube («¿vas por más?»).
ALTER TABLE meta_vendedor ADD COLUMN premio BIGINT NOT NULL DEFAULT 0;
ALTER TABLE meta_vendedor ADD COLUMN premio_previo BIGINT NOT NULL DEFAULT 0;
