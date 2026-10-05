import { useMemo, useRef, useState } from 'react'
import { Icono } from '../componentes/Icono'
import { ConsejoNova } from '../componentes/ConsejoNova'
import { Personaje } from '../componentes/Personaje'
import { PedidoEnCamino } from '../componentes/PedidoEnCamino'
import { ResumenInventario } from '../componentes/ResumenInventario'
import { Sheet } from '../componentes/Sheet'
import { TarjetaProducto } from '../componentes/TarjetaProducto'
import { vibrar } from '../formato'
import type { LineaPedido, LugarPlata, MotivoMerma, Producto, Tipo, PedidoEnCamino as PedidoEnCaminoDto } from '../tipos'

type Modo = 'sumar' | 'contar' | 'merma'

const ETIQUETA: Record<Modo, string> = { sumar: 'Sumar', contar: 'Contar', merma: 'Merma' }
const ETIQUETA_TIPO: Record<Tipo, string> = { NORMAL: 'Normal', CREMOSO: 'Cremoso', GRANDE: 'Grande' }

const MOTIVOS: { valor: MotivoMerma; texto: string }[] = [
  { valor: 'DANADO', texto: 'Dañado' },
  { valor: 'REGALADO', texto: 'Regalado' },
  { valor: 'VENCIDO', texto: 'Vencido' },
]

type Resultado = { modo: Modo; cantidad: number; real: number; motivo: MotivoMerma | null }

interface Props {
  productos: Producto[]
  pedido: PedidoEnCaminoDto | null
  onReponer: (p: Producto, cantidad: number) => void
  onContar: (p: Producto, real: number) => void
  onContarTodo: (productos: Producto[], reales: Readonly<Record<number, number>>) => void
  onMerma: (p: Producto, cantidad: number, motivo: MotivoMerma) => void
  onLlego: (pedidoId: number, items: LineaPedido[], pagoLugar?: LugarPlata) => void
  onCancelar: (pedidoId: number) => Promise<boolean>
  avisar: (m: string) => void
}

/** Inventario: sumar lo que llegó, contar lo que hay y anotar mermas. Todo funciona sin señal. */
export function Inventario({ productos, pedido, onReponer, onContar, onContarTodo, onMerma, onLlego, onCancelar,
  avisar }: Props) {
  const [elegido, setElegido] = useState<Producto | null>(null)
  const [contando, setContando] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const listo = (r: Resultado) => {
    const p = elegido
    setElegido(null)
    if (!p) return
    if (r.modo === 'sumar') onReponer(p, r.cantidad)
    else if (r.modo === 'contar') onContar(p, r.real)
    else if (r.motivo) onMerma(p, r.cantidad, r.motivo)
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return q ? productos.filter(p => p.nombre.toLowerCase().includes(q)) : productos
  }, [productos, busqueda])

  const grupos = useMemo(() => {
    const tipos: Tipo[] = ['NORMAL', 'CREMOSO', 'GRANDE']
    return tipos
      .map(t => ({ tipo: t, items: filtrados.filter(p => p.tipo === t) }))
      .filter(g => g.items.length > 0)
  }, [filtrados])

  const critico = productos.filter(p => p.stock <= p.stockMinimo).length

  return (
    <section>
      {pedido && <PedidoEnCamino pedido={pedido} onLlego={onLlego} onCancelar={onCancelar} avisar={avisar} />}

      {critico > 0 && (
        <div className="aviso-stock">
          <Icono nombre="alerta" />
          <span>{critico} sabor{critico === 1 ? '' : 'es'} con poco stock</span>
        </div>
      )}

      {critico === 0 && productos.length > 0 && (
        <ConsejoNova clave="inventario-surtido" personaje="sofia">Todo surtido: ningún sabor está bajo el mínimo 🙌</ConsejoNova>
      )}

      <ResumenInventario productos={productos} />

      <div className="buscador">
        <Icono nombre="buscar" />
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar sabor…" />
      </div>

      <div className="modo">Toca un sabor para sumar, contar o anotar una merma</div>

      {grupos.length > 1 ? grupos.map(g => (
        <div key={g.tipo} className="seccion-grupo">
          <div className="grupo-titulo"><Icono nombre="vaso" /> {ETIQUETA_TIPO[g.tipo]}<span className="mut">{g.items.length}</span></div>
          <div className="grid">
            {g.items.map(p => <TarjetaProducto key={p.id} p={p} onClick={() => setElegido(p)} />)}
          </div>
        </div>
      )) : (
        <div className="grid">
          {filtrados.map(p => <TarjetaProducto key={p.id} p={p} onClick={() => setElegido(p)} />)}
        </div>
      )}
      {!filtrados.length && (
        <div className="vacio">
          <Personaje nombre="vacio-pedidos" />
          {productos.length ? 'Nada con ese nombre' : 'Aún no tienes sabores. Agrégalos en Ajustes'}
        </div>
      )}

      <div className="acciones" style={{ marginTop: 12 }}>
        <button className="big ghost" onClick={() => setContando(true)}>Contar todo</button>
      </div>

      <Sheet abierto={!!elegido} onCerrar={() => setElegido(null)}>
        {elegido && <PanelMovimiento p={elegido} onListo={listo} />}
      </Sheet>

      <Sheet abierto={contando} onCerrar={() => setContando(false)}>
        {contando && <PanelContarTodo productos={productos} onGuardar={reales => {
          setContando(false)
          onContarTodo(productos, reales)
        }} />}
      </Sheet>
    </section>
  )
}

