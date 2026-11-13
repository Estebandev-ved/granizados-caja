# Daily Log · Dopamina Cocktails (caja)

Bitácora de trabajo día a día. La idea: cada vez que Claude Code trabaja en este repo,
1. marca lo que se terminó de la lista de **Hoy**,
2. lo que quedó sin hacer pasa al bloque de **Hoy** del día siguiente (arriba del todo, antes de sacar tareas nuevas del backlog),
3. agrega una entrada nueva en **Cambios** con lo que se entregó ese día,
4. si "Hoy" queda corto, saca 2-4 tareas nuevas del **Backlog** (roadmap de `CLAUDE.md`) para completar el día.

No es una automatización de cron (correr sola de madrugada) — es la convención que sigue cualquier sesión de Claude Code que abra este repo. Si algún día quieres que corra sola sin que nadie abra una sesión, eso necesita un *scheduled task* aparte (se puede armar con la skill `schedule`, pero implica que el agente haga cambios sin supervisión en vivo — pregúntame cuando lo quieras y lo armamos).

---

## Hoy — 2026-09-28

- [x] Esteban cambia `WEBAUTHN_RP_ID` a `dopaminaeventos.shop` en Railway (sin `www`) y confirma que Face ID activa en el iPhone. **Confirmado: funciona.**
- [ ] Probar en el iPhone real el botón "Instalar en la pantalla de inicio" (Safari 16) y el flujo de Chrome/Android con `beforeinstallprompt`.
- [ ] Empezar Roadmap #1: dejar listo el módulo `whatsapp` en el backend (cliente HTTP a WhatsApp Cloud API, config por variables de entorno, sin mandar nada todavía). **Bloqueado**: falta saber qué expone el módulo de WhatsApp de Antigravity (credenciales, endpoints, si hay SDK/librería propia) — Esteban tiene que pasar esos datos o acceso.
- [ ] Revisar qué expone el módulo de WhatsApp de Antigravity para reutilizar (plantillas, envío, credenciales) en vez de duplicar código.
- [x] `CLAUDE.md` y `README.md` quedaron desactualizados: dicen "un solo servicio en Railway" pero el frontend ya vive en Vercel (`dopaminaeventos.shop`) separado del backend en Railway. Actualizar la sección de Deploy.

## Backlog (del roadmap de `CLAUDE.md`, en orden)

1. **Pedido al proveedor por WhatsApp Cloud API**
   - Definir la plantilla del mensaje de pedido y mandarla a aprobar en Meta Business.
   - Endpoint `POST /api/pedidos/{id}/enviar-whatsapp`: arma el mensaje con `PedidoService.mensaje(items)` y lo manda por la Cloud API.
   - Botón en el sheet "Armar pedido" (`Hoy.tsx`): Esteban revisa las cantidades y confirma antes de que salga el mensaje (nunca se manda solo).
   - Guardar el estado del envío (enviado / falló) para poder reintentar a mano.
2. **Canal de difusión / IG**: publicar "hoy estoy en X, quedan N de Smirnoff" desde el inventario.
3. **Preventa**: link de pedido con pago anticipado por Nequi y vista "Pedidos por entregar".
4. **Predicción**: ajustar el pedido por día de la semana y clima, con 4+ semanas de datos.
5. **Hardware (motocarguero)**: ESP32 + HX711 por compartimiento, GPS publicando ubicación.

### Ideas sueltas para cuando falte tarea del día
- Botón "Compartir" en Reportes para mandar el resumen del día por WhatsApp directo (hoy solo exporta CSV).
- Atajo en Ajustes para copiar el link de instalación (útil si Esteban le pasa el celular a alguien más).
- Revisar si el ícono `maskable-icon-512x512.png` se ve bien recortado en Android (forma circular).
- Modo oscuro real del sistema vs el morado fijo actual — ver si vale la pena o si el morado es parte de la marca y se queda igual siempre.

---

## Cambios

