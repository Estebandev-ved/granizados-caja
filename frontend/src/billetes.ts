import { pesos } from './formato'

// Contar el efectivo billete por billete: cuántos hay de cada valor y la app suma.

export interface Denominacion {
  /** Único: el billete y la moneda de $1.000 son distintos. */
  clave: string
  valor: number
  tipo: 'billete' | 'moneda'
}

/** Los billetes y monedas que circulan en Colombia, de mayor a menor. */
export const DENOMINACIONES: readonly Denominacion[] = [
  { clave: 'b100000', valor: 100_000, tipo: 'billete' },
  { clave: 'b50000', valor: 50_000, tipo: 'billete' },
  { clave: 'b20000', valor: 20_000, tipo: 'billete' },
  { clave: 'b10000', valor: 10_000, tipo: 'billete' },
  { clave: 'b5000', valor: 5_000, tipo: 'billete' },
  { clave: 'b2000', valor: 2_000, tipo: 'billete' },
  { clave: 'b1000', valor: 1_000, tipo: 'billete' },
  { clave: 'm1000', valor: 1_000, tipo: 'moneda' },
  { clave: 'm500', valor: 500, tipo: 'moneda' },
  { clave: 'm200', valor: 200, tipo: 'moneda' },
  { clave: 'm100', valor: 100, tipo: 'moneda' },
  { clave: 'm50', valor: 50, tipo: 'moneda' },
]

/** Cuántos hay de cada uno, por `clave`. */
export type Conteo = Record<string, number>

const cuantos = (c: Conteo, d: Denominacion) => Math.max(0, Math.floor(c[d.clave] ?? 0))

export function totalDe(c: Conteo): number {
  return DENOMINACIONES.reduce((s, d) => s + cuantos(c, d) * d.valor, 0)
}

export function totalPorTipo(c: Conteo, tipo: Denominacion['tipo']): number {
  return DENOMINACIONES.filter(d => d.tipo === tipo).reduce((s, d) => s + cuantos(c, d) * d.valor, 0)
}

/** Para la nota del cierre: «5×$5.000 · 3×$1.000 (mon.)». Solo lo que tiene algo. */
export function desglose(c: Conteo): string {
  return DENOMINACIONES.filter(d => cuantos(c, d) > 0)
    .map(d => `${cuantos(c, d)}×${pesos(d.valor)}${d.tipo === 'moneda' && d.valor === 1_000 ? ' (mon.)' : ''}`)
    .join(' · ')
}

/** Junta la nota que escribió el dueño con el desglose, sin pasarse del máximo (si no cabe, queda solo la nota). */
export function notaConDesglose(nota: string, detalle: string, max = 120): string {
  const junta = [nota.trim(), detalle].filter(Boolean).join(' · ')
  return junta.length <= max ? junta : nota.trim()
}
