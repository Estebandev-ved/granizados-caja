# Dopamina Cocktails (caja) · contexto para Claude Code

## Qué es
Caja rápida, inventario y pedido automático para **Dopamina Cocktails**, el negocio de granizados (sachets con pitillo) que Esteban vende en la universidad, en Colombia.
- **Proveedor:** Energy Cocktails. Se le pide por WhatsApp y Esteban le paga a mano.
- **Precios:** normal $6.000, cremoso $7.000, grande $10.000. La plata va siempre en **pesos enteros** (`long`/BIGINT), nunca con decimales.
- **Métodos de pago:** Nequi y efectivo.
- **Ritmo:** unas 47 unidades cada 2 días. Smirnoff es el más vendido y Sangría el que menos.
- **Celular de venta:** iPhone X, con **iOS 16 como máximo** (Safari 16). No hay Web Push, así que los avisos van por Telegram.
- **Zona horaria:** `America/Bogota` para todo ("hoy", horarios de las tareas).

## Stack
- **`backend/`:** Spring Boot 4.1, Java 21, Maven (`./mvnw`).
  - JPA con Hibernate 7 y migraciones Flyway en `src/main/resources/db/migration`.
  - Spring Security como resource server con JWT HS256.
  - Se entra con PIN o con **Face ID** (passkeys / WebAuthn, librería Yubico `webauthn-server-core`, módulo `seguridad/passkey`).
  - El `rpId` sale de `RAILWAY_PUBLIC_DOMAIN`.
  - Yubico usa Jackson 2 y Spring Boot 4 usa Jackson 3: conviven, y por eso `jackson-core` va explícito en el pom.
  - Perfiles:
    - `local` (por defecto): H2 en archivo `./data` en modo PostgreSQL.
    - `test`: H2 en memoria.
    - `prod`: PostgreSQL, con las variables `PG*` de Railway.
- **`frontend/`:** React 19, TypeScript, Vite 8 y `vite-plugin-pwa`.
  - Cola offline en IndexedDB (`idb-keyval`).
  - CSS propio en `src/estilos.css`, sin librería de UI.
  - Tema **morado y negro "dopamina"**: variables `--morado`, `--fucsia` y `--grad`. Nequi conserva su color de marca.
  - Face ID en el cliente: `src/faceid.ts` (con `@simplewebauthn/browser`) y el ícono animado `componentes/IconoFaceId.tsx`.
- **Deploy:** backend en Railway (`Dockerfile` de la raíz), frontend en Vercel — dominios separados (`dopaminaeventos.shop` en Vercel, backend en Railway).
  - El `Dockerfile` puede seguir sirviendo todo desde un solo servicio (imagen compila el frontend, lo copia a `static/` del backend), pero hoy en producción no se usa así: el frontend se despliega aparte en Vercel con `VITE_API_URL` apuntando al backend.
  - Con dominios separados, `WEBAUTHN_RP_ID` y `WEBAUTHN_ORIGENES` (backend) tienen que apuntar al dominio del frontend (Vercel/dominio propio), no al de Railway — si no, Face ID y el CORS se rompen. `WEBAUTHN_RP_ID` debe ser el dominio exacto desde el que se abre la app o un dominio padre de ese (nunca un subdominio distinto, ej. `www.` no sirve como rpId si se abre desde la raíz).
  - Healthcheck en `/actuator/health`.
- **`v1-apps-script/`:** la versión anterior en Google Apps Script. Es solo de referencia, no se despliega.

## Comandos
- `npm run dev` (en la raíz): prende el backend en :8080 y el frontend en :5173 con `dev.mjs`. **Se abre el 5173**: Vite le pasa `/api` al 8080.
- `cd backend && ./mvnw test`: 83 pruebas de integración (`@SpringBootTest` con H2 y Flyway real, migraciones V1–V11).
- `cd backend && ./mvnw spring-boot:run`: API en :8080, con PIN de desarrollo `1234`.
- `cd frontend && npm run dev`: app en :5173, con proxy de `/api` a :8080.
- `cd frontend && npm test`: pruebas con vitest.
- `cd frontend && npm run lint`: oxlint.
- `cd frontend && npx tsc -b`: revisión de tipos.

