import type { CierreMes } from './tipos'

// Cuentas del cierre del mes que se muestran en Reportes. El servidor ya trae los números; acá solo se arma cómo se
// leen (los renglones del estado de resultados, el mes de antes y el de después, y qué tan cerca está el equilibrio).

/** 2026-11 → 2026-10 (o 2026-12 con +1). */
export function moverMes(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number)
  const total = a * 12 + (m - 1) + delta
  return Math.floor(total / 12) + '-' + String(total % 12 + 1).padStart(2, '0')
}

export interface Renglon {
  texto: string
  monto: number
  /** suma: entra; resta: sale; total: resultado. */
  clase: 'suma' | 'resta' | 'total'
  nota?: string
}

/** El estado de resultados del mes: de lo vendido a lo que le quedó al negocio. Los renglones en 0 no salen. */
export function renglones(c: CierreMes): Renglon[] {
  const r: Renglon[] = [
    { texto: 'Vendiste', monto: c.ventas, clase: 'suma', nota: c.unidades + ' granizados' },
    { texto: 'Producto', monto: c.costo, clase: 'resta', nota: 'lo que te costaron' },
  ]
  if (c.gastos > 0) r.push({ texto: 'Gastos', monto: c.gastos, clase: 'resta' })
  if (c.equipo > 0) {
    r.push({
      texto: 'Equipo', monto: c.equipo, clase: 'resta',
      nota: c.gastoTrabajadores > c.equipoApp ? 'lo que anotaste como gasto Trabajadores' : 'comisiones y premios',
    })
  }
  if (c.mermas > 0) r.push({ texto: 'Mermas', monto: c.mermas, clase: 'resta' })
  if (c.ingresos > 0) r.push({ texto: 'Otros ingresos', monto: c.ingresos, clase: 'suma' })
  r.push({ texto: 'Ganancia real', monto: c.gananciaReal, clase: 'total' })
  if (c.retiros > 0) {
    r.push({ texto: 'Te pagaste', monto: c.retiros, clase: 'resta', nota: '«Me pagué» en Mi plata' })
    r.push({ texto: 'Le quedó al negocio', monto: c.quedaEnNegocio, clase: 'total' })
  }
  return r
}

/** Cambio en % frente al mes anterior (null si no hay con qué comparar). */
export function cambio(actual: number, anterior: number): number | null {
  if (!anterior) return null
  return Math.round((actual - anterior) * 100 / Math.abs(anterior))
}

/** Qué tan lejos está del punto de equilibrio: 100 = justo lo cubre. null si no se puede saber. */
export function avanceEquilibrio(c: CierreMes): number | null {
  const e = c.equilibrio
  if (!e.granizadosAlDia || e.diasConVenta === 0) return null
  return Math.round(e.promedioAlDia * 100 / e.granizadosAlDia)
}
