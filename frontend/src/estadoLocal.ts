import type { Estado, Operacion, ResumenDia } from './tipos'

// Lo que se ve en pantalla = último estado del servidor + lo que el celular hizo y el servidor aún no refleja.
// Así la venta se ve al instante y nunca "desaparece" cuando llega un refresco del servidor.

const ZONA = 'America/Bogota'

export const resumenVacio = (): ResumenDia =>
  ({ total: 0, nequi: 0, efectivo: 0, unidades: 0, porSabor: [], costo: 0, gastos: 0, mermas: 0, ganancia: 0 })

/** "2026-09-25" en hora de Bogotá. */
export function diaBogota(fecha: Date | number = Date.now()): string {
  return new Date(fecha).toLocaleDateString('en-CA', { timeZone: ZONA })
}

export function horaBogota(fecha: Date | number): string {
  return new Date(fecha).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: ZONA })
}

/**
 * @param base         último estado que mandó el servidor (o el guardado en el celular)
 * @param confirmadas  ya subieron pero el estado base todavía no las incluye
 * @param pendientes   todavía en la cola
 *
 * Se aplican en orden: la merma descuenta, el conteo fija el stock y las ventas posteriores se restan encima.
 */
export function estadoVisible(base: Estado | null, confirmadas: readonly Operacion[],
                              pendientes: readonly Operacion[], hoy = diaBogota()): Estado | null {
  if (!base) return null
  const e: Estado = JSON.parse(JSON.stringify(base))
  if (e.dia !== hoy) {
    // El estado guardado es de otro día (app abierta sin señal a medianoche): "hoy" arranca en cero
    e.hoy = resumenVacio()
    e.ultimas = []
    e.dia = hoy
  }
  for (const op of confirmadas) aplicar(e, op, hoy, false)
  for (const op of pendientes) aplicar(e, op, hoy, true)
  recalcular(e.hoy)
  return e
}

/** La ganancia siempre sale de la cuenta, así nunca queda desfasada con lo que se ve. */
function recalcular(h: ResumenDia) {
  h.ganancia = h.total - h.costo - h.gastos - h.mermas
}

function aplicar(e: Estado, op: Operacion, hoy: string, pendiente: boolean) {
  switch (op.tipo) {
    case 'entrada': {
      const p = producto(e, op.productoId)
      if (p) p.stock += op.cantidad
      return
    }
    case 'merma': {
      const p = producto(e, op.productoId)
      if (p) p.stock -= op.cantidad
      return
    }
    case 'ajuste': {
      // El conteo manda: lo que se contó es lo que queda, aunque el servidor diga otra cosa
      const p = producto(e, op.productoId)
      if (p) p.stock = op.real
      return
    }
    case 'recepcion': {
      // Llegó el pedido: suma lo que se anotó que llegó y baja el banner
      for (const linea of op.items) {
        if (linea.cantidad <= 0) continue
        const p = producto(e, linea.productoId)
        if (p) p.stock += linea.cantidad
      }
      if (e.pedido?.id === op.pedidoId) e.pedido = null
      return
    }
    case 'gasto':
      // Un gasto de otro día no contamina "hoy"
      if (diaBogota(op.creadaEn) === hoy) e.hoy.gastos += op.monto
      return
    case 'arqueo':
      // El cierre no mueve ni el stock ni el total: solo se sube
      return
    case 'venta':
      aplicarVenta(e, op, hoy, pendiente)
  }
}

function producto(e: Estado, id: number) {
  return e.productos.find(x => x.id === id)
}

function aplicarVenta(e: Estado, op: Extract<Operacion, { tipo: 'venta' }>, hoy: string, pendiente: boolean) {
  const p = producto(e, op.productoId)
  if (!p) return
  p.stock -= op.cantidad
  if (diaBogota(op.creadaEn) !== hoy) return

  const total = p.precio * op.cantidad
  e.hoy.total += total
  e.hoy.costo += p.costo * op.cantidad
  e.hoy.unidades += op.cantidad
  if (op.metodo === 'EFECTIVO') e.hoy.efectivo += total
  else e.hoy.nequi += total

  const fila = e.hoy.porSabor.find(s => s.sabor === p.nombre)
  if (fila) fila.unidades += op.cantidad
  else e.hoy.porSabor.push({ sabor: p.nombre, unidades: op.cantidad })
  e.hoy.porSabor.sort((a, b) => b.unidades - a.unidades)

  e.ultimas = [{ clientUid: op.clientUid, hora: horaBogota(op.creadaEn), sabor: p.nombre, total, metodo: op.metodo, pendiente },
    ...e.ultimas].slice(0, 8)
}

export function nuevoUid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12)
}
