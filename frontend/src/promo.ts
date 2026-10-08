import { diaBogota } from './estadoLocal'
import type { Producto, Tipo } from './tipos'

// Promoción tipo "2 x $10.000". Se configura en Ajustes y se vende desde Vender.
// Vive en el celular (localStorage), igual que el aviso de la meta: es una conveniencia de venta, no un dato del negocio.

const CLAVE = 'gz_promo'

export interface Promo {
  activa: boolean
  /** Cuántos lleva el cliente por el precio del combo. */
  cantidad: number
  /** Lo que cuesta el combo completo. */
  precio: number
  /** A qué tipos de granizado aplica. */
  tipos: Tipo[]
  /** true = se apaga sola al cambiar el día; false = sigue hasta que la apagues. */
  soloHoy: boolean
  /** Día en que se prendió (para el modo "solo hoy"). */
  dia: string
}

export const PROMO_INICIAL: Promo = { activa: false, cantidad: 2, precio: 10000, tipos: ['NORMAL'], soloHoy: true, dia: '' }

/** Lee la promo guardada; lo que falte o venga raro se rellena con lo de siempre (2 x $10.000 en normales). */
export function leerPromo(): Promo {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Partial<Promo> | null
    if (!g) return PROMO_INICIAL
    const cantidad = Number.isInteger(g.cantidad) && g.cantidad! >= 2 && g.cantidad! <= 10 ? g.cantidad! : PROMO_INICIAL.cantidad
    const precio = Number.isFinite(g.precio) && g.precio! > 0 ? Math.round(g.precio!) : PROMO_INICIAL.precio
    const tipos = Array.isArray(g.tipos) && g.tipos.length ? g.tipos : PROMO_INICIAL.tipos
    return {
      // Las promos guardadas antes de Ajustes no tenían "activa": existir ya significaba prendida
      activa: g.activa ?? true,
      cantidad, precio, tipos,
      soloHoy: g.soloHoy ?? true,
      dia: typeof g.dia === 'string' ? g.dia : '',
    }
  } catch { return PROMO_INICIAL }
}

export function guardarPromo(p: Promo) {
  try { localStorage.setItem(CLAVE, JSON.stringify(p)) } catch { /* sin almacenamiento */ }
}

/** ¿Está corriendo ahora mismo? */
export function promoVigente(p: Promo, hoy = diaBogota()): boolean {
  return p.activa && (!p.soloHoy || p.dia === hoy)
}

/** Aplica si el tipo está elegido y el combo de verdad sale más barato que llevarlos sueltos. */
export function aplicaPromo(promo: Promo, p: Producto): boolean {
  return promo.tipos.includes(p.tipo) && promo.precio < p.precio * promo.cantidad
}

/** Total a cobrar: cada combo completo al precio de la promo y las unidades que sobran, a precio normal. */
export function totalConPromo(promo: Promo, p: Producto, cantidad: number): number {
  if (!aplicaPromo(promo, p)) return p.precio * cantidad
  return Math.floor(cantidad / promo.cantidad) * promo.precio + (cantidad % promo.cantidad) * p.precio
}

/** "2 x $10.000" */
export function nombrePromo(p: Pick<Promo, 'cantidad' | 'precio'>, formato: (n: number) => string): string {
  return `${p.cantidad} x ${formato(p.precio)}`
}
