-- Varias promos a la vez y combos mixtos (ej. 1 cremoso + 1 refrescante): la lista ya no cabe en 500 caracteres.
ALTER TABLE config ALTER COLUMN valor SET DATA TYPE VARCHAR(2000);

-- Dopamina Cocktails: las promos de la carta, prendidas todos los días (también en las salidas a la calle).
-- "partes" va en el mismo orden de "tipos": cuántos de cada uno lleva el combo mixto.
UPDATE config SET valor = '['
    || '{"activa":true,"cantidad":2,"precio":13000,"tipos":["NORMAL"],"soloHoy":false,"dia":"","dias":[],"nombre":"refrescantes"},'
    || '{"activa":true,"cantidad":3,"precio":19000,"tipos":["NORMAL"],"soloHoy":false,"dia":"","dias":[],"nombre":"refrescantes"},'
    || '{"activa":true,"cantidad":2,"precio":18000,"tipos":["CREMOSO"],"soloHoy":false,"dia":"","dias":[],"nombre":"cremosos"},'
    || '{"activa":true,"cantidad":2,"precio":15500,"tipos":["CREMOSO","NORMAL"],"soloHoy":false,"dia":"","dias":[],"nombre":"1 cremoso + 1 refrescante","partes":[1,1]},'
    || '{"activa":true,"cantidad":5,"precio":35000,"tipos":["NORMAL","CREMOSO"],"soloHoy":false,"dia":"","dias":[],"nombre":"4 refrescantes + 1 cremoso","partes":[4,1]}'
    || ']'
WHERE negocio_id = 1 AND clave = 'PROMO';
