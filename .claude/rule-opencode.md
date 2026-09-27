# Plan: nuevas funciones para Dopamina Cocktails (caja)

## Contexto
La app (Spring Boot 4 + React PWA, en Railway) ya vende, repone, arma el pedido sugerido y entra con Face ID. Esteban aprobó implementar las funciones propuestas:

1. Conteo de inventario y mermas.
2. Pedido con seguimiento y "Llegó el pedido".
3. Ganancia real (costos y gastos).
4. Reportes con horas pico.
5. Meta del día con racha.
6. Extras: arqueo de caja y calculadora de vueltas. Las promos quedan para después.

Hoy el inventario solo se puede sumar (en las pruebas quedó Mojito en -3), no se sabe cuánto se gana y no hay historial.

Reglas que no se rompen:
- Vender sigue siendo 2 toques.
- Todo lo que se hace en la calle funciona sin señal (cola offline con `clientUid` idempotente).
- La plata va en pesos enteros.
- "Hoy" es hora de Bogotá.
- Nada de datos de clientes.
- Cada cambio de esquema es una migración Flyway nueva que funcione en PostgreSQL y en H2.

## Piezas que se reutilizan
- **Stock atómico:** `ProductoRepository.sumarStock` (`backend/.../producto/ProductoRepository.java`).
- **Idempotencia por `client_uid`:** el patrón de `VentaService` e `InventarioService`, más el `catch DataIntegrityViolationException` de `VentaController` e `InventarioController`.
- **Cola offline:** `subirPendientes` en `frontend/src/cola.ts`, con la regla 4xx = descartar; `estadoVisible` en `frontend/src/estadoLocal.ts`; `useCaja` en `frontend/src/useCaja.ts`.
- **Estado y totales:** `EstadoService` (`resumir`, `ventasDe`, `hoy()`), `PedidoService.sugerido()`, `Reportes` (textos de Telegram), `AjustesService` (config clave/valor con `validar`).
- **UI:** `Sheet`, `TarjetaProducto`, `IconoFaceId`, `useToast`, estilos y variables en `estilos.css` (`--grad`, `--morado`).
- **Pruebas:** `PruebaIntegracion` y `RelojPrueba` en el backend; vitest con `fake-indexeddb` en el frontend.

## Cambios transversales
- **Cola:** `Operacion` (`frontend/src/tipos.ts`) crece a `venta | entrada | ajuste | merma | gasto | recepcion | arqueo`.
  - `subirPendientes` manda las ventas en lote y el resto una por una, cada tipo a su endpoint (una tabla `tipo → función de api`).
  - `estadoVisible` aplica cada tipo en orden: la merma descuenta; el conteo fija el stock y las ventas pendientes posteriores se restan encima; el gasto suma a gastos.
- **Navegación:** 5 pestañas: Vender · Inventario (antes Reponer) · Hoy · Reportes · Ajustes.
- **Migraciones:** una por fase (V4 a V8).

---

## Fase 1: Inventario cuadrado (conteo + mermas) · migración V4
- **Base de datos.** `entrada_inventario` pasa a ser el registro de todos los movimientos:
  - `tipo` VARCHAR con default `'ENTRADA'`: ENTRADA, CONTEO o MERMA.
  - `motivo` VARCHAR nulo: DANADO, REGALADO o VENCIDO.
  - `pedido_id` nulo (se usa en la fase 2).
  - La cantidad guarda el delta aplicado (puede ser negativo).
- **Backend: servicio.** `InventarioService.registrar(NuevoMovimiento)`:
  - ENTRADA suma.
  - MERMA resta.
  - CONTEO recibe el stock real: bloquea el producto con `@Lock(PESSIMISTIC_WRITE)` (método nuevo `findParaActualizar` en `ProductoRepository`), calcula `delta = real − actual` y lo aplica con `sumarStock`.
  - Si un conteo da delta 0, se guarda igual (queda la auditoría).
- **Backend: endpoints.**
  - `POST /api/inventario/movimientos` (`/entradas` queda como alias).
  - `POST /api/inventario/conteo` con una lista, para contar todo de una vez.
- **Frontend.**
  - La vista **Inventario** (antes `vistas/Reponer.tsx`) tiene un sheet con selector **Sumar | Contar | Merma**:
    - Contar: stepper con el valor actual.
    - Merma: chips con el motivo.
  - Botón **"Contar todo"**: lista con stepper por sabor y un solo guardado. Va a la cola como varias operaciones `ajuste` en orden.
