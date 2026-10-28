import type { MetaEquipo } from './tipos'

/** Los tres logros del día, como fracción de la meta: a mitad de camino, la meta y la súper meta. */
export const NIVELES = [
  { fraccion: 0.5, nombre: 'A medio camino' },
  { fraccion: 1, nombre: 'Meta cumplida' },
  { fraccion: 1.5, nombre: 'Súper meta' },
] as const

/** Cuántos logros lleva (0 a 3). */
export function nivelAlcanzado(meta: MetaEquipo): number {
  return NIVELES.filter(n => meta.vendidas >= Math.ceil(meta.unidades * n.fraccion)).length
}
