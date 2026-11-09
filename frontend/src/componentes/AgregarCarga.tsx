import { useState } from 'react'
import { vibrar } from '../formato'
import { Unidades } from './Unidades'
import type { Producto, Trabajador } from '../tipos'

/** Sumarle más granizados a un trabajador a mitad del día. Lo que ya llevaba y lo que ya vendió no se toca. */
export function AgregarCarga({ trabajador, productos, onGuardar }: {
  trabajador: Trabajador
  productos: Producto[]
  onGuardar: (items: { productoId: number; llevo: number }[]) => Promise<void>
}) {
  const [extra, setExtra] = useState<Record<number, number>>({})
  const [enviando, setEnviando] = useState(false)
  const llevaHoy = new Map(trabajador.carga.map(f => [f.productoId, f]))
  const total = Object.values(extra).reduce((a, n) => a + n, 0)

  const cambiar = (p: Producto, delta: number) => {
    vibrar()
    setExtra(e => ({ ...e, [p.id]: Math.min(99, Math.max(0, (e[p.id] ?? 0) + delta)) }))
  }

  const guardar = async () => {
    if (!total || enviando) return
    setEnviando(true)
    try {
      await onGuardar(Object.entries(extra).filter(([, n]) => n > 0).map(([id, n]) => ({ productoId: Number(id), llevo: n })))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <h2>Agregarle carga a {trabajador.nombre}</h2>
      <p>Cuántos más le entregas ahora. Se suman a lo que ya sacó hoy; lo que ya vendió se conserva.</p>
      <div className="list">
        {productos.map(p => {
          const f = llevaHoy.get(p.id)
          return (
            <div className="carga-fila" key={p.id}>
              <div className="sabor-info">
                <b>{p.sabor}</b>
                <div className="sabor-pie">
                  <span className="mut">{f ? 'le quedan ' + f.queda + ' · ' : ''}en casa {p.stock}</span>
                </div>
              </div>
              <div className="carga-paso">
                <button type="button" aria-label={'Menos ' + p.sabor} onClick={() => cambiar(p, -1)}>−</button>
                <span className={extra[p.id] ? 'on' : ''}>{extra[p.id] ?? 0}</span>
                <button type="button" aria-label={'Más ' + p.sabor} onClick={() => cambiar(p, 1)}>+</button>
              </div>
            </div>
          )
        })}
      </div>
      <div className="acciones">
        <button className="big primario" disabled={!total || enviando} onClick={() => void guardar()}>
          {enviando ? 'Guardando…' : total ? <>Agregar <Unidades n={total} /></> : 'Escoge cuántos'}
        </button>
      </div>
    </>
  )
}
