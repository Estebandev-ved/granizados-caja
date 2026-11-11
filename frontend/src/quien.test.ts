import { describe, expect, it } from 'vitest'
import { deQuien, quienesVendieron } from './quien'
import type { VentaReciente } from './tipos'

const v = (clientUid: string, vendedor: string | null, cantidad: number, metodo: VentaReciente['metodo'] = 'EFECTIVO'): VentaReciente =>
  ({ clientUid, hora: '3:00 PM', sabor: 'Smirnoff', total: 6000 * cantidad, metodo, vendedor, cantidad })

describe('de quién es cada venta', () => {
  const ventas = [v('a', 'Juan', 2), v('b', null, 1), v('c', 'Ana', 5), v('d', 'Juan', 1, 'NEQUI'), v('e', 'Juan', 1, 'CONSUMO')]

  it('cuenta los granizados de cada uno, el dueño primero y sin lo que se tomó el trabajador', () => {
    expect(quienesVendieron(ventas)).toEqual([
      { nombre: 'Tú', unidades: 1 }, { nombre: 'Ana', unidades: 5 }, { nombre: 'Juan', unidades: 3 },
    ])
  })

  it('filtra las de una persona; las que no traen vendedor son del dueño', () => {
    expect(deQuien(ventas, 'Juan').map(x => x.clientUid)).toEqual(['a', 'd', 'e'])
    expect(deQuien(ventas, 'Tú').map(x => x.clientUid)).toEqual(['b'])
    expect(deQuien(ventas, null)).toHaveLength(5)
    expect(quienesVendieron([{ ...v('x', null, 1), cantidad: undefined }])).toEqual([{ nombre: 'Tú', unidades: 1 }])
  })
})
