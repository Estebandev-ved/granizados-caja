import { describe, expect, it } from 'vitest'
import { desglose, notaConDesglose, totalDe, totalPorTipo } from './billetes'

describe('contar billete por billete', () => {
  const conteo = { b5000: 5, m1000: 3, m200: 5, b50000: 1 }

  it('suma cada valor por cuántos hay', () => {
    expect(totalDe(conteo)).toBe(5 * 5000 + 3 * 1000 + 5 * 200 + 50_000)
    expect(totalPorTipo(conteo, 'billete')).toBe(75_000)
    expect(totalPorTipo(conteo, 'moneda')).toBe(4_000)
    expect(totalDe({})).toBe(0)
    expect(totalDe({ b5000: -2, m500: 1.7 })).toBe(500)
  })

  it('arma el desglose de mayor a menor y distingue la moneda de mil', () => {
    expect(desglose(conteo)).toMatch(/^1×\$\s?50\.000 · 5×\$\s?5\.000 · 3×\$\s?1\.000 \(mon\.\) · 5×\$\s?200$/)
    expect(desglose({})).toBe('')
  })

  it('pega el desglose a la nota solo si cabe', () => {
    expect(notaConDesglose('', '2×$5.000')).toBe('2×$5.000')
    expect(notaConDesglose('dejé el corte', '2×$5.000')).toBe('dejé el corte · 2×$5.000')
    expect(notaConDesglose('x'.repeat(115), '2×$5.000')).toBe('x'.repeat(115))
  })
})
