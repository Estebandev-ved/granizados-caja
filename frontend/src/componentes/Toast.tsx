import { useCallback, useRef, useState } from 'react'

export interface AccionToast {
  texto: string
  alTocar: () => void
}

export function useToast() {
  const [mensaje, setMensaje] = useState('')
  const [accion, setAccion] = useState<AccionToast | null>(null)
  const [visible, setVisible] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  /** Con `accion` (ej. "Deshacer") el aviso dura más y se puede tocar el botón. */
  const avisar = useCallback((m: string, accion?: AccionToast) => {
    setMensaje(m)
    setAccion(accion ?? null)
    setVisible(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setVisible(false), accion ? 5000 : 1600)
  }, [])

  const toast = (
    <div className={'toast' + (visible ? ' on' : '') + (accion ? ' con-accion' : '')} role="status">
      {mensaje}
      {accion && (
        <button className="toast-accion" tabIndex={visible ? 0 : -1}
          onClick={() => { setVisible(false); accion.alTocar() }}>{accion.texto}</button>
      )}
    </div>
  )
  return { avisar, toast }
}
