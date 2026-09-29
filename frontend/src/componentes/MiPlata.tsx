import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { nuevoUid } from '../estadoLocal'
import { pesos, vibrar } from '../formato'
import type { LugarPlata, SaldoPlata } from '../tipos'
import { Icono } from './Icono'
import { Sheet } from './Sheet'

const LUGARES: { valor: LugarPlata; texto: string }[] = [
  { valor: 'CAJA', texto: 'Caja' },
  { valor: 'CASA', texto: 'Casa' },
  { valor: 'NEQUI', texto: 'Nequi' },
]

type Panel = { tipo: 'ingreso' } | { tipo: 'conteo' }

/**
 * Cuánta plata hay y dónde: efectivo en la caja, efectivo en la casa y Nequi.
 * Necesita señal (no usa la cola). Está aparte del resto de Hoy: si falla, lo demás sigue igual.
 */
export function MiPlata({ avisar }: { avisar: (m: string) => void }) {
  const [saldo, setSaldo] = useState<SaldoPlata | null>(null)
  const [sinSenal, setSinSenal] = useState(false)
  const [panel, setPanel] = useState<Panel | null>(null)

  const cargar = () => api.plata().then(s => { setSaldo(s); setSinSenal(false) }).catch(() => setSinSenal(true))
  useEffect(() => { void cargar() }, [])

  const cerrarYRecargar = (mensaje: string) => {
    setPanel(null)
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
          <div className="pago-fila"><b>Total</b><span style={{ marginLeft: 'auto' }}><b>{pesos(saldo.total)}</b></span></div>
          {LUGARES.map(l => (
            <div className="pago-fila" key={l.valor}>
              <span className="mut">{l.texto}</span>
              <span style={{ marginLeft: 'auto' }}>{pesos(saldo[l.valor.toLowerCase() as 'caja' | 'casa' | 'nequi'])}</span>
            </div>
          ))}
        </>
      )}
      <div className="acciones-grid" style={{ margin: '10px 0' }}>
        <button className="accion accion-gasto" onClick={() => setPanel({ tipo: 'ingreso' })}>
          <span className="accion-icono"><Icono nombre="moneda" /></span>
          <b>Entró plata</b>
        </button>
        <button className="accion accion-cierre" onClick={() => setPanel({ tipo: 'conteo' })}>
          <span className="accion-icono"><Icono nombre="candado" /></span>
          <b>Contar mi plata</b>
        </button>
      </div>

      <Sheet abierto={!!panel} onCerrar={() => setPanel(null)}>
        {panel?.tipo === 'ingreso' && (
          <PanelIngreso onListo={() => cerrarYRecargar('✓ Ingreso anotado')} avisar={avisar} />
        )}
        {panel?.tipo === 'conteo' && (
          <PanelConteo saldo={saldo} onListo={() => cerrarYRecargar('✓ Plata contada')} avisar={avisar} />
        )}
      </Sheet>
    </div>
  )
}

function Chips({ valor, onCambio }: { valor: LugarPlata; onCambio: (l: LugarPlata) => void }) {
  return (
    <div className="chips">
      {LUGARES.map(l => (
        <button type="button" key={l.valor} className={valor === l.valor ? 'on' : ''} onClick={() => onCambio(l.valor)}>
          {l.texto}
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
  const [enviando, setEnviando] = useState(false)
  const uid = useRef(nuevoUid()) // un doble toque o un reintento no puede meter dos ingresos

  const n = Number(monto)
  const guardar = async () => {
    if (!n || enviando) return
    setEnviando(true)
    try {
      await api.ingreso({ clientUid: uid.current, concepto: concepto.trim(), monto: n, lugar })
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
          onChange={e => setMonto(e.target.value.replace(/\D/g, ''))} />
      </div>
      <div className="campo">
        <label htmlFor="ingreso-concepto">¿De qué? (opcional)</label>
        <input id="ingreso-concepto" maxLength={120} value={concepto} placeholder="Ej: Pago deuda de Dani"
          onChange={e => setConcepto(e.target.value)} />
      </div>
      <p className="mut">¿Dónde quedó?</p>
      <Chips valor={lugar} onCambio={setLugar} />
      <button className="big primario" type="submit" disabled={!n || enviando}>
        {enviando ? 'Guardando…' : n ? 'Anotar ' + pesos(n) : 'Escribe cuánto fue'}
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
      <input id={id} inputMode="numeric" placeholder="0" value={valor} onChange={e => set(e.target.value.replace(/\D/g, ''))} />
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
