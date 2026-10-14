import { describe, expect, it } from 'vitest'
import { aplicaPromo, PROMO_INICIAL, promoVigente, repartirTotal, totalConPromo, totalMezclado, type Promo } from './promo'
import type { Producto } from './tipos'

const prod = (tipo: Producto['tipo'], precio: number): Producto =>
  ({ id: 1, sabor: 'Smirnoff', tipo, nombre: 'Smirnoff', precio, costo: 0, stock: 10, stockMinimo: 2, activo: true, orden: 1 })

const dosPorDiez: Promo = { ...PROMO_INICIAL, activa: true, dia: '2026-10-08' }

describe('promo 2 x $10.000', () => {
  it('cobra el combo por cada par y precio normal por la que sobra', () => {
    const normal = prod('NORMAL', 6000)
    expect(totalConPromo(dosPorDiez, normal, 1)).toBe(6000)
    expect(totalConPromo(dosPorDiez, normal, 2)).toBe(10000)
    expect(totalConPromo(dosPorDiez, normal, 3)).toBe(16000)
    expect(totalConPromo(dosPorDiez, normal, 4)).toBe(20000)
  })

  it('solo aplica a los tipos elegidos', () => {
    expect(aplicaPromo(dosPorDiez, prod('CREMOSO', 7000))).toBe(false)
    expect(totalConPromo(dosPorDiez, prod('GRANDE', 10000), 2)).toBe(20000)
    expect(aplicaPromo({ ...dosPorDiez, tipos: ['NORMAL', 'CREMOSO'] }, prod('CREMOSO', 7000))).toBe(true)
  })

  it('no aplica si el combo no ahorra nada', () => {
    expect(aplicaPromo({ ...dosPorDiez, precio: 12000 }, prod('NORMAL', 6000))).toBe(false)
  })

  it('funciona con otras cantidades, ej. 3 x $15.000', () => {
    const tres = { ...dosPorDiez, cantidad: 3, precio: 15000 }
    expect(totalConPromo(tres, prod('NORMAL', 6000), 3)).toBe(15000)
    expect(totalConPromo(tres, prod('NORMAL', 6000), 4)).toBe(21000)
  })

  it('"solo hoy" se apaga al cambiar el día, y "hasta que la apague" no', () => {
    expect(promoVigente(dosPorDiez, '2026-10-08')).toBe(true)
    expect(promoVigente(dosPorDiez, '2026-10-09')).toBe(false)
    expect(promoVigente({ ...dosPorDiez, soloHoy: false }, '2026-10-09')).toBe(true)
    expect(promoVigente({ ...dosPorDiez, activa: false }, '2026-10-08')).toBe(false)
  })
})

describe('promo con sabores distintos', () => {
  const a = { ...prod('NORMAL', 6000), id: 1 }
  const b = { ...prod('NORMAL', 6000), id: 2, sabor: 'Mojito', nombre: 'Mojito' }

  it('dos sabores distintos cuentan como un combo', () => {
    expect(totalMezclado(dosPorDiez, [{ p: a, cantidad: 1 }, { p: b, cantidad: 1 }])).toBe(10000)
  })

  it('tres unidades mezcladas: un combo y una suelta', () => {
    expect(totalMezclado(dosPorDiez, [{ p: a, cantidad: 2 }, { p: b, cantidad: 1 }])).toBe(16000)
  })

  it('un solo sabor sigue igual y lo que no aplica va a precio normal', () => {
    expect(totalMezclado(dosPorDiez, [{ p: a, cantidad: 2 }])).toBe(totalConPromo(dosPorDiez, a, 2))
    const cremoso = { ...prod('CREMOSO', 7000), id: 3 }
    expect(totalMezclado(dosPorDiez, [{ p: a, cantidad: 1 }, { p: cremoso, cantidad: 1 }])).toBe(13000)
  })

  it('reparte el total entre las líneas sin pasarse del precio normal', () => {
    const lineas = [{ p: a, cantidad: 1 }, { p: b, cantidad: 1 }]
    const partes = repartirTotal(lineas, 10000)
    expect(partes.reduce((x, n) => x + n, 0)).toBe(10000)
    partes.forEach(n => expect(n).toBeLessThanOrEqual(6000))
    expect(repartirTotal(lineas, 12000)).toEqual([6000, 6000])
  })
})