### 2026-11-12
- **Bono / descuento del proveedor en los pedidos.** Al recibir un pedido ("Llegó") aparece el campo "¿Te hizo descuento o bono? (opcional)": se le paga al proveedor `bruto − bono` (Mi plata resta solo eso del lugar escogido) y el bono queda guardado en el pedido. También se puede ajustar después con `POST /api/pedidos/{id}/bono` (por si se olvidó anotarlo). En Cierre del mes aparece una línea `💚 Te ahorraste $X en bonos del proveedor este mes`, y el resumen mensual de Telegram también lo lista. Si el bono cubre todo el pedido, no se registra pago. Migración `V36__pedido_bono.sql` + `pedido_proveedor.bono BIGINT NOT NULL DEFAULT 0`. Pruebas nuevas en `PedidoSeguimientoTest` (4 casos) y `cola.test.ts`. No hay todavía una pantalla de historial de pedidos; el endpoint queda listo para cuando se arme.

### 2026-11-11 (cierre, 2)
- **De quién es cada venta:** en Hoy → Ventas de hoy cada venta dice «Tú» o el nombre del trabajador, con filtro Todas · Mías · cada trabajador (y cuántos vendió). En Mi plata → Movimientos las ventas ya no se juntan: van por persona («Ventas en efectivo de Jacobo · 14 u.»). Sin migración.
- Pruebas: backend 236 (`QuienVendioTest`), frontend 123 (`quien.test.ts`). Probado en la app local con un trabajador de prueba (se borró al terminar).

### 2026-11-11 (cierre)
- **Cierre del mes (Reportes, arriba):** la ganancia real del mes con lo del equipo restado (comisiones + premios − consumos − faltantes; si lo anotado como gasto «Trabajadores» es más, se toma eso y no se cuenta dos veces). Estado de resultados (vendiste, producto, gastos, equipo, mermas, otros ingresos, ganancia real, te pagaste, le quedó al negocio), comparación con el mes anterior, proyección del mes en curso, consejos y meses anteriores con ‹ ›. `GET /api/reportes/mes`, `CierreMesService`.
- **Punto de equilibrio** (granizados al día que cubren los gastos, contra los que se venden) y **lo que deja cada sabor** ya pagada la comisión, dentro del cierre.
- **«Me pagué» en Mi plata (migración V35, tabla `retiro`):** lo que el dueño saca para él. Resta del lugar escogido, no toca la ganancia, sale en Movimientos (se borra con dos toques) y en el cierre del mes.
- **Rastro de ventas borradas (V35, `venta_borrada`):** toda venta deshecha queda anotada (qué, de quién, quién la borró, cuándo). Si la borra un trabajador, Telegram al dueño con cuántas lleva hoy. Reportes → Ventas borradas (sale aunque el periodo quede vacío).
- **Copia de seguridad:** botón en Reportes que baja un .zip con un CSV por tabla (sin PIN, Face ID ni fotos) y el día 1 de cada mes a las 8am llega por Telegram con el cierre del mes anterior (`app.tareas.cierre-mensual`, `RespaldoService`, `Notificador.enviarArchivo`).
- Pruebas: backend 234 (`CierreMesTest` y aislamiento), frontend 121 (`cierre.test.ts`). Probado en la app local contra PostgreSQL: migración V35, «Me pagué», cierre, venta borrada y copia.
- **Por revisar en producción:** que el envío del .zip por Telegram funcione con el bot real (el día 1 de diciembre o probando el endpoint).

