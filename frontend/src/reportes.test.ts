import { describe, expect, it } from 'vitest'
import { restarDias, rangoDe } from './reportes'

const HOY = '2026-09-25'
const PERSONAL = { desde: '2026-03-01', hasta: '2026-03-15' }

describe('restarDias', () => {
  it('cruza el mes y el año', () => {
    expect(restarDias('2026-09-25', 6)).toBe('2026-09-19')
    expect(restarDias('2026-03-02', 2)).toBe('2026-02-28')
    expect(restarDias('2026-01-02', 2)).toBe('2025-12-31')
  })

  it('cero días es el mismo día', () => {
    expect(restarDias(HOY, 0)).toBe(HOY)
  })
})

describe('rangoDe', () => {
  it('hoy es un solo día', () => {
    expect(rangoDe('hoy', HOY, PERSONAL)).toEqual({ desde: '2026-09-25', hasta: '2026-09-25' })
  })

  it('la semana son los últimos 7 días incluyendo hoy', () => {
    expect(rangoDe('semana', HOY, PERSONAL)).toEqual({ desde: '2026-09-19', hasta: HOY })
  })

  it('el mes empieza el día 1 y no se pasa del día de hoy', () => {
    expect(rangoDe('mes', HOY, PERSONAL)).toEqual({ desde: '2026-09-01', hasta: HOY })
  })

  it('el año empieza el 1 de enero', () => {
    expect(rangoDe('anio', HOY, PERSONAL)).toEqual({ desde: '2026-01-01', hasta: HOY })
  })

  it('cuando eliges las fechas se respetan tal cual', () => {
    expect(rangoDe('personalizado', HOY, PERSONAL)).toEqual(PERSONAL)
  })

  it('el mes cruza diciembre sin romperse', () => {
    expect(rangoDe('mes', '2026-01-09', PERSONAL)).toEqual({ desde: '2026-01-01', hasta: '2026-01-09' })
  })
})
