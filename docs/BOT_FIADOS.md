# Bot de recordatorios de fiados (WhatsApp Cloud API)

En Hoy → **Me deben** sale una tarjeta por persona con todo lo que debe junto. Cada tarjeta tiene:

- **Enviar recordatorio** (bot): muestra el mensaje, lo confirmas y sale por la WhatsApp Cloud API. Una vez al día por persona. Solo aparece si el bot está configurado.
- **Recordar por WhatsApp**: si el bot está apagado, abre WhatsApp con el mismo texto listo para que lo envíes tú.
- **Ya pagó**: elige efectivo o Nequi y la plata entra (un solo ingreso por el total).

El celular queda ligado al nombre: se pide una vez y se autollena en los siguientes fiados de esa persona.

## Datos de pago (van dentro del mensaje)

En Ajustes → Configuración: `PAGO_NEQUI`, `PAGO_BREB` y `PAGO_PRESENCIAL` (ej. "en la U, bloque 4"). Los que dejes vacíos no salen.

## Encender el bot

1. En Meta for Developers crea una app de tipo Business y agrega **WhatsApp**. Anota el **Phone number ID** y genera un **token permanente** (usuario del sistema).
2. En el administrador de WhatsApp crea una **plantilla** de categoría *Utilidad*, idioma español (Colombia), con exactamente 5 variables:

   > Hola {{1}}, te escribe {{2}}. Te recuerdo que tienes pendiente {{3}} por: {{4}}. Puedes pagar por: {{5}}. ¡Gracias!

   Espera a que Meta la apruebe.
3. En Railway agrega las variables (nunca en el código):

   | Variable | Qué es |
   |---|---|
   | `WHATSAPP_TOKEN` | Token permanente |
   | `WHATSAPP_PHONE_ID` | Phone number ID |
   | `WHATSAPP_PLANTILLA` | Nombre de la plantilla aprobada |
   | `WHATSAPP_IDIOMA` | Código de idioma de la plantilla (por defecto `es_CO`) |

Las variables llegan así: `{{1}}` nombre, `{{2}}` quién escribe (ajuste `NOMBRE`), `{{3}}` total, `{{4}}` qué debe, `{{5}}` cómo pagar. Meta no permite saltos de línea en las variables, por eso el bot manda todo en una línea; el texto largo con viñetas es el de "Recordar por WhatsApp".

El bot nunca escribe solo: siempre lo dispara el botón y tiene un límite de un aviso cada 24 horas por persona.
