INSERT INTO producto (sabor, tipo, precio, stock, stock_minimo, orden) VALUES
    ('Smirnoff',         'NORMAL', 6000, 0, 3, 1),
    ('Piña colada',      'NORMAL', 6000, 0, 3, 2),
    ('Margarita',        'NORMAL', 6000, 0, 3, 3),
    ('Tussi',            'NORMAL', 6000, 0, 3, 4),
    ('Mojito',           'NORMAL', 6000, 0, 3, 5),
    ('Sangría',          'NORMAL', 6000, 0, 3, 6),
    ('Four Loko sandía', 'NORMAL', 6000, 0, 3, 7),
    ('Four Loko apple',  'NORMAL', 6000, 0, 3, 8),
    ('Chicle',           'NORMAL', 6000, 0, 3, 9),
    ('Macufresa',        'NORMAL', 6000, 0, 3, 10),
    ('Crema de whisky',  'NORMAL', 6000, 0, 3, 11);

INSERT INTO config (clave, valor, nota) VALUES
    ('PROVEEDOR_WHATSAPP', '',        'Número del proveedor con 57 adelante, sin + ni espacios. Ej: 573001234567'),
    ('DIAS_COBERTURA',     '4',       'Para cuántos días de venta quieres tener inventario después de pedir'),
    ('DIAS_HISTORIAL',     '14',      'Cuántos días atrás mirar para calcular el promedio de ventas'),
    ('NOMBRE',             'Esteban', 'Cómo firmas el pedido');
