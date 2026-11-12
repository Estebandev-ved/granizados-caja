import { useState } from 'react'
import { DENOMINACIONES, desglose, totalDe, totalPorTipo, type Conteo, type Denominacion } from '../billetes'
import { pesos } from '../formato'

/**
 * «Contar billete por billete»: cuántos hay de cada valor (billetes y monedas) y la app suma.
 * Cada cambio le pasa al campo de arriba el total y el desglose (para la nota del cierre).
 */
export function ContarBilletes({ id, onCambio }: { id: string; onCambio: (total: number, detalle: string) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [conteo, setConteo] = useState<Conteo>({})

  const poner = (clave: string, n: number) => {
    const nuevo = { ...conteo, [clave]: Math.max(0, Math.min(9999, Math.floor(n) || 0)) }
    setConteo(nuevo)
    onCambio(totalDe(nuevo), desglose(nuevo))
  }

  if (!abierto) {
    return (
      <button type="button" className="link billetes-abrir" onClick={() => setAbierto(true)}>
        🧮 Contar billete por billete
      </button>
    )
  }

  const fila = (d: Denominacion) => {
    const n = conteo[d.clave] ?? 0
    return (
      <div className="billete-fila" key={d.clave}>
        <span className={`billete-valor ${d.tipo}`}>{pesos(d.valor)}</span>
        <div className="billete-paso">
          <button type="button" aria-label={`Quitar una de ${pesos(d.valor)}`} disabled={n === 0} onClick={() => poner(d.clave, n - 1)}>−</button>
          <input id={`${id}-${d.clave}`} inputMode="numeric" pattern="[0-9]*" aria-label={`Cuántas de ${pesos(d.valor)}`}
            value={n === 0 ? '' : String(n)} placeholder="0"
            onChange={e => poner(d.clave, Number(e.target.value.replace(/\D/g, '')))} />
          <button type="button" aria-label={`Sumar una de ${pesos(d.valor)}`} onClick={() => poner(d.clave, n + 1)}>+</button>
        </div>
        <span className={`billete-sub ${n ? '' : 'mut'}`}>{pesos(n * d.valor)}</span>
      </div>
    )
  }

  const billetes = totalPorTipo(conteo, 'billete')
  const monedas = totalPorTipo(conteo, 'moneda')
  return (
    <div className="billetes">
      <div className="billetes-tope">
        <b>Billete por billete</b>
        <button type="button" className="link" onClick={() => setAbierto(false)}>Cerrar</button>
      </div>
      <h4>Billetes <span className="mut">{pesos(billetes)}</span></h4>
      {DENOMINACIONES.filter(d => d.tipo === 'billete').map(fila)}
      <h4>Monedas <span className="mut">{pesos(monedas)}</span></h4>
      {DENOMINACIONES.filter(d => d.tipo === 'moneda').map(fila)}
      <div className="billetes-total">
        <span>Total contado</span>
        <b>{pesos(billetes + monedas)}</b>
      </div>
      {billetes + monedas > 0 && (
        <button type="button" className="link" onClick={() => { setConteo({}); onCambio(0, '') }}>Empezar de nuevo</button>
      )}
    </div>
  )
}
