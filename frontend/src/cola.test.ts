import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { ApiError, type ApiSync } from './api'
import { cargarCola, guardarCola, subirPendientes } from './cola'
import { sesion } from './api'
import type { CategoriaGasto, LineaPedido, Operacion, RespuestaVenta } from './tipos'

const venta = (uid: string, productoId = 1): Operacion =>
  ({ tipo: 'venta', clientUid: uid, productoId, metodo: 'NEQUI', cantidad: 1, creadaEn: Date.parse('2026-09-25T20:00:00Z') })
const entrada = (uid: string): Operacion =>
  ({ tipo: 'entrada', clientUid: uid, productoId: 1, cantidad: 5, creadaEn: Date.now() })
const conteo = (uid: string): Operacion =>
  ({ tipo: 'ajuste', clientUid: uid, productoId: 2, real: 7, creadaEn: Date.now() })
const merma = (uid: string): Operacion =>
  ({ tipo: 'merma', clientUid: uid, productoId: 3, cantidad: 2, motivo: 'VENCIDO', creadaEn: Date.now() })
const llegada = (uid: string): Operacion =>
  ({ tipo: 'recepcion', clientUid: uid, pedidoId: 7, items: [{ productoId: 1, cantidad: 20 }], creadaEn: Date.now() })
const gasto = (uid: string): Operacion =>
  ({ tipo: 'gasto', clientUid: uid, categoria: 'HIELO', concepto: 'bolsas', monto: 1500, creadaEn: Date.now() })
const arqueo = (uid: string): Operacion =>
  ({ tipo: 'arqueo', clientUid: uid, contado: 9000, nota: 'corto', creadaEn: Date.now() })

function apiFalsa(opciones: { rechazar?: string[]; caerEn?: number } = {}) {
  let llamadas = 0
  const cae = () => { if (++llamadas === opciones.caerEn) throw new TypeError('Failed to fetch') }
  const api = {
    lote: vi.fn(async (vs: { clientUid: string }[]): Promise<RespuestaVenta[]> => {
      cae()
      return vs.map(v => ({ clientUid: v.clientUid, estado: opciones.rechazar?.includes(v.clientUid) ? 'RECHAZADA' : 'REGISTRADA', error: null }))
    }),
    venta: vi.fn(async (v: { clientUid: string }): Promise<RespuestaVenta> => {
      if (opciones.rechazar?.includes(v.clientUid)) throw new ApiError(400, 'mala')
      return { clientUid: v.clientUid, estado: 'REGISTRADA', error: null }
    }),
    entrada: vi.fn(async () => { cae(); return { estado: 'REGISTRADA' } }),
    movimiento: vi.fn(async (m: { clientUid: string }) => {
      cae()
      return { clientUid: m.clientUid, estado: 'REGISTRADA', error: null }
    }),
    recibirPedido: vi.fn(async (pedidoId: number, clientUid: string, items: LineaPedido[]) => {
      cae()
      return { estado: pedidoId > 0 && items.length ? 'REGISTRADA' : 'RECHAZADA', clientUid }
    }),
    gasto: vi.fn(async (g: { clientUid: string; categoria: CategoriaGasto; concepto: string; monto: number; creadoEn: string }) => {
      cae()
      return { clientUid: g.clientUid, estado: g.monto > 0 ? 'REGISTRADA' : 'RECHAZADA', error: null }
    }),
    arqueo: vi.fn(async (a: { clientUid: string; contado: number; nota: string | null; creadoEn: string }) => {
      cae()
      return { clientUid: a.clientUid, estado: 'REGISTRADA', error: null }
    }),
  }
  return api as typeof api & ApiSync
}

describe('cola persistente', () => {
  it('sobrevive a recargar la app', async () => {
    await guardarCola([venta('a'), entrada('b')])
    const recargada = await cargarCola()
    expect(recargada.map(o => o.clientUid)).toEqual(['a', 'b'])
  })
})

