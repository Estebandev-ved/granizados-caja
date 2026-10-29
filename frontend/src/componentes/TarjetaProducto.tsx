import { pesos } from '../formato'
import type { Producto } from '../tipos'

/** `alcanza` (opcional): aviso corto de cuánto dura lo que queda, según el ritmo de venta. */
export function TarjetaProducto({ p, onClick, alcanza, restante }: {
  p: Producto
  onClick: () => void
  alcanza?: string
  /** Lo que te queda de la carga de hoy. `undefined` = no hay carga; `null` = ese sabor no lo llevas hoy. */
  restante?: number | null
}) {
  const conCarga = restante !== undefined
  const fuera = conCarga && restante === null
  const cantidad = conCarga ? (restante ?? 0) : p.stock
  const nivel = conCarga
    ? (cantidad <= 0 ? 'out' : cantidad <= 1 ? 'low' : '')
    : p.stock <= 0 ? 'out' : p.stock <= p.stockMinimo ? 'low' : ''
  return (
    <button className={'prod' + (fuera ? ' fuera' : '')} onClick={onClick}>
      <div className="prod-cabeza">
        <IconoTrago />
        <div>
          <b>{p.sabor}</b>
          {p.tipo !== 'NORMAL' && <div className="tipo">{p.tipo.toLowerCase()}</div>}
        </div>
      </div>
      <div className="fila">
        <span className="precio">{pesos(p.precio)}</span>
        <span className={'stock ' + nivel}>{fuera ? '—' : cantidad <= 0 ? 'Agotado' : cantidad}</span>
      </div>
      {alcanza && <span className="alcanza">{alcanza}</span>}
    </button>
  )
}

function IconoTrago() {
  return (
    <span className="prod-icono" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16l-6.5 8v6h3M13.5 12v6h-3" />
        <path d="M6.5 8h11" />
      </svg>
    </span>
  )
}
