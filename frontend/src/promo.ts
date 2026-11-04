import { diaBogota } from './estadoLocal'
import type { Producto, Tipo } from './tipos'

// Promoción tipo "2 x $10.000". Se configura en Ajustes, se guarda en el servidor (ajuste PROMO) y le llega a todos los
// celulares con el estado, así los trabajadores la venden igual que el dueño. Puede correr ciertos días de la semana.

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
}

export const PROMO_INICIAL: Promo = { activa: false, cantidad: 2, precio: 10000, tipos: ['NORMAL'], soloHoy: true, dia: '', dias: [] }

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
    }
  } catch { return PROMO_INICIAL }
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

/** "2 x $10.000" */
export function nombrePromo(p: Pick<Promo, 'cantidad' | 'precio'>, formato: (n: number) => string): string {
  return `${p.cantidad} x ${formato(p.precio)}`
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
