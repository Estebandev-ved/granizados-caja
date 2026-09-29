import { diaBogota } from './estadoLocal'
import type { CategoriaGasto } from './tipos'

export const CATEGORIA_TEXTO: Record<CategoriaGasto, string> = {
  HIELO: 'Hielo', TRANSPORTE: 'Transporte', EMPAQUE: 'Empaque', OTRO: 'Otro',
}

/** Los cortes de los reportes. Todos se calculan en días de Bogotá. */
export type Periodo = 'hoy' | 'semana' | 'mes' | 'anio' | 'personalizado'

export const PERIODOS: Record<Periodo, string> = {
  hoy: 'Hoy', semana: 'Semana', mes: 'Mes', anio: 'Año', personalizado: 'Elegir',
}

/**
 * Le quita días a una fecha "2026-09-25". Va por mediodía UTC para que el cambio de día
 * coincida siempre con el de Bogotá (Colombia no cambia de hora, así que no hay trampa).
 */
export function restarDias(dia: string, n: number): string {
  return diaBogota(Date.parse(dia + 'T12:00:00Z') - n * 86400000)
}

/** El [desde, hasta] del periodo, ambos incluidos. */
export function rangoDe(
  periodo: Periodo,
  hoy: string,
  propios: { desde: string; hasta: string },
): { desde: string; hasta: string } {
  switch (periodo) {
    case 'hoy': return { desde: hoy, hasta: hoy }
    case 'semana': return { desde: restarDias(hoy, 6), hasta: hoy }
    case 'mes': return { desde: hoy.slice(0, 8) + '01', hasta: hoy }
    case 'anio': return { desde: hoy.slice(0, 5) + '01-01', hasta: hoy }
    default: return propios
  }
}

/** Variación porcentual contra el periodo anterior. Nulo si no hay base para comparar o no cambió. */
export function variacion(actual: number, anterior: number): { texto: string; pct: number; clase: string } | null {
  if (anterior <= 0) return null
  const pct = Math.round((actual - anterior) / anterior * 100)
  if (pct === 0) return null
  return { texto: (pct > 0 ? '▲ ' : '▼ ') + Math.abs(pct) + '% vs anterior', pct, clase: pct > 0 ? 'delta-up' : 'delta-down' }
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "2026-09-24" a "24 sep 26". */
export function fechaCorta(dia: string): string {
  const [a, m, d] = dia.split('-')
  return `${Number(d)} ${MESES[Number(m) - 1]} ${a.slice(2)}`
}
