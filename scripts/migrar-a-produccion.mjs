#!/usr/bin/env node
// Pasa el catálogo (sabores) y los ajustes de un backend local a uno de producción.
// A propósito NO toca ventas, gastos, inventario, pedidos, arqueos ni passkeys:
// eso es historial real o está atado al dominio (Face ID no sirve de un dominio a otro).
//
// Uso:
//   node scripts/migrar-a-produccion.mjs --prod-url https://tu-backend.up.railway.app --prod-pin 1234
//   (agrega --confirm cuando el plan se vea bien, si no solo simula)
//
// Si producción ya tiene ajustes o precios puestos a mano (una meta diaria real, un precio
// que ya cambiaste ahí), usa --solo-nuevos: crea los sabores que falten y no toca nada que
// ya exista en producción (ni productos ni ajustes), para no pisar valores reales con los
// de fábrica de local.
//
// También se puede configurar con variables de entorno: LOCAL_URL, LOCAL_PIN, PROD_URL, PROD_PIN.

const args = parseArgs(process.argv.slice(2))

const localUrl = args['local-url'] ?? process.env.LOCAL_URL ?? 'http://localhost:8080'
const localPin = args['local-pin'] ?? process.env.LOCAL_PIN ?? '1234'
const prodUrl = args['prod-url'] ?? process.env.PROD_URL
const prodPin = args['prod-pin'] ?? process.env.PROD_PIN
const confirmar = args.confirm === true
const soloNuevos = args['solo-nuevos'] === true

if (!prodUrl || !prodPin) {
  console.error('Falta --prod-url y/o --prod-pin (o las variables de entorno PROD_URL / PROD_PIN).')
  console.error('Ejemplo: node scripts/migrar-a-produccion.mjs --prod-url https://tu-backend.up.railway.app --prod-pin 1234')
  process.exit(1)
}

console.log(`Local:      ${localUrl}`)
console.log(`Producción: ${prodUrl}`)
console.log(confirmar ? '\nModo: APLICANDO CAMBIOS (--confirm)\n' : '\nModo: solo simulación (falta --confirm)\n')

const tokenLocal = await login(localUrl, localPin, 'local')
const tokenProd = await login(prodUrl, prodPin, 'producción')

const productosLocal = await pedir(localUrl, tokenLocal, 'GET', '/api/productos')
const productosProd = await pedir(prodUrl, tokenProd, 'GET', '/api/productos')

// Todo despliegue nuevo (local o prod) arranca con los mismos sabores de la migración V2,
// así que "producción tiene productos" no significa "ya se sincronizó": comparamos uno por uno
// en vez de todo-o-nada, para no duplicar los que ya coinciden ni pisar los que sí cambiaron.
const clave = p => (p.sabor.trim().toLowerCase() + '|' + p.tipo)
const prodPorClave = new Map(productosProd.map(p => [clave(p), p]))
const CAMPOS = ['precio', 'costo', 'stockMinimo', 'activo', 'orden']

const plan = productosLocal.map(local => {
  const enProd = prodPorClave.get(clave(local))
  const deseado = {
    sabor: local.sabor, tipo: local.tipo, precio: local.precio, costo: local.costo ?? 0,
    stockMinimo: local.stockMinimo, activo: local.activo ?? true, orden: local.orden,
  }
  if (!enProd) return { accion: 'crear', local, deseado }
  const cambios = CAMPOS.filter(c => enProd[c] !== deseado[c])
  return cambios.length ? { accion: 'actualizar', local, enProd, deseado, cambios } : { accion: 'sin-cambios', local, enProd }
})

const aCrear = plan.filter(p => p.accion === 'crear')
const aActualizar = plan.filter(p => p.accion === 'actualizar')
const sinCambios = plan.filter(p => p.accion === 'sin-cambios')

