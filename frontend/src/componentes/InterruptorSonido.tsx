import { useState } from 'react'
import { prenderSonido, sonidoPrendido, sonidoVenta } from '../sonido'

/** Prende o apaga el sonido alegre de cada venta en este celular. Al prenderlo suena una vez para probarlo. */
export function InterruptorSonido() {
  const [prendido, setPrendido] = useState(() => sonidoPrendido())

  const cambiar = () => {
    const nuevo = !prendido
    prenderSonido(nuevo)
    setPrendido(nuevo)
    if (nuevo) sonidoVenta()
  }

  return (
    <button className="big ghost" onClick={cambiar} aria-pressed={prendido}>
      {prendido ? '🔔 Sonido de ventas: prendido' : '🔕 Sonido de ventas: apagado'}
    </button>
  )
}