### 2026-11-11 (noche)
- **Equipo con estilo de empresa** (Ajustes → Equipo): indicadores en una franja (activos, vendido hoy, por pagar), personal como tabla con monto y estado a la derecha, etiquetas rectas, y el panel de cada trabajador con ficha, cuadrícula de indicadores (vendido, carga, meta, base) y secciones plegables con su resumen (préstamos, entregas, base, carga, faltantes, ventas, datos). Pagos y premios abajo, también plegables. Solo cambia esa pantalla (`.equipo-vista`, `Plegable.tsx`).
- **El trabajador sabe cuánto gana:** en Vender, «Con esta venta ganas $X» (con la tarifa de promo cuando aplica) y en Mi día «Lo que ganas por granizado», con aviso de que en promo cada uno deja menos y los premios bajan.
- **Premios inteligentes (Ajustes → Equipo):** con las ventas de las últimas 4 semanas la app calcula cuánto vende un trabajador en un día normal y cuánto te deja cada granizado. A cada premio le dice si paga un día normal, si te hace perder, si se lleva casi todo lo extra o si les sirve a los dos. Sugiere premios donde él se lleva el 35 % de lo que vende de más («Usar estos» y luego Guardar).
- **Meta del día del trabajador (migración V34):** al entrar a Vender le pregunta cuántos se siente capaz de vender, con lo que ganaría en cada opción; al cumplirla, «¿Vas por más?». La cuenta nunca vuelve a cero. El dueño ve la meta en Equipo.
- Pruebas: backend 224, frontend 116. Probado en la app local con un trabajador de prueba (y el análisis con números de ejemplo, porque la base local casi no tiene ventas del equipo).
- **Pendiente:** con los premios de hoy (12:$2.500, 15:$4.000, 20:$8.000…) y un día normal de unos 16, los de 12 y 15 pagan sin que venda más. Revisarlo en Ajustes → Equipo con las ventas reales antes de subirle los bonos.

### 2026-11-11 (tarde)
- **Varias promos a la vez:** «3 refrescantes x $16.000» y «2 cremosos x $14.000» pueden correr juntas (hasta 3), cada una con su nombre, sus tipos y sus días. En una misma compra cada una arma sus combos.
- **¿Me sale rentable?:** al crear o editar una promo, la app calcula por combo lo que cobras, lo que te cuesta el producto, lo que le pagas al trabajador y lo que te queda, y dice si te sale rentable, si deja muy poquito o si pierdes. Sugiere a cuánto cobrarla para que quede el 20 % y avisa a qué productos el combo no les hace descuento (ej. Crema de whisky cremoso está en $6.000, así que 2 x $14.000 no le aplica).
- **Seguimiento de gastos (migración V33):** en Hoy, «Gastos del mes» con lo gastado por categoría y un tope para cada una. Avisa lo que se pasó y lo que va en 80 %, con cuánto queda por día; al anotar un gasto dice cuánto llevas en esa categoría.
- Pruebas: backend 217, frontend 110. Probado en la app local (las dos promos quedaron guardadas en la base local).

### 2026-11-11
- **«Ya le pagué» resta de Mi plata** (migración V32), solo los pagos de hoy en adelante: el efectivo sale de la caja o de la casa (se escoge al pagar) y lo de Nequi, de Nequi. Aparece en Movimientos. No toca la ganancia.
- **Préstamos al trabajador:** Equipo → «Le presté plata» (cuánto, de dónde y para qué). Sale de Mi plata y se le descuenta solo en el próximo pago (sale en el paz y salvo); él lo ve en Mi día.
- **Faltantes:** si las cuentas no dan y no hay explicación, Equipo → «Le faltaron granizados»: se le descuentan al **precio de venta** (no al costo). Los términos ahora lo dicen (cuadrar, revisar juntos, descuento al precio de venta), más préstamos y foto del comprobante; los trabajadores tienen que aceptarlos otra vez.
- **Foto del comprobante:** en Vender, «📷 Nequi con foto del comprobante» abre la cámara y anota la venta con la foto. También se agrega o se ve tocando la venta en Mi día o Hoy (📎). Sin señal espera en el celular. Se borran solas a los 30 días (traen el nombre del cliente).
- **Varios a la vez:** botón en Vender para cuando llega mucha gente: un toque por cada granizado y se cobra todo junto (efectivo, Nequi o parte y parte), con la promo bien repartida.
- **Historial del equipo en Reportes:** por trabajador, vendido, días, comisión, premios, lo que se tomó, faltantes, pagos y préstamos, día por día.
- Pruebas: backend 214, frontend 102. Probado en la app local (venta rápida con promo y pago mixto, faltante, préstamo, foto) y luego se borraron los datos de prueba.
- **Falta probar en el iPhone real:** que la cámara abra con «Nequi con foto» en Safari 16 y que la foto se vea bien.

