import { useEffect, useState, type ReactNode } from 'react'

/** Panel que sube desde abajo. Se monta de nuevo cada vez que se abre (estado interno limpio). */
export function Sheet({ abierto, onCerrar, children }: { abierto: boolean; onCerrar: () => void; children: ReactNode }) {
  const [visible, setVisible] = useState(false)

  // Un frame después de abrir se activa la clase "on" para que se vea la animación de subida
  useEffect(() => {
    if (!abierto) return
    const id = requestAnimationFrame(() => setVisible(true))
    return () => {
      cancelAnimationFrame(id)
      setVisible(false)
    }
  }, [abierto])

  const on = abierto && visible
  return (
    <>
      <div className={'sheet-bg' + (on ? ' on' : '')} onClick={onCerrar} />
      <div className={'sheet' + (on ? ' on' : '')} role="dialog" aria-modal="true" aria-hidden={!on}>
        {abierto && children}
      </div>
    </>
  )
}
