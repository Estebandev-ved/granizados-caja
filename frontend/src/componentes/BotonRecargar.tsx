import { useState } from 'react'

/** Recarga la app desde adentro (la app instalada no tiene botón de recargar): busca versión nueva y vuelve a abrir. */
export function BotonRecargar() {
  const [recargando, setRecargando] = useState(false)

  const recargar = async () => {
    setRecargando(true)
    try {
      const registro = await navigator.serviceWorker?.getRegistration()
      await registro?.update()
    } catch {
      /* sin señal: igual se recarga con lo que hay */
    }
    window.location.reload()
  }

  return (
    <button className="big ghost" onClick={() => void recargar()} disabled={recargando}>
      {recargando ? 'Recargando…' : 'Recargar la app'}
    </button>
  )
}
