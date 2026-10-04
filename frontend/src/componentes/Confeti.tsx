import { useEffect, useRef } from 'react'

const COLORES = ['#e53935', '#ff6b6b', '#c62828', '#f9a825', '#4ade80', '#1a1a1a']

/**
 * Confeti en un solo canvas, sin librería: ~90 rectángulos cayendo y ya.
 * Se apaga solo cuando se cumple la meta.
 */
export function Confeti({ duracion = 1800 }: { duracion?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const lienzo = ref.current
    const ctx = lienzo?.getContext('2d')
    if (!lienzo || !ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const ancho = lienzo.clientWidth
    const alto = lienzo.clientHeight
    lienzo.width = ancho * dpr
    lienzo.height = alto * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const trozos = Array.from({ length: 90 }, () => ({
      x: Math.random() * ancho,
      y: -20 - Math.random() * alto * 0.7,
      w: 5 + Math.random() * 5,
      h: 8 + Math.random() * 7,
      cae: 1.6 + Math.random() * 2.6,
      corre: (Math.random() - 0.5) * 1.4,
      gira: Math.random() * Math.PI,
      giro: (Math.random() - 0.5) * 0.3,
      color: COLORES[Math.floor(Math.random() * COLORES.length)],
    }))

    let vivo = true
    let cuadros = 0
    const pintar = () => {
      if (!vivo) return
      cuadros++
      ctx.clearRect(0, 0, ancho, alto)
      for (const t of trozos) {
        t.y += t.cae
        t.x += t.corre
        t.gira += t.giro
        if (t.y > alto + 24) {
          t.y = -20
          t.x = Math.random() * ancho
        }
        ctx.save()
        ctx.translate(t.x, t.y)
        ctx.rotate(t.gira)
        ctx.fillStyle = t.color
        ctx.fillRect(-t.w / 2, -t.h / 2, t.w, t.h)
        ctx.restore()
      }
      if (cuadros * 16 < duracion) requestAnimationFrame(pintar)
      else ctx.clearRect(0, 0, ancho, alto)
    }
    requestAnimationFrame(pintar)

    return () => {
      vivo = false
      ctx.clearRect(0, 0, ancho, alto)
    }
  }, [duracion])

  return <canvas ref={ref} className="confeti" aria-hidden="true" />
}
