import { useEffect, useState } from 'react'

// Chrome/Android avisan con este evento que la app se puede instalar y dejan un prompt nativo.
// Safari (iPhone) no tiene ese evento: ahí se instala a mano con "Compartir → Agregar a inicio".
interface EventoInstalacion extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function yaInstalada(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // Safari viejo (iOS) no tiene display-mode: standalone, pero sí este flag
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function esIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}

export type ModoInstalar = 'no-disponible' | 'instalable' | 'ios' | 'instalada'

/** Botón "Instalar app": en Chrome/Android dispara el prompt nativo, en iPhone explica cómo hacerlo a mano. */
export function useInstalarPWA() {
  const [evento, setEvento] = useState<EventoInstalacion | null>(null)
  const [instalada, setInstalada] = useState(yaInstalada)

  useEffect(() => {
    if (instalada) return
    const alDisponible = (e: Event) => { e.preventDefault(); setEvento(e as EventoInstalacion) }
    const alInstalar = () => { setInstalada(true); setEvento(null) }
    window.addEventListener('beforeinstallprompt', alDisponible)
    window.addEventListener('appinstalled', alInstalar)
    return () => {
      window.removeEventListener('beforeinstallprompt', alDisponible)
      window.removeEventListener('appinstalled', alInstalar)
    }
  }, [instalada])

  const modo: ModoInstalar = instalada ? 'instalada' : evento ? 'instalable' : esIOS() ? 'ios' : 'no-disponible'

  const instalar = async () => {
    if (!evento) return
    await evento.prompt()
    const { outcome } = await evento.userChoice
    if (outcome === 'accepted') setInstalada(true)
    setEvento(null)
  }

  return { modo, instalar }
}
