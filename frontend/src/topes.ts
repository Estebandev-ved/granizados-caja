import { CATEGORIA_TEXTO } from './reportes'
import type { CategoriaGasto } from './tipos'

// Topes de gasto al mes por categoría (ajuste TOPES_GASTO, JSON {"HIELO":60000}). Sirven para hacerle seguimiento a
// en qué se va la plata: la app avisa cuando una categoría se acerca a su tope y cuando se pasa.

export type Topes = Record<CategoriaGasto, number>

/** Desde aquí (en % del tope) se avisa que ya casi se llega. */
export const CASI = 80

export function leerTopes(texto?: string | null): Topes {
  try {
    const g = JSON.parse(texto || 'null') as unknown
    if (!g || typeof g !== 'object' || Array.isArray(g)) return {}
    const topes: Topes = {}
    for (const [k, v] of Object.entries(g as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) topes[k] = Math.round(v)
    }
    return topes
  } catch { return {} }
}

/** Solo los topes puestos (mayores que 0). */
export function serializarTopes(t: Topes): string {
  return JSON.stringify(Object.fromEntries(Object.entries(t).filter(([, v]) => v > 0)))
}

export interface AvanceCategoria {
  categoria: CategoriaGasto
  nombre: string
  gastado: number
  /** 0 = sin tope. */
  tope: number
  /** Gastado como % del tope (0 sin tope). */
  pct: number
  estado: 'sin-tope' | 'bien' | 'casi' | 'pasado'
}

export function avanceDe(categoria: CategoriaGasto, gastado: number, tope: number): AvanceCategoria {
  const pct = tope > 0 ? Math.round(gastado * 100 / tope) : 0
  return {
    categoria, nombre: CATEGORIA_TEXTO[categoria] ?? categoria, gastado, tope, pct,
    estado: tope <= 0 ? 'sin-tope' : gastado > tope ? 'pasado' : pct >= CASI ? 'casi' : 'bien',
  }
}

/**
 * Cómo va cada categoría este mes: las que tienen tope y las que tienen gasto. Primero las pasadas, luego las que
 * van casi, y después por lo gastado.
 */
export function avanceDelMes(gastosMes: Record<string, number> | null | undefined, topes: Topes): AvanceCategoria[] {
  const gastos = gastosMes ?? {}
  const categorias = new Set([...Object.keys(gastos), ...Object.keys(topes)])
  const orden = { pasado: 0, casi: 1, bien: 2, 'sin-tope': 3 }
  return [...categorias]
    .map(c => avanceDe(c, gastos[c] ?? 0, topes[c] ?? 0))
    .sort((a, b) => orden[a.estado] - orden[b.estado] || b.gastado - a.gastado)
}

/** El aviso que se muestra al anotar un gasto si con él la categoría llega cerca de su tope o se pasa. */
export function avisoAlGastar(antes: AvanceCategoria, monto: number): string | null {
  if (antes.tope <= 0) return null
  const despues = avanceDe(antes.categoria, antes.gastado + monto, antes.tope)
  if (despues.estado === 'pasado') {
    return `⚠️ Te pasaste del tope de ${despues.nombre}: llevas $${miles(despues.gastado)} de $${miles(despues.tope)} este mes`
  }
  if (despues.estado === 'casi' && antes.estado !== 'casi') {
    return `Ojo: ya llevas el ${despues.pct}% del tope de ${despues.nombre} este mes`
  }
  return null
}

function miles(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Cuánto se puede gastar por día en lo que queda del mes sin pasarse del tope (0 si ya se pasó). */
export function porDiaQueQueda(a: AvanceCategoria, dia: string): number {
  if (a.tope <= 0 || a.gastado >= a.tope) return 0
  const [anio, mes, d] = dia.split('-').map(Number)
  const diasMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  const quedan = diasMes - d + 1
  return Math.floor((a.tope - a.gastado) / quedan)
}
