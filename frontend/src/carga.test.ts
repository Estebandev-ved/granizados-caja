import { describe, expect, it } from 'vitest'
import { armarCarga, filasCarga, quedaDeCarga } from './carga'
import type { Producto } from './tipos'

const prod = (id: number, nombre: string): Producto =>
  ({ id, sabor: nombre, tipo: 'NORMAL', nombre, precio: 6000, costo: 0, stock: 20, stockMinimo: 2, activo: true, orden: id })

const smirnoff = prod(1, 'Smirnoff')
const mojito = prod(2, 'Mojito')
const productos = [smirnoff, mojito]

describe('lo que llevo hoy', () => {
  it('arma la carga y deja fuera lo que no llevas', () => {
    const c = armarCarga(null, { 1: 6, 2: 0 }, productos, [], '2026-10-08')
    expect(c).toEqual({ dia: '2026-10-08', items: { 1: { llevo: 6, antes: 0 } } })
  })

  it('cuenta solo lo vendido desde que la anotaste', () => {
    // ya llevabas 2 Smirnoff vendidas cuando armaste la carga
    const c = armarCarga(null, { 1: 5 }, productos, [{ sabor: 'Smirnoff', unidades: 2 }])
    const filas = filasCarga(c, productos, [{ sabor: 'Smirnoff', unidades: 4 }])
    expect(filas).toHaveLength(1)
    expect(filas[0]).toMatchObject({ llevo: 5, vendi: 2, queda: 3 })
  })

  it('al editar conserva el "antes" y no borra lo vendido de la mañana', () => {
    const previa = armarCarga(null, { 1: 5 }, productos, [])
    const nueva = armarCarga(previa, { 1: 8 }, productos, [{ sabor: 'Smirnoff', unidades: 3 }])
    expect(nueva.items[1]).toEqual({ llevo: 8, antes: 0 })
    expect(quedaDeCarga(nueva, smirnoff, [{ sabor: 'Smirnoff', unidades: 3 }])).toBe(5)
  })

  it('nunca muestra negativos, ni cuando vendes de más ni cuando borras ventas', () => {
    const c = armarCarga(null, { 1: 2 }, productos, [{ sabor: 'Smirnoff', unidades: 3 }])
    expect(quedaDeCarga(c, smirnoff, [{ sabor: 'Smirnoff', unidades: 9 }])).toBe(0)
    expect(filasCarga(c, productos, [])[0]).toMatchObject({ vendi: 0, queda: 2 })
  })

  it('un sabor que no llevas devuelve null', () => {
    const c = armarCarga(null, { 1: 2 }, productos, [])
    expect(quedaDeCarga(c, mojito, [])).toBeNull()
  })
})
