import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { api, type ArqueoHoy } from '../api'
import dopaGuino from '../assets/dopa-guino.png'
import { PedidoEnCamino } from '../componentes/PedidoEnCamino'
import { Sheet } from '../componentes/Sheet'
import { pesos, vibrar } from '../formato'
import type { CategoriaGasto, Estado, LineaPedido, PedidoSugerido, VentaReciente } from '../tipos'

interface Props {
  estado: Estado
  onDeshacer: (v: VentaReciente) => Promise<void>
  onRecargar: () => Promise<void>
  onLlego: (pedidoId: number, items: LineaPedido[]) => void
  onCancelar: (pedidoId: number) => Promise<boolean>
  onGasto: (categoria: CategoriaGasto, concepto: string, monto: number) => void
  onCerrarCaja: (contado: number, nota: string) => void
  avisar: (m: string) => void
}

type Panel =
  | { tipo: 'pedido'; sugerido: PedidoSugerido | null; error?: boolean; cantidades: Record<number, number>; enviando: boolean; aviso?: string }
  | { tipo: 'deshacer'; venta: VentaReciente }
  | { tipo: 'gasto'; categoria: CategoriaGasto; monto: string; concepto: string }
  | { tipo: 'cierre'; contado: string; nota: string; cargando: boolean; guardado: ArqueoHoy | null; sinSenal: boolean }

const CATEGORIAS: { valor: CategoriaGasto; texto: string }[] = [
  { valor: 'HIELO', texto: 'Hielo' },
  { valor: 'TRANSPORTE', texto: 'Transporte' },
  { valor: 'EMPAQUE', texto: 'Empaque' },
  { valor: 'OTRO', texto: 'Otro' },
]

