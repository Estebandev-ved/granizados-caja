import { pesos } from '../formato'
import type { Producto } from '../tipos'

export function TarjetaProducto({ p, onClick }: { p: Producto; onClick: () => void }) {
  const nivel = p.stock <= 0 ? 'out' : p.stock <= p.stockMinimo ? 'low' : ''
  return (
    <button className="prod" onClick={onClick}>
      <div className="prod-cabeza">
        <IconoTrago />
        <div>
          <b>{p.sabor}</b>
          {p.tipo !== 'NORMAL' && <div className="tipo">{p.tipo.toLowerCase()}</div>}
        </div>
      </div>
      <div className="fila">
        <span className="precio">{pesos(p.precio)}</span>
        <span className={'stock ' + nivel}>{p.stock}</span>
      </div>
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
