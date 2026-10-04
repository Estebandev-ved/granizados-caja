# Integración Caja ↔ Antigravity (Dopamina Cocktails → plan "Emprendedor")

Este archivo es el **contrato** entre las dos piezas. La caja (`granizados-caja`, Spring Boot + PostgreSQL) y
Antigravity (`Bot NOMA/antigravity`, Node + MySQL) se conectan solo por la identidad del negocio.

## Qué hace cada lado

| | Antigravity (Node) | Caja (Spring Boot) |
|---|---|---|
| Cuentas, registro y login | ✅ ya existe | usa el token de Antigravity |
| Planes, trial y cobro | ✅ ya existe (`config/planConfig.js`) | solo obedece el estado del plan |
| Datos del negocio (ventas, stock, plata) | — | ✅ cada negocio aislado por `negocio_id` |
| Base de datos | MySQL | PostgreSQL (separada) |

## El token de acceso a la caja

Antigravity firma un JWT **HS256** de corta duración con un secreto propio `CAJA_JWT_SECRET`
(distinto de `JWT_SECRET`, para no compartir el secreto principal).

```json
{
  "iss": "antigravity",
  "aud": "caja",
  "negocio_id": 42,
  "nombre": "Mi negocio",
  "plan": "emprendedor",
  "estado": "trial | activo | vencido",
  "vigente_hasta": "2026-11-01T00:00:00Z",
  "iat": 1790000000,
  "exp": 1790043200
}
```

- Duración: 12 horas.
- La caja valida `iss`, `aud` y `exp`, y usa `negocio_id` como el negocio (tenant) de toda la sesión.
- Si `estado` es `vencido` la caja entra en modo solo lectura.
- Antigravity **no** debe emitir el token si el plan del negocio no incluye la caja.
- Entrega al navegador: `${CAJA_URL}/#token=<jwt>` (en el fragmento, no en el query, para que no quede en logs).

## Cambios en Antigravity (los hace otra sesión, en el repo Bot NOMA)

1. **Migración** `antigravity/db/migrate_plan_emprendedor.js`: ampliar el `ENUM` de plan a
   `('starter','professional','enterprise','emprendedor')` en las 3 tablas que lo usan (`negocios.plan`,
   la de suscripciones y la de `plan_requerido`). Debe ser idempotente como las otras `migrate_*.js`.
2. **Plan** en `antigravity/config/planConfig.js`: agregar `emprendedor` (nameEs "Emprendedor", precio **25000**,
   `priceUSD` ≈ 6, `trialDays` 7) con la feature nueva `cajaInventario: true` (y `false` en los demás planes,
   o `true` en Professional/Enterprise si se quiere que la incluyan). Agregarlo a `PLAN_ORDER` (primero) y a
   `FEATURE_LABELS`. Revisar los ~16 lugares del API que asumen `'starter'` por defecto.
3. **Ruta nueva** `antigravity/api/routes/caja.js`, registrada en `api/index.js` como `app.use('/api/caja', ...)`:
   `POST /api/caja/token` (con `verificarAuth` + `injectTenantId`). Verifica `hasFeature(plan,'cajaInventario')`,
   arma los claims de arriba y responde `{ token, url }`.
4. **Panel**: en `agency-platform-react` agregar la entrada "Caja" al menú y una `CajaPage.jsx` que llame a
   `POST /api/caja/token` y abra la caja con el token. Mostrar el plan "Emprendedor" en la landing y en
   `SuscripcionPage`.
5. **Variables de entorno** nuevas: `CAJA_JWT_SECRET` y `CAJA_URL` (documentarlas en el README y el `.env.example`).
6. **Pruebas** (`node:test`): el token trae los claims correctos, no se emite sin la feature, y vence a las 12 h.

Reglas para esa sesión: no tocar datos reales ni `auth_info/` ni `.env`; trabajar en una rama nueva
(por ejemplo `caja-emprendedor`) sin mezclarla con `redisenio-noma`; no integrar pagos (lo hace el socio con Efipay).

## Cambios en la caja (los hace esta sesión) — Fase 1, hecha

- `negocio_id` en todas las tablas (migración V12, solo agrega columnas e índices) y aislamiento automático con
  `@TenantId`. Lo que ya existía (Dopamina Cocktails) quedó en el negocio 1.