- **Pruebas.** El conteo con ventas en cola antes y después cuadra. La merma no suma plata. La idempotencia se mantiene.

## Fase 2: Pedido con seguimiento · migración V5
- **Base de datos.**
  - `pedido_proveedor`: id, estado (ENVIADO, RECIBIDO o CANCELADO), creado_en, recibido_en, total_unidades.
  - `pedido_item`: pedido_id, producto_id, cantidad_pedida, cantidad_recibida.
- **Backend.**
  - `PedidoService` separa el armado del mensaje y del link en `mensaje(items)`, que se reutiliza para el sugerido y para el enviado.
  - `POST /api/pedidos` recibe los items (editados) → crea el pedido ENVIADO → devuelve el link de WhatsApp.
  - `GET /api/pedidos?estado=ENVIADO` y `GET /api/pedidos` (historial).
  - `POST /api/pedidos/{id}/recibido` con `{clientUid, items: [{productoId, cantidad}]}`:
    - Crea movimientos ENTRADA con `pedido_id`.
    - Marca RECIBIDO.
    - Si ya estaba recibido, responde REPETIDA.
  - `POST /api/pedidos/{id}/cancelar`.
- **Frontend.**
  - El sheet "Armar pedido" (`vistas/Hoy.tsx`) trae cantidades editables con stepper; "Enviar por WhatsApp" crea el pedido y abre el link.
  - En Inventario y Hoy aparece un banner **"Pedido en camino · 37 u."**.
  - "Llegó el pedido" abre un sheet con las cantidades pedidas ya puestas, editables por si llegó incompleto. Al confirmar, va a la cola como operación `recepcion` y suma todo.
- **Pruebas.** Recibir suma exacto. Recibir dos veces no duplica. Si llega incompleto, se registra lo recibido.

## Fase 3: Ganancia real · migración V6
- **Base de datos.**
  - `producto.costo` BIGINT, default 0.
  - `venta.costo_unitario` BIGINT: se congela al vender, igual que `precio_unitario`. Las ventas viejas se llenan con el costo actual.
  - Tabla `gasto`: id, client_uid UNIQUE, categoria (HIELO, TRANSPORTE, EMPAQUE u OTRO), concepto, monto, creado_en.
- **Backend.**
  - `ResumenDia` agrega `costo`, `gastos`, `mermas` (unidades × costo) y `ganancia = total − costo − gastos − mermas`.
  - `POST /api/gastos` (idempotente) y `DELETE /api/gastos/{clientUid}`.
  - El pedido muestra el **costo total** ("vas a pagarle $X a Energy Cocktails").
  - El cierre de Telegram incluye la ganancia.
- **Frontend.**
  - Ajustes → producto: campo **Costo**.
  - "Hoy": tarjeta **Ganancia** y botón **"Registrar gasto"**. El sheet trae monto con teclado numérico y chips de categoría, y va a la cola como `gasto`.
  - Si hay productos con costo 0, aviso: "pon el costo para ver la ganancia".
- **Pruebas.** La ganancia con costo, gasto y merma cuadra. Cambiar el costo no altera ventas viejas.

## Fase 4: Reportes · sin migración
- **Backend.** `ReporteService` y `GET /api/reportes?desde&hasta` (fechas de Bogotá). Devuelve:
  - totales (ventas, unidades, Nequi, efectivo, costo, gastos, mermas, ganancia);
  - `porDia[]`, `porHora[24]` y `porDiaSemana[7]`;
  - `porSabor[]` con unidades, ingresos y ganancia;
  - pedidos del periodo.

  Se calcula en Java sobre `VentaRepository.entre`, porque zona horaria y horas se manejan distinto en H2 y en PostgreSQL, y el volumen es pequeño.
- **Exportar.** `GET /api/reportes/ventas.csv`, con BOM UTF-8 y separador `;` para que Excel en Colombia lo abra bien.
- **Frontend: vista nueva `vistas/Reportes.tsx`.**
  - Chips de periodo: Semana, Mes, 30 días.
  - Tarjetas de totales.
  - Barras SVG hechas a mano (sin librería, para no crecer el bundle): por día, **horas pico** y día de la semana.
  - Ranking de sabores.
  - Botón **Exportar a Excel**: descarga con `fetch` y blob; en iOS usa `navigator.share` con el archivo.
  - Necesita señal y lo dice claramente si no hay.
