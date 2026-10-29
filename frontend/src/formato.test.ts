import { describe, expect, it } from 'vitest'
import { aEntero, miles, pesos, soloDigitos } from './formato'

describe('formato de números', () => {
  it('pesos con puntos de miles', () => {
    expect(pesos(18000)).toBe('$18.000')
    expect(pesos(1234567)).toBe('$1.234.567')
    expect(pesos(0)).toBe('$0')
  })

  it('pesos nunca da NaN ni -$0', () => {
    expect(pesos(NaN)).toBe('$0')
    expect(pesos(Infinity)).toBe('$0')
    expect(pesos(-0.4)).toBe('$0')
    expect(pesos(-5000)).toBe('-$5.000')
  })

  it('miles acepta texto', () => {
    expect(miles('150000')).toBe('150.000')
    expect(miles('')).toBe('')
  })

  it('soloDigitos limpia letras, ceros de más y pasa del tope', () => {
    expect(soloDigitos('12a3')).toBe('123')
    expect(soloDigitos('007')).toBe('7')
    expect(soloDigitos('0')).toBe('0')
    expect(soloDigitos('1234567890123', 9)).toBe('123456789')
    expect(soloDigitos('0123', 8, true)).toBe('0123') // PIN
  })

  it('aEntero devuelve 0 si no hay número', () => {
    expect(aEntero('')).toBe(0)
    expect(aEntero('5.000')).toBe(5000)
  })
})
