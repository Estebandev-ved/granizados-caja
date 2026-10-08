import { pesos } from '../formato'
import type { Producto } from '../tipos'

// Un color plano por sabor (sin degradado) para que cada tarjeta se distinga
// por identidad propia, no por decoración compartida.
const PALETA: string[] = [
  '#e53935', // rojo NOMA (por defecto)
  '#c62828', // rojo fuerte
  '#4d7bff', // azul
  '#2e7d32', // verde
  '#d98200', // ámbar
  '#00838f', // cian
]

function colorSabor(sabor: string): string {
  let h = 0
  for (let i = 0; i < sabor.length; i++) h = (h * 31 + sabor.charCodeAt(i)) >>> 0
  return PALETA[h % PALETA.length]
}

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
        <IconoTrago color={colorSabor(p.sabor)} />
        <div>
          <b>{p.sabor}</b>
          {p.tipo !== 'NORMAL' && <div className="tipo">{p.tipo.toLowerCase()}</div>}
        </div>
      </div>
      <div className="fila">
        <span className="precio">{pesos(p.precio)}</span>
        <span className={'stock ' + nivel}>{fuera ? '—' : cantidad}</span>
      </div>
      {alcanza && <span className="alcanza">{alcanza}</span>}
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
