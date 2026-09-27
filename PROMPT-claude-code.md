Vamos a construir **Granizados POS**: caja rápida, inventario y pedido automático al proveedor para mi negocio de granizados. Monorepo nuevo, con este stack:

- **Backend:** Spring Boot 3 (Java 21), desplegado en **Render** con Docker.
- **Base de datos:** MySQL en **Aiven**, con migraciones Flyway.
- **Frontend:** React + Vite + TypeScript como **PWA**, desplegado en **Vercel**.

En esta carpeta hay una v1 que hice en Google Apps Script (`Code.gs`, `Index.html`, `CLAUDE.md`). Úsala como **referencia de lógica y de diseño visual**, no como código a migrar. La UI de `Index.html` es la que quiero: oscura, botones grandes, bottom sheets.

## Contexto del negocio
- Vendo granizados en sachet con pitillo en la universidad (Colombia). El proveedor es Energy Cocktails y le pido por WhatsApp. Yo le pago a mano.
- Hay tres tipos con estos precios: normal $6.000, cremoso $7.000, grande $10.000. El dinero va como **enteros en pesos** (long), nunca decimales.
- Sabores iniciales: Smirnoff, Piña colada, Margarita, Tussi, Mojito, Sangría, Four Loko sandía, Four Loko apple, Chicle, Macufresa, Crema de whisky.
- Los clientes pagan por **Nequi** o en **efectivo**. Vendo unas 47 unidades cada 2 días.
- Zona horaria: `America/Bogota` en todo, tanto en cálculos de "hoy" como en tareas programadas.
- El celular de venta es un **iPhone X, con iOS 16 como máximo**:
  - Nada de APIs que iOS 16 no soporte.
  - Web Push no sirve (necesita iOS 16.4+ y la PWA instalada), así que las notificaciones van por **Telegram**.
  - Diseño para 375×812 respetando `safe-area-inset`.
- Solo yo uso la app, un usuario.

## Requisito más importante: la venta tiene que ser instantánea
- El flujo es: toco el sabor, se abre un bottom sheet con cantidad (default 1) y toco **Nequi** o **Efectivo**. Son 2 toques y tiene que sentirse en menos de 100 ms.
- **UI optimista:** actualizo stock y totales al instante, y la venta entra a una **cola persistente en IndexedDB** (usa `idb-keyval` o similar). Se sincroniza en segundo plano con reintentos y backoff.
- Cada venta lleva un `clientUid` (UUID generado en el celular). El backend es **idempotente** por ese campo (unique constraint): si llega repetida, devuelve 200 sin duplicar.
- **Por qué importa tanto:** si Render está en plan free, el backend se duerme y tarda en despertar. La app tiene que funcionar igual mientras tanto.
- La app debe mostrar lo último guardado aunque el backend no responda, con cache del estado más service worker para el shell.
- Indicador arriba: verde si está "al día", amarillo si hay "N pendientes", rojo si está sin conexión.

## Modelo de datos (Flyway)
- `producto`: id, sabor, tipo (NORMAL/CREMOSO/GRANDE), precio, stock, stock_minimo, activo, orden.
- `venta`: id, client_uid (unique), producto_id, cantidad, precio_unitario, total, metodo (NEQUI/EFECTIVO), creada_en (timestamptz).
- `entrada_inventario`: id, producto_id, cantidad, creada_en. Es la llegada de pedidos.
- `pedido_proveedor`: id, creado_en, estado (SUGERIDO/ENVIADO/RECIBIDO), total_unidades. Con `pedido_item` (producto_id, cantidad).
- `config`: clave/valor (PROVEEDOR_WHATSAPP, DIAS_COBERTURA=4, DIAS_HISTORIAL=14, NOMBRE).
- Seed con los sabores, todos en NORMAL, stock 0 y mínimo 3.
- Las modificaciones de stock van atómicas: `UPDATE ... SET stock = stock - ?` dentro de la transacción de la venta. Nada de leer y escribir por separado.

## API REST (`/api`)
- `GET /estado` → productos activos, resumen de hoy y últimas 8 ventas.
  - El resumen trae total, nequi, efectivo, unidades y porSabor.
  - Es lo único que la app carga al abrir.
- `POST /ventas` → body `{clientUid, productoId, metodo, cantidad}`.
  - También `POST /ventas/lote` para vaciar la cola de una vez.
- `DELETE /ventas/ultima` → deshace la última venta y devuelve el stock.
- `POST /inventario/entradas` → `{productoId, cantidad}`.
- `GET /pedido/sugerido` → items, total, mensaje y link `https://wa.me/<numero>?text=<encoded>`.
- `POST /pedido/{id}/recibido` → suma todo al stock de una vez.
- CRUD de productos y config, para editarlos desde la app en una vista "Ajustes".
- `POST /cron/pedido-semanal`, `POST /cron/cierre-diario`, `GET /health`: protegidos con el header `X-Cron-Token`.

