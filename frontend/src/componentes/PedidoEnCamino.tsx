import { useRef, useState } from 'react'
import { vibrar } from '../formato'
import type { LineaPedido, PedidoEnCamino as PedidoEnCaminoDto } from '../tipos'
import { Icono } from './Icono'
import { Sheet } from './Sheet'

interface Props {
  pedido: PedidoEnCaminoDto
  onLlego: (pedidoId: number, items: LineaPedido[]) => void
  onCancelar: (pedidoId: number) => Promise<boolean>
  avisar: (m: string) => void
}

type Panel = 'llego' | 'cancelar' | null

/** Banner de "hay un pedido en camino". Anotar la llegada funciona sin señal. */
export function PedidoEnCamino({ pedido, onLlego, onCancelar, avisar }: Props) {
  const [panel, setPanel] = useState<Panel>(null)
  const [esperando, setEsperando] = useState(false)

  const cancelar = async () => {
    if (esperando) return
    setEsperando(true)
    const listo = await onCancelar(pedido.id)
    setEsperando(false)
    if (listo) {
      setPanel(null)
      avisar('Pedido cancelado')
    }
  }

  return (
    <div className="banner-pedido">
      <div className="txt">
        <b><Icono nombre="caja" /> Pedido en camino</b>
        <small>{pedido.totalUnidades} unidades · todavía no ha llegado</small>
      </div>
      <div className="botones">
        <button className="primario" onClick={() => setPanel('llego')}>Llegó</button>
        <button className="ghost" onClick={() => setPanel('cancelar')} disabled={esperando}>Cancelar</button>
      </div>

      <Sheet abierto={panel !== null} onCerrar={() => setPanel(null)}>
        {panel === 'llego' && (
          <PanelLlego pedido={pedido} onLlego={items => { setPanel(null); onLlego(pedido.id, items) }} />
        )}
        {panel === 'cancelar' && (
          <>
            <h2>¿Cancelar el pedido?</h2>
            <p>{pedido.totalUnidades} unidades que estaban en camino. Ya no aparecerá en la app.</p>
            <div className="pay">
              <button className="big ghost" onClick={() => setPanel(null)}>No, seguirlo</button>
              <button className="big rojo" onClick={() => void cancelar()} disabled={esperando}>
                {esperando ? 'Cancelando…' : 'Cancelar'}
              </button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  )
}

function PanelLlego({ pedido, onLlego }: { pedido: PedidoEnCaminoDto; onLlego: (items: LineaPedido[]) => void }) {
  const [valores, setValores] = useState<Record<number, number>>(
    () => Object.fromEntries(pedido.items.map(i => [i.productoId, i.pedida])))
  const hecho = useRef(false) // un doble toque no puede registrar dos llegadas

  const lineas = pedido.items
    .map(i => ({ productoId: i.productoId, cantidad: valores[i.productoId] ?? 0, pedida: i.pedida }))
    .filter(l => l.cantidad > 0)
  const total = lineas.reduce((a, l) => a + l.cantidad, 0)
  const difieren = pedido.items.some(i => (valores[i.productoId] ?? 0) !== i.pedida)

  const guardar = () => {
    if (hecho.current || !total) return
    hecho.current = true
    vibrar()
    onLlego(lineas.map(l => ({ productoId: l.productoId, cantidad: l.cantidad })))
  }

  const cambiar = (id: number, n: number) => setValores(v => ({ ...v, [id]: Math.max(0, Math.min(1000, n)) }))

  return (
    <>
      <h2>Llegó el pedido</h2>
      <p>Anota lo que llegó. Lo que falte deja lo que estaba pedido.</p>
      <div className="list pedido-lista">
        {pedido.items.map(i => (
          <div className="row" key={i.productoId}>
            <span>{i.sabor}<br /><small className="mut">pidieron {i.pedida}</small></span>
            <span className="mini">
              <button aria-label={'Menos ' + i.sabor}
                onClick={() => cambiar(i.productoId, (valores[i.productoId] ?? 0) - 1)}>−</button>
              <b className={(valores[i.productoId] ?? 0) !== i.pedida ? 'aviso' : ''}>{valores[i.productoId] ?? 0}</b>
              <button aria-label={'Más ' + i.sabor}
                onClick={() => cambiar(i.productoId, (valores[i.productoId] ?? 0) + 1)}>+</button>
            </span>
          </div>
        ))}
      </div>
      {difieren && <p className="mut">Se anotó distinto a lo que se pidió.</p>}
      <button className="big primario" disabled={!total} onClick={guardar}>
        Registrar llegada · {total} unidad{total === 1 ? '' : 'es'}
      </button>
    </>
  )
}
