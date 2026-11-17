import { sesion } from './api'
import type { CalleConfig, Producto, TarifasDia, Tipo, VeredictoLugar } from './tipos'

// Plan de ventas en la calle. El dueño lo prende en Ajustes; mientras tanto quien sale a vender «empieza una salida»
// en un lugar y todo lo que venda ahí cobra el precio y la comisión de la calle. Esta parte es lo que vive en el
// celular: la salida abierta, los precios de calle y las cuentas rápidas. El veredicto de cada lugar lo arma el servidor.

/** Una salida que está en curso en este celular. */
export interface SalidaAbierta {
  clientUid: string
  lugar: string
  /** Cuándo empezó (ms). */
  inicio: number
  /** El dueño la marcó de prueba: él paga el pasaje completo. */
  prueba: boolean
  /** Lo vendido en la salida (se quita si se deshace una venta). */
  ventas: { uid: string; cantidad: number; total: number }[]
}

const clave = () => 'gz_salida:' + sesion.quien

export function leerSalida(): SalidaAbierta | null {
  try {
    const s = JSON.parse(localStorage.getItem(clave()) ?? 'null') as SalidaAbierta | null
    return s && typeof s.clientUid === 'string' && Array.isArray(s.ventas) ? s : null
  } catch { return null }
}

export function guardarSalida(s: SalidaAbierta | null) {
  try {
    if (s) localStorage.setItem(clave(), JSON.stringify(s))
    else localStorage.removeItem(clave())
  } catch { /* modo privado */ }
}

/**
 * Los sabores con el precio de la calle. Un precio en 0 deja el de siempre. Con el plan apagado o sin salida abierta
 * no cambia nada.
 */
export function productosEnCalle(productos: Producto[], calle: CalleConfig | null | undefined, enSalida: boolean): Producto[] {
  if (!calle?.activo || !enSalida) return productos
  return productos.map(p => (calle.precios[p.tipo] > 0 ? { ...p, precio: calle.precios[p.tipo] } : p))
}

/** Lo que gana el trabajador por granizado en la calle: la tarifa de la calle si el dueño la puso y, si no, la de siempre. */
export function tarifasEnCalle(t: TarifasDia | null, calle: CalleConfig | null | undefined, enSalida: boolean): TarifasDia | null {
  if (!t || !calle?.activo || !enSalida) return t
  const c = (tipo: Tipo, deSiempre: number) => (calle.comisiones[tipo] > 0 ? calle.comisiones[tipo] : deSiempre)
  const hay = Object.values(calle.comisiones).some(n => n > 0)
  return {
    ...t,
    normal: c('NORMAL', t.normal), cremoso: c('CREMOSO', t.cremoso), grande: c('GRANDE', t.grande), cerveza: c('CERVEZA', t.cerveza),
    promo: calle.combo > 0 ? calle.combo : t.promo,
    porcentaje: hay ? null : t.porcentaje,
  }
}

export interface ResumenSalida {
  unidades: number
  total: number
  horas: number
  /** Granizados en 4 horas (null = menos de una hora, no dice nada). */
  ritmo4h: number | null
  veredicto: VeredictoLugar
  /** Lo que se le devuelve de pasaje: la salida de prueba o una en que vendió menos del mínimo. */
  pasajeADevolver: number
}

export function veredicto(ritmo4h: number | null, calle: Pick<CalleConfig, 'bueno' | 'regular'>): VeredictoLugar {
  if (ritmo4h === null) return 'SIN_DATOS'
  if (ritmo4h >= calle.bueno) return 'BUENO'
  return ritmo4h >= calle.regular ? 'REGULAR' : 'MALO'
}

/** Misma cuenta que hace el servidor, con lo que este celular alcanzó a anotar. */
export function resumirSalida(s: SalidaAbierta, ahora: number, pasaje: number, calle: CalleConfig, trabajador: boolean): ResumenSalida {
  const unidades = s.ventas.reduce((a, v) => a + v.cantidad, 0)
  const total = s.ventas.reduce((a, v) => a + v.total, 0)
  const horas = Math.round(Math.max(0, ahora - s.inicio) / 36000) / 100 // dos decimales de hora
  const ritmo4h = horas >= 1 ? Math.round(unidades * 4 / horas) : null
  const devolver = trabajador && (s.prueba || unidades < calle.minimoPasaje)
  return { unidades, total, horas, ritmo4h, veredicto: veredicto(ritmo4h, calle), pasajeADevolver: devolver ? pasaje : 0 }
}

/** «1 h 20 min» / «35 min». */
export function duracion(desde: number, hasta: number): string {
  const min = Math.max(0, Math.floor((hasta - desde) / 60000))
  const h = Math.floor(min / 60)
  return h > 0 ? `${h} h ${min % 60} min` : `${min} min`
}

/** La hora del día en 12 horas: 18 → «6 p. m.». */
export function hora12(h: number): string {
  const sufijo = h < 12 ? 'a. m.' : 'p. m.'
  return `${h % 12 === 0 ? 12 : h % 12} ${sufijo}`
}

export const TEXTO_VEREDICTO: Record<VeredictoLugar, string> = {
  BUENO: 'Bueno para vender', REGULAR: 'Regular', MALO: 'Malo', SIN_DATOS: 'Sin datos todavía',
}

export const EMOJI_VEREDICTO: Record<VeredictoLugar, string> = {
  BUENO: '🟢', REGULAR: '🟡', MALO: '🔴', SIN_DATOS: '⚪',
}

/**
 * Dónde está el celular ahora, para el mapa y para la alerta. Nunca falla ni se queda esperando: sin permiso o sin
 * señal de GPS devuelve null y la salida (o la alerta) sigue igual, solo sin punto en el mapa.
 */
export function ubicacion(esperaMs = 8000): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolver => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolver(null)
    const tope = window.setTimeout(() => resolver(null), esperaMs + 500)
    navigator.geolocation.getCurrentPosition(
      p => { window.clearTimeout(tope); resolver({ lat: p.coords.latitude, lng: p.coords.longitude }) },
      () => { window.clearTimeout(tope); resolver(null) },
      { enableHighAccuracy: true, timeout: esperaMs, maximumAge: 60_000 })
  })
}

/** El valor de Ajustes en el formulario → el número que se guarda. */
export const CLAVES_CALLE = {
  precios: { NORMAL: 'CALLE_PRECIO_NORMAL', CREMOSO: 'CALLE_PRECIO_CREMOSO', GRANDE: 'CALLE_PRECIO_GRANDE', CERVEZA: 'CALLE_PRECIO_CERVEZA' },
  comisiones: { NORMAL: 'CALLE_COM_NORMAL', CREMOSO: 'CALLE_COM_CREMOSO', GRANDE: 'CALLE_COM_GRANDE', CERVEZA: 'CALLE_COM_CERVEZA' },
} as const
