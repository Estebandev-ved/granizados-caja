# 🍸 Dopamina Cocktails · Caja

Caja rápida, inventario y pedido automático al proveedor, para vender granizados desde el iPhone.

- **Entrar con Face ID**, con la animación del iPhone. El PIN queda de respaldo.

- **Vender** en 2 toques: sabor → Nequi o Efectivo. Funciona sin señal: la venta queda en el celular y sube sola cuando vuelve. Dentro del sheet hay una calculadora de vueltas ("¿Con cuánto paga?").
- **Inventario cuadrado**: sumar, **contar** (el conteo fija el stock real) y **mermas** con motivo. Todo va por la cola, así se cuenta sin señal.
- **Pedido con seguimiento**: el sugerido sale editable, se registra cuando sale y aparece un banner hasta que llega. "Llegó el pedido" anota lo que de verdad llegó (puede ser menos) y suma solo eso.
- **Hoy**: cuánto vendiste, **cuánto ganaste** (venta − costo del producto − gastos − mermas), el pedido sugerido con el botón de WhatsApp y el **cierre de caja** ("Cerrar caja": cuánto dice la app y cuánto había).
- **Meta del día con racha**: pones cuánto quieres vender al día, una barra de progreso en el encabezado y confeti cuando la cruzas (una vez al día).
- **Reportes**: por semana, mes, año o fechas a mano, con tarjetas, **horas pico**, día de la semana, ranking de sabores, cierres de caja y **exportar a Excel** (CSV con `;` y BOM).
- **Ajustes**: sabores, precios, costos, tamaños (normal, cremoso, grande), meta diaria y configuración.
- **Avisos por Telegram**:
  - stock bajo;
  - cierre de caja todos los días a las 9pm (con la ganancia y, si hubo arqueo, cuánto faltó o sobró);
  - pedido sugerido los domingos a las 7pm, con lo que vas a pagarle al proveedor.

## Cómo está armado

```
granizados-caja/
├── backend/        Spring Boot 4 · Java 21 · JPA · Flyway · Spring Security (PIN + JWT)
├── frontend/       React 19 · TypeScript · Vite · PWA (funciona offline)
├── Dockerfile      Una sola imagen: el backend sirve la API y la app ya compilada
├── railway.json    Configuración del deploy en Railway
└── v1-apps-script/ Versión anterior (Google Sheets), de referencia
```

- **Base de datos:** PostgreSQL en Railway. En tu PC se usa H2 guardado en un archivo, así que no hay que instalar nada.
- **Un solo servicio:** en producción Spring Boot entrega la app de React y la API en la misma URL. No hay que configurar CORS y es un solo servicio que pagar. Si algún día crece, el frontend se puede separar sin cambiar código: tiene `VITE_API_URL`.
- **El backend está organizado por módulo de negocio** (`producto`, `venta`, `inventario`, `pedido`, `resumen`, `gasto`, `reporte`, `caja`, `ajustes`, `notificacion`, `seguridad`). Cada funcionalidad nueva va en su propia carpeta.

### Cómo funciona la venta offline

1. Al tocar Nequi o Efectivo, la venta entra a una **cola en el celular** (IndexedDB) con un `clientUid` único y la hora exacta. La pantalla se actualiza al instante.
2. La cola sube en segundo plano en lotes (`POST /api/ventas/lote`). Si no hay señal, reintenta cada 3s, 6s, 12s… hasta cada 30s.
3. El backend no duplica: `client_uid` es `UNIQUE` en la base. Si el celular manda la misma venta dos veces, la segunda sale `REPETIDA`.
4. Si el servidor rechaza una venta (por ejemplo, el sabor ya no existe), sale de la cola y te avisa, así no tranca las demás.
5. Lo que se ve en pantalla es el último estado del servidor más lo que todavía no ha subido. Las ventas pendientes llevan ⏳ en "Hoy".
6. Si te equivocas en una venta que no ha subido, "Deshacer" la borra ahí mismo, sin internet.

## Correr en tu PC

Necesitas **Java 21** y **Node 20 o más nuevo**. No hace falta instalar Maven: el proyecto trae `mvnw`.

Desde la carpeta del proyecto corre **un solo comando**:

```bash
npm run dev
```

Este comando prende las dos partes juntas:
- **Backend** (Spring Boot) en el puerto 8080. Solo atiende `/api`: **no hay que abrirlo**.
- **Frontend** (React) en el puerto 5173. **Esta es la que abres: http://localhost:5173**. Entra con el PIN **1234**, que es el de desarrollo.

Vite le pasa al backend todo lo que va a `/api`, así que en el navegador solo usas el 5173. Para apagar todo, `Ctrl+C`. La primera vez instala las dependencias solo.

