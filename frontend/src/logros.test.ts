import { describe, expect, it } from 'vitest'
import { nivelAlcanzado } from './logros'

const meta = (vendidas: number, unidades = 10) => ({ unidades, premio: 2000, vendidas, racha: 0 })

describe('logros del equipo', () => {
  it('sube un logro a mitad de camino, al cumplir la meta y al pasarla en la mitad', () => {
    expect(nivelAlcanzado(meta(0))).toBe(0)
    expect(nivelAlcanzado(meta(4))).toBe(0)
    expect(nivelAlcanzado(meta(5))).toBe(1)
    expect(nivelAlcanzado(meta(9))).toBe(1)
    expect(nivelAlcanzado(meta(10))).toBe(2)
    expect(nivelAlcanzado(meta(14))).toBe(2)
    expect(nivelAlcanzado(meta(15))).toBe(3)
  })

  it('redondea hacia arriba con metas chicas: no regala el logro antes de tiempo', () => {
    expect(nivelAlcanzado(meta(1, 3))).toBe(0) // la mitad de 3 es 2
    expect(nivelAlcanzado(meta(2, 3))).toBe(1)
    expect(nivelAlcanzado(meta(3, 3))).toBe(2)
    expect(nivelAlcanzado(meta(5, 3))).toBe(3) // 4.5 → 5
  })
})
