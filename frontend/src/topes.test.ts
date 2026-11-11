import { describe, expect, it } from 'vitest'
import { avanceDelMes, avanceDe, avisoAlGastar, leerTopes, porDiaQueQueda, serializarTopes } from './topes'

describe('topes de gasto al mes', () => {
  it('lee lo guardado y descarta lo que venga raro', () => {
    expect(leerTopes('{"HIELO":60000,"Gasolina":30000,"MALO":"x","CERO":0}')).toEqual({ HIELO: 60000, Gasolina: 30000 })
    expect(leerTopes('')).toEqual({})
    expect(leerTopes('[1,2]')).toEqual({})
    expect(serializarTopes({ HIELO: 60000, TRANSPORTE: 0 })).toBe('{"HIELO":60000}')
  })

  it('ordena primero lo que se pasó, luego lo que va casi y después por lo gastado', () => {
    const lista = avanceDelMes({ HIELO: 70000, TRANSPORTE: 34000, EMPAQUE: 5000, Gasolina: 90000 }, { HIELO: 60000, TRANSPORTE: 40000, EMPAQUE: 50000 })
    expect(lista.map(a => [a.categoria, a.estado])).toEqual([
      ['HIELO', 'pasado'], ['TRANSPORTE', 'casi'], ['EMPAQUE', 'bien'], ['Gasolina', 'sin-tope'],
    ])
    expect(lista[0].nombre).toBe('Hielo')
  })

  it('avisa al anotar un gasto que llega cerca del tope o se pasa', () => {
    expect(avisoAlGastar(avanceDe('HIELO', 38000, 50000), 4000)).toBe('Ojo: ya llevas el 84% del tope de Hielo este mes')
    expect(avisoAlGastar(avanceDe('HIELO', 40000, 50000), 2000)).toBeNull() // ya iba en «casi»: no repite
    expect(avisoAlGastar(avanceDe('HIELO', 48000, 50000), 5000)).toBe('⚠️ Te pasaste del tope de Hielo: llevas $53.000 de $50.000 este mes')
    expect(avisoAlGastar(avanceDe('HIELO', 10000, 50000), 2000)).toBeNull()
    expect(avisoAlGastar(avanceDe('HIELO', 10000, 0), 90000)).toBeNull()
  })

  it('dice cuánto se puede gastar por día lo que queda del mes', () => {
    // Noviembre tiene 30 días: el 21 quedan 10 días contando ese
    expect(porDiaQueQueda(avanceDe('HIELO', 30000, 50000), '2026-11-21')).toBe(2000)
    expect(porDiaQueQueda(avanceDe('HIELO', 60000, 50000), '2026-11-21')).toBe(0)
  })
})
