import { diaBogota } from './estadoLocal'
import type { PorSabor, Producto } from './tipos'

// "Lo que llevo hoy": cuántos granizados de cada sabor saco de la casa para vender ese día.
// Vive en el celular (localStorage) y vale solo para el día en que se armó; no mueve el inventario de la casa.

const CLAVE = 'gz_carga'

export interface ItemCarga {
  /** Total que sacaste hoy de ese sabor. */
  llevo: number
  /** Lo que ya habías vendido hoy cuando lo anotaste (así la carga solo cuenta lo que vendes desde entonces). */
  antes: number
}

export interface Carga {
  dia: string
  items: Record<number, ItemCarga>
}

export interface FilaCarga {
  producto: Producto
  llevo: number
  vendi: number
  queda: number
}

/** La carga de hoy, o null si no hay (la de ayer no cuenta). */
export function leerCarga(hoy = diaBogota()): Carga | null {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Carga | null
    if (!c || c.dia !== hoy || !c.items || typeof c.items !== 'object') return null
    return Object.keys(c.items).length ? c : null
  } catch { return null }
}

export function guardarCarga(c: Carga | null) {
  try {
    if (c && Object.keys(c.items).length) localStorage.setItem(CLAVE, JSON.stringify(c))
    else localStorage.removeItem(CLAVE)
  } catch { /* sin almacenamiento */ }
}

/** Unidades vendidas hoy de un sabor (el resumen del día las trae por nombre). */
export function vendidasHoy(porSabor: readonly PorSabor[], p: Pick<Producto, 'nombre'>): number {
  return porSabor.find(s => s.sabor === p.nombre)?.unidades ?? 0
}

/**
 * Arma la carga a partir de lo que escribiste (`llevo` por producto; 0 o vacío = no lo llevas).
 * Si el sabor ya estaba en la carga conserva su "antes", así editar no borra lo vendido en la mañana.
 */
export function armarCarga(
  previa: Carga | null,
  llevo: Readonly<Record<number, number>>,
  productos: readonly Producto[],
  porSabor: readonly PorSabor[],
  hoy = diaBogota(),
): Carga {
  const items: Record<number, ItemCarga> = {}
  for (const p of productos) {
    const n = Math.max(0, Math.floor(llevo[p.id] ?? 0))
    if (n <= 0) continue
    items[p.id] = { llevo: n, antes: previa?.items[p.id]?.antes ?? vendidasHoy(porSabor, p) }
  }
  return { dia: hoy, items }
}

/** Una fila por sabor que llevas: cuánto sacaste, cuánto vendiste desde entonces y cuánto te queda. */
export function filasCarga(carga: Carga, productos: readonly Producto[], porSabor: readonly PorSabor[]): FilaCarga[] {
  const filas: FilaCarga[] = []
  for (const p of productos) {
    const it = carga.items[p.id]
    if (!it) continue
    // Si borras una venta, lo vendido puede quedar por debajo de "antes": nunca se muestra negativo
    const vendi = Math.max(0, vendidasHoy(porSabor, p) - it.antes)
    filas.push({ producto: p, llevo: it.llevo, vendi, queda: Math.max(0, it.llevo - vendi) })
  }
  return filas
}

/** Cuánto te queda de un sabor en la carga; null si ese sabor no lo llevas. */
export function quedaDeCarga(carga: Carga, p: Producto, porSabor: readonly PorSabor[]): number | null {
  const it = carga.items[p.id]
  if (!it) return null
  return Math.max(0, it.llevo - Math.max(0, vendidasHoy(porSabor, p) - it.antes))
}