> Si abres `localhost:8080` vas a ver la última versión compilada (la que se sube a Railway), no la que estás editando. Para desarrollar usa siempre el 5173.
- La base local queda en `backend/data/`. Si la borras, arranca de cero con los sabores iniciales.

### Pruebas

```bash
cd backend && ./mvnw test
```

```bash
cd frontend && npm test
```

- **Backend (64 pruebas):** ventas, idempotencia, alerta al cruzar el mínimo, deshacer, el conteo y las mermas, "hoy" en hora de Bogotá, el pedido sugerido con seguimiento, la ganancia con costos y gastos, el cierre de caja, los reportes, la meta con racha, login con PIN, la API completa y Face ID. Face ID se prueba con un autenticador falso que firma igual que el iPhone. Corren contra H2 en modo PostgreSQL, con las mismas migraciones de Flyway que usa producción.
- **Frontend (34 pruebas):** que la cola sobreviva a recargar, el lote que se corta a mitad, las ventas rechazadas, la sesión vencida, el estado optimista (stock, gastos, meta) y el rango de fechas de los reportes.

## Subir a Railway

1. **Sube el proyecto a GitHub.** Crea un repo privado y haz push de esta carpeta.
2. **Crea el proyecto en Railway.** En [railway.com](https://railway.com): **New Project → Deploy from GitHub repo** y escoge el repo. Railway encuentra el `Dockerfile` solo.
3. **Agrega la base de datos.** En el mismo proyecto: **+ Create → Database → PostgreSQL**.
4. **Configura las variables del servicio** (no las de Postgres). En **Variables**, agrega:

   | Variable | Valor |
   |---|---|
   | `APP_PIN` | Tu PIN para entrar, por ejemplo `4827` |
   | `JWT_SECRET` | 48 caracteres al azar (en Git Bash: `openssl rand -base64 48`) |
   | `PGHOST` | `${{Postgres.PGHOST}}` |
   | `PGPORT` | `${{Postgres.PGPORT}}` |
   | `PGDATABASE` | `${{Postgres.PGDATABASE}}` |
   | `PGUSER` | `${{Postgres.PGUSER}}` |
   | `PGPASSWORD` | `${{Postgres.PGPASSWORD}}` |
   | `TELEGRAM_TOKEN` | Opcional (ver abajo) |
   | `TELEGRAM_CHAT_ID` | Opcional |

   Las variables `${{Postgres.…}}` se escriben tal cual: Railway las conecta con la base sola. Tienes el mismo listado en [.env.example](.env.example).

5. **Genera la URL.** En **Settings → Networking → Generate Domain**. Te queda algo como `granizados-production.up.railway.app`.
6. **Espera el primer deploy (unos 4 minutos).** Las migraciones crean las tablas y los sabores iniciales solas. Cuando `/actuator/health` responde, Railway marca el deploy como listo.
7. **Instala la app en el iPhone.** Abre la URL en **Safari → Compartir → Agregar a inicio**.

Cada `git push` a la rama principal vuelve a desplegar solo.

> **Costo:** Railway cobra por uso, no tiene plan gratis permanente. Con este tamaño (un servicio pequeño y un Postgres) queda dentro del plan Hobby.
>
> **Por qué los avisos corren solos:** el servidor en Railway no se "duerme" como en Render, así que el cierre de las 9pm y el pedido del domingo corren solos con `@Scheduled` (hora Bogotá). No hay que activar "App Sleeping" en Railway. Si lo activas, esos avisos no salen.

### Face ID

1. Abre la app en el iPhone (desde la URL de Railway) y entra con el PIN.
2. La app pregunta **¿Entrar con Face ID?** Toca **Activar Face ID** y mira el celular.
3. Desde ahí, al abrir la app sale Face ID solo. Si iOS pide un toque primero, toca la cara.

Detalles:
- Funciona con **passkeys** (WebAuthn), que el iPhone X soporta desde iOS 16. La llave privada nunca sale del iPhone: el servidor solo guarda la pública.
- Hay que tener **Llavero de iCloud** activado (Ajustes → tu nombre → iCloud → Contraseñas y Llavero).
- **Solo funciona en HTTPS**, o sea en la URL de Railway. En tu PC (`localhost`) funciona si tu computador tiene Windows Hello o Touch ID. Desde el iPhone apuntando a tu PC por WiFi no funciona, porque no es HTTPS.
- La llave queda amarrada al dominio. Railway pone su dominio solo (`RAILWAY_PUBLIC_DOMAIN`). Si después usas un dominio propio, pon `WEBAUTHN_RP_ID=tudominio.com` y activa Face ID de nuevo.
- En **Ajustes → Face ID** ves los celulares activados y puedes quitarlos.

### Telegram (recomendado)

1. En Telegram habla con **@BotFather**, escribe `/newbot` y copia el token.
2. Escríbele cualquier cosa a tu bot nuevo.
3. Abre `https://api.telegram.org/bot<TOKEN>/getUpdates` y copia el número que aparece en `"chat":{"id": …}`.
4. Pon los dos en las variables `TELEGRAM_TOKEN` y `TELEGRAM_CHAT_ID` de Railway.

Si Telegram no está configurado, los avisos quedan en los logs del servicio.

### Pasar los datos de la v1 (Google Sheets)

La v2 arranca con los sabores en stock 0. Lo más simple es entrar a **Reponer** y cargar el inventario real. El historial de ventas del Sheet no se migra automáticamente. Si lo quieres, se puede hacer un script de importación después.

## API

Todo va bajo `/api`, con `Authorization: Bearer <token>` menos el login.

| Método | Ruta | Para qué |
|---|---|---|
| POST | `/api/auth/login` | `{pin}` → `{token}` (dura 30 días; 5 intentos fallidos bloquean 5 min) |
| GET | `/api/estado` | Productos, resumen de hoy (con costo, gastos, mermas y ganancia), últimas 8 ventas, pedido en camino y `meta: {valor, racha}`. Lo único que carga la app al abrir |
| POST | `/api/ventas` | `{clientUid, productoId, metodo, cantidad, creadaEn?}` |
| POST | `/api/ventas/lote` | `{ventas: [...]}` → estado de cada una: `REGISTRADA`, `REPETIDA` o `RECHAZADA` |
| DELETE | `/api/ventas/{clientUid}` | Deshacer una venta y devolver el stock |
| POST | `/api/inventario/movimientos` | `{clientUid, productoId, tipo, cantidad?, real?, motivo?}`. `tipo` = `ENTRADA`, `CONTEO` o `MERMA`. `/api/inventario/entradas` queda como alias |
| POST | `/api/inventario/conteo` | `{movimientos: [...]}` para contar todo de una vez |
| GET | `/api/pedido/sugerido` | Items (con el costo de cada uno), total, costo total, mensaje y link de WhatsApp |
| POST | `/api/pedidos` | `{items: [{productoId, cantidad}]}` → crea el pedido `ENVIADO` y devuelve el link |
| GET | `/api/pedidos?estado=` | Historial. Sin `estado` trae todos |
| POST | `/api/pedidos/{id}/recibido` | `{clientUid, items: [{productoId, cantidad}]}`: suma lo que llegó y crea las entradas |
| POST | `/api/pedidos/{id}/cancelar` | Cancela un pedido que salió |
| POST | `/api/gastos` | `{clientUid, categoria, concepto, monto, creadoEn?}`. `categoria` = `HIELO`, `TRANSPORTE`, `EMPAQUE` u `OTRO` |
| DELETE | `/api/gastos/{clientUid}` | Borra un gasto del día |
| POST | `/api/arqueo` | `{clientUid, contado, nota?, creadoEn?}`: cierra la caja. Uno por día |
| GET | `/api/arqueo` | El cierre de hoy, o `null` |
| GET | `/api/reportes?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` | Totales, por día, horas pico, días de la semana, ranking, pedidos y cierres de caja |
| GET | `/api/reportes/ventas.csv` | El CSV del periodo, con `;` y BOM (se abre bien en Excel) |
| GET/POST/PUT | `/api/productos` | Sabores, precios y costos (no se borran: se ocultan con `activo=false`) |
| GET/PUT | `/api/config/{clave}` | `PROVEEDOR_WHATSAPP`, `DIAS_COBERTURA`, `DIAS_HISTORIAL`, `META_DIARIA`, `NOMBRE` |
| GET/POST/DELETE | `/api/passkey` | Los celulares con Face ID activados |
| GET | `/actuator/health` | Público, para el healthcheck de Railway |

Errores: la API responde `{"error": "…"}`. Los **4xx** el celular descarta la operación (401, 408 y 429 sí reintentan); los **5xx** y la falta de red reintentan con backoff de 3 s a 30 s.

## Próximos pasos (ideas para escalar)

- Pedido al proveedor por **WhatsApp Cloud API**, con plantilla aprobada y confirmación antes de enviar.
- **Canal de difusión / Instagram:** "hoy estoy en X, quedan N de Smirnoff", desde el inventario.
- Preventa con pago anticipado por Nequi y una vista "Pedidos por entregar".
- Predicción del pedido por día de la semana y clima, cuando haya al menos 4 semanas de datos.
- Hardware (motocarguero): ESP32 con celdas HX711 por compartimiento para inventario automático.
- Promos (combo por cantidad y hora feliz): Esteban las dejó para después.
