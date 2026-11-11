import { diaBogota } from './estadoLocal'
import type { Metodo, Producto, Tipo } from './tipos'

// Promociones tipo "3 refrescantes x $16.000" y "2 cremosos x $14.000". Se configuran en Ajustes, se guardan en el
// servidor (ajuste PROMO: una lista) y le llegan a todos los celulares con el estado, así los trabajadores las venden
// igual que el dueño. Pueden correr varias a la vez y cada una ciertos días de la semana.

export interface Promo {
  activa: boolean
  /** Cuántos lleva el cliente por el precio del combo. */
  cantidad: number
  /** Lo que cuesta el combo completo. */
  precio: number
  /** A qué tipos de granizado aplica. */
  tipos: Tipo[]
  /** true = se apaga sola al cambiar el día; false = sigue hasta que la apagues. */
  soloHoy: boolean
  /** Día en que se prendió (para el modo "solo hoy"). */
  dia: string
  /** Días de la semana en que corre (1 = lunes ... 7 = domingo). Vacío = no hay horario y mandan `soloHoy` y `dia`. */
  dias: number[]
  /** Cómo se llama en Vender: "refrescantes" → "3 refrescantes x $16.000". Vacío = "3 x $16.000". */
  nombre: string
}

export const PROMO_INICIAL: Promo = { activa: false, cantidad: 2, precio: 10000, tipos: ['NORMAL'], soloHoy: true, dia: '', dias: [], nombre: '' }

/** Cuántas promos se pueden tener guardadas (el ajuste del servidor mide 500 caracteres). */
export const MAX_PROMOS = 3

/** Largo máximo del nombre de una promo. */
export const MAX_NOMBRE_PROMO = 16

export const NOMBRES_DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/** Día de la semana de una fecha "2026-11-04": 1 = lunes ... 7 = domingo. */
export function diaSemana(dia: string): number {
  const d = new Date(dia + 'T12:00:00Z').getUTCDay()
  return d === 0 ? 7 : d
}

/** "miércoles", "lunes y miércoles", "lunes, martes y viernes". */
export function textoDias(dias: number[]): string {
  const nombres = [...dias].sort((a, b) => a - b).map(d => NOMBRES_DIAS[d - 1])
  return nombres.length > 1 ? nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1] : (nombres[0] ?? '')
}

/** Lee la promo que viene del servidor; lo que falte o venga raro se rellena con lo de siempre (2 x $10.000 en normales). */
export function leerPromo(texto?: string | null): Promo {
  try {
    const g = JSON.parse(texto || 'null') as Partial<Promo> | null
    if (!g) return PROMO_INICIAL
    const cantidad = Number.isInteger(g.cantidad) && g.cantidad! >= 2 && g.cantidad! <= 10 ? g.cantidad! : PROMO_INICIAL.cantidad
    const precio = Number.isFinite(g.precio) && g.precio! > 0 ? Math.round(g.precio!) : PROMO_INICIAL.precio
    const tipos = Array.isArray(g.tipos) && g.tipos.length ? g.tipos : PROMO_INICIAL.tipos
    return {
      // Las promos guardadas antes de Ajustes no tenían "activa": existir ya significaba prendida
      activa: g.activa ?? true,
      cantidad, precio, tipos,
      soloHoy: g.soloHoy ?? true,
      dia: typeof g.dia === 'string' ? g.dia : '',
      dias: Array.isArray(g.dias) ? g.dias.filter(d => Number.isInteger(d) && d >= 1 && d <= 7) : [],
      nombre: typeof g.nombre === 'string' ? g.nombre.trim().slice(0, MAX_NOMBRE_PROMO) : '',
    }
  } catch { return PROMO_INICIAL }
}

/** Todas las promos guardadas. Lo de antes era una sola promo (un objeto): queda como una lista de una. */
export function leerPromos(texto?: string | null): Promo[] {
  try {
    const g = JSON.parse(texto || 'null') as unknown
    if (!g || typeof g !== 'object') return []
    const lista = Array.isArray(g) ? g : [g]
    return lista.filter(x => x && typeof x === 'object').slice(0, MAX_PROMOS).map(x => leerPromo(JSON.stringify(x)))
  } catch { return [] }
}

