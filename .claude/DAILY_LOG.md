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
