-- Costos reales pagados a Energy Cocktails (promedio de las compras de sept/2026).
-- Piña colada y Crema de whisky llevan más licor/crema, por eso cuestan más.

UPDATE producto SET costo = 3400 WHERE sabor IN ('Piña colada', 'Crema de whisky');
UPDATE producto SET costo = 2200 WHERE sabor NOT IN ('Piña colada', 'Crema de whisky');
