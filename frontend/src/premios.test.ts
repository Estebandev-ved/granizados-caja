import { describe, expect, it } from 'vitest'
import { analizarEscalon, ganariaCon, opcionesMeta, sugerirPremios } from './premios'
import type { DatosPremios, PremiosDia } from './tipos'

const datos: DatosPremios = {
  base: 16, diasAnalizados: 20, mejorDia: 30, margenNormal: 2800, margenPromo: 2100,
  pocosDatos: false, faltanCostos: false, sinTarifas: false,
}

describe('premios que le convengan a los dos', () => {
  it('un premio por vender lo de un día normal no lo hace vender más', () => {
    expect(analizarEscalon({ granizados: 12, total: 2500 }, datos).veredicto).toBe('dia-normal')
  })

  it('dice qué parte de lo que ganas de más se lleva el trabajador', () => {
    // 20 granizados: 4 más que un día normal × 2.800 = 11.200 de más; con 8.000 de premio se lleva el 71 %
    const a = analizarEscalon({ granizados: 20, total: 8000 }, datos)
    expect(a.extra).toBe(11200)
    expect(a.teQueda).toBe(3200)
    expect(a.pct).toBe(71)
    expect(a.veredicto).toBe('mucho')
    expect(analizarEscalon({ granizados: 25, total: 8000 }, datos).veredicto).toBe('bien')
    expect(analizarEscalon({ granizados: 18, total: 8000 }, datos).veredicto).toBe('pierde')
  })

  it('en día de promo cuenta la rebaja y lo que deja un granizado en promo', () => {
    const a = analizarEscalon({ granizados: 20, total: 8000 }, datos, true, 5000)
    expect(a.premio).toBe(3000)
    expect(a.extra).toBe(4 * 2100)
  })

  it('sugiere escalones por encima de un día normal donde el trabajador se lleva el 35 % de lo extra', () => {
    const { escalones, rebaja } = sugerirPremios(datos)
    expect(escalones).toEqual([
      { granizados: 20, total: 3500 }, { granizados: 24, total: 7500 },
      { granizados: 29, total: 12500 }, { granizados: 35, total: 18500 },
    ])
    for (const e of escalones) expect(analizarEscalon(e, datos).veredicto).toBe('bien')
    expect(rebaja).toBe(2500)
    expect(sugerirPremios({ ...datos, margenPromo: null }).rebaja).toBeNull()
  })
})

describe('la meta del día del trabajador', () => {
  const premios: PremiosDia = {
    vendidas: 14, comision: 14000, premio: 0, gratis: 1, diaPromo: false, siguiente: { granizados: 20, total: 3500 },
    escalones: [{ granizados: 20, total: 3500 }, { granizados: 24, total: 7500 }, { granizados: 29, total: 12500 }],
    tarifas: { normal: 1000, cremoso: 1500, grande: 0, cerveza: 0, promo: 700, rebajaPromo: 0, porcentaje: null },
  }

  it('le ofrece los escalones que le faltan y, para ir por más, solo los que pasan su meta', () => {
    expect(opcionesMeta(premios)).toEqual([20, 24, 29])
    expect(opcionesMeta({ ...premios, vendidas: 21 }, 20)).toEqual([24, 29])
    expect(opcionesMeta({ ...premios, escalones: [], vendidas: 3 })).toEqual([5, 10, 15, 20])
  })

  it('calcula cuánto ganaría con esa meta: comisión más premio', () => {
    expect(ganariaCon(premios, 24)).toBe(24 * 1000 + 7500)
    expect(ganariaCon({ ...premios, diaPromo: true }, 20)).toBe(20 * 700 + 3500)
  })
})
