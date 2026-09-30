import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { api, type ArqueoHoy } from '../api'
import dopaGuino from '../assets/dopa-guino.png'
import { Icono } from '../componentes/Icono'
import { PedidoEnCamino } from '../componentes/PedidoEnCamino'
import { Sheet } from '../componentes/Sheet'
import { pesos, vibrar } from '../formato'
import type { CategoriaGasto, Estado, LineaPedido, LugarPlata, PedidoSugerido, RecomendacionCompra, SaldoPlata, VentaReciente } from '../tipos'

interface Props {
  estado: Estado
  onDeshacer: (v: VentaReciente) => Promise<void>
  onRecargar: () => Promise<void>
  onLlego: (pedidoId: number, items: LineaPedido[], pagoLugar?: LugarPlata) => void
  onCancelar: (pedidoId: number) => Promise<boolean>
  onGasto: (categoria: CategoriaGasto, concepto: string, monto: number) => void
  onCerrarCaja: (contado: number, nota: string) => void
  avisar: (m: string) => void
}

type Panel =
  | { tipo: 'pedido'; sugerido: PedidoSugerido | null; error?: boolean; cantidades: Record<number, number>; enviando: boolean; aviso?: string; presupuesto: string; dias?: number; rec?: RecomendacionCompra }
  | { tipo: 'deshacer'; venta: VentaReciente }
  | { tipo: 'gasto'; categoria: CategoriaGasto; monto: string; concepto: string }
  | { tipo: 'cierre'; contado: string; nota: string; cargando: boolean; guardado: ArqueoHoy | null; sinSenal: boolean; saldo: SaldoPlata | null }

const CATEGORIAS: { valor: CategoriaGasto; texto: string }[] = [
  { valor: 'HIELO', texto: 'Hielo' },
  { valor: 'TRANSPORTE', texto: 'Transporte' },
  { valor: 'EMPAQUE', texto: 'Empaque' },
  { valor: 'OTRO', texto: 'Otro' },
]

