import type { DatosPremios, Escalon, PremiosDia } from './tipos'

// Premios que le convengan a los dos. La idea: un premio solo tiene sentido si paga por vender MÁS de lo que se vende
// en un día normal, y el trabajador se lleva una parte de la ganancia extra que esos granizados de más te dejan.

/** Qué parte (en %) de la ganancia extra se lleva el trabajador en los premios sugeridos. */
export const PARTE_TRABAJADOR = 35

/** Más de esto (en % de lo extra) ya es mucho: casi todo lo que ganas de más se va en el premio. */
export const PARTE_MAXIMA = 50

export interface AnalisisEscalon {
  granizados: number
  premio: number
  /** Lo que te dejan de más los granizados por encima de un día normal (ya pagada la comisión). */
  extra: number
  /** Lo que te queda de esa ganancia extra después de pagar el premio. */
  teQueda: number
  /** El premio como % de lo extra. */
  pct: number
  veredicto: 'dia-normal' | 'pierde' | 'mucho' | 'bien'
}

const redondear500 = (n: number) => Math.max(0, Math.floor(n / 500) * 500)

/** Cómo le va a un escalón: cuánto te deja de más y qué parte de eso se lleva el trabajador. */
export function analizarEscalon(e: Escalon, d: DatosPremios, promo = false, rebaja = 0): AnalisisEscalon {
  const margen = promo ? d.margenPromo ?? d.margenNormal : d.margenNormal
  const premio = promo ? Math.max(0, e.total - rebaja) : e.total
  const extra = Math.max(0, e.granizados - d.base) * margen
  const pct = extra > 0 ? Math.round(premio * 100 / extra) : premio > 0 ? 999 : 0
  const veredicto = premio > 0 && e.granizados <= d.base ? 'dia-normal'
    : premio > extra ? 'pierde'
      : pct > PARTE_MAXIMA ? 'mucho' : 'bien'
  return { granizados: e.granizados, premio, extra, teQueda: extra - premio, pct, veredicto }
}

/**
 * Premios sugeridos: escalones un poco por encima de un día normal (25 %, 50 %, 80 % y más del doble), y en cada uno el
 * trabajador se lleva el 35 % de lo que esos granizados de más te dejan. La rebaja en promo sale de la diferencia entre
 * lo que deja un granizado normal y uno en promo (null si todavía no hay ventas en promo para saberlo).
 */
export function sugerirPremios(d: DatosPremios): { escalones: Escalon[]; rebaja: number | null } {
  if (d.base <= 0 || d.margenNormal <= 0) return { escalones: [], rebaja: null }
  const escalones: Escalon[] = []
  let anterior = d.base
  for (const m of [1.25, 1.5, 1.8, 2.2]) {
    const granizados = Math.max(anterior + 1, Math.round(d.base * m))
    const total = redondear500((granizados - d.base) * d.margenNormal * PARTE_TRABAJADOR / 100)
    if (total >= 500 && !escalones.some(e => e.total >= total)) escalones.push({ granizados, total })
    anterior = granizados
  }
  let rebaja: number | null = null
  if (d.margenPromo !== null && escalones.length) {
    const diferencias = escalones.map(e => e.total - redondear500((e.granizados - d.base) * Math.max(0, d.margenPromo ?? 0) * PARTE_TRABAJADOR / 100))
    rebaja = redondear500(diferencias.reduce((a, n) => a + n, 0) / diferencias.length)
  }
  return { escalones, rebaja }
}

// ---------------------------------------------------------------- la meta propia del trabajador

/** Lo que gana por cada granizado hoy (si le pagan por %, lo del granizado normal a $6.000 según su %). */
export function porGranizado(p: PremiosDia, precioNormal = 6000): number {
  const t = p.tarifas
  if (!t) return 0
  if (t.porcentaje !== null && t.porcentaje !== undefined) return Math.round(precioNormal * t.porcentaje / 100)
  return p.diaPromo && t.promo > 0 ? t.promo : t.normal
}

/** El premio que daría llegar a `meta` hoy (el escalón más alto alcanzado). */
export function premioAl(p: PremiosDia, meta: number): number {
  return p.escalones.filter(e => e.granizados <= meta).reduce((a, e) => Math.max(a, e.total), 0)
}

/** Cuánto ganaría en total si vende `meta` hoy: comisión aproximada + premio. */
export function ganariaCon(p: PremiosDia, meta: number): number {
  return meta * porGranizado(p) + premioAl(p, meta)
}

/**
 * Lo que se le ofrece para escoger: los escalones de premio que todavía no alcanza (son las metas que pagan) y, si no
 * hay premios, de 5 en 5 desde lo que ya vendió. Para «¿vas por más?» solo van las que pasan de `desde`.
 */
export function opcionesMeta(p: PremiosDia, desde = 0): number[] {
  const piso = Math.max(desde, p.vendidas)
  const deEscalones = p.escalones.map(e => e.granizados).filter(g => g > piso)
  if (deEscalones.length >= 2) return deEscalones.slice(0, 4)
  const base = Math.max(5, Math.ceil((piso + 1) / 5) * 5)
  const sueltas = [base, base + 5, base + 10, base + 15]
  return [...new Set([...deEscalones, ...sueltas])].sort((a, b) => a - b).slice(0, 4)
}
