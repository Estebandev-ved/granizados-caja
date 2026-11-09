import { describe, expect, it } from 'vitest'
import { cargoConsumo, diaBogota, estadoVisible, resumenVacio } from './estadoLocal'
import type { Estado, Operacion } from './tipos'

const base = (dia = '2026-09-25'): Estado => ({
  dia,
  productos: [
    { id: 1, sabor: 'Smirnoff', tipo: 'NORMAL', nombre: 'Smirnoff', precio: 6000, costo: 3000, stock: 10, stockMinimo: 3, activo: true, orden: 1 },
    { id: 2, sabor: 'Piña colada', tipo: 'CREMOSO', nombre: 'Piña colada cremoso', precio: 7000, costo: 4000, stock: 4, stockMinimo: 3, activo: true, orden: 2 },
  ],
  hoy: {
    total: 6000, nequi: 6000, efectivo: 0, unidades: 1, porSabor: [{ sabor: 'Smirnoff', unidades: 1 }],
    costo: 3000, gastos: 0, mermas: 0, ganancia: 3000,
  },
  ultimas: [{ clientUid: 'vieja', hora: '2:00 PM', sabor: 'Smirnoff', total: 6000, metodo: 'NEQUI' }],
  pedido: null,
  meta: { valor: 0, racha: 0 },
})

const HOY_3PM = Date.parse('2026-09-25T15:00:00-05:00')
const venta = (uid: string, productoId: number, cantidad: number, metodo: 'NEQUI' | 'EFECTIVO' = 'EFECTIVO', creadaEn = HOY_3PM): Operacion =>
  ({ tipo: 'venta', clientUid: uid, productoId, metodo, cantidad, creadaEn })

