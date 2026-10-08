import { useState } from 'react'
import type { Carga } from '../carga'
import { vibrar } from '../formato'
import type { Producto, Tipo } from '../tipos'

const TIPOS: { tipo: Tipo; titulo: string }[] = [
  { tipo: 'NORMAL', titulo: 'Normales' }, { tipo: 'CREMOSO', titulo: 'Cremosos' }, { tipo: 'GRANDE', titulo: 'Grandes' },
]

interface Props {
  productos: Producto[]
  /** Lo que ya llevabas hoy, si ya habías armado la carga. */
  actual: Carga | null
  onGuardar: (llevo: Record<number, number>) => void
  onLimpiar: () => void
}

/** Cuántos de cada sabor sacas hoy para vender, por secciones (normal, cremoso, grande). */
export function CargaDelDia({ productos, actual, onGuardar, onLimpiar }: Props) {
  const [llevo, setLlevo] = useState<Record<number, number>>(() =>
    Object.fromEntries(productos.map(p => [p.id, actual?.items[p.id]?.llevo ?? 0])))

  const cambiar = (p: Producto, delta: number) => {
    vibrar()
    setLlevo(l => ({ ...l, [p.id]: Math.min(99, Math.max(0, (l[p.id] ?? 0) + delta)) }))
  }

  const total = Object.values(llevo).reduce((a, n) => a + n, 0)

  return (
    <>
      <h2>Lo que llevo hoy</h2>
      <p>Anota cuántos de cada sabor sacas para vender. En Vender te va mostrando cuántos te quedan.</p>

      <div className="carga-lista">
        {TIPOS.map(({ tipo, titulo }) => {
          const items = productos.filter(p => p.tipo === tipo)
          if (!items.length) return null
          return (
            <div className="list" key={tipo}>
              <h3>{titulo}</h3>
              {items.map(p => (
                <div className="carga-fila" key={p.id}>
                  <div className="sabor-info">
                    <b>{p.sabor}</b>
                    <div className="sabor-pie"><span className="mut">en casa {p.stock}</span></div>
                  </div>
                  <div className="carga-paso">
                    <button type="button" aria-label={'Menos ' + p.sabor} onClick={() => cambiar(p, -1)}>−</button>
                    <span className={llevo[p.id] ? 'on' : ''}>{llevo[p.id] ?? 0}</span>
                    <button type="button" aria-label={'Más ' + p.sabor} onClick={() => cambiar(p, 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <div className="acciones">
        <button className="big primario" onClick={() => onGuardar(llevo)} disabled={total === 0}>
          Guardar · {total} {total === 1 ? 'granizado' : 'granizados'}
        </button>
        {actual && <button className="big ghost" onClick={onLimpiar}>Quitar la carga de hoy</button>}
      </div>
    </>
  )
}
