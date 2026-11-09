-- Perfil del negocio (JSON corto): nombre, rubro, cómo llama a lo que vende y qué funciones usa (equipo, fiados, cerveza).
-- Vacío = negocio de antes del perfil: se comporta como siempre (todo prendido). Lo llena la bienvenida o Ajustes.
INSERT INTO config (negocio_id, clave, valor, nota)
SELECT DISTINCT negocio_id, 'PERFIL', '', 'Perfil del negocio (lo edita la bienvenida y Ajustes → Mi negocio)'
FROM config;
