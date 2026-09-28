import { pesos } from '../formato'
import type { Producto } from '../tipos'

// Paleta de degradados "dopamina": todos en la misma familia morado/fucsia/neón,
// para que cada sabor se distinga sin salirse del tema.
const PALETA: [string, string][] = [
  ['#9d4dff', '#ff3db8'], // morado -> fucsia (grad por defecto)
  ['#ff3db8', '#ff6a4d'], // fucsia -> naranja neón
  ['#4d7bff', '#9d4dff'], // azul -> morado
  ['#22c55e', '#4dffb8'], // verde -> menta
  ['#ffb020', '#ff3db8'], // ámbar -> fucsia
  ['#4dd6ff', '#9d4dff'], // cian -> morado
]

function colorSabor(sabor: string): string {
  let h = 0
  for (let i = 0; i < sabor.length; i++) h = (h * 31 + sabor.charCodeAt(i)) >>> 0
  const [a, b] = PALETA[h % PALETA.length]
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`
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