export function Hoy({ estado, onDeshacer, onRecargar, onLlego, onCancelar, onGasto, onCerrarCaja, avisar }: Props) {
  const [panel, setPanel] = useState<Panel | null>(null)
  const h = estado.hoy
  const faltaCosto = estado.productos.some(p => p.costo === 0)

  const abrirPedido = async () => {
    setPanel({ tipo: 'pedido', sugerido: null, cantidades: {}, enviando: false })
    try {
      const sugerido = await api.pedido()
      setPanel(p => (p?.tipo === 'pedido'
        ? { ...p, sugerido, cantidades: Object.fromEntries(sugerido.items.map(i => [i.productoId, i.pedir])) }
        : p))
    } catch {
      setPanel(p => (p?.tipo === 'pedido' ? { ...p, error: true } : p))
    }
  }

  const pedirDeshacer = () => {
    const ultima = estado.ultimas[0]
    if (!ultima) avisar('No hay ventas para deshacer')
    else setPanel({ tipo: 'deshacer', venta: ultima })
  }

  /** Antes de contar mira si la caja ya se cerró hoy, para corregirla en vez de duplicarla. */
  const abrirCierre = () => {
    setPanel({ tipo: 'cierre', contado: '', nota: '', cargando: true, guardado: null, sinSenal: false })
    api.cierreHoy()
      .then(g => setPanel(p => (p?.tipo === 'cierre'
        ? { ...p, cargando: false, guardado: g, contado: g ? String(g.contado) : '', nota: g?.nota ?? '' }
        : p)))
      .catch(() => setPanel(p => (p?.tipo === 'cierre' ? { ...p, cargando: false, sinSenal: true } : p)))
  }

  return (
    <section>
      {estado.pedido && (
        <PedidoEnCamino pedido={estado.pedido} onLlego={onLlego} onCancelar={onCancelar} avisar={avisar} />
      )}

      <div className="cards">
        <div className="card full">
          <div className="k">Vendido hoy</div>
          <div className="v">{pesos(h.total)}</div>
        </div>
        <div className="card full ganancia">
          <div className="k">Ganancia</div>
          <div className="v">{pesos(h.ganancia)}</div>
          <div className="desglose">
            <span>producto {pesos(h.costo)}</span>
            {h.gastos > 0 && <span>gastos {pesos(h.gastos)}</span>}
            {h.mermas > 0 && <span>mermas {pesos(h.mermas)}</span>}
          </div>
        </div>
        <div className="card">
          <div className="k">Granizados</div>
          <div className="v">{h.unidades}</div>
        </div>
        <div className="card">
          <div className="k">Ticket promedio</div>
          <div className="v">{pesos(h.unidades ? Math.round(h.total / h.unidades) : 0)}</div>
        </div>
      </div>

      {faltaCosto && h.unidades > 0 && (
        <p className="aviso">Pon el costo de tus sabores en Ajustes para saber cuánto ganas de verdad.</p>
      )}

      {h.total > 0 && (
        <div className="list">
          <h3>Nequi vs efectivo</h3>
          <div className="canal">
            <div className="canal-barra"><span style={{ width: (h.total ? Math.round(h.nequi / h.total * 100) : 0) + '%' }} /></div>
            <div className="canal-leyenda">
              <span>Nequi {pesos(h.nequi)}</span>
              <span className="mut">Efectivo {pesos(h.efectivo)}</span>
            </div>
          </div>
        </div>
      )}

      {h.porSabor.length > 0 && (
        <div className="list">
          <h3>Sabores más pedidos</h3>
          {[...h.porSabor].sort((a, b) => b.unidades - a.unidades).map((s, i) => (
            <div className="row" key={s.sabor}>
              <span><b className="rank">{i + 1}</b> {s.sabor}</span>
              <b>{s.unidades}</b>
            </div>
          ))}
        </div>
      )}

      {estado.ultimas.length ? (
        <div className="list">
          <h3>Últimas ventas</h3>
          {estado.ultimas.map(u => (
            <div className="row" key={u.clientUid}>
              <span>{u.hora} · {u.sabor}{u.pendiente && <span className="pend-tag" title="Sin subir">⏳</span>}</span>
              <span>{pesos(u.total)}<span className={'tag ' + (u.metodo === 'EFECTIVO' ? 'e' : 'n')}>{u.metodo === 'EFECTIVO' ? 'EF' : 'NQ'}</span></span>
            </div>
          ))}
        </div>
      ) : <div className="vacio"><img src={dopaGuino} alt="" className="vacio-mascota" />Aún no hay ventas hoy</div>}

      <div className="acciones">
        <button className="big primario" onClick={() => void abrirPedido()}>Armar pedido al proveedor</button>
        <button className="big ghost" onClick={() => setPanel({ tipo: 'gasto', categoria: 'HIELO', monto: '', concepto: '' })}>
          Registrar gasto
        </button>
        <button className="big ghost" onClick={abrirCierre}>Cerrar caja</button>
        <button className="big ghost" onClick={pedirDeshacer}>Deshacer última venta</button>
        <button className="big ghost" onClick={() => { avisar('Recargando…'); void onRecargar() }}>Recargar datos</button>
      </div>

      <Sheet abierto={!!panel} onCerrar={() => setPanel(null)}>
        {panel?.tipo === 'pedido' && (
          <PanelPedido
            sugerido={panel.sugerido}
            error={panel.error}
            aviso={panel.aviso}
            cantidades={panel.cantidades}
            enviando={panel.enviando}
            onCantidad={(id, n) => setPanel(p => (p?.tipo === 'pedido' ? { ...p, cantidades: { ...p.cantidades, [id]: n } } : p))}
            onEnviar={() => {
              if (panel.enviando) return
              enviar(panel, setPanel, avisar, onRecargar)
            }}
          />
        )}
        {panel?.tipo === 'gasto' && (
          <PanelGasto onGuardar={(categoria, concepto, monto) => {
            setPanel(null)
            vibrar()
            onGasto(categoria, concepto, monto)
            avisar('✓ Gasto de ' + pesos(monto) + ' anotado')
          }} />
        )}
        {panel?.tipo === 'cierre' && (
          <PanelCierre esperado={estado.hoy.efectivo} contado={panel.contado} nota={panel.nota}
            cargando={panel.cargando} guardado={panel.guardado} sinSenal={panel.sinSenal}
            onCambio={cambio => setPanel(p => (p?.tipo === 'cierre' ? { ...p, ...cambio } : p))}
            onGuardar={(contado, nota) => {
              setPanel(null)
              vibrar()
              onCerrarCaja(contado, nota)
              avisar('✓ Caja cerrada · ' + resumenCierre(estado.hoy.efectivo, contado))
            }} />
        )}
        {panel?.tipo === 'deshacer' && (
          <>
            <h2>¿Deshacer?</h2>
            <p>{panel.venta.sabor} · {pesos(panel.venta.total)} · {panel.venta.hora}</p>
            <div className="pay">
              <button className="big ghost" onClick={() => setPanel(null)}>Cancelar</button>
              <button className="big rojo" onClick={() => { setPanel(null); void onDeshacer(panel.venta) }}>Deshacer</button>
            </div>
          </>
        )}
      </Sheet>
    </section>
  )
}

