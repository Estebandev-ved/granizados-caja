import { useState } from 'react'
import type { FrecuenciaPago } from '../tipos'

const OPCIONES: { valor: FrecuenciaPago; titulo: string; detalle: string }[] = [
  { valor: 'DIARIO', titulo: 'Cada día', detalle: 'Al terminar tu día. Lo que ganas se descuenta del efectivo que entregas.' },
  { valor: 'SEMANAL', titulo: 'Cada semana', detalle: 'Se suma lo de la semana y te pagamos todo junto.' },
  { valor: 'QUINCENAL', titulo: 'Cada quincena', detalle: 'Se junta lo de 15 días y te pagamos de una vez.' },
]

/** El trabajador escoge cada cuánto prefiere cobrar. Sale al entrar la primera vez y se puede cambiar desde Mi día. */
export function PagoPreferido({ actual, onElegir }: { actual: FrecuenciaPago | null; onElegir: (f: FrecuenciaPago) => Promise<void> }) {
  const [guardando, setGuardando] = useState<FrecuenciaPago | null>(null)

  const elegir = async (f: FrecuenciaPago) => {
    if (guardando) return
    setGuardando(f)
    try {
      await onElegir(f)
    } finally {
      setGuardando(null)
    }
  }

  return (
    <div className="terminos">
      <h2>¿Cómo prefieres que te paguemos?</h2>
      <p className="mut">Escoge lo que más te sirva. Lo puedes cambiar después hablando con el dueño.</p>
      <div className="pago-opciones">
        {OPCIONES.map(o => (
          <button key={o.valor} type="button" className={'pago-opcion' + (actual === o.valor ? ' on' : '')}
            disabled={!!guardando} onClick={() => void elegir(o.valor)}>
            <b>{guardando === o.valor ? 'Guardando…' : o.titulo}</b>
            <span>{o.detalle}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
