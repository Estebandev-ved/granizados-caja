-- Bolsillos: una meta ahora puede decir en qué lugar está su plata (caja, casa o Nequi) y si es plata para comprar el
-- próximo pedido (esa sí cuenta para el presupuesto del pedido, aunque esté apartada). `lugar` null = no se dice.
ALTER TABLE meta_plata ADD COLUMN lugar VARCHAR(10);
ALTER TABLE meta_plata ADD COLUMN para_pedido BOOLEAN NOT NULL DEFAULT FALSE;

-- Base de la caja: lo que se deja siempre en efectivo para dar vueltos. No cuenta como plata libre. 0 = sin base.
INSERT INTO config (negocio_id, clave, valor, nota)
SELECT DISTINCT negocio_id, 'CAJA_BASE', '0', 'Plata que dejas siempre en la caja para vueltos (se edita en Mi plata)'
FROM config;
