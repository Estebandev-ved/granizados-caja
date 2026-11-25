-- Bonos automáticos del equipo: la app arma la escalera de premios de cada trabajador con sus propias ventas
-- (su día normal = la mediana de las últimas 4 semanas) y por cada granizado de más se lleva BONOS_PARTE % de lo que
-- ese granizado deja ya pagada la comisión. Quedan prendidos; con BONOS_AUTO = 0 vuelven los premios a mano.
INSERT INTO config (negocio_id, clave, valor, nota)
SELECT DISTINCT negocio_id, 'BONOS_AUTO', '1', 'Bonos automáticos del equipo: 1 = la app arma los premios de cada trabajador, 0 = los pones a mano'
FROM config;
INSERT INTO config (negocio_id, clave, valor, nota)
SELECT DISTINCT negocio_id, 'BONOS_PARTE', '40', 'Parte (%) de lo que deja cada granizado de más que se lleva el trabajador con los bonos automáticos'
FROM config;