- El negocio sale del token verificado. Los tokens propios (PIN y Face ID) llevan `negocio_id` = `NEGOCIO_ID` (1).
- La caja acepta el token de Antigravity (`CAJA_JWT_SECRET`, emisor `antigravity`, audiencia `caja`); con
  `estado: vencido` queda en solo lectura (402).
- Un negocio nuevo entra con catálogo vacío y sus ajustes por defecto.
- Pruebas: aislamiento entre negocios (`AislamientoTest`) y acceso con token de Antigravity (`AccesoAntigravityTest`).
- Verificado también sobre PostgreSQL con una copia de los datos reales de desarrollo.

### Pendiente antes de vender a otros negocios
- **Dopamina en Antigravity:** cuando Esteban tenga su cuenta en Antigravity, su `negocio_id` allá será otro número.
  Hay que reasignar los datos con un `UPDATE` de `negocio_id` en una migración nueva (V13) y poner `NEGOCIO_ID`.
  Mientras tanto, ningún negocio de Antigravity puede tener el id 1 en la caja (chocaría con Dopamina).
- Catálogo genérico (hoy el producto tiene "sabor" y "tipo") y arranque guiado en 2 minutos.
- Telegram y tareas programadas solo sirven al negocio por defecto; para los demás hace falta uno por negocio.

Hecho en el frontend: la cola offline se guarda por negocio (`gz_cola_<id>`; el negocio 1 conserva `gz_cola`) y al entrar
otro negocio al mismo celular se limpia lo guardado del anterior (estado, confirmadas, meta, plata del pedido).

## Prompt para pegar en el otro chat (proyecto Bot NOMA)

```
Estoy conectando una app aparte, la "caja" (inventario, ventas y plata para emprendedores, hecha en Spring Boot),
con Antigravity. Quiero venderla como un plan nuevo de $25.000/mes llamado "Emprendedor".
Necesito que hagas SOLO los cambios del lado de Antigravity que describe este contrato.

Lee primero README.md y antigravity/config/planConfig.js, antigravity/api/middleware/auth.js y tenant.js,
antigravity/api/routes/auth.js y antigravity/api/index.js. No abras .env ni auth_info/.

Trabaja en una rama nueva (caja-emprendedor). Cambios:
1. Migración antigravity/db/migrate_plan_emprendedor.js: agregar 'emprendedor' al ENUM de plan en las tres tablas
   que lo definen (negocios.plan, la de suscripciones y plan_requerido). Idempotente, como las otras migrate_*.js.
2. antigravity/config/planConfig.js: plan 'emprendedor' (nameEs 'Emprendedor', price 25000, priceUSD 6, trialDays 7)
   con la feature nueva cajaInventario: true; cajaInventario false en los demás planes (o true en Professional y
   Enterprise); ponerlo primero en PLAN_ORDER y agregar la etiqueta en FEATURE_LABELS. Revisa los lugares del API
   que asumen 'starter' como plan por defecto y dime cuáles hay que tocar.
3. Ruta nueva antigravity/api/routes/caja.js y registrarla en api/index.js como /api/caja:
   POST /api/caja/token, protegida con verificarAuth + injectTenantId. Si !hasFeature(plan,'cajaInventario')
   responde 403. Si cumple, firma con jwt.sign un JWT HS256 usando process.env.CAJA_JWT_SECRET (NO JWT_SECRET)
   con claims { iss:'antigravity', aud:'caja', negocio_id, nombre, plan, estado:'trial'|'activo'|'vencido',
   vigente_hasta } y expiresIn '12h'. Responde { token, url: process.env.CAJA_URL + '/#token=' + token }.
4. agency-platform-react: entrada "Caja" en el menú y una CajaPage.jsx que llame a POST /api/caja/token y abra
   la url en una pestaña nueva. Muestra el plan Emprendedor en la sección de precios y en SuscripcionPage.
5. Documenta CAJA_JWT_SECRET y CAJA_URL en el README y en el .env.example (sin valores reales).
6. Pruebas con node:test: el token trae los claims correctos, no se emite sin la feature, y expira a las 12 h.

No toques pagos (Efipay lo hace mi socio), ni datos reales, ni la rama redisenio-noma. Al final dime qué
archivos cambiaste y cómo correr las pruebas.
```
