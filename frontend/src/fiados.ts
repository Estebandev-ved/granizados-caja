import { pesos } from './formato'
import type { Fiado } from './tipos'

/** Número listo para wa.me: solo dígitos y con el 57 de Colombia si viene de 10 dígitos. */
export function numeroWhatsApp(telefono: string): string {
  const d = telefono.replace(/\D/g, '')
  return d.length === 10 ? '57' + d : d
}

/** El recordatorio que se manda por WhatsApp, amable y con lo que debe. */
export function mensajeRecordatorio(f: Pick<Fiado, 'cliente' | 'monto' | 'detalle'>): string {
  return `Hola ${f.cliente} 👋 te escribo para recordarte los ${pesos(f.monto)} de ${f.detalle} que quedaron pendientes. ` +
    'Me los puedes pasar por Nequi o en efectivo cuando puedas. ¡Gracias!'
}

export function enlaceRecordatorio(f: Fiado): string | null {
  if (!f.telefono) return null
  return 'https://wa.me/' + numeroWhatsApp(f.telefono) + '?text=' + encodeURIComponent(mensajeRecordatorio(f))
}
