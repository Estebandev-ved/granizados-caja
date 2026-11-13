import { describe, expect, it } from 'vitest'
import { avanceEquilibrio, cambio, moverMes, renglones } from './cierre'
import type { CierreMes } from './tipos'

const base: CierreMes = {
  mes: '2026-11', nombre: 'Noviembre 2026', desde: '2026-11-01', hasta: '2026-11-30', enCurso: true, diasDelMes: 30,
  diasTranscurridos: 11, diasConVenta: 9, unidades: 200, ventas: 1_200_000, costo: 600_000, mermas: 0, gastos: 100_000,
  ingresos: 0, equipo: 150_000, equipoApp: 150_000, gastoTrabajadores: 0, bonosProveedor: 0, gananciaApp: 500_000, gananciaReal: 350_000,
  retiros: 0, quedaEnNegocio: 350_000, proyeccion: 954_545, gastosPorCategoria: [],
  equilibrio: { gastosDelMes: 100_000, gastoPorDia: 9_091, dejaPorGranizado: 2_250, granizadosAlDia: 5, promedioAlDia: 22.2, diasQueCubrieron: 9, diasConVenta: 9 },
  porSabor: [], anterior: { mes: '2026-10', nombre: 'Octubre 2026', unidades: 0, ventas: 0, gastos: 0, equipo: 0, gananciaReal: 0, retiros: 0 },
  consejos: [],
}

describe('cierre del mes', () => {
  it('pasa de un mes a otro, también cambiando de año', () => {
    expect(moverMes('2026-11', -1)).toBe('2026-10')
    expect(moverMes('2026-01', -1)).toBe('2025-12')
    expect(moverMes('2026-12', 1)).toBe('2027-01')
  })

  it('arma el estado de resultados sin renglones en cero', () => {
    const r = renglones(base)
    expect(r.map(x => x.texto)).toEqual(['Vendiste', 'Producto', 'Gastos', 'Equipo', 'Ganancia real'])
    expect(r.find(x => x.texto === 'Equipo')?.nota).toBe('comisiones y premios')
  })

  it('si se pagó, dice cuánto le quedó al negocio', () => {
    const r = renglones({ ...base, retiros: 400_000, quedaEnNegocio: -50_000 })
    expect(r.slice(-2)).toEqual([
      { texto: 'Te pagaste', monto: 400_000, clase: 'resta', nota: '«Me pagué» en Mi plata' },
      { texto: 'Le quedó al negocio', monto: -50_000, clase: 'total' },
    ])
  })

  it('dice de dónde salió lo del equipo cuando pesa más lo anotado como gasto', () => {
    const r = renglones({ ...base, equipoApp: 100_000, gastoTrabajadores: 150_000 })
    expect(r.find(x => x.texto === 'Equipo')?.nota).toBe('lo que anotaste como gasto Trabajadores')
  })

  it('compara con el mes anterior y mide el equilibrio', () => {
    expect(cambio(120, 100)).toBe(20)
    expect(cambio(-50, -100)).toBe(50)
    expect(cambio(10, 0)).toBeNull()
    expect(avanceEquilibrio(base)).toBe(444)
    expect(avanceEquilibrio({ ...base, equilibrio: { ...base.equilibrio, granizadosAlDia: null } })).toBeNull()
  })
})