### 2026-11-09 (tarde)
- **«Me lo tomo yo»** (migración V31, método `CONSUMO`): el trabajador toca el sabor en Vender y luego «Me lo tomo yo». El del día sale gratis (`GRANIZADOS_GRATIS`) y del siguiente en adelante se le descuenta al precio de venta de lo que se le paga: lo ve en Mi día (los que se tomó, cuánto se descuenta, «me tomé» en la carga) y al cerrar el día; el dueño lo ve en Equipo («Por pagarle» ya viene con el descuento, o «Te debe» si se tomó más de lo que ganó), en «Ya le pagué», en el paz y salvo, en Ventas de hoy y por Telegram. No cuenta como venta ni para premios, no entra plata y baja la carga y el inventario. Se borra como cualquier venta (si borra el gratis, el siguiente pasa a ser el gratis).
- Pruebas: backend 199, frontend 100. Probado en la app local con un trabajador de prueba (quedó desactivado en la base local: «Prueba consumo»).
- **Por decidir:** hoy se cobra al precio de venta (lo que ya dicen los términos). Si Esteban quiere precio especial para el equipo (al costo, o un precio fijo), es un ajuste nuevo.

### 2026-11-09
- **Pago al trabajador en dos partes** (migración V29): en «Ya le pagué» ahora se escoge todo en efectivo, todo por Nequi o **parte y parte** (cuánto en efectivo, el resto Nequi) y queda un solo pago que el trabajador confirma y firma. Si le das menos de lo que le toca, la app pregunta por lo que falta: «Se los pago después» lo deja pendiente y sigue saliendo en «Por pagarle» (antes las cuentas arrancaban de cero sin avisar bien) o «No se los debo».
- **Gastos** (migración V30): más categorías (Insumos, Trabajadores, Arriendo, Servicios, Publicidad), «＋ Otra categoría» para escribir la propia (queda como chip para la próxima) y pregunta obligatoria «¿De dónde salió la plata?» (caja, Nequi o casa); Mi plata descuenta del lugar correcto y Mis gastos lo muestra.
- **Gastos de otros días:** al anotar un gasto se escoge «¿Cuándo fue?» (hoy, ayer u otro día, hasta 90 días atrás) y en Reportes → Mis gastos cada gasto tiene «Cambiar fecha» para pasarlo al día en que de verdad fue; así no le baja la ganancia al día en que se escribió.
- Pruebas: backend 191, frontend 98. Probado en local contra PostgreSQL (las dos migraciones corrieron bien).
- **Pendiente de decidir:** los pagos al equipo siguen sin restar de Mi plata ni de la ganancia (son solo constancia). Si Esteban quiere, que «Ya le pagué» anote solo el gasto «Trabajadores» desde caja/Nequi.

### 2026-11-06 (tarde)
- **Caja white-label por negocio** (migración V28, ajuste `PERFIL`): la bienvenida pregunta nombre, rubro (granizados, café, comida, otro), si trabaja con equipo y si fía; crea productos de ejemplo del rubro y guarda meta y WhatsApp del proveedor. El nombre y monograma salen en el encabezado, el vocabulario cambia por rubro y Equipo/Fiados se esconden si no se usan. Se edita en Ajustes → Perfil del negocio.
- **Guía:** botón «?» con ayuda por pantalla, lista «Primeros pasos» que se tacha sola, recorrido de 4 tarjetas en el Login, chulo animado al vender, errores con personaje y botón de reintentar, zonas táctiles de 40-44px.
- **Resumen semanal** por Telegram los lunes 8am (`resumen-semanal`). Backend 184 y frontend 94 pruebas.
- **No hecho:** subir logo (la columna `config.valor` mide 500 caracteres; hoy hay monograma), modo demo con datos de ejemplo (hoy hay recorrido), pruebas visuales automáticas y medición de rendimiento con mala señal. Probar en el iPhone X real.

### 2026-11-06
- **Pulido visual y de movimiento (solo frontend):** cada pantalla entra con fundido, las tarjetas suben escalonadas, el total del header cuenta de un valor al otro (`NumeroAnimado`), nav con barra que se desliza, paneles y avisos con resorte, esqueleto que brilla al cargar y relieve suave en tarjetas. Todo respeta `prefers-reduced-motion`. Nueva **Bienvenida** (`Bienvenida.tsx`): al dueño con caja recién estrenada (sin meta ni ventas hoy) se le pregunta cómo vende (solo/equipo), su meta diaria y el WhatsApp del proveedor; guarda `META_DIARIA` y `PROVEEDOR_WHATSAPP` y, si tiene equipo, lo lleva a Ajustes. Bandera local `gz_bienvenida`. Pendiente: verlo en el celular real (iPhone X / Safari 16).

