# Guía de estilo Apple / iOS · Dopamina Cocktails

Contexto para Claude Code: esta app se vende y se usa **solo en un iPhone X con iOS 16 (Safari 16 máximo)**, hoy como PWA. Esta guía fija las reglas de diseño estilo Apple que hay que respetar en `frontend/` y sirve de base si el roadmap más adelante empuja a envolver la PWA en algo nativo (Capacitor, o un wrapper Swift). No reemplaza [CLAUDE.md](../CLAUDE.md), lo complementa en lo visual/interacción.

## 1. Por qué esto importa
- Un solo celular, un solo usuario (Esteban o quien esté en caja), pantalla de 375×812pt. No hay que diseñar para "cualquier Android", hay que diseñar para **ese iPhone**.
- Cada toque de más en el flujo de venta cuesta plata (fila de gente esperando el granizado). El estilo tiene que servir a la velocidad, no competir con ella.
- Si el roadmap llega al punto 6 (hardware/motocarguero) o se empaqueta como app nativa, cualquier revisión de App Store va a mirar con lupa que la interfaz "se sienta nativa". Empezar alineado a HIG ahora ahorra ese trabajo después.

## 2. Human Interface Guidelines aplicadas a este proyecto

### Touch targets
- Mínimo Apple: **44×44pt**. Ya se cumple: `.qty button` (48px), `.teclado button` (76px), `.prod` (min-height 96px), `nav button` (padding vertical ~24px + ícono).
- Cualquier botón nuevo que se agregue en el flujo de venta o cobro debe respetar ese mínimo. No lo bajes por "verse más compacto".
- Separación entre targets adyacentes: al menos 8px, para evitar toques accidentales con el pulgar (la caja se opera con una mano, rápido, a veces con la otra sosteniendo plata o el sachet).

### Safe areas
- Ya se usa `env(safe-area-inset-top/bottom)` en `header`, `nav` y `.sheet`. Mantener esto en **todo** elemento fijo o pegado a un borde (toasts, sheets nuevos, banners).
- No asumir que `100vh` es la altura útil en Safari iOS: la barra de UI de Safari cambia de alto al hacer scroll. Si se agrega algo con `height: 100vh`, considerar `100svh`/`100dvh` con fallback, o mantener el patrón actual de `min-height: 100vh` que ya usa `.login`.

### Tipografía
- La pila actual `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` es correcta: en iOS resuelve a San Francisco, la fuente del sistema. No reemplazar por una web font "de marca" para textos de UI — rompe la sensación nativa y agrega peso/latencia sin necesidad.
- Jerarquía ya usada y a mantener: 24px (títulos), 17px (nombre de producto), 15px (cuerpo/filas), 12-13px (metadatos/etiquetas). No bajar de 12px para texto legible (Apple recomienda no ir bajo 11pt).
- `-webkit-text-size-adjust: 100%` ya está puesto: evita que Safari reescale el texto solo al rotar o hacer zoom del sistema. Correcto, mantenerlo.

