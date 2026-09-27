# Granizados · Caja rápida (v1)

La app en el iPhone sirve para vender con 2 toques y reponer cuando llega pedido. El Google Sheet guarda todo y además:

- Te avisa cuando un sabor llega al mínimo.
- Te manda el cierre de caja todos los días a las 9pm.
- Te arma el pedido al proveedor los domingos a las 7pm, con el link de WhatsApp listo para enviar.

No hay que pagar hosting. Todo corre en Google.

## Instalación (15 min)

1. **Crea el Sheet.** Entra a sheets.new y ponle de nombre "Granizados".
2. **Abre el editor de script.** Menú **Extensiones → Apps Script**.
3. **Pega el backend.** Borra lo que haya en `Código.gs` y pega todo `Code.gs`.
4. **Pega la app.** Dale **+ → HTML**, llámalo exactamente `Index` y pega todo `Index.html`.
5. **Ejecuta el setup.** Arriba selecciona la función `setup` y dale **▶ Ejecutar**.
   - Google te va a pedir permisos: acéptalos (Configuración avanzada → Ir a proyecto).
   - Esto crea las hojas Productos, Ventas, Entradas y Config con tus sabores, y programa las alertas.
6. **Llena el Sheet.**
   - En **Productos** pon el stock real de cada sabor. Si un sabor viene en cremoso o grande, duplica la fila, cambia `tipo`, `precio` y un `id` único (ej: `pina-colada-cremoso`).
   - En `minimo` va con cuántas unidades te avisa. Pon `activo` en FALSE para ocultar un sabor.
   - En **Config** pon el WhatsApp del proveedor (`573001234567`, sin + ni espacios).
7. **Publica.** **Implementar → Nueva implementación → Tipo: App web**.
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Solo yo**. Así nadie más ve tus ventas y en el iPhone entras con tu cuenta de Google.
   - Copia la URL que termina en `/exec`.
8. **Pásala al iPhone.** Abre la URL en **Safari**, dale **Compartir → Agregar a inicio**. Te queda como un ícono de app.

> Si cambias el código, ve a **Implementar → Gestionar implementaciones → Editar → Nueva versión**. Si no, el iPhone sigue viendo la versión vieja.

### Si ya tenías la versión anterior instalada

1. Pega otra vez `Code.gs` e `Index.html` completos.
2. Ejecuta `setup` una vez. No borra nada: solo le agrega la columna `uid` a la hoja Entradas y recrea las alertas.
3. **Implementar → Gestionar implementaciones → Editar → Nueva versión.**

Las ventas que hayan quedado pendientes en el celular se suben solas con la versión nueva.

## Probar sin tocar el Sheet real

Necesitas Node 18 o más nuevo:

- `node --test`: corre las pruebas del backend (`tests/code.test.js`) contra un Google Sheet simulado. Revisan ventas, idempotencia, alertas, deshacer, reponer, "hoy" en hora de Bogotá, el pedido sugerido y el cierre.
- `node tests/servir.js`: abre la app en modo demo en `http://localhost:5173`, con datos falsos.
  - Para simular que se cayó la señal, en la consola del navegador escribe `demoOffline = true`.
  - Para que vuelva, `demoOffline = false`.

## Alertas: correo o Telegram

Por defecto las alertas llegan a tu Gmail.

Para que te lleguen al celular como chat (recomendado):

1. En Telegram habla con **@BotFather**, escribe `/newbot` y copia el token.
2. Escríbele cualquier cosa a tu bot nuevo.
3. Abre `https://api.telegram.org/bot<TOKEN>/getUpdates` y copia el número de `chat.id`.
4. Pega los dos en la hoja **Config** (`TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`).

## Cómo calcula el pedido

Para cada sabor se sigue esta fórmula:

`pedir = (promedio vendido por día × DIAS_COBERTURA) − stock actual`

- El promedio sale de los últimos `DIAS_HISTORIAL` días. Si llevas menos días vendiendo, divide por los días reales.
- Nunca deja un sabor por debajo de su `minimo`.
- Los sabores que se venden más, como Smirnoff, salen con más unidades solos.
- Puedes ajustar DIAS_COBERTURA y DIAS_HISTORIAL en Config.

## Cosas del iPhone X

- El iPhone X llega hasta iOS 16. La app es web, así que funciona sin problema.
- iOS no deja que una app lea las notificaciones de Nequi, así que al vender tú marcas "Nequi" o "Efectivo". Ese toque es el que te cuadra la caja.
- Si se cae el internet en la U, las ventas y las reposiciones quedan guardadas en el celular (punto amarillo arriba) y se suben solas cuando vuelve la señal.
  - En "Hoy", las ventas que no han subido se marcan con ⏳.
  - Si te equivocaste en una venta que no ha subido, "Deshacer última venta" la borra ahí mismo, aunque no haya señal.
- La primera vez que abras puede pedirte iniciar sesión con Google. Usa la misma cuenta del Sheet.
