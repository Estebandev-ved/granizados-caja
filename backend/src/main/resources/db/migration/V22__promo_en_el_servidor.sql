-- La promoción deja de vivir en el celular del dueño: se guarda en el servidor y le llega a todos los celulares
-- (incluidos los de los trabajadores) con el estado. "dias" son los días de la semana en que corre (1 = lunes ... 7 = domingo).
INSERT INTO config (negocio_id, clave, valor, nota)
SELECT DISTINCT negocio_id, 'PROMO', '', 'Promoción (la edita Ajustes → Promoción)'
FROM config;
-- Dopamina Cocktails: 2 x $10.000 en los Normales todos los miércoles
UPDATE config SET valor = '{"activa":true,"cantidad":2,"precio":10000,"tipos":["NORMAL"],"soloHoy":false,"dia":"","dias":[3]}'
WHERE negocio_id = 1 AND clave = 'PROMO' AND valor = '';
