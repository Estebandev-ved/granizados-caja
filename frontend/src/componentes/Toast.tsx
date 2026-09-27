import { useCallback, useRef, useState } from 'react'

export function useToast() {
  const [mensaje, setMensaje] = useState('')
  const [visible, setVisible] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const avisar = useCallback((m: string) => {
    setMensaje(m)
    setVisible(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setVisible(false), 1600)
  }, [])

  const toast = <div className={'toast' + (visible ? ' on' : '')} role="status">{mensaje}</div>
  return { avisar, toast }
}
