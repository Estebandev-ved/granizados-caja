-- Meta del día para el equipo: cuántos granizados debe vender cada trabajador y, si quieres, un premio en pesos
-- por cada día que la cumpla. Los negocios que ya existen los reciben apagados (los nuevos los siembra NegocioService).
INSERT INTO config (negocio_id, clave, valor, nota)
SELECT DISTINCT negocio_id, 'META_EQUIPO', '0', 'Granizados que debe vender cada trabajador al día. 0 la apaga'
FROM config;
INSERT INTO config (negocio_id, clave, valor, nota)
SELECT DISTINCT negocio_id, 'PREMIO_EQUIPO', '0', 'Pesos que gana el trabajador por cada día que cumple la meta. 0 = solo reconocimiento'
FROM config;
