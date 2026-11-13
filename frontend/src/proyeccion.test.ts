import { describe, expect, it } from 'vitest'
import { estimar, ganariaHoyCon, textoDias } from './proyeccion'
import type { PremiosDia, Proyeccion } from './tipos'

const premios = (vendidas: number, extra: Partial<PremiosDia> = {}): PremiosDia => ({
  vendidas, comision: vendidas * 1000, premio: vendidas >= 15 ? 4000 : vendidas >= 12 ? 2000 : 0,
  escalones: [{ granizados: 12, total: 2000 }, { granizados: 15, total: 4000 }], siguiente: null, gratis: 1, diaPromo: false,
  tarifas: { normal: 1000, cremoso: 1500, grande: 2000, cerveza: 0, promo: 700, rebajaPromo: 0, porcentaje: null },
  ...extra,
})

const historia: Proyeccion = {
  vendedorId: 1, nombre: 'Juan', dias: 8, unidadesDia: 13, ganaDia: 15000, mejorUnidades: 16, mejorGana: 20000,
  diasSemana: 4, minutosDia: 240, primeraHoy: '2026-11-12T15:00:00Z', pendiente: 63000,
}
const a = (hora: string) => new Date('2026-11-12T' + hora + ':00Z')

describe('cuánto se va a hacer el trabajador', () => {
  it('sin vender todavía, hoy se espera un día normal suyo', () => {
    const e = estimar(premios(0), { ...historia, primeraHoy: null }, a('14:00'))
    expect(e.base).toBe('historia')
    expect(e.unidadesHoy).toBe(13)
    // 13 × 1.000 de comisión + el premio de 12
    expect(e.ganaHoy).toBe(15000)
  })

  it('a mitad de jornada mezcla el ritmo de hoy con su día normal', () => {
    // Lleva 2 horas de 4 y ya vendió 10: a ese ritmo serían 20; mitad de peso a 20 y mitad a 13
    const e = estimar(premios(10), historia, a('17:00'))
    expect(e.base).toBe('ritmo')
    expect(e.unidadesHoy).toBe(17)
    expect(e.ganaHoy).toBe(17000 + 4000)
  })

  it('una venta apenas empezando no dispara la cuenta', () => {
    const e = estimar(premios(3), historia, a('15:05'))
    expect(e.base).toBe('historia')
    expect(e.unidadesHoy).toBe(13)
  })

  it('pasada su jornada normal, lo de hoy es lo que lleva', () => {
    const e = estimar(premios(9), historia, a('20:00'))
    expect(e.unidadesHoy).toBe(9)
    expect(e.ganaHoy).toBe(9000)
  })

  it('nunca estima menos de lo que ya vendió', () => {
    expect(estimar(premios(18), { ...historia, primeraHoy: null }, a('16:00')).unidadesHoy).toBe(18)
  })

  it('la semana, la quincena y el mes salen de un día suyo por los días que trabaja', () => {
    const e = estimar(premios(0), historia, a('14:00'))
    expect(e.semana).toBe(60000)
    expect(e.quincena).toBe(128500)
    expect(e.mes).toBe(257000)
    expect(e.diasSupuestos).toBe(false)
    expect(e.pocosDatos).toBe(false)
  })

  it('el nuevo que ya puso su meta ve lo que se haría si la cumple, a 5 días por semana', () => {
    const nuevo: Proyeccion = { ...historia, dias: 0, unidadesDia: 0, ganaDia: 0, diasSemana: 0, minutosDia: 0, primeraHoy: null, pendiente: 0 }
    const e = estimar(premios(2, { metaPropia: 15 }), nuevo, a('16:00'))
    expect(e.base).toBe('meta')
    expect(e.unidadesHoy).toBe(15)
    expect(e.ganaHoy).toBe(19000)
    expect(e.semana).toBe(95000)
    expect(e.diasSupuestos).toBe(true)
    expect(e.pocosDatos).toBe(true)
  })

  it('el nuevo sin meta ni ventas todavía no tiene con qué calcular', () => {
    const nuevo: Proyeccion = { ...historia, dias: 1, primeraHoy: null }
    const e = estimar(premios(0), nuevo, a('16:00'))
    expect(e.base).toBe('nada')
    expect(e.unidadesHoy).toBeNull()
    expect(e.semana).toBe(0)
  })

  it('lo que se toma y lo que faltó se descuentan de lo de hoy', () => {
    expect(ganariaHoyCon(premios(10, { descuento: 6000, faltantes: 6000 }), 12)).toBe(12000 + 2000 - 12000)
  })

  it('con pago por porcentaje usa lo que deja un granizado normal', () => {
    const p = premios(0, { comision: 0, escalones: [], tarifas: { normal: 0, cremoso: 0, grande: 0, cerveza: 0, promo: 0, rebajaPromo: 0, porcentaje: 10 } })
    expect(ganariaHoyCon(p, 10)).toBe(6000)
  })

  it('escribe los días sin decimales de más', () => {
    expect(textoDias(4)).toBe('4 días')
    expect(textoDias(4.5)).toBe('4,5 días')
    expect(textoDias(1)).toBe('1 día')
  })
})