## Reglas de negocio
- **Pedido sugerido por producto:**
  - `promedio = vendidas en los últimos DIAS_HISTORIAL / días reales con historial` (mínimo 1 día).
  - `objetivo = max(ceil(promedio × DIAS_COBERTURA), stock_minimo)`.
  - `pedir = max(0, objetivo − stock)`.
  - Ordena de mayor a menor. El mensaje va en tono informal y firmado con NOMBRE.
- **Alerta de stock bajo:** solo cuando el stock **cruza** el mínimo en una venta (antes > mínimo y después <= mínimo). Va por Telegram e incluye el pedido sugerido.
- **Cierre diario (9pm):** total, Nequi, efectivo ("esto debe haber en caja") y top 3 sabores. No se envía si no hubo ventas.
- **Pedido semanal (domingo 7pm):** manda por Telegram el pedido con el link de WhatsApp listo. **No le escribe al proveedor directo**: yo confirmo y envío.
- **Tareas programadas:** no dependas de `@Scheduled`, porque si Render duerme no se ejecuta. Expón los endpoints `/cron/*` y documenta cómo llamarlos desde **cron-job.org** o un GitHub Action con cron. Ese mismo cron puede hacer ping a `/health` en horario de venta para que no se duerma.

## Seguridad
- Login con PIN: `POST /auth/login {pin}` devuelve un JWT de larga duración (30 días).
- El hash del PIN va en una variable de entorno (`APP_PIN_HASH`, BCrypt).
- Spring Security stateless.
- CORS solo para el dominio de Vercel y localhost.
- Nada de secretos en el repo. Todo por variables de entorno, con un `.env.example`.

## Frontend
- **Vistas:** Vender, Reponer, Hoy, Ajustes. Van en una nav inferior fija con safe-area.
- **Vender:**
  - Grilla de 2 columnas.
  - Cada tarjeta muestra sabor, tipo si no es normal, precio y un badge de stock (rojo si es 0, ámbar si está en el mínimo o menos).
  - Los agotados van al final.
- **Reponer:** chips +1/+5/+10 y stepper. También botón "Llegó el pedido", que marca como recibido el último pedido ENVIADO.
- **Hoy:**
  - Tarjetas con total, Nequi y efectivo.
  - Lista por sabor y últimas ventas con tag NQ/EF.
  - Botones "Armar pedido", que abre un sheet con la lista y el botón que abre WhatsApp, y "Deshacer última".
- **Ajustes:** editar productos (precio, mínimo, activo, crear variantes cremoso/grande) y config.
- Toast de confirmación, vibración si existe y cero dependencias pesadas de UI (CSS propio o Tailwind).
- **PWA:**
  - `vite-plugin-pwa`, manifest, íconos y `apple-touch-icon`.
  - `apple-mobile-web-app-capable` y `status-bar-style` black-translucent.
  - Pensada para "Agregar a inicio" desde Safari.

## Deploy
- **Backend:**
  - `Dockerfile` multi-stage (Maven y luego JRE 21 slim) y `render.yaml`.
  - Perfil `prod` que lee `DATABASE_URL`, usuario, clave, `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_TOKEN`, `APP_PIN_HASH`, `JWT_SECRET` y `CORS_ORIGIN`.
  - Aiven exige **SSL**: configura bien la URL JDBC (`sslMode=REQUIRED`) y documenta si hace falta el CA.
  - Pool Hikari pequeño (máx 3-5 conexiones), porque el plan free de Aiven tiene pocas.
- **Frontend:** `VITE_API_URL` y `vercel.json` con rewrite SPA.
- **Local:** `docker-compose.yml` con MySQL para desarrollo.
- **README:** paso a paso para Aiven, Render, Vercel, Telegram (BotFather más cómo sacar el chat_id) y cron-job.org.

## Calidad
- **Tests de backend:** cálculo del pedido sugerido, idempotencia de ventas, alerta por cruce de mínimo, deshacer y "hoy" en zona Bogotá. Usa Testcontainers o H2 en modo MySQL.
- **Tests de frontend:** que la cola sobreviva a recargar y que reintente.
- Código y nombres del dominio en español. Commits pequeños por fase.

## Cómo trabajar
Hazlo por fases y **para al final de cada una** para que yo pruebe:
1. Estructura del monorepo, backend con modelo, migraciones, API y tests, más docker-compose local.
2. Frontend con la vista Vender más la cola offline, conectado al backend local.
3. Vistas Reponer, Hoy y Ajustes, pedido sugerido y Telegram.
4. PWA, auth con PIN, Dockerfile, render.yaml, config de Vercel y README de deploy.

Antes de empezar, muéstrame el plan y la estructura de carpetas. Si algo no está claro, pregúntame en vez de suponer. Actualiza `CLAUDE.md` con el contexto del proyecto nuevo.