### 2026-11-04
- **Reportes con más datos:** lo fiado ya cobrado se separa de lo que sigue debiéndose (en pantalla y en el CSV: `Fiado (cobrado)` / `Fiado (debe)`) y nuevo bloque «Cómo compran» (compras, ticket, unidades por compra, días con venta, qué tipo deja más, descuentos de promo).
- **Regalos** (V24): método `REGALO` para cuando un cliente gana el sello de fidelidad y hay que regalarle un granizado. Baja el stock y cuenta el costo, no entra plata. Link «Regalo» en Vender (solo dueño). Backend 170 y frontend 88 pruebas.
- **Comisión por granizado** para el equipo: tarifas por tipo en Ajustes → Equipo (`COMISION_*`, migración V19), congeladas en cada venta; sin tarifas sigue el %. Liquidación y cierre del día la usan. Pendiente de Esteban: poner $1.000 Normal y $1.500 Cremoso en Ajustes y decidir Grande y Cerveza.
- **Premios por escalón + términos del trabajo** (V20): premio del día acumulado (12/15/20/25/30 → $2.000/$4.000/$8.000/$12.000/$17.000, ya sembrado para Dopamina junto con $1.000 Normal y $1.500 Cremoso), barra de premios y “lo que llevas ganado hoy” para el trabajador, mensaje del granizado gratis por día y términos que se aceptan antes de empezar (constancia guardada). Pendiente: cobrar los granizados extra desde la app y definir Grande/Cerveza.
- **Comisión en promo** ($700 por granizado cuando se vende 2 x $10.000, sembrada para Dopamina) y **elegir cada cuánto cobrar** (diario, semanal o quincenal) al entrar, V21; Equipo suma el rango de 15 días.
- **Promo en el servidor** (V22): ya no vive en el celular del dueño; llega a todos los celulares con el estado y puede correr ciertos días (Dopamina arranca con 2 x $10.000 en Normales todos los miércoles).
- **Premios más bajos en día de promo** ($5.000 menos por escalón, V23, sembrado para Dopamina) y los términos ya no escriben los montos de los premios.
- **Equipo más fácil de editar** (`TarifasEquipo`): barras con −/+ para las comisiones, un renglón por escalón de premio (agregar y quitar) con lo que pagan en promo, y un solo botón de guardar. **Barra de premios del trabajador** nueva: se llena por tramos, el próximo escalón late y Sofía le dice cuánto falta.
- Pruebas: 165 backend y 87 frontend en verde.

### 2026-11-03
- **Mi día del trabajador** muestra lo que llevó, vendió y le queda por sabor (antes solo "lo que me queda").
- **Aviso de versión nueva** (PWA con `registerType: 'prompt'`, `AvisoActualizacion`): sale "Hay una versión nueva · Actualizar", busca cada 30 min y al volver a abrir la app.
- **Cierre del día del trabajador**: botón "Terminé mi día" (`POST /api/mi-turno/cierre`) le dice cuánto entrega y qué devuelve, y al dueño le llega el resumen por Telegram (`AvisoEquipo`).
- **Aviso de pocos**: cuando a un trabajador le quedan 2 o menos de un sabor, Telegram al dueño (una vez al cruzar el límite) y la tarjeta se marca en bajo.
- Pruebas: 149 backend y 83 frontend en verde.

### 2026-10-28
- **Números sin bugs**: `CampoNumero` (puntos de miles mientras escribes, solo dígitos, sin ceros de más, con tope de largo; el PIN conserva ceros) en todos los campos de plata y cantidades. `pesos()` ya no da `$NaN` ni `-$0`. Un sabor no se puede guardar con precio vacío o 0 y avisa si vendes bajo el costo. Comisión máx. 100 %. Los ajustes numéricos se validan según su tipo.
- **Ajustes ordenados**: menú por temas (Sabores y precios, Promoción, Metas y premios, Equipo, Pedido al proveedor, Cobro de fiados, Seguridad, Datos y celular) con subpantallas y botón "‹ Ajustes". Cada ajuste con nombre en español y valor legible ($20.000, "Apagada", "4 días").
- **Vender**: el total va grande arriba del panel de cobro, y las vueltas suman el billete de $100.000.
- Pruebas: `formato.test.ts` (82 en total).

