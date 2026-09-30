import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { nuevoUid } from '../estadoLocal'
import { pesos, vibrar } from '../formato'
import type { LugarPlata, MetaPlata, MovimientoPlata, SaldoPlata } from '../tipos'
import { Icono } from './Icono'
import { Sheet } from './Sheet'

const LUGARES: { valor: LugarPlata; texto: string }[] = [
  { valor: 'CAJA', texto: 'Caja' },
  { valor: 'CASA', texto: 'Casa' },
  { valor: 'NEQUI', texto: 'Nequi' },
]

const nombreLugar = (l: LugarPlata) => LUGARES.find(x => x.valor === l)?.texto ?? l
const soloDigitos = (v: string) => v.replace(/\D/g, '')

type Panel = 'ingreso' | 'traslado' | 'conteo' | 'metas' | 'historial'

/**
 * Cuánta plata hay y dónde: efectivo en la caja, efectivo en la casa y Nequi, con lo apartado en metas.
 * Necesita señal (no usa la cola). Está aparte del resto de Hoy: si falla, lo demás sigue igual.
 */
export function MiPlata({ avisar }: { avisar: (m: string) => void }) {
  const [saldo, setSaldo] = useState<SaldoPlata | null>(null)
  const [sinSenal, setSinSenal] = useState(false)
  const [panel, setPanel] = useState<Panel | null>(null)

  const cargar = () => api.plata().then(s => { setSaldo(s); setSinSenal(false) }).catch(() => setSinSenal(true))
  useEffect(() => { void cargar() }, [])

  /** Recarga el saldo y, si hay mensaje, avisa. \`cerrar\` cierra el panel (las metas y el historial se quedan abiertos). */
  const listo = (mensaje: string, cerrar = true) => {
    if (cerrar) setPanel(null)
    vibrar()
    avisar(mensaje)
    void cargar()
  }

  return (
    <div className="list">
      <h3><Icono nombre="moneda" /> Mi plata</h3>
      {!saldo && <p className="mut">{sinSenal ? 'Sin señal para ver tu plata.' : 'Cargando…'}</p>}
      {saldo && !saldo.contadoEn && (
        <p className="mut">Cuenta cuánto tienes en la caja, en la casa y en Nequi, y desde ahí la app lleva la cuenta.</p>
      )}
      {saldo?.contadoEn && (
        <>
          <Fila etiqueta="Total" valor={pesos(saldo.total)} fuerte />
          {saldo.apartado > 0 && (
            <>
              <Fila etiqueta="Apartado en metas" valor={pesos(saldo.apartado)} />
              <Fila etiqueta="Libre para gastar" valor={pesos(saldo.libre)} fuerte />
            </>
          )}
          <p className="mut" style={{ margin: '8px 0 0' }}>Dónde está</p>
          {LUGARES.map(l => (
            <Fila key={l.valor} etiqueta={l.texto} valor={pesos(saldo[l.valor.toLowerCase() as 'caja' | 'casa' | 'nequi'])} />
          ))}
        </>
      )}
      <div className="acciones-grid" style={{ margin: '10px 0 4px' }}>
        <button className="accion accion-gasto" onClick={() => setPanel('ingreso')}>
          <span className="accion-icono"><Icono nombre="moneda" /></span>
          <b>Entró plata</b>
        </button>
        <button className="accion accion-cierre" onClick={() => setPanel('traslado')}>
          <span className="accion-icono"><Icono nombre="flecha" /></span>
          <b>Pasé plata</b>
        </button>
        <button className="accion accion-pedido" onClick={() => setPanel('metas')}>
          <span className="accion-icono"><Icono nombre="billetera" /></span>
          <b>Mis metas</b>
        </button>
        <button className="accion accion-cierre" onClick={() => setPanel('conteo')}>
          <span className="accion-icono"><Icono nombre="candado" /></span>
          <b>Contar mi plata</b>
        </button>
      </div>
      <button type="button" className="chip-link" onClick={() => setPanel('historial')}>Ver movimientos</button>

      <Sheet abierto={!!panel} onCerrar={() => setPanel(null)}>
        {panel === 'ingreso' && <PanelIngreso onListo={() => listo('✓ Ingreso anotado')} avisar={avisar} />}
        {panel === 'traslado' && <PanelTraslado onListo={() => listo('✓ Plata movida')} avisar={avisar} />}
        {panel === 'conteo' && <PanelConteo saldo={saldo} onListo={() => listo('✓ Plata contada')} avisar={avisar} />}
        {panel === 'metas' && <PanelMetas saldo={saldo} onCambio={m => listo(m, false)} avisar={avisar} />}
        {panel === 'historial' && <PanelHistorial onCambio={m => listo(m, false)} avisar={avisar} />}
      </Sheet>
    </div>
  )
}