describe('estadoVisible', () => {
  it('la barra de logros del trabajador sube al instante con cada venta pendiente', () => {
    const b = base()
    b.metaEquipo = { unidades: 10, premio: 2000, vendidas: 3, racha: 0 }
    const e = estadoVisible(b, [], [venta('p1', 1, 2)], '2026-09-25')!

    expect(e.metaEquipo?.vendidas).toBe(5)
    expect(b.metaEquipo.vendidas).toBe(3)
  })

  it('lo que vende este celular también cuenta en las ventas propias (la carga del día)', () => {
    const b = base()
    b.hoy.propias = [{ sabor: 'Smirnoff', unidades: 1 }]
    const e = estadoVisible(b, [], [venta('p1', 1, 2), venta('p2', 2, 1)], '2026-09-25')!

    expect(e.hoy.propias).toEqual([{ sabor: 'Smirnoff', unidades: 3 }, { sabor: 'Piña colada cremoso', unidades: 1 }])
    expect(b.hoy.propias).toEqual([{ sabor: 'Smirnoff', unidades: 1 }])
  })

  it('la cerveza cuenta en el total pero también en su propio bloque de ganancia', () => {
    const b = base()
    b.productos.push({ id: 3, sabor: 'Águila', tipo: 'CERVEZA', nombre: 'Águila', precio: 5000, costo: 3200, stock: 24, stockMinimo: 6, activo: true, orden: 3 })
    const e = estadoVisible(b, [], [venta('c1', 3, 2), venta('c2', 1, 1)], '2026-09-25')!

    expect(e.hoy.cerveza).toEqual({ unidades: 2, total: 10000, costo: 6400, ganancia: 3600 })
    expect(e.hoy.total).toBe(6000 + 10000 + 6000)
    expect(e.hoy.ganancia).toBe(3000 + 3600 + 3000)
    expect(b.hoy.cerveza).toBeUndefined()
  })

  it('una venta que el servidor ya trae no se suma otra vez (ni confirmada ni pendiente)', () => {
    const b = base()
    b.ultimas = [{ clientUid: 'ya', hora: '2:55 PM', sabor: 'Smirnoff', total: 6000, metodo: 'NEQUI' }, ...b.ultimas]
    const op = venta('ya', 1, 1, 'NEQUI')

    for (const e of [estadoVisible(b, [op], [], '2026-09-25')!, estadoVisible(b, [], [op], '2026-09-25')!]) {
      expect(e.productos[0].stock).toBe(10)
      expect(e.hoy.total).toBe(6000)
      expect(e.hoy.unidades).toBe(1)
    }
  })

  it('una merma pendiente baja la ganancia del día y el stock', () => {
    const merma: Operacion = { tipo: 'merma', clientUid: 'mm', productoId: 1, cantidad: 2, motivo: 'DANADO', creadaEn: HOY_3PM }
    const e = estadoVisible(base(), [], [merma], '2026-09-25')!

    expect(e.productos[0].stock).toBe(8)
    expect(e.hoy.mermas).toBe(6000)
    expect(e.hoy.ganancia).toBe(3000 - 6000)
  })

  it('una venta mixta suma cada parte donde entró la plata', () => {
    const op: Operacion = { tipo: 'venta', clientUid: 'm1', productoId: 2, metodo: 'MIXTO', cantidad: 1, creadaEn: HOY_3PM, efectivo: 3000 }
    const e = estadoVisible(base(), [], [op], '2026-09-25')!

    expect(e.hoy.efectivo).toBe(3000)
    expect(e.hoy.nequi).toBe(6000 + 4000)
    expect(e.hoy.total).toBe(13000)
  })

  it('un regalo baja el stock y cuenta la unidad, pero no suma plata', () => {
    const op: Operacion = { tipo: 'venta', clientUid: 'r1', productoId: 2, metodo: 'REGALO', cantidad: 1, creadaEn: HOY_3PM, total: 0 }
    const e = estadoVisible(base(), [], [op], '2026-09-25')!

    expect(e.productos[1].stock).toBe(3)
    expect(e.hoy.total).toBe(6000) // lo mismo que ya traía el servidor
    expect(e.hoy.nequi).toBe(6000)
    expect(e.hoy.efectivo).toBe(0)
    expect(e.hoy.unidades).toBe(2)
    expect(e.hoy.costo).toBe(3000 + 4000)
  })

  it('lo que se toma el trabajador sale de su carga pero no es venta: el del día gratis y el siguiente se descuenta', () => {
    const b = base()
    b.metaEquipo = { unidades: 10, premio: 2000, vendidas: 1, racha: 0 }
    b.premios = { vendidas: 1, comision: 600, premio: 0, escalones: [], siguiente: null, gratis: 1, diaPromo: false, consumidos: 0, descuento: 0 }
    const tomar = (uid: string): Operacion => ({ tipo: 'venta', clientUid: uid, productoId: 1, metodo: 'CONSUMO', cantidad: 1, creadaEn: HOY_3PM })
    const e = estadoVisible(b, [], [tomar('c1'), tomar('c2')], '2026-09-25')!

    expect(e.productos[0].stock).toBe(8)
    expect(e.hoy.unidades).toBe(1) // sigue siendo solo lo vendido
    expect(e.hoy.total).toBe(6000)
    expect(e.hoy.efectivo).toBe(0)
    expect(e.metaEquipo?.vendidas).toBe(1)
    expect(e.hoy.porSabor).toEqual([{ sabor: 'Smirnoff', unidades: 3 }])
    expect(e.premios?.consumidos).toBe(2)
    expect(e.premios?.descuento).toBe(6000)
    expect(e.ultimas.slice(0, 2).map(u => u.cargo)).toEqual([6000, 0])
  })

  it('cargoConsumo cobra solo lo que pasa de los gratis del día', () => {
    expect(cargoConsumo(6000, 1, 1, 0)).toBe(0)
    expect(cargoConsumo(6000, 1, 1, 1)).toBe(6000)
    expect(cargoConsumo(6000, 3, 1, 0)).toBe(12000)
    expect(cargoConsumo(6000, 2, 0, 0)).toBe(12000)
  })

  it('suma las ventas pendientes encima del estado del servidor', () => {
    const e = estadoVisible(base(), [], [venta('p1', 2, 2)], '2026-09-25')!

    expect(e.productos[1].stock).toBe(2)
    expect(e.hoy.total).toBe(20000)
    expect(e.hoy.efectivo).toBe(14000)
    expect(e.hoy.porSabor[0]).toEqual({ sabor: 'Piña colada cremoso', unidades: 2 })
    expect(e.ultimas[0]).toMatchObject({ clientUid: 'p1', sabor: 'Piña colada cremoso', total: 14000, pendiente: true })
    expect(e.ultimas[0].hora).toMatch(/^3:00\s?PM$/)
  })

  it('no modifica el estado base (un refresco del servidor no pierde nada)', () => {
    const b = base()
    estadoVisible(b, [], [venta('p1', 1, 1)], '2026-09-25')
    expect(b.productos[0].stock).toBe(10)
    expect(b.hoy.total).toBe(6000)
  })

  it('las confirmadas cuentan pero ya no salen como pendientes', () => {
    const e = estadoVisible(base(), [venta('c1', 1, 1)], [venta('p1', 1, 1)], '2026-09-25')!
    expect(e.productos[0].stock).toBe(8)
    expect(e.ultimas.map(u => [u.clientUid, !!u.pendiente])).toEqual([['p1', true], ['c1', false], ['vieja', false]])
  })

  it('las entradas de inventario suman stock pero no plata', () => {
    const entrada: Operacion = { tipo: 'entrada', clientUid: 'e1', productoId: 1, cantidad: 12, creadaEn: HOY_3PM }
    const e = estadoVisible(base(), [], [entrada], '2026-09-25')!
    expect(e.productos[0].stock).toBe(22)
    expect(e.hoy.total).toBe(6000)
  })

  it('la merma descuenta stock pero no plata', () => {
    const merma: Operacion = { tipo: 'merma', clientUid: 'm1', productoId: 1, cantidad: 3, motivo: 'VENCIDO', creadaEn: HOY_3PM }
    const e = estadoVisible(base(), [], [merma], '2026-09-25')!
    expect(e.productos[0].stock).toBe(7)
    expect(e.hoy).toMatchObject({ total: 6000, unidades: 1, nequi: 6000, efectivo: 0 })
  })

  it('el conteo fija el stock y las ventas posteriores se restan encima', () => {
    const conteo: Operacion = { tipo: 'ajuste', clientUid: 'c1', productoId: 1, real: 5, creadaEn: HOY_3PM }
    const e = estadoVisible(base(), [], [conteo, venta('p1', 1, 2)], '2026-09-25')!
    expect(e.productos[0].stock).toBe(3)
    expect(e.hoy.total).toBe(18000)
    expect(e.hoy.efectivo).toBe(12000)
  })

  it('un conteo que cuadra deja el stock igual, aunque el servidor diga otra cosa', () => {
    const conteo: Operacion = { tipo: 'ajuste', clientUid: 'c2', productoId: 1, real: 10, creadaEn: HOY_3PM }
    const e = estadoVisible(base(), [], [conteo], '2026-09-25')!
    expect(e.productos[0].stock).toBe(10)
    expect(e.hoy.total).toBe(6000)
  })

  it('el gasto sube los gastos y baja la ganancia, sin tocar el stock', () => {
    const gasto: Operacion = { tipo: 'gasto', clientUid: 'g1', categoria: 'HIELO', concepto: 'bolsas', monto: 1500, creadaEn: HOY_3PM }
    const e = estadoVisible(base(), [], [gasto], '2026-09-25')!
    expect(e.hoy.gastos).toBe(1500)
    expect(e.hoy.ganancia).toBe(1500)
    expect(e.hoy.total).toBe(6000)
    expect(e.productos[0].stock).toBe(10)
  })

  it('un gasto de otro día no contamina hoy', () => {
    const ayer = Date.parse('2026-09-24T18:00:00-05:00')
    const gasto: Operacion = { tipo: 'gasto', clientUid: 'g1', categoria: 'TRANSPORTE', concepto: '', monto: 900, creadaEn: ayer }
    const e = estadoVisible(base(), [], [gasto], '2026-09-25')!
    expect(e.hoy.gastos).toBe(0)
    expect(e.hoy.ganancia).toBe(3000)
  })

  it('el arqueo no mueve ni el stock ni la plata', () => {
    const cierre: Operacion = { tipo: 'arqueo', clientUid: 'a1', contado: 9000, nota: 'corto', creadaEn: HOY_3PM }
    const e = estadoVisible(base(), [], [cierre], '2026-09-25')!

    expect(e).toEqual(base())
  })

  it('la meta se arrastra aunque cambie el día', () => {
    const b: Estado = { ...base('2026-09-24'), meta: { valor: 15000, racha: 3 } }
    const e = estadoVisible(b, [], [], '2026-09-25')!

    expect(e.dia).toBe('2026-09-25')
    expect(e.hoy.total).toBe(0)
    expect(e.meta).toEqual({ valor: 15000, racha: 3 })
  })

  it('la llegada del pedido suma stock, baja el banner y no toca la plata', () => {
    const conPedido: Estado = { ...base(), pedido: { id: 7, totalUnidades: 30, items: [] } }
    const llegada: Operacion = {
      tipo: 'recepcion', clientUid: 'r1', pedidoId: 7,
      items: [{ productoId: 1, cantidad: 20 }, { productoId: 2, cantidad: 10 }], creadaEn: HOY_3PM,
    }
    const e = estadoVisible(conPedido, [], [llegada], '2026-09-25')!
    expect(e.productos[0].stock).toBe(30)
    expect(e.productos[1].stock).toBe(14)
    expect(e.pedido).toBeNull()
    expect(e.hoy).toMatchObject({ total: 6000, unidades: 1 })
    expect(conPedido.pedido).not.toBeNull() // el estado base no se toca
  })

  it('una llegada de otro pedido no borra el banner', () => {
    const conPedido: Estado = { ...base(), pedido: { id: 7, totalUnidades: 5, items: [] } }
    const llegada: Operacion = { tipo: 'recepcion', clientUid: 'r2', pedidoId: 8, items: [{ productoId: 1, cantidad: 1 }], creadaEn: HOY_3PM }
    const e = estadoVisible(conPedido, [], [llegada], '2026-09-25')!
    expect(e.pedido?.id).toBe(7)
  })

  it('si el estado guardado es de ayer, hoy arranca en cero', () => {
    const e = estadoVisible(base('2026-09-24'), [], [], '2026-09-25')!
    expect(e.hoy).toEqual(resumenVacio())
    expect(e.ultimas).toEqual([])
    expect(e.productos[0].stock).toBe(10)
  })

  it('una venta pendiente de ayer descuenta stock pero no suma a hoy', () => {
    const ayer = Date.parse('2026-09-24T23:30:00-05:00')
    const e = estadoVisible(base(), [], [venta('p1', 1, 1, 'NEQUI', ayer)], '2026-09-25')!
    expect(e.productos[0].stock).toBe(9)
    expect(e.hoy.total).toBe(6000)
  })
})

describe('diaBogota', () => {
  it('usa la hora de Colombia, no la del celular ni UTC', () => {
    expect(diaBogota(Date.parse('2026-09-26T03:00:00Z'))).toBe('2026-09-25') // 10pm del 25 en Bogotá
  })
})