/** Lo que se guarda en el servidor: la lista, sin datos que sobran (el ajuste mide 500 caracteres). */
export function serializarPromos(ps: Promo[]): string {
  return JSON.stringify(ps.slice(0, MAX_PROMOS).map(p => ({
    activa: p.activa, cantidad: p.cantidad, precio: p.precio, tipos: p.tipos, soloHoy: p.soloHoy,
    dia: p.soloHoy ? p.dia : '', dias: p.dias, ...(p.nombre ? { nombre: p.nombre } : {}),
  })))
}

/** Las que corren hoy. */
export function promosVigentes(ps: Promo[], hoy = diaBogota()): Promo[] {
  return ps.filter(p => promoVigente(p, hoy))
}

/** La promo que le aplica a ese producto (la primera de la lista que lo incluya y le haga descuento), o null. */
export function promoDe(promos: readonly Promo[], p: Producto): Promo | null {
  return promos.find(x => aplicaPromo(x, p)) ?? null
}

/** Lo que se guarda en el servidor. */
export function serializarPromo(p: Promo): string {
  return JSON.stringify(p)
}

/** ¿Está corriendo ahora mismo? Con días de la semana manda el calendario; si no, `soloHoy` y el día en que se prendió. */
export function promoVigente(p: Promo, hoy = diaBogota()): boolean {
  if (!p.activa) return false
  if (p.dias.length) return p.dias.includes(diaSemana(hoy))
  return !p.soloHoy || p.dia === hoy
}

/** Aplica si el tipo está elegido y el combo de verdad sale más barato que llevarlos sueltos. */
export function aplicaPromo(promo: Promo, p: Producto): boolean {
  return promo.tipos.includes(p.tipo) && promo.precio < p.precio * promo.cantidad
}

/** Total a cobrar: cada combo completo al precio de la promo y las unidades que sobran, a precio normal. */
export function totalConPromo(promo: Promo, p: Producto, cantidad: number): number {
  if (!aplicaPromo(promo, p)) return p.precio * cantidad
  return Math.floor(cantidad / promo.cantidad) * promo.precio + (cantidad % promo.cantidad) * p.precio
}

/** "2 x $10.000", o con nombre "3 refrescantes x $16.000". */
export function nombrePromo(p: Pick<Promo, 'cantidad' | 'precio'> & { nombre?: string }, formato: (n: number) => string): string {
  return `${p.cantidad}${p.nombre ? ' ' + p.nombre : ''} x ${formato(p.precio)}`
}

export interface LineaCombo {
  p: Producto
  cantidad: number
}

/**
 * Total cuando el cliente mezcla sabores en la promo (ej. 2 x $10.000 con dos sabores distintos).
 * Se arman los combos con las unidades más caras (le conviene al cliente) y las que sobran van a precio normal.
 * Nunca cobra más que llevarlos sueltos.
 */
export function totalMezclado(promo: Promo, lineas: LineaCombo[]): number {
  const normal = lineas.reduce((a, l) => a + l.p.precio * l.cantidad, 0)
  const precios = lineas
    .filter(l => aplicaPromo(promo, l.p))
    .flatMap(l => Array<number>(l.cantidad).fill(l.p.precio))
    .sort((a, b) => b - a)
  const combos = Math.floor(precios.length / promo.cantidad)
  if (!combos) return normal
  const fuera = lineas.filter(l => !aplicaPromo(promo, l.p)).reduce((a, l) => a + l.p.precio * l.cantidad, 0)
  const sobran = precios.slice(combos * promo.cantidad).reduce((a, n) => a + n, 0)
  return Math.min(normal, combos * promo.precio + sobran + fuera)
}

/**
 * Reparte el total cobrado entre las líneas (la API guarda una venta por sabor) en proporción a su precio normal.
 * Cada línea queda entre 0 y su precio normal, y la suma da exactamente `total`.
 */
