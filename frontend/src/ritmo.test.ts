import { describe, expect, it } from 'vitest'
import { diasQueAlcanza, hitoDeRacha, hitoNuevo, ritmoPorSabor, textoAlcanza } from './ritmo'

describe('ritmo', () => {
  it('usa los días reales si el negocio es nuevo', () => {
    const r = ritmoPorSabor([{ sabor: 'Smirnoff', unidades: 10, ingresos: 0, ganancia: 0 }], 5)
    expect(r.get('Smirnoff')).toBe(2)
  })
  it('avisa solo cuando alcanza para pocos días', () => {
    expect(diasQueAlcanza(4, 2)).toBe(2)
    expect(diasQueAlcanza(20, 2)).toBeNull()
    expect(diasQueAlcanza(0, 2)).toBeNull()
    expect(diasQueAlcanza(5, undefined)).toBeNull()
    expect(diasQueAlcanza(5, 0)).toBeNull()
  })
  it('redacta el aviso', () => {
    expect(textoAlcanza(0.4)).toBe('se acaba hoy')
    expect(textoAlcanza(1.2)).toBe('alcanza ~1 día')
    expect(textoAlcanza(2.6)).toBe('alcanza ~3 días')
  })
})

describe('hitos de racha', () => {
  it('da el más alto alcanzado', () => {
    expect(hitoDeRacha(2)).toBeNull()
    expect(hitoDeRacha(3)?.nombre).toBe('En racha')
    expect(hitoDeRacha(10)?.nombre).toBe('Semana perfecta')
    expect(hitoDeRacha(45)?.nombre).toBe('Imparable')
  })
  it('detecta el día exacto del hito', () => {
    expect(hitoNuevo(7)?.nombre).toBe('Semana perfecta')
    expect(hitoNuevo(8)).toBeNull()
  })
})