### Color y modo oscuro
- `color-scheme: dark` ya declarado — bien, evita que Safari intente aplicar sus propios controles en modo claro sobre una UI oscura.
- El tema morado/fucsia/negro es la marca; no es negociable, pero dentro de esa paleta seguir el contraste AA: texto `--txt` (#f7f0ff) sobre `--bg`/`--card` ya cumple. Si se agregan nuevos textos sobre `--grad` o `--nequi`, verificar contraste antes (herramienta: WebAIM contrast checker).
- `theme-color` del `<meta>` y del manifest deben coincidir siempre con `--bg` (#07030d). Si cambia el fondo del header, actualizar ambos.

### Movimiento y feedback
- Ya se respeta `prefers-reduced-motion` para el ícono de Face ID y el temblor de error. Extender esa misma media query a cualquier animación nueva (confeti de venta, transiciones de sheet, etc.).
- Transiciones cortas (0.08s–0.45s) ya usadas son el rango correcto estilo iOS: nada de animaciones "decorativas" largas en el flujo de venta.
- **Haptics:** Safari en iOS no expone `navigator.vibrate` (a diferencia de Chrome/Android), así que no hay feedback táctil real disponible desde la web. El único "haptic" posible es visual/sonido corto. Si se necesita feedback físico de verdad, eso solo llega envolviendo la app en algo nativo (Capacitor con un plugin de haptics).

### Modales y hojas (sheets)
- El patrón `.sheet` que ya existe (aparece desde abajo, `border-radius: 24px 24px 0 0`, backdrop con blur) es exactamente el patrón de "action sheet" / modal de iOS. Mantenerlo como estándar para cualquier flujo nuevo (no usar `alert()`/`confirm()` nativos del navegador, se ven completamente ajenos a la marca y a iOS moderno).
- Los sheets deben poder cerrarse tocando el fondo (`.sheet-bg`), como ya está.

## 3. Límites duros de Safari 16 (no se pueden pasar por alto)
El build ya apunta a `safari16` — hay que mantener esa disciplina:
- **Sin Web Push** → las notificaciones van por Telegram (ya definido en CLAUDE.md). No intentar agregar `Notification.requestPermission()` esperando push real en background; en iOS 16 sin instalarse en pantalla de inicio ni siquiera hay notificaciones locales confiables.
- **Sin haptics** (ver arriba).
- Verificar cualquier API nueva de CSS/JS contra [caniuse.com](https://caniuse.com) filtrando por Safari iOS 16 antes de usarla — especialmente `:has()`, `dvh/svh`, `backdrop-filter` (soportado con prefijo `-webkit-`, ya usado correctamente en `nav`), `subgrid`, contenedor queries.
- Instalación como PWA en iOS 16 es manual (compartir → "Agregar a inicio") y no dispara `beforeinstallprompt` (esa API no existe en Safari). Cualquier UI de "instalar la app" tiene que ser un banner con instrucciones propias, no depender del evento estándar.

## 4. Iconografía y splash (lo que falta para que se sienta 100% nativo)
- `apple-touch-icon-180x180.png` ya existe y está enlazado — correcto para el ícono en pantalla de inicio.
- **Falta:** splash screens de arranque para iOS (`apple-touch-startup-image`). Sin esto, al abrir la PWA desde el ícono se ve un flash de pantalla blanca antes de pintar `--bg`. Para un solo dispositivo (iPhone X, 1125×2436px @3x, con notch) basta con generar **una** imagen splash a esa resolución con el fondo `--bg` y el logo centrado, y agregar el `<link rel="apple-touch-startup-image" media="...">` correspondiente en `index.html`. Se puede generar con `npx pwa-asset-generator` o a mano en Figma/Stitch.
- El manifest ya tiene `background_color` y `theme_color` en `#07030d`, coherente con lo anterior.

## 5. Si algún día esto deja de ser "solo PWA"
El roadmap dice "por ahora PWA, más adelante más". Dos caminos realistas, en orden de esfuerzo:
1. **Capacitor** (Ionic): envuelve el mismo build de Vite en un proyecto Xcode, da acceso a haptics reales, notificaciones locales, y evita las limitaciones de Safari para WebAuthn/Face ID (hoy ya usan passkeys, que en un WebView de Capacitor funcionan distinto — revisar el plugin `@capacitor/passkey` o mantener Face ID vía navegador del sistema).
2. **Rehacer en SwiftUI**: solo si el negocio crece a punto de justificar un equipo iOS dedicado. No es el siguiente paso lógico hoy.

Para que el día de mañana el salto a Capacitor sea barato, lo más importante es **no romper** las reglas de esta guía ahora: si la UI ya se comporta como una app nativa (sheets, safe areas, targets de 44pt, sin popups del navegador), el envoltorio nativo es casi gratis. Si se acumulan atajos "porque es solo web", ese salto se vuelve una reescritura.

## 6. Checklist rápido antes de mergear un cambio visual
- [ ] ¿Los targets táctiles nuevos miden al menos 44×44pt?
- [ ] ¿Usa `env(safe-area-inset-*)` si toca un borde de la pantalla?
- [ ] ¿La API de CSS/JS nueva existe en Safari 16 (revisado en caniuse)?
- [ ] ¿Respeta `prefers-reduced-motion` si anima algo?
- [ ] ¿El contraste de texto nuevo sobre el fondo cumple AA?
- [ ] ¿Sigue vendiendo en 2 toques máximo (sabor → método)?