export function Hoy({ estado, onDeshacer, onRecargar, onLlego, onCancelar, onGasto, onCerrarCaja, avisar }: Props) {
  const [panel, setPanel] = useState<Panel | null>(null)
  const [verTodas, setVerTodas] = useState(false)
  const h = estado.hoy
  const faltaCosto = estado.productos.some(p => p.costo === 0)

  /** Sin plata: lo ideal según ventas. Con plata: solo lo que alcanza, dejando reserva. */
  const abrirPedido = async (presupuesto?: number, dias?: number) => {
    if (presupuesto === undefined && dias === undefined) {
      setPanel({ tipo: 'pedido', sugerido: null, cantidades: {}, enviando: false, presupuesto: plataGuardada() })
      // Si ya contaste tu plata, el campo llega con el total (y lo puedes cambiar)
      api.plata().then(s => {
        if (!s.contadoEn || s.libre <= 0) return
        setPanel(p => (p?.tipo === 'pedido' && p.presupuesto === plataGuardada() ? { ...p, presupuesto: String(s.libre) } : p))
      }).catch(() => { /* sin señal: queda lo que había */ })
      api.recomendacion()
        .then(rec => setPanel(p => (p?.tipo === 'pedido' ? { ...p, rec } : p)))
        .catch(() => { /* sin recomendación el pedido igual funciona */ })
    } else {
      setPanel(p => (p?.tipo === 'pedido' ? { ...p, sugerido: null, error: false } : p))
    }
    try {
      const sugerido = await api.pedido(presupuesto, dias)
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
    setPanel({ tipo: 'cierre', contado: '', nota: '', cargando: true, guardado: null, sinSenal: false, saldo: null })
    api.plata()
      .then(saldo => setPanel(p => (p?.tipo === 'cierre' ? { ...p, saldo } : p)))
      .catch(() => { /* sin saldo el cierre igual funciona */ })
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
          <div className="k"><Icono nombre="billete" /> Vendido hoy</div>
          <div className="v">{pesos(h.total)}</div>
        </div>
        <div className="card full ganancia">
          <div className="k"><Icono nombre="grafico" /> Ganancia</div>
          <div className="v">{pesos(h.ganancia)}</div>
          <div className="desglose">
            <span>producto {pesos(h.costo)}</span>
            {h.gastos > 0 && <span>gastos {pesos(h.gastos)}</span>}
            {h.mermas > 0 && <span>mermas {pesos(h.mermas)}</span>}
          </div>
        </div>
        <div className="card">
          <div className="k"><Icono nombre="vaso" /> Granizados</div>
          <div className="v">{h.unidades}</div>
        </div>
        <div className="card">
          <div className="k"><Icono nombre="ticket" /> Ticket promedio</div>
          <div className="v">{pesos(h.unidades ? Math.round(h.total / h.unidades) : 0)}</div>
        </div>
      </div>

      {faltaCosto && h.unidades > 0 && (
        <p className="aviso">Pon el costo de tus sabores en Ajustes para saber cuánto ganas de verdad.</p>
      )}

      {h.total > 0 && (
        <div className="list">
          <h3><Icono nombre="billetera" /> Nequi vs efectivo</h3>
          <div className="canal">
            <div className="canal-barra"><span style={{ width: (h.total ? Math.round(h.nequi / h.total * 100) : 0) + '%' }} /></div>
            <div className="canal-leyenda">
              <span>{h.total ? Math.round(h.nequi / h.total * 100) : 0}% Nequi · {pesos(h.nequi)}</span>
              <span className="mut">Efectivo {pesos(h.efectivo)}</span>
            </div>
          </div>
        </div>
      )}

      {h.porSabor.length > 0 && (
        <div className="list">
          <h3><Icono nombre="trofeo" /> Sabores más pedidos</h3>
          {[...h.porSabor].sort((a, b) => b.unidades - a.unidades).map((s, i) => {
            const pct = h.unidades ? Math.round(s.unidades / h.unidades * 100) : 0
            return (
              <div className="sabor-fila" key={s.sabor}>
                <span className="rank">{i + 1}</span>
                <div className="sabor-info">
                  <div className="sabor-cabeza"><b>{s.sabor}</b><b>{s.unidades} u.</b></div>
                  <div className="sabor-pie"><span className="mut">{pct}% del total</span></div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {estado.ultimas.length ? (
        <div className="list">
          <h3><Icono nombre="reloj" /> Ventas de hoy</h3>
          <p className="mut" style={{ margin: '0 0 6px' }}>Toca una venta para borrarla si te equivocaste.</p>
          {(verTodas ? estado.ultimas : estado.ultimas.slice(0, 8)).map(u => (
            <button type="button" className="pago-fila" key={u.clientUid}
              onClick={() => setPanel({ tipo: 'deshacer', venta: u })}>
              <span className={'pago-avatar ' + (u.metodo === 'EFECTIVO' ? 'e' : 'n')}>
                <Icono nombre={u.metodo === 'EFECTIVO' ? 'billete' : 'celular'} />
              </span>
              <div className="pago-info">
                <b>{u.metodo === 'EFECTIVO' ? 'Efectivo' : 'Nequi'}</b>
                <span className="mut">{u.sabor} · {u.hora}{u.pendiente && <span className="pend-tag" title="Sin subir"> ⏳</span>}</span>
              </div>
              <b>{pesos(u.total)}</b>
            </button>
          ))}
          {estado.ultimas.length > 8 && (
            <button type="button" className="chip-link" onClick={() => setVerTodas(v => !v)}>
              {verTodas ? 'Ver menos' : 'Ver todas (' + estado.ultimas.length + ')'}
            </button>
          )}
        </div>
      ) : <div className="vacio"><img src={dopaGuino} alt="" className="vacio-mascota" />Aún no hay ventas hoy</div>}

      <div className="acciones">
        <button className="accion accion-pedido" onClick={() => void abrirPedido()}>
          <span className="accion-icono"><Icono nombre="camion" /></span>
          <span className="accion-texto">
            <b>Armar pedido</b>
            <small>Al proveedor, por WhatsApp</small>
          </span>
        </button>
        <div className="acciones-grid">
          <button className="accion accion-gasto" onClick={() => setPanel({ tipo: 'gasto', categoria: 'HIELO', monto: '', concepto: '' })}>
            <span className="accion-icono"><Icono nombre="moneda" /></span>
            <b>Gasto</b>
          </button>
          <button className="accion accion-cierre" onClick={abrirCierre}>
            <span className="accion-icono"><Icono nombre="candado" /></span>
            <b>Cerrar caja</b>
          </button>
          <button className="accion accion-deshacer" onClick={pedirDeshacer}>
            <span className="accion-icono"><Icono nombre="flecha" /></span>
            <b>Deshacer venta</b>
          </button>
          <button className="accion accion-recargar" onClick={() => { avisar('Recargando…'); void onRecargar() }}>
            <span className="accion-icono"><Icono nombre="refrescar" /></span>
            <b>Recargar</b>
          </button>
        </div>
      </div>

      <Sheet abierto={!!panel} onCerrar={() => setPanel(null)}>
        {panel?.tipo === 'pedido' && (
          <PanelPedido
            sugerido={panel.sugerido}
            error={panel.error}
            aviso={panel.aviso}
            cantidades={panel.cantidades}
            enviando={panel.enviando}
            presupuesto={panel.presupuesto}
            rec={panel.rec}
            onPresupuesto={v => setPanel(p => (p?.tipo === 'pedido' ? { ...p, presupuesto: v } : p))}
            onAjustar={() => {
              const n = Number(panel.presupuesto)
              if (!n) return
              try { localStorage.setItem(CLAVE_PLATA, String(n)) } catch { /* sin storage no pasa nada */ }
              abrirPedido(n, panel.dias)
            }}
            onDias={d => {
              setPanel(p => (p?.tipo === 'pedido' ? { ...p, dias: d } : p))
              abrirPedido(Number(panel.presupuesto) || undefined, d)
            }}
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
          <PanelCierre esperado={esperadoCierre(panel.saldo, estado.hoy.efectivo)} contado={panel.contado} nota={panel.nota} saldo={panel.saldo}
            cargando={panel.cargando} guardado={panel.guardado} sinSenal={panel.sinSenal}
            onCambio={cambio => setPanel(p => (p?.tipo === 'cierre' ? { ...p, ...cambio } : p))}
            onGuardar={(contado, nota) => {
              setPanel(null)
              vibrar()
              onCerrarCaja(contado, nota)
              avisar('✓ Caja cerrada · ' + resumenCierre(esperadoCierre(panel.saldo, estado.hoy.efectivo), contado))
            }} />
        )}
        {panel?.tipo === 'deshacer' && (
          <>
            <h2>¿Borrar esta venta?</h2>
            <p>{panel.venta.sabor} · {pesos(panel.venta.total)} · {panel.venta.hora}</p>
            <p className="mut">El sabor vuelve al inventario y la plata sale del día.</p>
            <div className="pay">
              <button className="big ghost" onClick={() => setPanel(null)}>Cancelar</button>
              <button className="big rojo" onClick={() => { setPanel(null); void onDeshacer(panel.venta) }}>Borrar venta</button>
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

const CLAVE_PLATA = 'gz_plata_pedido'
const DIAS = [4, 7, 10, 14]

function plataGuardada(): string {
  try { return localStorage.getItem(CLAVE_PLATA) ?? '' } catch { return '' }
}

function PanelPedido({ sugerido, error, aviso, cantidades, enviando, presupuesto, rec, onPresupuesto, onAjustar, onDias, onCantidad, onEnviar }: {
  rec?: RecomendacionCompra
  sugerido: PedidoSugerido | null
  error?: boolean
  aviso?: string
  cantidades: Record<number, number>
  enviando: boolean
  presupuesto: string
  onPresupuesto: (v: string) => void
  onAjustar: () => void
  onDias: (dias: number) => void
  onCantidad: (productoId: number, cantidad: number) => void
  onEnviar: () => void
}) {
  if (error) return <><h2>Sin conexión</h2><p>El pedido se calcula en el servidor. Intenta cuando tengas señal.</p></>
  if (!sugerido) return <><h2>Pedido sugerido</h2><p>Calculando con tus ventas…</p></>
  if (!sugerido.items.length) {
    return (
      <>
        <h2>Pedido sugerido</h2>
        <p>Con {sugerido.dias} días de venta tienes stock suficiente. No hace falta pedir 🙌</p>
        {rec && <p className="mut">{rec.motivo}</p>}
        <p className="mut">¿Quieres inventario para más días?</p>
        <div className="chips">
          {DIAS.filter(d => d > sugerido.dias).map(d => (
            <button type="button" key={d} onClick={() => onDias(d)}>{d} días</button>
          ))}
        </div>
      </>
    )
  }

  const total = sugerido.items.reduce((a, i) => a + (cantidades[i.productoId] ?? 0), 0)
  const costo = sugerido.items.reduce((a, i) => a + (cantidades[i.productoId] ?? 0) * i.costo, 0)
  return (
    <>
      <h2>Armar pedido</h2>
      <p>Edita lo que quieres pedir. Se arma en el servidor y abre WhatsApp.</p>
      <form className="campo" onSubmit={e => { e.preventDefault(); onAjustar() }}>
        <label htmlFor="pedido-plata">¿Cuánta plata tienes para el pedido?</label>
        <input id="pedido-plata" inputMode="numeric" placeholder="Ej: 150000" value={presupuesto}
          onChange={e => onPresupuesto(e.target.value.replace(/\D/g, ''))} />
        <button type="submit" className="big" disabled={!Number(presupuesto)}>Ajustar a mi plata</button>
      </form>
      <p className="mut">¿Para cuántos días quieres inventario?</p>
      <div className="chips">
        {DIAS.map(d => {
          const op = rec?.opciones.find(o => o.dias === d)
          return (
            <button type="button" key={d} className={sugerido.dias === d ? 'on' : ''} onClick={() => onDias(d)}>
              {rec?.recomendado === d ? '⭐ ' : ''}{d} días{op ? ' · ' + pesos(op.costo) : ''}
            </button>
          )
        })}
      </div>
      {rec && <p className="mut">{rec.motivo}</p>}
      {sugerido.disponible !== null && (
        <p className={sugerido.recortado ? 'aviso' : 'mut'}>
          Gasto hasta {pesos(sugerido.disponible)} y dejo {pesos((sugerido.presupuesto ?? 0) - sugerido.disponible)} de reserva.
          {sugerido.recortado ? ' No alcanza para todo, repartí por lo que más se vende.' : ' Te alcanza para todo lo sugerido 🙌'}
        </p>
      )}
      <div className="list pedido-lista">
        {sugerido.items.map(i => (
          <div className="row" key={i.productoId}>
            <span>{i.sabor}<br /><small className="mut">{i.promedioDia}/día · sugiere {i.pedir}{i.ideal !== i.pedir ? ` (ideal ${i.ideal})` : ''}</small></span>
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

/** Con la plata contada en Mi plata, lo esperado es lo que debería haber en la caja; si no, solo el efectivo de hoy. */
function esperadoCierre(saldo: SaldoPlata | null, efectivoHoy: number): number {
  return saldo?.contadoEn ? Math.max(0, saldo.caja) : efectivoHoy
}

/** Qué queda después de contar: cuadró, o cuánto faltó o sobró. */
function resumenCierre(esperado: number, contado: number): string {
  const d = contado - esperado
  if (d === 0) return 'cuadró'
  return (d < 0 ? 'faltaron ' : 'sobraron ') + pesos(Math.abs(d))
}

/** El cierre de caja: cuánto dice la app y cuánto había de verdad. Va a la cola. */
function PanelCierre({ esperado, contado, nota, saldo, cargando, guardado, sinSenal, onCambio, onGuardar }: {
  saldo: SaldoPlata | null
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
  // La plata de todo el negocio: la caja se cambia por lo que cuentas; la casa y Nequi siguen igual
  const cajaFinal = sinContar ? Math.max(0, saldo?.caja ?? 0) : n
  const totalNegocio = saldo ? saldo.total - saldo.caja + cajaFinal : 0

  return (
    <form onSubmit={e => { e.preventDefault(); if (!sinContar && !cargando) onGuardar(n, nota.trim()) }}>
      <h2>Cerrar caja</h2>
      {saldo?.contadoEn && (
        <div className="list">
          <h3>{sinContar ? 'Plata total del negocio' : 'Plata total con lo que contaste'}</h3>
          <div className="pago-fila">
            <b style={{ fontSize: 28 }}>{pesos(totalNegocio)}</b>
          </div>
          <div className="pago-fila"><span className="mut">Efectivo en la caja{sinContar ? ' (según la app)' : ''}</span>
            <span style={{ marginLeft: 'auto' }}>{pesos(cajaFinal)}</span></div>
          <div className="pago-fila"><span className="mut">Efectivo en la casa</span>
            <span style={{ marginLeft: 'auto' }}>{pesos(saldo.casa)}</span></div>
          <div className="pago-fila"><span className="mut">En Nequi</span>
            <span style={{ marginLeft: 'auto' }}>{pesos(saldo.nequi)}</span></div>
          {saldo.apartado > 0 && (
            <>
              <div className="pago-fila"><span className="mut">Apartado en metas</span>
                <span style={{ marginLeft: 'auto' }}>{pesos(saldo.apartado)}</span></div>
              <div className="pago-fila"><b>Libre para gastar</b>
                <b style={{ marginLeft: 'auto' }}>{pesos(totalNegocio - saldo.apartado)}</b></div>
            </>
          )}
        </div>
      )}
      {saldo?.contadoEn ? (
        <p>Según la app, en la caja debe haber <b>{pesos(esperado)}</b> (lo que había más lo de hoy, menos gastos). Cuenta el efectivo del cajón:</p>
      ) : (
        <p>Según la app, en la caja debe haber <b>{pesos(esperado)}</b> de efectivo (lo vendido hoy en efectivo).</p>
      )}

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
        <label htmlFor="cierre-contado">Efectivo que hay de verdad en la caja</label>
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
      {!saldo?.contadoEn && !cargando && (
        <p className="mut">Cuenta tu plata en Mi plata (en Reportes) y aquí verás cuánta plata hay en total en el negocio.</p>
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
