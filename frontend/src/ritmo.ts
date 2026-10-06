import type { ReporteSabor } from './tipos'

/** Cuántos días de venta se miran para saber el ritmo de cada sabor. */
export const VENTANA_RITMO = 14

/** Unidades por día de cada sabor (por nombre), según lo vendido en la ventana. `dias` = días reales de operación. */
export function ritmoPorSabor(sabores: ReporteSabor[], dias: number): Map<string, number> {
  const ventana = Math.max(1, Math.min(VENTANA_RITMO, dias || VENTANA_RITMO))
  return new Map(sabores.map(s => [s.sabor, s.unidades / ventana]))
}

/**
 * Para cuántos días alcanza lo que queda a ese ritmo. Nulo si no hay dato o no se vende
 * (no se puede predecir) o si todavía alcanza para más de `limite` días (no hace falta avisar).
 */
export function diasQueAlcanza(stock: number, ritmo: number | undefined, limite = 3): number | null {
  if (stock <= 0 || !ritmo || ritmo <= 0) return null
  const dias = stock / ritmo
  return dias <= limite ? dias : null
}

export function textoAlcanza(dias: number): string {
  if (dias < 1) return 'se acaba hoy'
  const n = Math.round(dias)
  return n <= 1 ? 'alcanza ~1 día' : `alcanza ~${n} días`
}

/** Los hitos de la racha: 3, 7 y 30 días seguidos cumpliendo la meta. */
const HITOS = [
  { dias: 30, nombre: 'Imparable' },
  { dias: 7, nombre: 'Semana perfecta' },
  { dias: 3, nombre: 'En racha' },
]

/** El hito más alto alcanzado con esa racha, o nulo si todavía no llega al primero. */
export function hitoDeRacha(racha: number): { dias: number; nombre: string } | null {
  return HITOS.find(h => racha >= h.dias) ?? null
}

/** Si cumplir hoy completa justo un hito (racha 2→3, 6→7, 29→30). */
export function hitoNuevo(rachaNueva: number): { dias: number; nombre: string } | null {
  return HITOS.find(h => h.dias === rachaNueva) ?? null
}
