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
  /**
   * Cómo se llama en Vender: "refrescantes" → "3 refrescantes x $16.000". Vacío = "3 x $16.000".
   * En un combo mixto es el texto completo: "4 refrescantes + 1 cremoso" → "4 refrescantes + 1 cremoso x $35.000".
   */
  nombre: string
  /**
   * Combo mixto: cuántos de cada tipo, en el mismo orden de `tipos` (ej. tipos [NORMAL, CREMOSO] y partes [4, 1] =
   * 4 normales + 1 cremoso). Vacío = el cliente mezcla como quiera `cantidad` de esos tipos.
   */
  partes: number[]
}

export const PROMO_INICIAL: Promo = { activa: false, cantidad: 2, precio: 10000, tipos: ['NORMAL'], soloHoy: true, dia: '', dias: [], nombre: '', partes: [] }

/** Cuántas promos se pueden tener guardadas (el ajuste del servidor mide 2.000 caracteres). */
export const MAX_PROMOS = 8

/** Largo máximo del nombre de una promo. */
export const MAX_NOMBRE_PROMO = 28

/** ¿Es un combo con cuántos de cada tipo fijos (ej. 1 cremoso + 1 refrescante)? */
export function esMixta(p: Pick<Promo, 'partes'>): boolean {
  return p.partes.length > 0
}

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
    // Combo mixto: un número entero por tipo y en total de 2 a 10; si viene raro se toma como mezcla libre
    const partes = Array.isArray(g.partes) && g.partes.length === tipos.length && new Set(tipos).size === tipos.length
      && g.partes.every(n => Number.isInteger(n) && n >= 1) ? g.partes : []
    const suma = partes.reduce((a, n) => a + n, 0)
    const mixta = suma >= 2 && suma <= 10
    return {
      // Las promos guardadas antes de Ajustes no tenían "activa": existir ya significaba prendida
      activa: g.activa ?? true,
      cantidad: mixta ? suma : cantidad, precio, tipos,
      partes: mixta ? partes : [],
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
    ...(esMixta(p) ? { partes: p.partes } : {}),
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

/**
 * ¿Ese producto puede entrar en la promo? Sencilla: si el tipo está elegido y el combo de verdad sale más barato que
 * llevarlos sueltos. Mixta: si su tipo es parte del combo (el descuento se mira con el combo armado, `daDescuento`).
 */
export function aplicaPromo(promo: Promo, p: Producto): boolean {
  if (esMixta(promo)) return promo.tipos.includes(p.tipo)
  return promo.tipos.includes(p.tipo) && promo.precio < p.precio * promo.cantidad
}

/**
 * ¿Con estos productos la promo le hace descuento a alguien? Una mixta necesita al menos un producto de cada tipo
 * del combo y que el combo armado con los más caros cueste menos que sueltos. Con precios de la calle puede servir y
 * en la universidad no (o al revés): Vender solo muestra las que sirven.
 */
export function daDescuento(promo: Promo, productos: readonly Producto[]): boolean {
  if (!esMixta(promo)) return productos.some(p => aplicaPromo(promo, p))
  let normal = 0
  for (let i = 0; i < promo.tipos.length; i++) {
    const precios = productos.filter(p => p.tipo === promo.tipos[i]).map(p => p.precio)
    if (!precios.length) return false
    normal += Math.max(...precios) * promo.partes[i]
  }
  return promo.precio < normal
}

/** Total a cobrar: cada combo completo al precio de la promo y las unidades que sobran, a precio normal. */
export function totalConPromo(promo: Promo, p: Producto, cantidad: number): number {
  return totalConPromos([promo], [{ p, cantidad }])
}

const TIPO_TEXTO: Record<Tipo, [string, string]> = {
  NORMAL: ['normal', 'normales'], CREMOSO: ['cremoso', 'cremosos'], GRANDE: ['grande', 'grandes'], CERVEZA: ['cerveza', 'cervezas'],
}

/** "2 x $10.000", con nombre "3 refrescantes x $16.000" y mixta "1 cremoso + 1 refrescante x $15.500". */
export function nombrePromo(p: Pick<Promo, 'cantidad' | 'precio'> & { nombre?: string; partes?: number[]; tipos?: Tipo[] },
                            formato: (n: number) => string): string {
  const tipos = p.tipos
  if (p.partes?.length && tipos) {
    const texto = p.nombre || p.partes.map((n, i) => `${n} ${TIPO_TEXTO[tipos[i]][n === 1 ? 0 : 1]}`).join(' + ')
    return `${texto} x ${formato(p.precio)}`
  }
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
  return totalConPromos([promo], lineas)
}

// ---------------------------------------------------------------- la mejor combinación de combos

const ORDEN_TIPOS: Tipo[] = ['NORMAL', 'CREMOSO', 'GRANDE', 'CERVEZA']

/** Un combo concreto: cuántos de cada tipo (en el orden de ORDEN_TIPOS) y lo que cuesta. */
interface Receta { promo: Promo; precio: number; pide: number[] }

/** Cada promo como combos concretos. Una de mezcla libre con varios tipos da una receta por cada forma de repartirla. */
function recetasDe(promo: Promo): Receta[] {
  const idx = promo.tipos.map(t => ORDEN_TIPOS.indexOf(t)).filter(i => i >= 0)
  if (!idx.length) return []
  if (esMixta(promo)) {
    const pide = [0, 0, 0, 0]
    promo.tipos.forEach((t, i) => { pide[ORDEN_TIPOS.indexOf(t)] += promo.partes[i] })
    return [{ promo, precio: promo.precio, pide }]
  }
  const out: Receta[] = []
  const repartir = (k: number, quedan: number, pide: number[]) => {
    if (k === idx.length - 1) {
      const fin = [...pide]
      fin[idx[k]] += quedan
      out.push({ promo, precio: promo.precio, pide: fin })
      return
    }
    for (let n = 0; n <= quedan; n++) {
      const sig = [...pide]
      sig[idx[k]] += n
      repartir(k + 1, quedan - n, sig)
    }
  }
  repartir(0, promo.cantidad, [0, 0, 0, 0])
  return out
}

/** Lo que salió de armar los combos. */
interface Plan {
  total: number
  /** Por línea: cuántas de sus unidades quedaron dentro de algún combo. */
  enCombo: number[]
  /** Lo que se cobra por todos los combos juntos (0 = no hubo combo). */
  combos: number
  /** Qué promos se usaron y cuántas veces. */
  usadas: { promo: Promo; veces: number }[]
}

/**
 * La combinación de combos que le sale más barata al cliente con todas las promos que corren (ej. con "2 x $13.000"
 * y "3 x $19.000", tres refrescantes van en el de 3). Cada combo se arma con las unidades más caras de cada tipo y lo
 * que sobra va a precio normal. Nunca cobra más que llevarlos sueltos.
 */
function planear(promos: readonly Promo[], lineas: LineaCombo[]): Plan {
  const normal = lineas.reduce((a, l) => a + l.p.precio * l.cantidad, 0)
  const sinCombo: Plan = { total: normal, enCombo: lineas.map(() => 0), combos: 0, usadas: [] }
  // Las unidades de cada tipo que alguna promo acepta, de la más cara a la más barata (las caras van primero a los combos)
  const unidades: { linea: number; precio: number }[][] = ORDEN_TIPOS.map(() => [])
  lineas.forEach((l, i) => {
    const t = ORDEN_TIPOS.indexOf(l.p.tipo)
    if (t < 0 || !promos.some(pr => aplicaPromo(pr, l.p))) return
    for (let k = 0; k < l.cantidad; k++) unidades[t].push({ linea: i, precio: l.p.precio })
  })
  unidades.forEach(u => u.sort((a, b) => b.precio - a.precio))
  // Lo que cuestan las `n` más baratas de cada tipo (las que se quedan por fuera de los combos)
  const baratas = unidades.map(u => {
    const suma = [0]
    for (let k = u.length - 1; k >= 0; k--) suma.push(suma[suma.length - 1] + u[k].precio)
    return suma
  })
  const recetas = promos.flatMap(recetasDe).filter(r => r.pide.some(n => n > 0))
  if (!recetas.length) return sinCombo

  type Mejor = { costo: number; veces: number[] }
  const memo = new Map<string, Mejor>()
  const mejor = (r: number, quedan: number[]): Mejor => {
    if (r === recetas.length) return { costo: quedan.reduce((a, n, t) => a + baratas[t][n], 0), veces: [] }
    const clave = r + ':' + quedan.join(',')
    const visto = memo.get(clave)
    if (visto) return visto
    const { pide, precio } = recetas[r]
    let res: Mejor | null = null
    for (let k = 0; ; k++) {
      const resto = quedan.map((n, t) => n - pide[t] * k)
      if (resto.some(n => n < 0)) break
      const sig = mejor(r + 1, resto)
      const costo = sig.costo + precio * k
      // En empate gana la de menos combos: así no se marca como promo lo que no ahorra nada
      if (!res || costo < res.costo) res = { costo, veces: [k, ...sig.veces] }
    }
    memo.set(clave, res!)
    return res!
  }

  const { veces } = mejor(0, unidades.map(u => u.length))
  const usados = [0, 0, 0, 0]
  let combos = 0
  const porPromo = new Map<Promo, number>()
  veces.forEach((k, r) => {
    if (!k) return
    combos += recetas[r].precio * k
    recetas[r].pide.forEach((n, t) => { usados[t] += n * k })
    porPromo.set(recetas[r].promo, (porPromo.get(recetas[r].promo) ?? 0) + k)
  })
  const enCombo = lineas.map(() => 0)
  usados.forEach((n, t) => unidades[t].slice(0, n).forEach(u => { enCombo[u.linea]++ }))
  const dentro = lineas.reduce((a, l, i) => a + l.p.precio * enCombo[i], 0)
  if (!combos || combos >= dentro) return sinCombo
  return { total: normal - dentro + combos, enCombo, combos, usadas: [...porPromo].map(([promo, v]) => ({ promo, veces: v })) }
}

/** Las promos que se usaron en esa compra (para decir "promo 3 refrescantes x $19.000"). */
export function promosUsadas(promos: readonly Promo[], lineas: LineaCombo[]): { promo: Promo; veces: number }[] {
  return planear(promos, lineas).usadas
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
 * Lo que se cobra por cada línea: con todas las promos se busca la combinación de combos más barata (mezclando
 * sabores y tipos) y lo que cuestan los combos se reparte solo entre las unidades que entraron; lo que no entra en
 * ningún combo va a precio normal (así un sabor que se llevó aparte no queda como vendido en promo).
 */
function repartirConPromos(lineas: LineaCombo[], promos: readonly Promo[]): number[] {
  const plan = planear(promos, lineas)
  const normales = lineas.map(l => l.p.precio * l.cantidad)
  if (!plan.combos) return normales
  const idx = lineas.map((_, i) => i).filter(i => plan.enCombo[i] > 0)
  const reparto = repartirTotal(idx.map(i => ({ p: lineas[i].p, cantidad: plan.enCombo[i] })), plan.combos)
  const partes = [...normales]
  idx.forEach((i, j) => { partes[i] = reparto[j] + (lineas[i].cantidad - plan.enCombo[i]) * lineas[i].p.precio })
  return partes
}

/** Total de varias líneas con todas las promos que corren: la mejor combinación de combos y el resto a precio normal. */
export function totalConPromos(promos: readonly Promo[], lineas: LineaCombo[]): number {
  return planear(promos, lineas).total
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
  const mixta = esMixta(promo)
  const sirve = !mixta || daDescuento(promo, delTipo)
  const aplica = sirve ? delTipo.filter(p => aplicaPromo(promo, p)) : []
  const sinDescuento = sirve ? delTipo.filter(p => !aplicaPromo(promo, p)) : delTipo
  const sinCosto = aplica.filter(p => !(p.costo > 0))
  const hayTarifas = tarifas.NORMAL + tarifas.CREMOSO + tarifas.GRANDE + tarifas.CERVEZA > 0
  const peorDe = (ps: Producto[]) => [...ps].sort((a, b) => b.costo - a.costo || b.precio - a.precio)[0]
  // El combo en el peor caso: el de costo más alto (en una mixta, el peor de cada tipo con su cantidad)
  const receta: { p: Producto; n: number }[] = mixta
    ? promo.tipos.map((t, i) => ({ p: peorDe(aplica.filter(p => p.tipo === t)), n: promo.partes[i] })).filter(x => x.p)
    : aplica.length ? [{ p: peorDe(aplica), n: promo.cantidad }] : []
  const vacia: Rentabilidad = {
    aplica, sinDescuento, sinCosto, cobras: promo.precio, producto: 0, trabajador: 0, quedaTu: 0, quedaConTrabajador: 0,
    pct: 0, sueltos: 0, sugerido: 0, hayTarifas, veredicto: 'sin-datos',
  }
  if (!receta.length || sinCosto.length === aplica.length) return vacia
  const tarifaNormal = (p: Producto) => (hayTarifas ? tarifas[p.tipo] : 0)
  const tarifaPromo = (p: Producto) => (hayTarifas && tarifas.PROMO > 0 ? tarifas.PROMO : tarifaNormal(p))
  const suma = (f: (x: { p: Producto; n: number }) => number) => receta.reduce((a, x) => a + f(x) * x.n, 0)
  const producto = suma(x => x.p.costo)
  const trabajador = suma(x => tarifaPromo(x.p))
  const quedaTu = promo.precio - producto
  const quedaConTrabajador = quedaTu - trabajador
  const pct = promo.precio > 0 ? Math.round(quedaConTrabajador * 100 / promo.precio) : 0
  const sueltos = suma(x => x.p.precio - x.p.costo - tarifaNormal(x.p))
  const sugerido = Math.ceil((producto + trabajador) / 0.8 / 500) * 500
  const veredicto = sinCosto.length ? 'sin-datos' : quedaConTrabajador < 0 ? 'pierde' : pct < MARGEN_JUSTO ? 'justo' : 'bien'
  return { ...vacia, producto, trabajador, quedaTu, quedaConTrabajador, pct, sueltos, sugerido, veredicto }
}
