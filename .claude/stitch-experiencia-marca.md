# Experiencia de marca inmersiva con Google Stitch · Dopamina Cocktails

> **Nota importante:** Google Stitch (stitch.withgoogle.com) no está conectado como MCP en este entorno de Claude Code — no hay un servidor MCP de Stitch disponible ahora mismo, así que Claude Code no puede generar las pantallas automáticamente desde aquí. Este documento es el **brief listo para pegar manualmente en Stitch** (o en cualquier herramienta de generación de UI con IA). Si en el futuro se conecta un MCP de Stitch a Claude Code, este mismo brief sirve de entrada directa.

## 1. Objetivo
Diseñar momentos de la app donde aparezca un **personaje de marca** ("mascota Dopamina") que le dé personalidad al negocio más allá de la función utilitaria de caja — sin romper las reglas duras del proyecto: venta en 2 toques, mobile-first 375×812, Safari 16, sin formularios en el flujo de venta.

La mascota **no reemplaza la funcionalidad**, decora los momentos donde ya hay una pausa natural: login, splash, éxito de venta, stock bajo, estado vacío, pantalla de instalación.

## 2. Propuesta de personaje: "Dopa" (definido, con referencia generada)
Dirección final (aprobada sobre las referencias tipo Cravee/Mura Saki que trajo el usuario):
- **Qué es:** un cubo/gota de granizado derretido, antropomorfo, cuerpo redondeado y "chorreado" (efecto de hielo derritiéndose en los bordes).
- **Pose:** actitud *chill* extrema — recostado, una pierna cruzada o levantada, sosteniendo un vaso alto de granizado con pitillo, como si estuviera saboreándolo.
- **Expresión:** éxtasis exagerado — ojos cerrados o en blanco, boca bien abierta en sonrisa enorme, lengua afuera, gotitas de sudor/frío como detalle cómico. Nada tímido, nada infantil: la idea es que se vea que el granizado le encanta al punto de la exageración, coherente con el público universitario.
- **Estilo gráfico:** línea gruesa tipo sticker, **un solo color morado intenso sobre blanco** (no degradé en el personaje, para que funcione bien como sticker/ícono), con sombreado de puntos halftone en vez de sombras planas — el mismo lenguaje visual que la hoja de personajes de referencia (Cravee/Mura Saki).
- Chispas/líneas de movimiento alrededor como acento, sin saturar la silueta.
- Logotipo hermano: "dopamina cocktails" en tipografía bubble/wavy gruesa (inspirada en el logo "Cafézices" de referencia), morado intenso sobre blanco, con "GRANIZADOS ARTESANALES" en versalitas delgadas y espaciadas debajo — ese es el lockup de marca que acompaña al personaje en splash y ajustes.
- **Uso en la UI real (`estilos.css`):** el personaje se ilustra en un solo morado plano para que funcione como asset importado (SVG/PNG), pero al integrarlo a las pantallas de la app puede convivir con el `--grad` existente en el fondo o los acentos alrededor — el personaje mismo se mantiene monocromático para legibilidad a tamaño pequeño (avatar 40-80px, sticker de Telegram).
- Paleta de integración en la app: `--morado`, `--fucsia`, `--lila`, `--bg`, `--card` (ya definidas en `frontend/src/estilos.css`) — el personaje no trae colores nuevos al sistema.
- Expresiones a producir además de la base "éxtasis": guiño (login/Face ID), "durmiendo" (estado vacío), "alarmado" (stock bajo) — mismo cuerpo, mismo trazo, solo cambia cara/pose, como una hoja de stickers.

## 3. Dónde vive el personaje (momentos, no pantallas completas)
La regla de oro: el personaje ocupa **espacio muerto existente**, nunca compite con el flujo de venta de 2 toques.

| Momento | Dónde en el código actual | Qué hace Dopa |
|---|---|---|
| Splash / carga inicial | falta `apple-touch-startup-image` (ver [guia-estilo-ios.md](guia-estilo-ios.md)) | Aparece quieto, centrado, mientras carga — reemplaza el flash blanco |
| Login con Face ID | `.login` en `estilos.css`, componente `IconoFaceId.tsx` | Guiño cuando el escaneo empieza, animación de susto/temblor si falla (ya existe `.faceid.error` con `temblor`, se puede sincronizar el gesto de Dopa con esa misma animación) |
| Venta confirmada | `Toast.tsx` / `.toast` | Un pequeño salto de celebración de 300-400ms, sin bloquear la siguiente venta |
| Stock bajo / agotado | `.stock.low` / `.stock.out` en `TarjetaProducto.tsx` | Cara de alarma junto al badge de stock |
| Estado vacío (sin ventas del día, sin pedidos) | clase `.vacio` ya existe en `estilos.css` | Dopa "dormido" o "esperando", con una línea de texto informal |
| Prompt de instalar como app | no existe todavía — hay que crearlo porque iOS no dispara `beforeinstallprompt` | Dopa señalando el botón de compartir de Safari, con las 2 instrucciones ("Compartir → Agregar a inicio") |
| Pantalla de ajustes / acerca de | `Marca.tsx` | Versión relajada de Dopa junto al nombre de marca |

