import { describe, expect, it } from 'vitest'
import { aplicaPromo, totalConPromo } from './promo'
import type { Producto } from './tipos'

const prod = (tipo: Producto['tipo'], precio: number): Producto =>
  ({ id: 1, sabor: 'Smirnoff', tipo, nombre: 'Smirnoff', precio, costo: 0, stock: 10, stockMinimo: 2, activo: true, orden: 1 })

describe('promo 2 x $10.000', () => {
  it('cobra $10.000 por cada par y precio normal por la que sobra', () => {
    const normal = prod('NORMAL', 6000)
    expect(totalConPromo(normal, 1)).toBe(6000)
    expect(totalConPromo(normal, 2)).toBe(10000)
    expect(totalConPromo(normal, 3)).toBe(16000)
    expect(totalConPromo(normal, 4)).toBe(20000)
  })

  it('no toca cremosos ni grandes', () => {
    expect(aplicaPromo(prod('CREMOSO', 7000))).toBe(false)
    expect(totalConPromo(prod('GRANDE', 10000), 2)).toBe(20000)
  })
})