describe('subirPendientes', () => {
  it('manda las ventas seguidas en un solo lote y las entradas aparte, en orden', async () => {
    const api = apiFalsa()
    const r = await subirPendientes([venta('v1'), venta('v2'), entrada('e1'), venta('v3')], api)

    expect(r.error).toBeUndefined()
    expect(r.aceptadas).toEqual(['v1', 'v2', 'e1', 'v3'])
    expect(api.lote).toHaveBeenCalledTimes(2)
    expect(api.lote.mock.calls[0][0].map((v: { clientUid: string }) => v.clientUid)).toEqual(['v1', 'v2'])
    expect(api.lote.mock.calls[0][0][0]).toMatchObject({ creadaEn: '2026-09-25T20:00:00.000Z', metodo: 'NEQUI' })
  })

  it('si se cae la señal a mitad, reporta lo que alcanzó a subir y el error', async () => {
    const api = apiFalsa({ caerEn: 2 })
    const r = await subirPendientes([venta('v1'), entrada('e1'), venta('v2')], api)

    expect(r.aceptadas).toEqual(['v1'])
    expect(r.error).toBeInstanceOf(TypeError)
  })

  it('las rechazadas por el servidor salen aparte para sacarlas de la cola', async () => {
    const r = await subirPendientes([venta('v1'), venta('mala', 999)], apiFalsa({ rechazar: ['mala'] }))
    expect(r.aceptadas).toEqual(['v1'])
    expect(r.rechazadas).toEqual(['mala'])
    expect(r.error).toBeUndefined()
  })

  it('si el lote entero da 400, las manda una por una para no perder las buenas', async () => {
    const api = apiFalsa({ rechazar: ['mala'] })
    api.lote.mockRejectedValueOnce(new ApiError(400, 'cantidad: debe ser mayor a 0'))
    const r = await subirPendientes([venta('v1'), venta('mala'), venta('v2')], api)

    expect(api.venta).toHaveBeenCalledTimes(3)
    expect(r.aceptadas).toEqual(['v1', 'v2'])
    expect(r.rechazadas).toEqual(['mala'])
  })

  it('cada tipo de movimiento va a su endpoint con su cuerpo', async () => {
    const api = apiFalsa()
    const r = await subirPendientes([conteo('c1'), merma('m1'), entrada('e1')], api)

    expect(r.error).toBeUndefined()
    expect(r.aceptadas).toEqual(['c1', 'm1', 'e1'])
    expect(api.movimiento).toHaveBeenCalledTimes(2)
    expect(api.movimiento.mock.calls[0][0]).toEqual({ clientUid: 'c1', productoId: 2, tipo: 'CONTEO', real: 7 })
    expect(api.movimiento.mock.calls[1][0]).toEqual({ clientUid: 'm1', productoId: 3, tipo: 'MERMA', cantidad: 2, motivo: 'VENCIDO' })
    expect(api.entrada).toHaveBeenCalledWith({ clientUid: 'e1', productoId: 1, cantidad: 5 })
  })

  it('la llegada de un pedido sube a su endpoint con su clientUid y sus cantidades', async () => {
    const api = apiFalsa()
    const r = await subirPendientes([llegada('rx1')], api)

    expect(r.error).toBeUndefined()
    expect(r.aceptadas).toEqual(['rx1'])
    expect(api.recibirPedido).toHaveBeenCalledWith(7, 'rx1', [{ productoId: 1, cantidad: 20 }], undefined)
    expect(api.movimiento).not.toHaveBeenCalled()
    expect(api.entrada).not.toHaveBeenCalled()
  })

  it('la llegada manda de dónde salió la plata cuando se dijo', async () => {
    const api = apiFalsa()
    await subirPendientes([{ tipo: 'recepcion', clientUid: 'rx2', pedidoId: 7, items: [{ productoId: 1, cantidad: 20 }], pagoLugar: 'CASA', creadaEn: Date.now() }], api)

    expect(api.recibirPedido).toHaveBeenCalledWith(7, 'rx2', [{ productoId: 1, cantidad: 20 }], 'CASA')
  })

  it('el gasto sube a /api/gastos con su hora del celular', async () => {
    const api = apiFalsa()
    const r = await subirPendientes([gasto('g1')], api)

    expect(r.error).toBeUndefined()
    expect(r.aceptadas).toEqual(['g1'])
    expect(api.gasto).toHaveBeenCalledTimes(1)
    const enviado = api.gasto.mock.calls[0][0]
    expect(enviado).toMatchObject({ clientUid: 'g1', categoria: 'HIELO', concepto: 'bolsas', monto: 1500 })
    expect(enviado.creadoEn).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('el arqueo sube a /api/arqueo con la hora del celular', async () => {
    const api = apiFalsa()
    const r = await subirPendientes([arqueo('a1')], api)

    expect(r.error).toBeUndefined()
    expect(r.aceptadas).toEqual(['a1'])
    expect(api.arqueo).toHaveBeenCalledTimes(1)
    expect(api.arqueo.mock.calls[0][0]).toMatchObject({ clientUid: 'a1', contado: 9000, nota: 'corto' })
    expect(api.arqueo.mock.calls[0][0].creadoEn).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('un 401 (sesión vencida) no bota nada: se reintenta después del login', async () => {
    const api = apiFalsa()
    api.lote.mockRejectedValueOnce(new ApiError(401, 'no'))
    const r = await subirPendientes([venta('v1')], api)
    expect(r.aceptadas).toEqual([])
    expect(r.rechazadas).toEqual([])
    expect(r.error).toBeInstanceOf(ApiError)
  })
})

describe('cola por negocio', () => {
  const jwt = (id: number) => 'x.' + btoa(JSON.stringify({ negocio_id: id })).replace(/=/g, '') + '.f'

  it('un celular compartido no mezcla las pendientes de dos negocios', async () => {
    sesion.guardar(jwt(1))
    await guardarCola([venta('del-uno')])
    sesion.guardar(jwt(42))
    expect(await cargarCola()).toEqual([])
    await guardarCola([venta('del-42')])
    sesion.guardar(jwt(1))
    expect((await cargarCola()).map(o => o.clientUid)).toEqual(['del-uno'])
  })

  it('al entrar otro negocio se limpia lo guardado del anterior', () => {
    sesion.guardar(jwt(1))
    localStorage.setItem('gz_estado', '{}')
    sesion.guardar(jwt(42))
    expect(localStorage.getItem('gz_estado')).toBeNull()
  })
})
