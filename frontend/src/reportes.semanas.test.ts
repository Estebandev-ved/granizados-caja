import { describe, expect, it } from 'vitest'
import { armarSemanas, diaDeSemana, lunesDe, rangoSemanas, totalPrimerosDias } from './reportes'

describe('comparar semanas', () => {
  // 2026-10-07 es miércoles
  it('encuentra el lunes de la semana', () => {
    expect(diaDeSemana('2026-10-07')).toBe(2)
    expect(lunesDe('2026-10-07')).toBe('2026-10-05')
    expect(lunesDe('2026-10-05')).toBe('2026-10-05')
    expect(lunesDe('2026-10-11')).toBe('2026-10-05')
  })

  it('pide desde el lunes de hace 3 semanas hasta hoy', () => {
    expect(rangoSemanas('2026-10-07')).toEqual({ desde: '2026-09-14', hasta: '2026-10-07' })
  })

  it('arma 4 semanas, rellena días sin ventas y marca el futuro', () => {
    const s = armarSemanas([
      { dia: '2026-09-30', total: 20000, unidades: 3 },
      { dia: '2026-10-05', total: 12000, unidades: 2 },
      { dia: '2026-10-06', total: 6000, unidades: 1 },
    ], '2026-10-07')
    expect(s).toHaveLength(4)
    const actual = s[3], pasada = s[2]
    expect(actual.inicio).toBe('2026-10-05')
    expect(actual.total).toBe(18000)
    expect(actual.dias.map(d => d.futuro)).toEqual([false, false, false, true, true, true, true])
    expect(pasada.inicio).toBe('2026-09-28')
    expect(pasada.dias[2].total).toBe(20000) // el miércoles 30
    expect(totalPrimerosDias(pasada, 3)).toBe(20000)
  })
})