## 4. Prompts sugeridos para Stitch
Pegar en Stitch uno a la vez (Stitch genera mejor con un objetivo concreto por prompt que con "diseña toda la app"). Todos parten del mismo contexto de marca:

**Prompt base de marca (pegar primero para fijar el estilo):**
> Diseña para una app de iPhone (375×812pt, iOS, modo oscuro) de una marca llamada "Dopamina Cocktails" que vende granizados universitarios en Colombia. Paleta: fondo casi negro #07030d, tarjetas #130a20, degradé de marca de morado #9d4dff a fucsia #ff3db8, texto lila claro #f7f0ff. Tipografía del sistema (San Francisco). Estética: neón, energética, nocturna, para universitarios, nunca infantil ni corporativa.

**Prompt pantalla de login:**
> Usando el mismo estilo de marca, diseña una pantalla de login de iPhone con Face ID: un ícono de escaneo facial animado en el centro, 4 puntos de PIN debajo como respaldo, y una mascota tipo gota de granizado con gafas de sol en degradé morado-fucsia flotando arriba, con una expresión de guiño amigable. Todo dentro de los safe areas de un iPhone con notch.

**Prompt de estado vacío:**
> Usando el mismo estilo de marca, diseña un estado vacío para una lista de ventas del día sin resultados: la mascota gota de granizado dormida o bostezando, con un texto corto e informal en español colombiano tipo "todavía no hay ventas hoy, ¡dale que se puede!".

**Prompt de celebración de venta:**
> Usando el mismo estilo de marca, diseña una notificación toast pequeña que aparece arriba de la pantalla al confirmar una venta exitosa: fondo blanco, texto oscuro, con la mascota gota de granizado en miniatura haciendo un salto de celebración, degradé morado-fucsia en el borde o sombra.

**Prompt de stock bajo:**
> Usando el mismo estilo de marca, diseña una insignia/badge de "stock bajo" para una tarjeta de producto en una grilla 2×N, con la mascota gota de granizado en versión mini con cara de alerta junto al número de unidades restantes.

Ajustar el texto de cada prompt con la jerga real del negocio (sabores: Smirnoff, Sangría, etc.) si se quiere que Stitch genere contenido de ejemplo más realista.

## 5. Cómo traer de vuelta lo que genere Stitch (importante)
Stitch entrega HTML/CSS o capturas de referencia — **no copiar y pegar ese código directo al proyecto**. Motivo: Stitch no conoce:
- Las restricciones de Safari 16 (puede usar CSS moderno que no corre en el iPhone X real).
- La arquitectura de estado del frontend (`estadoVisible(base, confirmadas, cola)`, cola offline en IndexedDB).
- Las reglas de negocio (2 toques máximo para vender, sin formularios en el flujo de venta, sin datos de clientes).

Flujo correcto:
1. Usar Stitch solo para **explorar la dirección visual e ilustrar a Dopa** (poses, expresiones, composición).
2. Exportar los assets de la mascota como SVG o PNG con fondo transparente.
3. Implementar la integración a mano en React, reutilizando los componentes y clases CSS que ya existen (`Toast.tsx`, `.vacio`, `.sheet`, etc.) y las variables de `estilos.css` — nunca un stylesheet nuevo paralelo.
4. Revisar cada pantalla nueva contra el checklist de [guia-estilo-ios.md](guia-estilo-ios.md) antes de mergear.

## 6. Qué NO hacer
- No animar a Dopa en la grilla de venta (`.grid`, `.prod`) — ahí cada milisegundo de distracción cuesta ventas.
- No usarlo para pedir datos del cliente ni para "personalizar" nada que implique guardar información personal (regla explícita de CLAUDE.md: no guardar datos de clientes).
- No generar sabores con licor mostrados por Dopa como "recomendados a cualquiera" — esos productos son solo para mayores de edad y la app no debe insinuar autoservicio sin control.
- No depender de Stitch para producción final: es una herramienta de exploración/ideación, el código real vive en `frontend/`.
