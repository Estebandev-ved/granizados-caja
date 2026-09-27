import { diaBogota } from './estadoLocal'

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
