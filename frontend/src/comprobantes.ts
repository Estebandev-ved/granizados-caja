import { get, set } from 'idb-keyval'
import { api, ApiError, sesion } from './api'

// Fotos de comprobantes de pago (el pantallazo de Nequi). Se comprimen en el celular y esperan en IndexedDB hasta que
// haya señal: la venta puede seguir en la cola y la foto sube igual (el servidor la liga por el clientUid de la venta).

/** Lado más largo de la foto ya comprimida: alcanza para leer un comprobante y pesa unos 100-200 KB. */
const LADO = 1280
const CALIDAD = 0.6
/** Una foto que no sube en este tiempo se descarta (la venta ya no está en "Mis ventas de hoy"). */
const VENCE_MS = 3 * 24 * 60 * 60 * 1000

interface Pendiente {
  imagen: string
  en: number
}

function clave(): string {
  const n = sesion.negocioId
  return n === 1 ? 'gz_comprobantes' : 'gz_comprobantes_' + n
}

async function leer(): Promise<Record<string, Pendiente>> {
  try { return (await get<Record<string, Pendiente>>(clave())) ?? {} } catch { return {} }
}

async function guardar(p: Record<string, Pendiente>): Promise<void> {
  try { await set(clave(), p) } catch { /* sin almacenamiento: se pierde la foto, no la venta */ }
}

/** Achica la foto y la vuelve JPEG (data URL). Safari 16 lo hace bien con <img> + canvas. */
export function comprimir(archivo: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, LADO / Math.max(img.naturalWidth, img.naturalHeight))
      const lienzo = document.createElement('canvas')
      lienzo.width = Math.max(1, Math.round(img.naturalWidth * escala))
      lienzo.height = Math.max(1, Math.round(img.naturalHeight * escala))
      const ctx = lienzo.getContext('2d')
      URL.revokeObjectURL(url)
      if (!ctx) { rechazar(new Error('No se pudo leer la foto')); return }
      ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height)
      resolver(lienzo.toDataURL('image/jpeg', CALIDAD))
    }
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No se pudo leer la foto')) }
    img.src = url
  })
}

/** Guarda la foto para esas ventas y trata de subirla ya. Nunca falla: si no hay señal, sube después. */
export async function adjuntarComprobante(ventaUids: string[], archivo: Blob): Promise<void> {
  const imagen = await comprimir(archivo)
  const pendientes = await leer()
  for (const uid of ventaUids) pendientes[uid] = { imagen, en: Date.now() }
  await guardar(pendientes)
  window.dispatchEvent(new Event('gz:comprobantes'))
  void subirComprobantes()
}

let subiendo = false

/** Sube las fotos que esperan. Un error del servidor que no se arregla reintentando (4xx) la descarta. */
export async function subirComprobantes(): Promise<void> {
  if (subiendo || !navigator.onLine) return
  subiendo = true
  try {
    const pendientes = await leer()
    let cambio = false
    for (const [uid, p] of Object.entries(pendientes)) {
      if (Date.now() - p.en > VENCE_MS) { delete pendientes[uid]; cambio = true; continue }
      try {
        await api.subirComprobante(uid, p.imagen)
        delete pendientes[uid]
        cambio = true
      } catch (e) {
        if (e instanceof ApiError && e.status >= 400 && e.status < 500 && ![401, 408, 429].includes(e.status)) {
          delete pendientes[uid]
          cambio = true
          continue
        }
        break // sin señal o servidor caído: se reintenta después
      }
    }
    if (cambio) {
      await guardar(pendientes)
      window.dispatchEvent(new Event('gz:comprobantes'))
    }
  } finally {
    subiendo = false
  }
}

/** Las ventas cuya foto todavía no sube. */
export async function comprobantesPendientes(): Promise<Set<string>> {
  return new Set(Object.keys(await leer()))
}