### 2026-10-27
- **Metas del equipo** (`V17`): `META_EQUIPO` y `PREMIO_EQUIPO` en Ajustes; el trabajador ve una barra de logros (medio camino, meta, súper meta) con racha y confeti, y el premio se descuenta del saldo en la liquidación. Todo lo de costos, ganancia y reportes sigue siendo solo del dueño.
- **Equipo**: trabajadores con PIN propio dentro de la misma caja (`V16`). Solo ven Vender y Mi día; la carga de cada uno vive en el servidor y las cuentas (efectivo, Nequi, comisión, saldo) salen de Ajustes → Equipo. Supuestos a confirmar con Esteban: el Nequi entra a su cuenta, comisión en % por trabajador, cada uno saca su carga de la casa.
- **Sincronización y "Lo que llevo hoy"**: refresco cada 20 s, sin doble conteo de una venta que sube mientras se pide el estado, la carga de ayer ya no cuenta, la merma pendiente baja la ganancia al instante. Las pruebas HTTP fallaban por el reloj fijo de pruebas contra tokens de 30 días: `token-dias` de pruebas en 36500.
- **Pago dividido (efectivo + Nequi)**: método `MIXTO` y columna `venta.monto_efectivo` (migración `V15`). Link "Pagó mitad y mitad" en Vender; Estado, Reportes, Mi plata y arqueo suman cada parte donde entró. Pruebas: `PagoMixtoTest` y las de frontend (`repartirEfectivo`, `estadoLocal`).
- **Pendiente**: sellos de fidelidad (canje como venta `CANJE` que descuenta stock). Falta que Esteban cuente cómo funcionan hoy, cuántos sellos dan un granizado y qué sabores se regalan. `ApiTest` y `FaceIdTest` ya fallaban con 401 antes de este cambio.

### 2026-10-05
- **Rediseño con el sistema NOMA de Antigravity**: tema claro + oscuro automático, rojo `#E53935` como único color de acción, todo con variables CSS (se quitaron los colores fijos). Tipografías Plus Jakarta Sans e Inter copiadas localmente (solo el subconjunto latino, 76 KB) para que funcionen sin señal; el service worker ahora guarda también fuentes, SVG y PNG.
- **Personajes de NOMA**: Sofía (sin ventas hoy), Nova (consejos: recomendación de compra y Mi plata sin contar), escenas de error/carga/vacío. Componentes `Personaje`, `LogoNoma` y `Marca` ("Antigravity · Caja").
- App instalable: nombre "Antigravity Caja", íconos regenerados desde el logo de NOMA, `theme-color` claro/oscuro, barra de estado `default`. La mascota y el logo de Dopamina se quitaron. Quien ya la tenga instalada debe quitarla y volver a instalarla para ver el nombre y el ícono nuevos.
- 41 pruebas de vitest, tipos, lint y build en verde. Revisado en 375×812 en claro y oscuro.

### 2026-10-04
- **Fase 1 del SaaS (caja multi-negocio)**: migración `V12` (`negocio_id` en todas las tablas; `client_uid`, cierre por día y sabor+tipo únicos por negocio; `config` con llave propia), `@TenantId` en las 15 entidades, `TenantResolver` + `NegocioFiltro` (el negocio sale del token verificado), `NegocioService` (ajustes por defecto al primer ingreso), aviso de stock bajo solo del negocio principal.
- **Acceso con Antigravity**: JWT HS256 firmado con `CAJA_JWT_SECRET` (iss `antigravity`, aud `caja`, `negocio_id` obligatorio); `estado: vencido` = solo lectura (402, el celular reintenta). Frontend: `accesoExterno.ts` (`#token=`).
- `docs/INTEGRACION_ANTIGRAVITY.md`: contrato + prompt para la otra sesión (proyecto Bot NOMA).
- Verificado sobre PostgreSQL con copia de los datos reales: datos intactos en el negocio 1, negocio 77 aislado, 402 y 401 correctos.
- 105 pruebas de backend y 41 de vitest en verde.

