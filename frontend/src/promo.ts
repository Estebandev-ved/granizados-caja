import { diaBogota } from './estadoLocal'
import type { Producto } from './tipos'

// Promoción "2 x $10.000" de un solo día. Se prende a mano desde Vender y se apaga sola al cambiar el día.
// Vive en el celular (localStorage), igual que el aviso de la meta: es una conveniencia de venta, no un dato del negocio.

const CLAVE = 'gz_promo'

export const PRECIO_PAR = 10000

interface PromoGuardada { dia: string; precio: number }

/** ¿La promo está prendida hoy? */
export function promoActiva(hoy = diaBogota()): boolean {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as PromoGuardada | null
    return !!p && p.dia === hoy && p.precio === PRECIO_PAR
  } catch { return false }
}

export function prenderPromo(prendida: boolean, hoy = diaBogota()) {
  try {
    if (prendida) localStorage.setItem(CLAVE, JSON.stringify({ dia: hoy, precio: PRECIO_PAR } satisfies PromoGuardada))
    else localStorage.removeItem(CLAVE)
  } catch { /* sin almacenamiento */ }
}

/** La promo solo aplica a los granizados normales: son los que cuestan menos de la mitad del par. */
export function aplicaPromo(p: Producto): boolean {
  return p.tipo === 'NORMAL' && PRECIO_PAR < p.precio * 2
}

/** Total a cobrar: cada par sale a $10.000 y la unidad que sobra, a precio normal. */
export function totalConPromo(p: Producto, cantidad: number): number {
  if (!aplicaPromo(p)) return p.precio * cantidad
  return Math.floor(cantidad / 2) * PRECIO_PAR + (cantidad % 2) * p.precio
}