/** Arma el pedido con las cantidades editadas, lo registra y abre WhatsApp. Necesita señal. */
async function enviar(
  panel: Extract<Panel, { tipo: 'pedido' }>,
  setPanel: Dispatch<SetStateAction<Panel | null>>,
  avisar: (m: string) => void,
  onRecargar: () => Promise<void>,
) {
  const sugerido = panel.sugerido
  if (!sugerido) return
  const lineas = sugerido.items
    .map(i => ({ productoId: i.productoId, cantidad: panel.cantidades[i.productoId] ?? 0 }))
    .filter(l => l.cantidad > 0)
  if (!lineas.length) {
    avisar('Sube al menos un sabor')
    return
  }

  setPanel({ ...panel, enviando: true, aviso: undefined })
  vibrar()
  try {
    const creado = await api.crearPedido(lineas)
    if (creado.link) window.open(creado.link, '_blank', 'noopener')
    setPanel(null)
    avisar('✓ Pedido de ' + creado.totalUnidades + ' unidades armado')
    await onRecargar()
  } catch {
    avisar('⚠️ No se pudo enviar, revisa la señal')
    setPanel(p => (p?.tipo === 'pedido' ? { ...p, enviando: false, aviso: 'No se pudo guardar el pedido. Revisa la señal.' } : p))
  }
}

function PanelPedido({ sugerido, error, aviso, cantidades, enviando, onCantidad, onEnviar }: {
  sugerido: PedidoSugerido | null
  error?: boolean
  aviso?: string
  cantidades: Record<number, number>
  enviando: boolean
  onCantidad: (productoId: number, cantidad: number) => void
  onEnviar: () => void
}) {
  if (error) return <><h2>Sin conexión</h2><p>El pedido se calcula en el servidor. Intenta cuando tengas señal.</p></>
  if (!sugerido) return <><h2>Pedido sugerido</h2><p>Calculando con tus ventas…</p></>
  if (!sugerido.items.length) return <><h2>Pedido sugerido</h2><p>Tienes stock suficiente. No hace falta pedir 🙌</p></>

  const total = sugerido.items.reduce((a, i) => a + (cantidades[i.productoId] ?? 0), 0)
  const costo = sugerido.items.reduce((a, i) => a + (cantidades[i.productoId] ?? 0) * i.costo, 0)
  return (
    <>
      <h2>Armar pedido</h2>
      <p>Edita lo que quieres pedir. Se arma en el servidor y abre WhatsApp.</p>
      <div className="list pedido-lista">
        {sugerido.items.map(i => (
          <div className="row" key={i.productoId}>
            <span>{i.sabor}<br /><small className="mut">{i.promedioDia}/día · sugiere {i.pedir}</small></span>
            <span className="mini">
              <button aria-label={'Menos ' + i.sabor} onClick={() => onCantidad(i.productoId, Math.max(0, (cantidades[i.productoId] ?? 0) - 1))}>−</button>
              <b className={(cantidades[i.productoId] ?? 0) !== i.pedir ? 'aviso' : ''}>{cantidades[i.productoId] ?? 0}</b>
              <button aria-label={'Más ' + i.sabor} onClick={() => onCantidad(i.productoId, Math.min(1000, (cantidades[i.productoId] ?? 0) + 1))}>+</button>
            </span>
          </div>
        ))}
      </div>
      {aviso && <p className="aviso">{aviso}</p>}
      {costo > 0 && <p className="mut">Vas a pagarle {pesos(costo)} a Energy Cocktails.</p>}
      <button className="big primario" disabled={!total || enviando} onClick={onEnviar}>
        {enviando ? 'Armando…' : `Enviar por WhatsApp · ${total} unidad${total === 1 ? '' : 'es'}`}
      </button>
      {!sugerido.tieneProveedor && (
        <p className="aviso">Pon el WhatsApp del proveedor en Ajustes para tener el botón directo.</p>
      )}
    </>
  )
}

/** Qué queda después de contar: cuadró, o cuánto faltó o sobró. */
function resumenCierre(esperado: number, contado: number): string {
  const d = contado - esperado
  if (d === 0) return 'cuadró'
  return (d < 0 ? 'faltaron ' : 'sobraron ') + pesos(Math.abs(d))
}

