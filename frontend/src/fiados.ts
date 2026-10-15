import type { PersonaFiado } from './tipos'

/** Número listo para wa.me: solo dígitos y con el 57 de Colombia si viene de 10 dígitos. */
export function numeroWhatsApp(telefono: string): string {
  const d = telefono.replace(/\D/g, '')
  return d.length === 10 ? '57' + d : d
}

/** Abre WhatsApp con el recordatorio ya escrito (el servidor lo arma: explica qué debe y cómo pagar). */
export function enlaceRecordatorio(p: Pick<PersonaFiado, 'telefono' | 'mensaje'>): string | null {
  if (!p.telefono) return null
  return 'https://wa.me/' + numeroWhatsApp(p.telefono) + '?text=' + encodeURIComponent(p.mensaje)
}

/** ¿Ya se le recordó en las últimas 24 horas? (el servidor tampoco deja repetirlo) */
export function recordadoHoy(p: Pick<PersonaFiado, 'recordadoEn'>, ahora = Date.now()): boolean {
  return !!p.recordadoEn && ahora - new Date(p.recordadoEn).getTime() < 24 * 3_600_000
}
