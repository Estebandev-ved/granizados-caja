import { useEffect, useRef, useState } from 'react'

/** Número que sube o baja con suavidad (cuenta de un valor al otro). Sin animación si el celular pide menos movimiento. */
export function NumeroAnimado({ valor, formato }: { valor: number; formato: (n: number) => string }) {
  const [mostrado, setMostrado] = useState(valor)
  const actual = useRef(valor)

  useEffect(() => {
    const desde = actual.current
    if (desde === valor) return
    const quieto = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const inicio = performance.now()
    const duracion = quieto ? 0 : 450
    let id = 0
    const paso = (ahora: number) => {
      const t = duracion === 0 ? 1 : Math.min(1, (ahora - inicio) / duracion)
      const suave = 1 - Math.pow(1 - t, 3)
      const n = Math.round(desde + (valor - desde) * suave)
      actual.current = n
      setMostrado(n)
      if (t < 1) id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [valor])

  return <>{formato(mostrado)}</>
}