### 2026-10-03
- **Inventario**: línea discreta "N granizados en inventario" que al tocarla muestra invertido, valor de venta y ganancia que dejaría (se calcula en el celular, sirve sin señal).
- **Días en operación**: `GET /api/negocio` (primera venta → días contando el primero) y una línea en Hoy: "Día N de operación · desde el …".
- 90 pruebas de backend y 35 de vitest en verde.
- Idea en curso: convertirlo en suscripción (~$25.000/mes) para emprendedores universitarios, integrado con Antigravity. Falta definir cómo se integran (login, cobro, multi-negocio).

### 2026-10-02
- **Cerrar caja cuenta toda la plata**: arriba "Lo de hoy" (vendido, efectivo, Nequi, ganancia) y "Plata total del negocio" (caja + casa + Nequi, con apartado y libre); campos para el efectivo del cajón, la casa y Nequi. `NuevoArqueo` recibe `casa` y `nequi` opcionales: con ellos (o si ya había conteo) el cierre deja el conteo de Mi plata armado, así el primer cierre ya deja el saldo listo. Sin plata contada no se muestra "Faltan/Sobran" (solo se conocería el efectivo de hoy).
- 87 pruebas de backend y 35 de vitest en verde.

### 2026-10-01 (2)
- **Cerrar caja muestra la plata total del negocio** arriba (caja + casa + Nequi, con apartado y libre) y se actualiza al contar el efectivo del cajón. Antes solo hablaba del efectivo.

### 2026-10-01
- **Mi plata pasó de Hoy a Reportes** (arriba, antes de los periodos): Hoy queda solo con lo del día.
- **Cerrar caja compara contra la caja real**: si ya contaste tu plata, "lo esperado" es lo que debe haber en la caja (lo de antes + hoy − gastos − traslados), no solo el efectivo del día. Al cerrar, lo contado pasa a ser el nuevo conteo de la caja en Mi plata (casa y Nequi no cambian). Sin conteo previo funciona como antes. `ArqueoService` usa `PlataService`.
- 86 pruebas de backend y 35 de vitest en verde.

### 2026-09-30
- **Borrar cualquier venta** (Hoy): la lista "Ventas de hoy" se toca para borrar cualquiera (hasta 40 del día, "Ver todas"), no solo la última.
- **Mi plata completo** (`V11`): "Pasé plata" (traslados caja/casa/Nequi), **metas o sobres** (apartar/sacar plata, con progreso; lo apartado no cuenta como libre), "Ver movimientos" (historial día por día), y ingresos marcables como ganancia o aporte. La ganancia de Hoy y de Reportes suma los ingresos de ganancia (`ResumenDia.ingresos`, `Totales.ingresos`).
- **Cerrar caja** muestra con cuánta plata termina el día (total, libre, caja, casa, Nequi).
- **Pedido**: la plata que llega prellenada es la *libre*; `GET /api/pedido/recomendacion` compara 4/7/10/14 días con esa plata y marca ⭐ el que conviene (prefiere la semana). Al marcar "Llegó" se elige de dónde se pagó (`Recepcion.pagoLugar`).
- Fix: `api.ts` trataba una respuesta 200 vacía (cierre de caja aún sin hacer hoy) como "sin señal".
- 83 pruebas de backend y 35 de vitest en verde. Sin subir a producción todavía.

