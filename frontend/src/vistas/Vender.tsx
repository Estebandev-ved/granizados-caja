import { useMemo, useRef, useState } from 'react'
import { Sheet } from '../componentes/Sheet'
import { TarjetaProducto } from '../componentes/TarjetaProducto'
import { pesos, vibrar } from '../formato'
import type { Metodo, Producto, Tipo } from '../tipos'

interface Props {
  productos: Producto[]
  onVender: (p: Producto, metodo: Metodo, cantidad: number) => void
}

type Filtro = 'todos' | Tipo
const ETIQUETA_TIPO: Record<Tipo, string> = { NORMAL: 'Normal', CREMOSO: 'Cremoso', GRANDE: 'Grande' }

export function Vender({ productos, onVender }: Props) {
  const [elegido, setElegido] = useState<Producto | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const tiposPresentes = useMemo(
    () => (Object.keys(ETIQUETA_TIPO) as Tipo[]).filter(t => productos.some(p => p.tipo === t)),
    [productos])

  // Los agotados al final; el resto en el orden de Ajustes
  const orden = [...productos]
    .filter(p => filtro === 'todos' || p.tipo === filtro)
    .sort((a, b) => Number(a.stock <= 0) - Number(b.stock <= 0))

  return (
    <section>
      <div className="modo">Toca un sabor para vender</div>
      {tiposPresentes.length > 1 && (
        <div className="chips categorias">
          <button className={filtro === 'todos' ? 'on' : ''} onClick={() => setFiltro('todos')}>Todos</button>
          {tiposPresentes.map(t => (
            <button key={t} className={filtro === t ? 'on' : ''} onClick={() => setFiltro(t)}>{ETIQUETA_TIPO[t]}</button>
          ))}
        </div>
      )}
      <div className="grid">
        {orden.map(p => <TarjetaProducto key={p.id} p={p} onClick={() => setElegido(p)} />)}
        {!orden.length && <p className="mut" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px 0' }}>Nada por aquí</p>}
      </div>
      <Sheet abierto={!!elegido} onCerrar={() => setElegido(null)}>
        {elegido && (
          <PanelVenta p={elegido} onPagar={(metodo, cantidad) => {
            setElegido(null)
            onVender(elegido, metodo, cantidad)
          }} />
        )}
      </Sheet>
    </section>
  )
}

function PanelVenta({ p, onPagar }: { p: Producto; onPagar: (m: Metodo, cantidad: number) => void }) {
  const [cantidad, setCantidad] = useState(1)
  const [billete, setBillete] = useState<number | null>(null)
  const pagado = useRef(false) // un doble toque en Nequi no puede registrar dos ventas

  const pagar = (m: Metodo) => {
    if (pagado.current) return
    pagado.current = true
    vibrar()
    onPagar(m, cantidad)
  }

  const total = p.precio * cantidad

  return (
    <>
      <h2>{p.nombre}</h2>
      <p className={p.stock - cantidad < 0 ? 'aviso' : ''}>
        {pesos(total)} · {p.stock <= 0 ? 'según el inventario no quedan' : 'quedan ' + p.stock}
      </p>
      <div className="qty">
        <button aria-label="Menos" onClick={() => setCantidad(c => Math.max(1, c - 1))}>−</button>
        <span>{cantidad}</span>
        <button aria-label="Más" onClick={() => setCantidad(c => Math.min(99, c + 1))}>+</button>
      </div>

      <div className="vueltas">
        <button type="button" className="link" onClick={() => setBillete(b => (b === null ? 10000 : null))}>
          {billete === null ? '¿Con cuánto paga?' : 'Ocultar vueltas'}
        </button>
        {billete !== null && (
          <>
            <div className="chips">
              {[10000, 20000, 50000].map(b => (
                <button key={b} type="button" className={billete === b ? 'on' : ''}
                  onClick={() => setBillete(b)}>{pesos(b)}</button>
              ))}
            </div>
            <p className={billete < total ? 'aviso' : 'mut'}>
              {billete < total
                ? 'No alcanza, faltan ' + pesos(total - billete)
                : 'Vueltas: ' + pesos(billete - total)}
            </p>
          </>
        )}
      </div>

      <div className="pay">
        <button className="big nequi" onClick={() => pagar('NEQUI')}>Nequi</button>
        <button className="big cash" onClick={() => pagar('EFECTIVO')}>Efectivo</button>
      </div>
    </>
  )
}