export function repartirTotal(lineas: LineaCombo[], total: number): number[] {
  const normales = lineas.map(l => l.p.precio * l.cantidad)
  const suma = normales.reduce((a, n) => a + n, 0)
  if (total >= suma || suma === 0) return normales
  const partes = normales.map(n => Math.floor((total * n) / suma))
  let resto = total - partes.reduce((a, n) => a + n, 0)
  for (let i = 0; resto > 0 && i < partes.length; i = (i + 1) % partes.length) {
    if (partes[i] < normales[i]) { partes[i]++; resto-- }
  }
  return partes
}

/**
 * Pago dividido: reparte lo que se pagó en efectivo entre las líneas de la venta, en proporción a lo cobrado en cada una.
 * El resto de cada línea es Nequi. Cada parte cabe en su línea y la suma da justo `efectivo`.
 */
export function repartirEfectivo(cobrados: number[], efectivo: number): number[] {
  const suma = cobrados.reduce((a, n) => a + n, 0)
  if (suma === 0) return cobrados.map(() => 0)
  const tope = Math.min(Math.max(efectivo, 0), suma)
  const partes = cobrados.map(n => Math.floor((tope * n) / suma))
  let resto = tope - partes.reduce((a, n) => a + n, 0)
  for (let i = 0; resto > 0 && i < partes.length; i = (i + 1) % partes.length) {
    if (partes[i] < cobrados[i]) { partes[i]++; resto-- }
  }
  return partes
}

/** Una línea lista para la API: `total` solo si se cobró por debajo del precio normal, `efectivo` solo en MIXTO. */
export type LineaCobrada = { p: Producto; cantidad: number; total?: number; efectivo?: number }

/**
 * Cómo se reparte el cobro de varias líneas: con promo, el combo se arma mezclando sabores; cada línea lleva lo que
 * le toca (solo si quedó por debajo del precio normal) y, si pagó mitad y mitad, su parte en efectivo.
 */
export function cobrarLineas(lineas: LineaCombo[], m: Metodo, promos: readonly Promo[], enEfectivo?: number): LineaCobrada[] {
  const sinCobro = m === 'REGALO' || m === 'CONSUMO' // el servidor pone lo que vale: un regalo nada, un consumo lo que se descuenta
  const partes = sinCobro ? lineas.map(() => 0) : repartirConPromos(lineas, promos)
  // Pago dividido: lo pagado en efectivo se reparte igual entre las líneas, el resto de cada una es Nequi
  const efectivos = m === 'MIXTO' && enEfectivo !== undefined ? repartirEfectivo(partes, enEfectivo) : []
  return lineas.map((l, i) => ({
    p: l.p, cantidad: l.cantidad,
    total: m === 'REGALO' ? 0 : m === 'CONSUMO' ? undefined : partes[i] < l.p.precio * l.cantidad ? partes[i] : undefined,
    efectivo: m === 'MIXTO' ? efectivos[i] : undefined,
  }))
}

/**
 * Lo que se cobra por cada línea: cada promo arma sus combos con sus sabores (mezclados) y reparte su descuento solo
 * entre ellos; lo que no entra en ninguna va a precio normal (así un sabor que se llevó aparte no queda como vendido
 * en promo).
 */
function repartirConPromos(lineas: LineaCombo[], promos: readonly Promo[]): number[] {
  const partes = lineas.map(l => l.p.precio * l.cantidad)
  for (const promo of promos) {
    const idx = lineas.map((l, i) => (promoDe(promos, l.p) === promo ? i : -1)).filter(i => i >= 0)
    if (!idx.length) continue
    const grupo = idx.map(i => lineas[i])
    const reparto = repartirTotal(grupo, totalMezclado(promo, grupo))
    idx.forEach((i, j) => { partes[i] = reparto[j] })
  }
  return partes
}

/** Total de varias líneas con todas las promos que corren: cada una arma sus combos y el resto va a precio normal. */
export function totalConPromos(promos: readonly Promo[], lineas: LineaCombo[]): number {
  return repartirConPromos(lineas, promos).reduce((a, n) => a + n, 0)
}

// ---------------------------------------------------------------- ¿me sale rentable?