console.log(`Sabores en local: ${productosLocal.length} · en producción: ${productosProd.length}`)
console.log(soloNuevos ? '(--solo-nuevos: solo se crean los que falten, no se toca nada existente)\n' : '')
if (aCrear.length) {
  console.log(`Nuevos en producción (${aCrear.length}):`)
  aCrear.forEach(({ local }) => console.log(`  + ${local.sabor} (${local.tipo}) · $${local.precio} · costo $${local.costo ?? 0} · mínimo ${local.stockMinimo}`))
}
if (aActualizar.length) {
  console.log(`\n${soloNuevos ? 'Ya existen en producción con otro valor, no se tocan (--solo-nuevos)' : 'Cambian en producción'} (${aActualizar.length}):`)
  aActualizar.forEach(({ local, enProd, deseado, cambios }) => {
    console.log(`  ~ ${local.sabor} (${local.tipo}): ` + cambios.map(c => `${c} ${enProd[c]}${soloNuevos ? '' : ' → ' + deseado[c]}`).join(', '))
  })
}
if (sinCambios.length) console.log(`\nYa igual en los dos (${sinCambios.length}): ${sinCambios.map(p => p.local.sabor).join(', ')}`)

const configLocal = await pedir(localUrl, tokenLocal, 'GET', '/api/config')
const configProd = await pedir(prodUrl, tokenProd, 'GET', '/api/config')
const valorProd = new Map(configProd.map(c => [c.clave, c.valor]))
const configCambia = soloNuevos ? [] : configLocal.filter(c => valorProd.get(c.clave) !== c.valor)

if (!soloNuevos) {
  console.log(`\nAjustes que cambian en producción (${configCambia.length} de ${configLocal.length}):`)
  configCambia.forEach(c => console.log(`  ~ ${c.clave}: "${valorProd.get(c.clave) ?? ''}" → "${c.valor}"`))
} else {
  console.log('\nAjustes: no se tocan (--solo-nuevos).')
}

const aActualizarDeVerdad = soloNuevos ? [] : aActualizar

if (!aCrear.length && !aActualizarDeVerdad.length && !configCambia.length) {
  console.log('\nNo hay nada que sincronizar.')
  process.exit(0)
}

if (!confirmar) {
  console.log('\nEsto fue una simulación, no se cambió nada. Vuelve a correr con --confirm para aplicarlo de verdad.')
  process.exit(0)
}

console.log('\nAplicando en producción…')
for (const { local, deseado } of aCrear) {
  await pedir(prodUrl, tokenProd, 'POST', '/api/productos', deseado)
  console.log(`  ✓ creado ${local.sabor}`)
}
for (const { local, enProd, deseado } of aActualizarDeVerdad) {
  await pedir(prodUrl, tokenProd, 'PUT', '/api/productos/' + enProd.id, deseado)
  console.log(`  ✓ actualizado ${local.sabor}`)
}
for (const c of configCambia) {
  await pedir(prodUrl, tokenProd, 'PUT', '/api/config/' + encodeURIComponent(c.clave), { valor: c.valor })
  console.log(`  ✓ ajuste ${c.clave}`)
}

console.log(`\nListo: ${aCrear.length} producto(s) creado(s), ${aActualizarDeVerdad.length} actualizado(s) y ${configCambia.length} ajuste(s) copiado(s).`)
console.log('Nota: el stock (cantidad actual) no se toca a propósito — cuéntalo en producción con "Contar" en Inventario.')

// ------------------------------------------------------------------ utilidades

async function login(base, pin, nombre) {
  try {
    const r = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    const { token } = await r.json()
    return token
  } catch (e) {
    console.error(`No pude entrar a ${nombre} (${base}): ${e.message}`)
    if (e.cause) console.error('Causa: ' + (e.cause.code ?? e.cause.message ?? e.cause))
    process.exit(1)
  }
}

async function pedir(base, token, metodo, ruta, cuerpo) {
  const r = await fetch(base + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  if (!r.ok) {
    const texto = await r.text().catch(() => '')
    throw new Error(`${metodo} ${ruta} → HTTP ${r.status} ${texto}`)
  }
  return r.status === 204 ? null : r.json()
}

function parseArgs(argv) {
  const salida = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const clave = a.slice(2)
    const siguiente = argv[i + 1]
    if (siguiente && !siguiente.startsWith('--')) {
      salida[clave] = siguiente
      i++
    } else {
      salida[clave] = true
    }
  }
  return salida
}
