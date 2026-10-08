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

// ---------------------------------------------------------------- comparar semanas

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Posición del día en la semana, con lunes = 0. */
export function diaDeSemana(dia: string): number {
  const [a, m, d] = dia.split('-').map(Number)
  return (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7
}

export function lunesDe(dia: string): string {
  return restarDias(dia, diaDeSemana(dia))
}

export interface DiaSemana {
  dia: string
  total: number
  unidades: number
  /** Todavía no llega ese día (solo pasa en la semana en curso). */
  futuro: boolean
}

export interface Semana {
  /** El lunes de esa semana. */
  inicio: string
  dias: DiaSemana[]
  total: number
  unidades: number
}

/** Cuántas semanas completas hacia atrás se piden además de la actual. */
export const SEMANAS_ATRAS = 3

/** El rango que hay que pedir al servidor para armar las semanas: del lunes más viejo a hoy. */
export function rangoSemanas(hoy: string, atras = SEMANAS_ATRAS): { desde: string; hasta: string } {
  return { desde: restarDias(lunesDe(hoy), atras * 7), hasta: hoy }
}

/** Arma las semanas (lun-dom) de la más vieja a la actual, a partir de las ventas por día. */
export function armarSemanas(
  porDia: readonly { dia: string; total: number; unidades: number }[],
  hoy: string,
  atras = SEMANAS_ATRAS,
): Semana[] {
  const porFecha = new Map(porDia.map(d => [d.dia, d]))
  const lunesActual = lunesDe(hoy)
  const semanas: Semana[] = []
  for (let s = atras; s >= 0; s--) {
    const inicio = restarDias(lunesActual, s * 7)
    const dias: DiaSemana[] = []
    for (let i = 0; i < 7; i++) {
      const dia = restarDias(inicio, -i)
      const v = porFecha.get(dia)
      dias.push({ dia, total: v?.total ?? 0, unidades: v?.unidades ?? 0, futuro: dia > hoy })
    }
    semanas.push({
      inicio, dias,
      total: dias.reduce((a, d) => a + d.total, 0),
      unidades: dias.reduce((a, d) => a + d.unidades, 0),
    })
  }
  return semanas
}

/** Lo vendido en los primeros `n` días de la semana (para comparar justo hasta el mismo día). */
export function totalPrimerosDias(s: Semana, n: number): number {
  return s.dias.slice(0, n).reduce((a, d) => a + d.total, 0)
}
