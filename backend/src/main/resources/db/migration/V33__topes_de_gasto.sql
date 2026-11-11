-- Topes de gasto al mes por categoría (JSON corto, ej. {"HIELO":60000,"TRANSPORTE":40000}). Vacío = sin topes.
-- La app avisa cuando una categoría se acerca o se pasa de su tope en el mes.
INSERT INTO config (negocio_id, clave, valor, nota)
SELECT DISTINCT negocio_id, 'TOPES_GASTO', '', 'Tope de gasto al mes por categoría (lo edita Hoy → Gastos del mes)'
FROM config;