### 2026-09-29 (2)
- **Mi plata** (Hoy): saldo por lugares (caja, casa, Nequi) + botón "Entró plata" (ej. cobro de una deuda) + "Contar mi plata". Migración `V10__mi_plata.sql` (solo tablas nuevas: `ingreso`, `conteo_plata`, `pago_proveedor`), paquete `plata` en el backend (`GET /api/plata`, `POST /api/plata/conteo`, `POST/DELETE /api/ingresos`). El saldo = último conteo + ventas + ingresos − gastos (de la caja) − pagos al proveedor.
- Al marcar "Llegó el pedido" se descuenta lo que llegó × costo (`Recepcion.pagoLugar` opcional; sin él se asume Nequi). Es idempotente por pedido.
- El campo "¿Cuánta plata tienes?" del pedido llega con el total de Mi plata.
- **No toca** ganancia ni reportes ni la cola offline (Mi plata necesita señal). Pendiente: que el ingreso cuente en la ganancia del día, y elegir de dónde se pagó al recibir el pedido desde la UI.
- Ajuste tras probarlo en pantalla: con poca plata el reparto daba prioridad a llenar el stock mínimo de todos y dejaba a Smirnoff en 0. Ahora solo los agotados van primero y después gana el que tiene menos días de venta cubiertos.
- "Armar pedido" ahora deja escoger para cuántos días de inventario (4, 7, 10 o 14): `GET /api/pedido/sugerido?dias=N` (máx. 30) manda solo para ese cálculo, sin cambiar `DIAS_COBERTURA` de Ajustes. También se arregló el filtro numérico del campo de plata (aceptaba letras).
- 74 pruebas de backend, tsc, lint y vitest en verde.

### 2026-09-29
- **Pedido ajustado a la plata que tienes**: `GET /api/pedido/sugerido?presupuesto=N` gasta como máximo el 80% de N (20% de reserva, `RESERVA_PORCENTAJE` en `PedidoService`). Reparte una unidad a la vez: primero lo que está bajo el stock mínimo, luego lo que tiene menos días de venta cubiertos; nunca pasa de lo ideal. Los sabores que quedan en 0 siguen en la lista para subirlos a mano.
- En el sheet "Armar pedido" (`Hoy.tsx`) hay un campo "¿Cuánta plata tienes para el pedido?" y el botón "Ajustar a mi plata" (recuerda el último valor en `localStorage`).
- 3 pruebas nuevas en `PedidoServiceTest` (plata justa, plata de sobra, plata 0). Backend, tsc, lint y vitest en verde.

### 2026-09-28 (3)
- **Docs al día con la arquitectura real** (frontend en Vercel, backend en Railway, dominios separados):
  - `CLAUDE.md`: sección Deploy explica el split y que `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGENES` tienen que apuntar al dominio del frontend.
  - `README.md`: nota de arquitectura, tabla de variables `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGENES` en "Subir a Railway", y la sección de Face ID explica la regla real (dominio exacto o dominio padre, nunca un subdominio distinto).
  - `.env.example`: agrega `WEBAUTHN_RP_ID` y `WEBAUTHN_ORIGENES` con la misma explicación.
  - `frontend/.env.example` (nuevo): documenta `VITE_API_URL` para cuando el frontend se despliega aparte.

### 2026-09-28 (2)
- **Face ID no activaba desde el dominio propio (`dopaminaeventos.shop`)**: la causa era `WEBAUTHN_RP_ID=www.dopaminaeventos.shop` en Railway, y la app se abre desde `dopaminaeventos.shop` (sin `www`). WebAuthn exige que el rpId sea el dominio exacto o un dominio **padre** del que abrió la página — nunca al revés, así que Safari rechazaba la ceremonia con `SecurityError`. Fix es de variable de entorno (Esteban lo hace en Railway), no de código.
- Se agregó `esErrorDeDominio` en `frontend/src/faceid.ts` y un mensaje específico en `Ajustes.tsx` para que la próxima vez que esto pase (rpId mal puesto) el aviso diga la causa en vez de "no se pudo activar" genérico.

### 2026-09-28
- **Botón "Instalar la app"** en Ajustes (`frontend/src/vistas/Ajustes.tsx`, `frontend/src/instalarPwa.ts`):
  - Chrome/Android: escucha `beforeinstallprompt` y dispara el prompt nativo.
  - iPhone (Safari no tiene ese evento): abre un sheet con los 2 pasos a mano (Compartir → Agregar a inicio).
  - Se oculta solo si la app ya está instalada (`display-mode: standalone` / `navigator.standalone`) o si el navegador no soporta ninguna de las dos formas.
  - Type-check (`tsc -b`) y lint (`oxlint`) en verde; probado cargando el frontend en el navegador integrado (sin errores de consola).
- Se crea este `DAILY_LOG.md` para llevar el trabajo día a día.