function Fila({ etiqueta, valor, fuerte }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <div className="pago-fila">
      <span className={fuerte ? '' : 'mut'}>{fuerte ? <b>{etiqueta}</b> : etiqueta}</span>
      <span style={{ marginLeft: 'auto' }}>{fuerte ? <b>{valor}</b> : valor}</span>
    </div>
  )
}

function Chips<T extends string>({ opciones, valor, onCambio }: {
  opciones: { valor: T; texto: string }[]
  valor: T
  onCambio: (v: T) => void
}) {
  return (
    <div className="chips">
      {opciones.map(o => (
        <button type="button" key={o.valor} className={valor === o.valor ? 'on' : ''} onClick={() => onCambio(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  )
}

/** Plata que entra y no es una venta: por ejemplo, te pagaron una deuda. */
function PanelIngreso({ onListo, avisar }: { onListo: () => void; avisar: (m: string) => void }) {
  const [monto, setMonto] = useState('')
  const [concepto, setConcepto] = useState('')
  const [lugar, setLugar] = useState<LugarPlata>('CAJA')
  const [cuentaGanancia, setCuentaGanancia] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const uid = useRef(nuevoUid()) // un doble toque o un reintento no puede meter dos ingresos

  const n = Number(monto)
  const guardar = async () => {
    if (!n || enviando) return
    setEnviando(true)
    try {
      await api.ingreso({ clientUid: uid.current, concepto: concepto.trim(), monto: n, lugar, cuentaGanancia })
      onListo()
    } catch {
      setEnviando(false)
      avisar('⚠️ No se pudo guardar, revisa la señal')
    }
  }

  return (
    <form onSubmit={e => { e.preventDefault(); void guardar() }}>
      <h2>Entró plata</h2>
      <p>Plata que no es una venta de hoy: el pago de una deuda, un aporte…</p>
      <div className="campo">
        <label htmlFor="ingreso-monto">¿Cuánto?</label>
        <input id="ingreso-monto" inputMode="numeric" autoFocus placeholder="0" value={monto}
          onChange={e => setMonto(soloDigitos(e.target.value))} />
      </div>
      <div className="campo">
        <label htmlFor="ingreso-concepto">¿De qué? (opcional)</label>
        <input id="ingreso-concepto" maxLength={120} value={concepto} placeholder="Ej: Pago deuda de Dani"
          onChange={e => setConcepto(e.target.value)} />
      </div>
      <p className="mut">¿Dónde quedó?</p>
      <Chips opciones={LUGARES} valor={lugar} onCambio={setLugar} />
      <p className="mut">¿Es ganancia?</p>
      <Chips
        opciones={[{ valor: 'si', texto: 'Sí, es ganancia' }, { valor: 'no', texto: 'No, es plata mía' }]}
        valor={cuentaGanancia ? 'si' : 'no'} onCambio={v => setCuentaGanancia(v === 'si')} />
      <p className="mut">
        {cuentaGanancia
          ? 'Un pago de granizados que te debían: suma a la ganancia de hoy.'
          : 'Un aporte tuyo: entra a tu plata pero no cuenta como ganancia del negocio.'}
      </p>
      <button className="big primario" type="submit" disabled={!n || enviando}>
        {enviando ? 'Guardando…' : n ? 'Anotar ' + pesos(n) : 'Escribe cuánto fue'}
      </button>
    </form>
  )
}

/** Mover plata de un lugar a otro: el total no cambia. */
function PanelTraslado({ onListo, avisar }: { onListo: () => void; avisar: (m: string) => void }) {
  const [monto, setMonto] = useState('')
  const [desde, setDesde] = useState<LugarPlata>('CAJA')
  const [hacia, setHacia] = useState<LugarPlata>('CASA')
  const [enviando, setEnviando] = useState(false)
  const uid = useRef(nuevoUid())

  const n = Number(monto)
  const iguales = desde === hacia
  const guardar = async () => {
    if (!n || iguales || enviando) return
    setEnviando(true)
    try {
      await api.trasladar({ clientUid: uid.current, monto: n, desde, hacia })
      onListo()
    } catch {
      setEnviando(false)
      avisar('⚠️ No se pudo guardar, revisa la señal')
    }
  }

  return (
    <form onSubmit={e => { e.preventDefault(); void guardar() }}>
      <h2>Pasé plata</h2>
      <p>Por ejemplo, sacaste efectivo de la caja y lo llevaste a la casa, o lo consignaste a Nequi.</p>
      <div className="campo">
        <label htmlFor="traslado-monto">¿Cuánto?</label>
        <input id="traslado-monto" inputMode="numeric" autoFocus placeholder="0" value={monto}
          onChange={e => setMonto(soloDigitos(e.target.value))} />
      </div>
      <p className="mut">Sale de</p>
      <Chips opciones={LUGARES} valor={desde} onCambio={setDesde} />
      <p className="mut">Va para</p>
      <Chips opciones={LUGARES} valor={hacia} onCambio={setHacia} />
      {iguales && <p className="aviso">Escoge dos lugares distintos.</p>}
      <button className="big primario" type="submit" disabled={!n || iguales || enviando}>
        {enviando ? 'Guardando…' : n && !iguales ? `Pasar ${pesos(n)} de ${nombreLugar(desde)} a ${nombreLugar(hacia)}` : 'Escribe cuánto'}
      </button>
    </form>
  )
}

/** Cuánto hay de verdad en cada lugar. Desde acá la app suma y resta. */
function PanelConteo({ saldo, onListo, avisar }: { saldo: SaldoPlata | null; onListo: () => void; avisar: (m: string) => void }) {
  const inicial = (v?: number) => (saldo?.contadoEn && v ? String(Math.max(0, v)) : '')
  const [caja, setCaja] = useState(inicial(saldo?.caja))
  const [casa, setCasa] = useState(inicial(saldo?.casa))
  const [nequi, setNequi] = useState(inicial(saldo?.nequi))
  const [enviando, setEnviando] = useState(false)
  const uid = useRef(nuevoUid())

  const total = (Number(caja) || 0) + (Number(casa) || 0) + (Number(nequi) || 0)
  const guardar = async () => {
    if (enviando) return
    setEnviando(true)
    try {
      await api.contarPlata({ clientUid: uid.current, caja: Number(caja) || 0, casa: Number(casa) || 0, nequi: Number(nequi) || 0 })
      onListo()
    } catch {
      setEnviando(false)
      avisar('⚠️ No se pudo guardar, revisa la señal')
    }
  }

  const campo = (id: string, etiqueta: string, valor: string, set: (v: string) => void) => (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <input id={id} inputMode="numeric" placeholder="0" value={valor} onChange={e => set(soloDigitos(e.target.value))} />
    </div>
  )

  return (
    <form onSubmit={e => { e.preventDefault(); void guardar() }}>
      <h2>Contar mi plata</h2>
      <p>Cuenta lo que tienes de verdad ahora mismo. Lo que digas queda como punto de partida.</p>
      {campo('conteo-caja', 'Efectivo en la caja', caja, setCaja)}
      {campo('conteo-casa', 'Efectivo en la casa', casa, setCasa)}
      {campo('conteo-nequi', 'En Nequi', nequi, setNequi)}
      <p className="mut">Total: <b>{pesos(total)}</b></p>
      <button className="big primario" type="submit" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar conteo'}
      </button>
    </form>
  )
}

type VistaMetas = { t: 'lista' } | { t: 'nueva' } | { t: 'mover'; meta: MetaPlata }

/** Las metas o "sobres": plata apartada para cada cosa. La plata apartada sigue siendo tuya pero no se ofrece para el pedido. */
function PanelMetas({ saldo, onCambio, avisar }: { saldo: SaldoPlata | null; onCambio: (m: string) => void; avisar: (m: string) => void }) {
  const [vista, setVista] = useState<VistaMetas>({ t: 'lista' })
  const metas = saldo?.metas ?? []

  if (vista.t === 'nueva') {
    return <NuevaMeta onVolver={() => setVista({ t: 'lista' })} onListo={() => { setVista({ t: 'lista' }); onCambio('✓ Meta creada') }} avisar={avisar} />
  }
  if (vista.t === 'mover') {
    // Se busca de nuevo en el saldo para mostrar lo apartado al día
    const actual = metas.find(m => m.id === vista.meta.id) ?? vista.meta
    return (
      <MoverMeta meta={actual} libre={saldo?.libre ?? 0} onVolver={() => setVista({ t: 'lista' })}
        onListo={m => { setVista({ t: 'lista' }); onCambio(m) }} avisar={avisar} />
    )
  }

  return (
    <>
      <h2>Mis metas</h2>
      <p>Aparta plata para cada cosa: el pedido, ahorro, lo que quieras. Sigue siendo tuya, pero no cuenta como plata libre.</p>
      {saldo?.contadoEn && (
        <p className="mut">Libre para gastar: <b>{pesos(saldo.libre)}</b> · Apartado: <b>{pesos(saldo.apartado)}</b></p>
      )}
      {!saldo?.contadoEn && <p className="aviso">Cuenta tu plata primero para poder apartar.</p>}
      <div className="list">
        {!metas.length && <p className="mut">Aún no tienes metas.</p>}
        {metas.map(m => {
          const pct = m.objetivo > 0 ? Math.min(100, Math.round(m.apartado * 100 / m.objetivo)) : 0
          return (
            <button type="button" className="pago-fila" key={m.id} onClick={() => setVista({ t: 'mover', meta: m })}
              style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                <b>{m.nombre}</b>
                <b>{pesos(m.apartado)}{m.objetivo > 0 && <span className="mut"> / {pesos(m.objetivo)}</span>}</b>
              </span>
              {m.objetivo > 0 && (
                <>
                  <span className="canal-barra"><span style={{ width: pct + '%' }} /></span>
                  <small className="mut">{pct}%{m.apartado >= m.objetivo ? ' · ¡lista! 🎉' : ' · faltan ' + pesos(m.objetivo - m.apartado)}</small>
                </>
              )}
            </button>
          )
        })}
      </div>
      <button className="big primario" onClick={() => setVista({ t: 'nueva' })}>Nueva meta</button>
    </>
  )
}

function NuevaMeta({ onVolver, onListo, avisar }: { onVolver: () => void; onListo: () => void; avisar: (m: string) => void }) {
  const [nombre, setNombre] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const uid = useRef(nuevoUid())

  const guardar = async () => {
    if (!nombre.trim() || enviando) return
    setEnviando(true)
    try {
      await api.crearMeta({ clientUid: uid.current, nombre: nombre.trim(), objetivo: Number(objetivo) || 0 })
      onListo()
    } catch {
      setEnviando(false)
      avisar('⚠️ No se pudo guardar, revisa la señal')
    }
  }

  return (
    <form onSubmit={e => { e.preventDefault(); void guardar() }}>
      <h2>Nueva meta</h2>
      <div className="campo">
        <label htmlFor="meta-nombre">¿Para qué es?</label>
        <input id="meta-nombre" maxLength={40} autoFocus placeholder="Ej: Ahorro, Pedido, Moto" value={nombre}
          onChange={e => setNombre(e.target.value)} />
      </div>
      <div className="campo">
        <label htmlFor="meta-objetivo">¿Cuánto quieres juntar? (opcional)</label>
        <input id="meta-objetivo" inputMode="numeric" placeholder="0" value={objetivo}
          onChange={e => setObjetivo(soloDigitos(e.target.value))} />
      </div>
      <div className="pay">
        <button type="button" className="big ghost" onClick={onVolver}>Volver</button>
        <button className="big primario" type="submit" disabled={!nombre.trim() || enviando}>
          {enviando ? 'Guardando…' : 'Crear meta'}
        </button>
      </div>
    </form>
  )
}

function MoverMeta({ meta, libre, onVolver, onListo, avisar }: {
  meta: MetaPlata
  libre: number
  onVolver: () => void
  onListo: (mensaje: string) => void
  avisar: (m: string) => void
}) {
  const [accion, setAccion] = useState<'apartar' | 'sacar'>('apartar')
  const [monto, setMonto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [borrar, setBorrar] = useState(false)
  const uid = useRef(nuevoUid())

  const n = Number(monto)
  const tope = accion === 'apartar' ? libre : meta.apartado
  const pasa = n > tope
  const guardar = async () => {
    if (!n || pasa || enviando) return
    setEnviando(true)
    try {
      await api.aportarMeta(meta.id, { clientUid: uid.current, monto: accion === 'apartar' ? n : -n })
      onListo(accion === 'apartar' ? `✓ ${pesos(n)} apartados para ${meta.nombre}` : `✓ Sacaste ${pesos(n)} de ${meta.nombre}`)
    } catch {
      setEnviando(false)
      avisar('⚠️ No se pudo guardar, revisa la señal')
    }
  }

  const eliminar = async () => {
    if (!borrar) { setBorrar(true); return }
    try {
      await api.borrarMeta(meta.id)
      onListo('Meta borrada: la plata volvió a libre')
    } catch {
      avisar('⚠️ No se pudo borrar, revisa la señal')
    }
  }

  return (
    <form onSubmit={e => { e.preventDefault(); void guardar() }}>
      <h2>{meta.nombre}</h2>
      <p>Apartado: <b>{pesos(meta.apartado)}</b>{meta.objetivo > 0 && <> de {pesos(meta.objetivo)}</>}</p>
      <Chips opciones={[{ valor: 'apartar', texto: 'Apartar' }, { valor: 'sacar', texto: 'Sacar' }]} valor={accion} onCambio={setAccion} />
      <div className="campo">
        <label htmlFor="meta-monto">{accion === 'apartar' ? 'Cuánto apartas' : 'Cuánto sacas'}</label>
        <input id="meta-monto" inputMode="numeric" autoFocus placeholder="0" value={monto}
          onChange={e => setMonto(soloDigitos(e.target.value))} />
      </div>
      <p className={pasa ? 'aviso' : 'mut'}>
        {accion === 'apartar' ? 'Libre para apartar: ' : 'Apartado en la meta: '}{pesos(Math.max(0, tope))}
      </p>
      <button className="big primario" type="submit" disabled={!n || pasa || enviando}>
        {enviando ? 'Guardando…' : accion === 'apartar' ? 'Apartar' : 'Sacar'}
      </button>
      <div className="pay" style={{ marginTop: 10 }}>
        <button type="button" className="big ghost" onClick={onVolver}>Volver</button>
        <button type="button" className="big rojo" onClick={() => void eliminar()}>
          {borrar ? 'Toca otra vez para borrar' : 'Borrar meta'}
        </button>
      </div>
    </form>
  )
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function hoyBogota(): string {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date()) } catch { return '' }
}

function etiquetaDia(dia: string): string {
  if (dia === hoyBogota()) return 'Hoy'
  const [, m, d] = dia.split('-')
  return `${Number(d)} ${MESES[Number(m) - 1] ?? ''}`
}

/** Todo lo que movió la plata en los últimos días, día por día. */
function PanelHistorial({ onCambio, avisar }: { onCambio: (m: string) => void; avisar: (m: string) => void }) {
  const [movs, setMovs] = useState<MovimientoPlata[] | null>(null)
  const [error, setError] = useState(false)
  const [porBorrar, setPorBorrar] = useState<string | null>(null)

  const cargar = () => api.movimientosPlata(14).then(setMovs).catch(() => setError(true))
  useEffect(() => { void cargar() }, [])

  const tocar = async (m: MovimientoPlata) => {
    if (m.tipo !== 'INGRESO' || !m.clientUid) return
    if (porBorrar !== m.clientUid) { setPorBorrar(m.clientUid); return }
    try {
      await api.borrarIngreso(m.clientUid)
      setPorBorrar(null)
      onCambio('Ingreso borrado')
      void cargar()
    } catch {
      avisar('⚠️ No se pudo borrar, revisa la señal')
    }
  }

  if (error) return <><h2>Movimientos</h2><p className="aviso">Sin señal para ver los movimientos.</p></>
  if (!movs) return <><h2>Movimientos</h2><p className="mut">Cargando…</p></>

  const dias = [...new Set(movs.map(m => m.dia))]
  return (
    <>
      <h2>Movimientos</h2>
      <p className="mut">Lo que movió tu plata en los últimos 14 días. Toca un ingreso dos veces para borrarlo.</p>
      {!movs.length && <p className="mut">Todavía no hay movimientos.</p>}
      <div className="pedido-lista">
        {dias.map(dia => (
          <div className="list" key={dia}>
            <h3>{etiquetaDia(dia)}</h3>
            {movs.filter(m => m.dia === dia).map((m, i) => (
              <button type="button" key={dia + i} className="pago-fila" onClick={() => void tocar(m)}
                disabled={m.tipo !== 'INGRESO'} style={m.tipo === 'INGRESO' ? undefined : { cursor: 'default' }}>
                <div className="pago-info">
                  <b>{m.concepto}</b>
                  <span className="mut">
                    {m.hora} · {nombreLugar(m.lugar)}
                    {m.tipo === 'INGRESO' && porBorrar === m.clientUid && <span className="aviso"> · toca otra vez para borrar</span>}
                  </span>
                </div>
                {m.tipo === 'TRASLADO'
                  ? <span className="mut">↔</span>
                  : <b className={m.monto < 0 ? 'aviso' : 'ok-dinero'}>{(m.monto > 0 ? '+' : '') + pesos(m.monto)}</b>}
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
