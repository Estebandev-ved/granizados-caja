import type { VentaReciente } from './tipos'

// De quién es cada venta de hoy. Una venta sin `vendedor` es del dueño (también las que siguen en la cola de su celular).

/** Cómo se llama al dueño en la lista. */
export const TU = 'Tú'

export const quienHizo = (v: Pick<VentaReciente, 'vendedor'>): string => v.vendedor || TU

/** Quiénes vendieron hoy y cuántos granizados cada uno: el dueño primero y luego el equipo, de más a menos. */
export function quienesVendieron(ventas: readonly VentaReciente[]): { nombre: string; unidades: number }[] {
  const mapa = new Map<string, number>()
  for (const v of ventas) {
    // Lo que se tomó o le faltó al trabajador no es una venta
    const unidades = v.metodo === 'CONSUMO' || v.metodo === 'FALTANTE' ? 0 : v.cantidad ?? 1
    mapa.set(quienHizo(v), (mapa.get(quienHizo(v)) ?? 0) + unidades)
  }
  return [...mapa.entries()]
    .map(([nombre, unidades]) => ({ nombre, unidades }))
    .sort((a, b) => (a.nombre === TU ? -1 : b.nombre === TU ? 1 : b.unidades - a.unidades || a.nombre.localeCompare(b.nombre)))
}

/** Las ventas de esa persona (null = todas). */
export function deQuien(ventas: readonly VentaReciente[], quien: string | null): VentaReciente[] {
  return quien === null ? [...ventas] : ventas.filter(v => quienHizo(v) === quien)
}