/** El cierre de caja: cuánto dice la app y cuánto había de verdad. Va a la cola. */
function PanelCierre({ esperado, contado, nota, cargando, guardado, sinSenal, onCambio, onGuardar }: {
  esperado: number
  contado: string
  nota: string
  cargando: boolean
  guardado: ArqueoHoy | null
  sinSenal: boolean
  onCambio: (cambio: { contado?: string; nota?: string }) => void
  onGuardar: (contado: number, nota: string) => void
}) {
  const n = Number(contado) || 0
  const diferencia = n - esperado
  const sinContar = contado === ''

  return (
    <form onSubmit={e => { e.preventDefault(); if (!sinContar && !cargando) onGuardar(n, nota.trim()) }}>
      <h2>Cerrar caja</h2>
      <p>Según la app, en el cajón debe haber <b>{pesos(esperado)}</b> de efectivo.</p>

      {cargando && <p className="mut">Mirando si ya cerraste hoy…</p>}

      {!cargando && guardado && (
        <p className="ok-dinero">
          ✓ Ya cerraste hoy: contaste {pesos(guardado.contado)} y {resumenCierre(guardado.esperado, guardado.contado)}.
          Cuenta otra vez si quieres corregirlo.
        </p>
      )}

      {!cargando && sinSenal && (
        <p className="aviso">Sin señal no pude ver si ya cerraste. Cuenta y guarda igual: lo que diga la caja.</p>
      )}

      <div className="campo">
        <label htmlFor="cierre-contado">Lo que hay de verdad</label>
        <input id="cierre-contado" inputMode="numeric" placeholder="0" value={contado} disabled={cargando}
          onChange={e => onCambio({ contado: e.target.value.replace(/\D/g, '') })} />
      </div>
      {!sinContar && (
        <p className={diferencia === 0 ? 'ok-dinero' : diferencia < 0 ? 'aviso' : 'mut'}>
          {diferencia === 0
            ? '✓ Cuadró perfecto'
            : (diferencia < 0 ? 'Faltan ' : 'Sobran ') + pesos(Math.abs(diferencia))}
        </p>
      )}
      <div className="campo">
        <label htmlFor="cierre-nota">Nota (opcional)</label>
        <input id="cierre-nota" maxLength={120} value={nota} disabled={cargando}
          onChange={e => onCambio({ nota: e.target.value })} placeholder="Ej: dejé el corte con Dani" />
      </div>
      <button className="big primario" type="submit" disabled={sinContar || cargando}>
        {cargando ? 'Mirando si ya cerraste…' : sinContar ? 'Cuenta el efectivo primero' : 'Cerrar caja'}
      </button>
    </form>
  )
}

/** Gasto del día: monto con teclado numérico y categoría. Va a la cola, así que sirve sin señal. */
function PanelGasto({ onGuardar }: { onGuardar: (categoria: CategoriaGasto, concepto: string, monto: number) => void }) {
  const [categoria, setCategoria] = useState<CategoriaGasto>('HIELO')
  const [monto, setMonto] = useState('')
  const [concepto, setConcepto] = useState('')
  const hecho = useRef(false) // un doble toque no puede meter dos gastos

  const n = Number(monto)
  const guardar = () => {
    if (hecho.current || !n) return
    hecho.current = true
    onGuardar(categoria, concepto.trim(), n)
  }

  return (
    <form onSubmit={e => { e.preventDefault(); guardar() }}>
      <h2>Registrar gasto</h2>
      <p>Lo que gastaste hoy y no es producto: hielo, transporte, empaque…</p>
      <div className="chips">
        {CATEGORIAS.map(c => (
          <button type="button" key={c.valor} className={categoria === c.valor ? 'on' : ''}
            onClick={() => setCategoria(c.valor)}>{c.texto}</button>
        ))}
      </div>
      <div className="campo">
        <label htmlFor="gasto-monto">Monto</label>
        <input id="gasto-monto" inputMode="numeric" autoFocus placeholder="0" value={monto}
          onChange={e => setMonto(e.target.value.replace(/\D/g, ''))} />
      </div>
      <div className="campo">
        <label htmlFor="gasto-concepto">Para qué (opcional)</label>
        <input id="gasto-concepto" maxLength={120} value={concepto}
          onChange={e => setConcepto(e.target.value)} placeholder="Ej: bolsas de hielo" />
      </div>
      <button className="big primario" type="submit" disabled={!n}>
        {n ? 'Guardar gasto de ' + pesos(n) : 'Escribe cuánto gastaste'}
      </button>
    </form>
  )
}
