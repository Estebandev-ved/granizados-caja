import { beforeEach, describe, expect, it } from 'vitest'
import { duracion, hora12, productosEnCalle, resumirSalida, tarifasEnCalle, veredicto, type SalidaAbierta } from './calle'
import type { CalleConfig, Producto, TarifasDia } from './tipos'

const calle: CalleConfig = {
  activo: true,
  precios: { NORMAL: 7000, CREMOSO: 9000, GRANDE: 0, CERVEZA: 0 },
  comisiones: { NORMAL: 1800, CREMOSO: 2300, GRANDE: 0, CERVEZA: 0 },
  combo: 1500, pasaje: 7800, minimoPasaje: 12, bueno: 25, regular: 15,
}

const prod = (id: number, tipo: Producto['tipo'], precio: number) =>
  ({ id, sabor: 'S' + id, tipo, nombre: 'S' + id, precio, costo: 0, stock: 5, stockMinimo: 1, activo: true, orden: id }) as Producto

const tarifas: TarifasDia = { normal: 1000, cremoso: 1500, grande: 2000, cerveza: 0, promo: 700, rebajaPromo: 0, porcentaje: null }

const salida = (ventas: SalidaAbierta['ventas'], prueba = false): SalidaAbierta =>
  ({ clientUid: 's1', lugar: 'La Kurva', inicio: 0, prueba, ventas })

beforeEach(() => { try { localStorage.clear() } catch { /* sin storage en pruebas */ } })

describe('precios de la calle', () => {
  const productos = [prod(1, 'NORMAL', 6000), prod(2, 'CREMOSO', 8000), prod(3, 'GRANDE', 10000)]

  it('con una salida abierta cobran el precio de la calle y el Grande (en 0) queda como siempre', () => {
    const r = productosEnCalle(productos, calle, true)
    expect(r.map(p => p.precio)).toEqual([7000, 9000, 10000])
  })

  it('sin salida abierta o con el plan apagado no cambia nada', () => {
    expect(productosEnCalle(productos, calle, false)).toBe(productos)
    expect(productosEnCalle(productos, { ...calle, activo: false }, true)).toBe(productos)
    expect(productosEnCalle(productos, null, true)).toBe(productos)
  })
})

describe('lo que gana el trabajador en la calle', () => {
  it('usa la tarifa de la calle y deja la de siempre donde está en 0', () => {
    const t = tarifasEnCalle(tarifas, calle, true)!
    expect([t.normal, t.cremoso, t.grande, t.cerveza]).toEqual([1800, 2300, 2000, 0])
    expect(t.promo).toBe(1500)
    expect(t.porcentaje).toBeNull()
  })

  it('sin tarifas de calle gana su porcentaje como siempre', () => {
    const sin = { ...calle, comisiones: { NORMAL: 0, CREMOSO: 0, GRANDE: 0, CERVEZA: 0 }, combo: 0 }
    const t = tarifasEnCalle({ ...tarifas, porcentaje: 10 }, sin, true)!
    expect(t.porcentaje).toBe(10)
    expect(t.promo).toBe(700)
  })

  it('fuera de la calle devuelve las mismas', () => {
    expect(tarifasEnCalle(tarifas, calle, false)).toBe(tarifas)
  })
})

describe('el veredicto del lugar', () => {
  it('compara los granizados en 4 horas con los umbrales', () => {
    expect(veredicto(25, calle)).toBe('BUENO')
    expect(veredicto(24, calle)).toBe('REGULAR')
    expect(veredicto(15, calle)).toBe('REGULAR')
    expect(veredicto(14, calle)).toBe('MALO')
    expect(veredicto(null, calle)).toBe('SIN_DATOS')
  })
})

describe('cuentas de una salida', () => {
  const H = 3600_000

  it('25 en 4 horas es bueno y no se devuelve pasaje', () => {
    const r = resumirSalida(salida([{ uid: 'a', cantidad: 25, total: 175000 }]), 4 * H, 7800, calle, true)
    expect(r).toMatchObject({ unidades: 25, total: 175000, horas: 4, ritmo4h: 25, veredicto: 'BUENO', pasajeADevolver: 0 })
  })

  it('menos del mínimo: se le devuelve el pasaje al trabajador', () => {
    const r = resumirSalida(salida([{ uid: 'a', cantidad: 10, total: 70000 }]), 4 * H, 7800, calle, true)
    expect(r.veredicto).toBe('MALO')
    expect(r.pasajeADevolver).toBe(7800)
  })

  it('el pasaje del dueño es suyo: nunca se devuelve', () => {
    const r = resumirSalida(salida([{ uid: 'a', cantidad: 3, total: 21000 }]), 4 * H, 7800, calle, false)
    expect(r.pasajeADevolver).toBe(0)
  })

  it('una salida de prueba devuelve el pasaje completo aunque venda bien', () => {
    const r = resumirSalida(salida([{ uid: 'a', cantidad: 30, total: 210000 }], true), 4 * H, 7800, calle, true)
    expect(r.pasajeADevolver).toBe(7800)
  })

  it('con menos de una hora no hay veredicto', () => {
    const r = resumirSalida(salida([{ uid: 'a', cantidad: 5, total: 35000 }]), 30 * 60_000, 0, calle, true)
    expect(r.ritmo4h).toBeNull()
    expect(r.veredicto).toBe('SIN_DATOS')
  })
})

describe('textos', () => {
  it('duración y hora en 12 horas', () => {
    expect(duracion(0, 80 * 60_000)).toBe('1 h 20 min')
    expect(duracion(0, 35 * 60_000)).toBe('35 min')
    expect(hora12(0)).toBe('12 a. m.')
    expect(hora12(12)).toBe('12 p. m.')
    expect(hora12(18)).toBe('6 p. m.')
  })
})