- **Pruebas.** Horas y días agrupados en hora de Bogotá, y totales iguales a la suma de los días.

## Fase 5: Meta del día y racha · migración V7
- **Base de datos.** Config `META_DIARIA` (0 = apagada), editable en Ajustes y validada en `AjustesService.validar`.
- **Backend.** `/api/estado` agrega `meta: {valor, racha}`.
  - La racha son los días seguidos hasta ayer que cumplieron la meta, más hoy si ya la cumplió.
  - Se calcula sobre los totales por día de los últimos 90 días.
- **Frontend.**
  - Barra de progreso con degradado debajo del total del encabezado (`App.tsx`).
  - Al cruzar la meta, con la venta optimista: confeti (canvas liviano propio), vibración y "¡Meta cumplida! 🔥 racha N".
  - Solo una vez por día (`gz_meta_celebrada` = día).
- **Pruebas.** Cálculo de la racha (con días sin venta en el medio) y el componente celebra una sola vez.

## Fase 6: Extras · migración V8
- **Arqueo de caja.**
  - Tabla `arqueo`: id, client_uid, dia DATE UNIQUE, esperado, contado, diferencia, nota.
  - En "Hoy", **"Cerrar caja"** muestra el efectivo esperado; escribes lo contado y ves la diferencia en verde o rojo. Va a la cola como `arqueo`.
  - El cierre de Telegram dice "Faltaron $2.000" si aplica, y Reportes muestra las diferencias.
- **Calculadora de vueltas.** Dentro del sheet de venta, un enlace pequeño "¿Con cuánto paga?" con chips de $10.000, $20.000 y $50.000 que muestra el cambio. Es solo informativo: el flujo normal sigue en 2 toques.
- **Pruebas.** El arqueo es idempotente y queda una sola vez por día.

## Para después (fuera de este plan)
- **Promos** (combo por cantidad y hora feliz). Esteban decidió dejarlas para más adelante.

---

## Archivos principales
- **Backend:**
  - `inventario/*`
  - `pedido/*` (más entidades nuevas `PedidoProveedor` y `PedidoItem`)
  - `producto/Producto.java` y `ProductoService.java`
  - `venta/Venta.java` y `VentaService.java`
  - `resumen/EstadoService.java`
  - paquetes nuevos `gasto/`, `reporte/` y `caja/` (arqueo)
  - `notificacion/Reportes.java`
  - `ajustes/AjustesService.java`
  - `db/migration/V4…V8`
- **Frontend:**
  - `tipos.ts`, `api.ts`, `cola.ts`, `estadoLocal.ts`, `useCaja.ts`, `App.tsx`
  - `vistas/Reponer.tsx` → `Inventario.tsx`, `Hoy.tsx`, `Vender.tsx`, `Ajustes.tsx`
  - vista nueva `Reportes.tsx`
  - componentes nuevos `BarraMeta.tsx`, `Confeti.tsx` y `Barras.tsx`
  - `estilos.css`
- **Docs:** `README.md` (API y funciones) y `CLAUDE.md` (arquitectura y reglas).

## Cómo se entrega
Esteban lo quiere **todo junto**: cuando apruebe el plan, se implementan las 6 fases seguidas, en el orden de arriba, sin paradas intermedias.
- Dentro de cada fase: pruebas en verde antes de pasar a la siguiente, para que un error no se arrastre.
- Al final: una revisión completa en el navegador a 375×812 y un resumen de todo lo hecho.
- Por ahora **no se implementa nada**: este documento es solo el plan.

## Verificación (en cada fase)
1. `cd backend && ./mvnw test`: pruebas nuevas por fase, más las 31 actuales.
2. `cd frontend && npm test && npx tsc -b && npm run lint`.
3. `npm run dev` y abrir http://localhost:5173 en el navegador integrado, tamaño móvil. Probar el flujo de la fase con el servidor prendido y **con el backend apagado** (la cola debe guardar y subir después), y comparar lo que se ve con `/api/estado` y `/api/reportes`.
4. `npm run build`, y revisar que las migraciones corren en limpio (borrar `backend/data`).
5. Después del push, en Railway: la migración aplica sobre PostgreSQL y el healthcheck queda en verde.