function PanelMovimiento({ p, onListo }: { p: Producto; onListo: (r: Resultado) => void }) {
  const [modo, setModo] = useState<Modo>('sumar')
  const [cantidad, setCantidad] = useState(0)
  const [real, setReal] = useState(p.stock)
  const [motivo, setMotivo] = useState<MotivoMerma | null>(null)
  const hecho = useRef(false) // un doble toque no puede meter dos movimientos

  const guardar = () => {
    if (hecho.current) return
    if (modo === 'sumar' && !cantidad) return
    if (modo === 'merma' && (!cantidad || !motivo)) return
    hecho.current = true
    vibrar()
    onListo({ modo, cantidad, real, motivo })
  }

  const delta = real - p.stock
  return (
    <>
      <h2>{p.nombre}</h2>
      <div className="segmento">
        {(Object.keys(ETIQUETA) as Modo[]).map(m => (
          <button key={m} className={modo === m ? 'on' : ''} onClick={() => setModo(m)}>{ETIQUETA[m]}</button>
        ))}
      </div>

      {modo === 'sumar' && (
        <>
          <p>Stock actual {p.stock} → queda en <b>{p.stock + cantidad}</b></p>
          <div className="chips">
            {[1, 5, 10].map(n => <button key={n} onClick={() => setCantidad(c => Math.min(1000, c + n))}>+{n}</button>)}
            <button onClick={() => setCantidad(0)}>0</button>
          </div>
          <Stepper valor={cantidad} onCambio={setCantidad} />
          <button className="big primario" disabled={!cantidad} onClick={guardar}>
            Sumar {cantidad} unidad{cantidad === 1 ? '' : 'es'}
          </button>
        </>
      )}

      {modo === 'contar' && (
        <>
          <p>
            Lo que dice la app: <b>{p.stock}</b> · Lo que hay en el anaquel:{' '}
            <b className={delta < 0 ? 'aviso' : ''}>{real}</b>
          </p>
          <Stepper valor={real} onCambio={setReal} min={0} max={1000} />
          <p className="mut">{delta === 0 ? 'Ya cuadraba' : delta > 0 ? `Sobraban ${delta}` : `Faltaban ${-delta}`}</p>
          <button className="big primario" onClick={guardar}>
            {delta === 0 ? 'Dejar cuadrado' : 'Guardar conteo'}
          </button>
        </>
      )}

      {modo === 'merma' && (
        <>
          <p>Se pierden unidades de <b>{p.nombre}</b>. Stock {p.stock} → queda en <b>{Math.max(0, p.stock - cantidad)}</b>.</p>
          <div className="chips">
            {MOTIVOS.map(m => (
              <button key={m.valor} className={motivo === m.valor ? 'on' : ''} onClick={() => setMotivo(m.valor)}>{m.texto}</button>
            ))}
          </div>
          <div className="chips">
            {[1, 5, 10].map(n => <button key={n} onClick={() => setCantidad(c => Math.min(1000, c + n))}>+{n}</button>)}
            <button onClick={() => setCantidad(0)}>0</button>
          </div>
          <Stepper valor={cantidad} onCambio={setCantidad} />
          <button className="big rojo" disabled={!cantidad || !motivo} onClick={guardar}>
            Anotar merma de {cantidad} unidad{cantidad === 1 ? '' : 'es'}
          </button>
        </>
      )}
    </>
  )
}

function Stepper({ valor, onCambio, min = 0, max = 1000 }: { valor: number; onCambio: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="qty">
      <button aria-label="Menos" onClick={() => onCambio(Math.max(min, valor - 1))}>−</button>
      <span>{valor}</span>
      <button aria-label="Más" onClick={() => onCambio(Math.min(max, valor + 1))}>+</button>
    </div>
  )
}

function PanelContarTodo({ productos, onGuardar }: { productos: Producto[]; onGuardar: (r: Readonly<Record<number, number>>) => void }) {
  const [valores, setValores] = useState<Record<number, number>>(
    () => Object.fromEntries(productos.map(p => [p.id, p.stock])))
  const hecho = useRef(false)

  const cambiados = productos.filter(p => valores[p.id] !== p.stock).length
  const guardar = () => {
    if (hecho.current) return
    hecho.current = true
    vibrar()
    onGuardar(valores)
  }

  return (
    <>
      <h2>Contar todo</h2>
      <p>Pon lo que hay en el anaquel sabor por sabor. Se guarda de una sola vez.</p>
      <div className="list pedido-lista">
        {productos.map(p => (
          <div className="row" key={p.id}>
            <span>{p.nombre}<br /><small className="mut">decía {p.stock}</small></span>
            <span className="mini">
              <button aria-label={'Menos ' + p.nombre} onClick={() => setValores(v => ({ ...v, [p.id]: Math.max(0, (v[p.id] ?? 0) - 1) }))}>−</button>
              <b className={valores[p.id] !== p.stock ? 'aviso' : ''}>{valores[p.id]}</b>
              <button aria-label={'Más ' + p.nombre} onClick={() => setValores(v => ({ ...v, [p.id]: Math.min(1000, (v[p.id] ?? 0) + 1) }))}>+</button>
            </span>
          </div>
        ))}
      </div>
      <button className="big primario" onClick={guardar}>
        Guardar conteo · {productos.length} sabor{productos.length === 1 ? '' : 'es'}
        {cambiados ? ` · ${cambiados} cambió${cambiados === 1 ? '' : 'ron'}` : ''}
      </button>
    </>
  )
}