/** Lo que se le paga al trabajador por granizado, como está en Ajustes → Equipo (0 = sin tarifa). */
export interface TarifasEquipo {
  NORMAL: number
  CREMOSO: number
  GRANDE: number
  CERVEZA: number
  /** Lo que gana por cada uno vendido en promo (0 = gana su tarifa normal). */
  PROMO: number
}

export interface Rentabilidad {
  /** Los productos a los que les aplica (el combo sí les sale más barato). */
  aplica: Producto[]
  /** Productos del tipo escogido a los que el combo NO les hace descuento (cuesta igual o más que sueltos). */
  sinDescuento: Producto[]
  /** Productos que entran pero no tienen costo puesto: sin eso no se puede saber cuánto deja. */
  sinCosto: Producto[]
  /** Por cada combo, en el peor caso (armado con los de costo más alto). */
  cobras: number
  producto: number
  trabajador: number
  /** Lo que te queda si lo vendes tú y si lo vende un trabajador. */
  quedaTu: number
  quedaConTrabajador: number
  /** `quedaConTrabajador` como porcentaje de lo que cobras. */
  pct: number
  /** Lo que te quedaría vendiendo esos mismos granizados sueltos (con trabajador). */
  sueltos: number
  /** Precio del combo para que con trabajador te quede al menos el 20 %. */
  sugerido: number
  /** Hay tarifas por granizado: si no, al trabajador se le paga un % y acá no se cuenta. */
  hayTarifas: boolean
  veredicto: 'sin-datos' | 'pierde' | 'justo' | 'bien'
}

/** Debajo de esto (con trabajador) la promo deja muy poquito. */
export const MARGEN_JUSTO = 15

/**
 * ¿Te sale rentable la promo después de pagarle al trabajador? Se calcula por combo y en el peor caso: el combo
 * armado con los granizados que más te cuestan. Al trabajador se le cuenta su tarifa en promo (o la normal).
 */
export function rentabilidad(promo: Promo, productos: readonly Producto[], tarifas: TarifasEquipo): Rentabilidad {
  const delTipo = productos.filter(p => p.activo && promo.tipos.includes(p.tipo))
  const aplica = delTipo.filter(p => aplicaPromo(promo, p))
  const sinDescuento = delTipo.filter(p => !aplicaPromo(promo, p))
  const sinCosto = aplica.filter(p => !(p.costo > 0))
  const hayTarifas = tarifas.NORMAL + tarifas.CREMOSO + tarifas.GRANDE + tarifas.CERVEZA > 0
  const peor = [...aplica].sort((a, b) => b.costo - a.costo || b.precio - a.precio)[0]
  const vacia: Rentabilidad = {
    aplica, sinDescuento, sinCosto, cobras: promo.precio, producto: 0, trabajador: 0, quedaTu: 0, quedaConTrabajador: 0,
    pct: 0, sueltos: 0, sugerido: 0, hayTarifas, veredicto: 'sin-datos',
  }
  if (!peor || sinCosto.length === aplica.length) return vacia
  const n = promo.cantidad
  const tarifaNormal = hayTarifas ? tarifas[peor.tipo] : 0
  const tarifaPromo = hayTarifas && tarifas.PROMO > 0 ? tarifas.PROMO : tarifaNormal
  const producto = peor.costo * n
  const trabajador = tarifaPromo * n
  const quedaTu = promo.precio - producto
  const quedaConTrabajador = quedaTu - trabajador
  const pct = promo.precio > 0 ? Math.round(quedaConTrabajador * 100 / promo.precio) : 0
  const sueltos = (peor.precio - peor.costo - tarifaNormal) * n
  const sugerido = Math.ceil((producto + trabajador) / 0.8 / 500) * 500
  const veredicto = sinCosto.length ? 'sin-datos' : quedaConTrabajador < 0 ? 'pierde' : pct < MARGEN_JUSTO ? 'justo' : 'bien'
  return { ...vacia, producto, trabajador, quedaTu, quedaConTrabajador, pct, sueltos, sugerido, veredicto }
}
