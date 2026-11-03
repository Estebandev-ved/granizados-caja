import { useRegisterSW } from 'virtual:pwa-register/react'

const CADA_CUANTO = 30 * 60 * 1000

/**
 * Cuando hay versión nueva, avisa abajo y deja actualizar con un toque.
 * El iPhone casi nunca cierra la PWA, así que también busca versión nueva cada 30 min y al volver a abrirla.
 */
export function AvisoActualizacion() {
  const { needRefresh: [hayNueva], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      if (!registro) return
      const buscar = () => { if (navigator.onLine) void registro.update().catch(() => { /* sin señal */ }) }
      window.setInterval(buscar, CADA_CUANTO)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') buscar() })
    },
  })

  if (!hayNueva) return null
  return (
    <div className="aviso-actualizacion" role="status">
      <span>Hay una versión nueva</span>
      <button type="button" onClick={() => void updateServiceWorker(true)}>Actualizar</button>
    </div>
  )
}
