-- Los días de promoción el margen es menor: los premios por escalón bajan en esta cantidad (sin pasar de 0).
-- Cada venta guarda si fue en promoción, así un día ya pagado no cambia si después se mueve el calendario de la promo.
ALTER TABLE venta ADD COLUMN en_promo BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO config (negocio_id, clave, valor, nota)
SELECT DISTINCT negocio_id, 'PREMIO_REBAJA_PROMO', '0', 'Pesos que bajan los premios por escalón los días de promoción. 0 = no bajan'
FROM config;
UPDATE config SET valor = '5000' WHERE negocio_id = 1 AND clave = 'PREMIO_REBAJA_PROMO' AND valor = '0';