## Arquitectura (decisiones que importan)
- **Backend organizado por módulo de negocio:** `producto`, `venta`, `inventario`, `pedido`, `resumen`, `gasto`, `reporte`, `caja`, `ajustes`, `notificacion`, `seguridad` y `comun`. Cada módulo tiene su entidad, repositorio, servicio y controlador; los DTO son records.
- **Migraciones:** `V1` esquema base · `V2` datos iniciales · `V3` passkeys · `V4` movimientos de inventario (conteo/merma) · `V5` pedidos · `V6` costos y gastos · `V7` meta diaria · `V8` arqueo · `V9` costos reales · `V10` Mi plata (ingresos, conteos, pagos al proveedor) · `V11` traslados, metas e ingresos que cuentan como ganancia.
- **Stock:** solo cambia con `ProductoRepository.sumarStock` (un `UPDATE … SET stock = stock + :delta` atómico). Nunca leer y escribir por separado.
- **Idempotencia:** `venta.client_uid`, `entrada_inventario.client_uid`, `gasto.client_uid` y `arqueo.dia` (`UNIQUE`) hacen que una operación repetida devuelva `REPETIDA`. Los controladores atrapan `DataIntegrityViolationException` por si llegan dos reintentos al mismo tiempo. Un arqueo repetido con otro `clientUid` **actualiza** el del día (solo puede haber uno).
- **Dinero y ganancia:** `venta.costo_unitario` se congela al vender (cambiar el costo del producto no reescribe ventas viejas). `ganancia = total − costo − gastos − mermas`.
- **Reportes** (`GET /api/reportes`): se calculan en Java sobre `VentaRepository.entre`, agrupando en hora de Bogotá, porque la zona horaria se maneja distinto en H2 y en PostgreSQL. El CSV sale con `;` y BOM para Excel.
- **Meta y racha:** config `META_DIARIA` (0 = apagada). La racha son los días seguidos hasta ayer que cumplieron la meta, más hoy si ya la cumplió; mira los últimos 90 días y un día sin ventas la rompe. La celebración (confeti + vibración) pasa una sola vez al día (`gz_meta_celebrada` en `localStorage`).
- **Hora de la venta:** la manda el celular (`creadaEn`) porque la venta pudo quedar en cola sin señal. El servidor la acepta si no viene del futuro y no tiene más de 3 días; si no, usa la suya.
- **Errores de la API:** vienen como `{"error": "..."}`.
  - **4xx:** el celular descarta la operación. Excepción: 401, 408 y 429 se reintentan.
  - **5xx o sin red:** reintenta con backoff de 3 s a 30 s.
- **Tiempo:** todo lo que depende de "ahora" usa el bean `Clock`. En las pruebas se reemplaza por `RelojPrueba`.
- **Avisos:**
  - Stock bajo: `StockBajo` se publica como evento y se manda con `@TransactionalEventListener` más `@Async`, así un Telegram lento no demora la venta.
  - Cierre diario (9pm) y pedido semanal (domingo 7pm): `@Scheduled` con zona Bogotá. Funciona porque Railway no duerme el servicio.
- **Frontend:** lo que se ve = `estadoVisible(base del servidor, confirmadas, cola)`.
  - `base`: último `/api/estado`.
  - `confirmadas`: subieron pero la base todavía no las incluye.
  - `cola`: pendientes.
  - Mientras hay una subida en curso no se aplica ningún refresco del servidor.
  - La cola (`Operacion` en `tipos.ts`) tiene 7 tipos: `venta`, `entrada`, `ajuste`, `merma`, `gasto`, `recepcion` y `arqueo`. Cada uno va a su endpoint; las ventas seguidas van juntas en lote (`cola.ts`).
- **Navegación:** 5 pestañas: Vender · Inventario · Hoy · Reportes · Ajustes.

## Reglas
- Todo el texto de la UI en español colombiano, informal. El código y los nombres del dominio también en español.
- Vender toma **2 toques como máximo** (sabor → método). No meter formularios en el flujo de venta. Un doble toque no puede registrar dos ventas.
- Mobile-first a 375×812 y respetando `safe-area-inset`.
- La marca es **Dopamina Cocktails**. El proveedor sigue siendo Energy Cocktails.
- Nada de APIs que Safari 16 no soporte. El build apunta a `safari16`.
- No guardar datos de clientes. Los sabores con licor se venden solo a mayores de edad, así que no proponer autoservicio sin control.
- Secretos solo por variables de entorno (`.env.example`). En `prod` no hay valores por defecto para `APP_PIN` y `JWT_SECRET`.
- Los cambios de esquema van en una migración Flyway nueva (`V3__…sql`). **Nunca** editar una migración que ya corrió en producción. El SQL tiene que funcionar en PostgreSQL y en H2 (modo PostgreSQL).

## Trabajo día a día
`.claude/DAILY_LOG.md` lleva la bitácora de qué se hizo y qué sigue. Al final de cada sesión: marcar lo hecho de "Hoy", mover lo que quedó pendiente al "Hoy" de la próxima sesión, sacar tareas nuevas del backlog si hacen falta, y agregar una entrada en "Cambios" con lo entregado.

## Roadmap (en orden)
1. Pedido al proveedor por **WhatsApp Cloud API**, reutilizando el módulo de WhatsApp de Antigravity (la plataforma propia de Esteban).
   - Requiere una plantilla aprobada para iniciar la conversación.
   - Esteban confirma manualmente antes de enviar.
2. **Canal de difusión / IG:** publicar "hoy estoy en X, quedan N de Smirnoff" desde el inventario.
3. **Preventa:** link de pedido con pago anticipado por Nequi y una vista "Pedidos por entregar".
4. **Predicción:** ajustar el pedido por día de la semana y clima, cuando haya 4 semanas de datos o más.
5. **Hardware (motocarguero):** ESP32 con celdas HX711 por compartimiento para inventario automático, y GPS publicando la ubicación.
