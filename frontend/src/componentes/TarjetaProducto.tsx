import { pesos } from '../formato'
import type { Producto } from '../tipos'

// Un color plano por sabor (sin degradado) para que cada tarjeta se distinga
// por identidad propia, no por decoración compartida.
const PALETA: string[] = [
  '#7c5cff', // morado (por defecto)
  '#ff3db8', // fucsia
  '#4d7bff', // azul
  '#22c55e', // verde
  '#ffb020', // ámbar
  '#00b8c4', // cian
]

function colorSabor(sabor: string): string {
  let h = 0
  for (let i = 0; i < sabor.length; i++) h = (h * 31 + sabor.charCodeAt(i)) >>> 0
  return PALETA[h % PALETA.length]
}

export function TarjetaProducto({ p, onClick }: { p: Producto; onClick: () => void }) {
  const nivel = p.stock <= 0 ? 'out' : p.stock <= p.stockMinimo ? 'low' : ''
  return (
    <button className="prod" onClick={onClick}>
      <div className="prod-cabeza">
        <IconoTrago color={colorSabor(p.sabor)} />
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

function IconoTrago({ color }: { color: string }) {
  return (
    <span className="prod-icono" style={{ background: color }} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16l-6.5 8v6h3M13.5 12v6h-3" />
        <path d="M6.5 8h11" />
      </svg>
    </span>
  )
}
