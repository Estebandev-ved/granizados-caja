import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { EMOJI_VEREDICTO, duracion, resumirSalida, TEXTO_VEREDICTO, ubicacion, type ResumenSalida, type SalidaAbierta } from '../calle'
import { nuevoUid } from '../estadoLocal'
import { pesos, vibrar } from '../formato'
import type { CalleConfig, LugarSimple, TipoAlerta } from '../tipos'
import { CampoNumero } from './CampoNumero'
import { Sheet } from './Sheet'

const INCIDENTES = ['Policía', 'Hurto', 'Lluvia', 'Decían que estaba caro', 'Muy poca gente']

interface Props {
  /** Los ajustes del plan; null o apagado = no hay salidas, pero la alerta sigue para un trabajador. */
  calle: CalleConfig | null
  salida: SalidaAbierta | null
  trabajador: boolean
  avisar: (m: string) => void
  onEmpezar: (lugar: string, ubic: { lat: number; lng: number } | null, prueba: boolean) => void
  onTerminar: (pasaje: number, incidentes: string, nota: string) => void
}

/**
 * Lo del plan de la calle dentro de Vender: «Empezar salida» (con el lugar y el GPS), la barra de la salida en curso con
 * «Terminar» y el botón de alerta (hurto, policía, necesito ayuda) que le avisa al dueño por Telegram con la ubicación.
 */
export function SalidaCalle({ calle, salida, trabajador, avisar, onEmpezar, onTerminar }: Props) {
  const plan = !!calle?.activo
  const [empezando, setEmpezando] = useState(false)
  const [terminando, setTerminando] = useState(false)
  const [alertando, setAlertando] = useState(false)
  const [resumen, setResumen] = useState<ResumenSalida | null>(null)
  const [ahora, setAhora] = useState(Date.now)
  useEffect(() => {
    if (!salida) return
    const r = window.setInterval(() => setAhora(Date.now()), 30_000)
    return () => window.clearInterval(r)
  }, [salida])

  // El botón de alerta: siempre para un trabajador, y para el dueño solo mientras tenga el plan prendido (para probarlo)
  const conAlerta = trabajador || plan
  if (!plan && !conAlerta && !salida) return null

  const unidades = salida?.ventas.reduce((a, v) => a + v.cantidad, 0) ?? 0

  return (
    <div className="calle-barra">
      {plan && !salida && (
        <button type="button" className="calle-empezar" onClick={() => setEmpezando(true)}>
          <b>📍 Empezar salida a la calle</b>
          <span>Precios y comisión de la calle desde que empiezas</span>
        </button>
      )}
      {salida && (
        <div className="calle-curso">
          <div>
            <b>📍 {salida.lugar}</b>
            <span>{duracion(salida.inicio, ahora)} · {unidades} vendido{unidades === 1 ? '' : 's'}{salida.prueba ? ' · de prueba' : ''}</span>
          </div>
          <button type="button" className="chip-rapido on" onClick={() => setTerminando(true)}>Terminar</button>
        </div>
      )}
      {conAlerta && (
        <button type="button" className="calle-sos" onClick={() => setAlertando(true)} aria-label="Alerta: necesito ayuda">
          🆘 Alerta
        </button>
      )}

      <Sheet abierto={empezando} onCerrar={() => setEmpezando(false)}>
        {empezando && (
          <EmpezarSalida trabajador={trabajador}
            onEmpezar={async (lugar, prueba) => {
              setEmpezando(false)
              vibrar()
              avisar('📍 Buscando dónde estás…')
              onEmpezar(lugar, await ubicacion(), prueba)
            }} />
        )}
      </Sheet>

      <Sheet abierto={terminando} onCerrar={() => setTerminando(false)}>
        {terminando && salida && calle && (
          <TerminarSalida salida={salida} calle={calle} trabajador={trabajador}
            onTerminar={(pasaje, incidentes, nota) => {
              setResumen(resumirSalida(salida, Date.now(), pasaje, calle, trabajador))
              setTerminando(false)
              onTerminar(pasaje, incidentes, nota)
            }} />
        )}
      </Sheet>

      <Sheet abierto={!!resumen} onCerrar={() => setResumen(null)}>
        {resumen && (
          <div className="calle-resumen">
            <h2>{EMOJI_VEREDICTO[resumen.veredicto]} Salida terminada</h2>
            <p className="panel-total">{resumen.unidades} vendidos · {pesos(resumen.total)}</p>
            <p className="mut">
              {resumen.ritmo4h === null
                ? 'Fue muy corta para decir si el lugar sirve.'
                : `${TEXTO_VEREDICTO[resumen.veredicto]}: a este ritmo son ${resumen.ritmo4h} granizados en 4 horas.`}
            </p>
            {resumen.pasajeADevolver > 0 && <p>Se te devuelve el pasaje: <b>{pesos(resumen.pasajeADevolver)}</b>.</p>}
            <button className="big primario" onClick={() => setResumen(null)}>Listo</button>
          </div>
        )}
      </Sheet>

      <Sheet abierto={alertando} onCerrar={() => setAlertando(false)}>
        {alertando && <Alerta avisar={avisar} onCerrar={() => setAlertando(false)} />}
      </Sheet>
    </div>
  )
}

function EmpezarSalida({ trabajador, onEmpezar }: { trabajador: boolean; onEmpezar: (lugar: string, prueba: boolean) => void }) {
  const [lugares, setLugares] = useState<LugarSimple[]>([])
  const [nombre, setNombre] = useState('')
  const [prueba, setPrueba] = useState(false)
  const yaPuesto = useRef(false)
  useEffect(() => {
    api.calleLugares().then(setLugares).catch(() => { /* sin señal: se escribe el nombre */ })
  }, [])
  const lugar = nombre.trim()
  const empezar = () => {
    if (!lugar || yaPuesto.current) return
    yaPuesto.current = true // un doble toque no puede abrir dos salidas
    onEmpezar(lugar, prueba)
  }
  return (
    <form onSubmit={e => { e.preventDefault(); empezar() }}>
      <h2>¿Dónde vas a vender?</h2>
      {lugares.length > 0 && (
        <div className="chips">
          {lugares.map(l => (
            <button type="button" key={l.id} className={lugar.toLowerCase() === l.nombre.toLowerCase() ? 'on' : ''}
              onClick={() => setNombre(l.nombre)}>{l.nombre}</button>
          ))}
        </div>
      )}
      <div className="campo">
        <label htmlFor="lugar-salida">{lugares.length ? 'O escribe un lugar nuevo' : 'Nombre del lugar'}</label>
        <input id="lugar-salida" maxLength={60} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: La Kurva" autoComplete="off" />
      </div>
      {!trabajador && (
        <label className="check-fila">
          <input type="checkbox" checked={prueba} onChange={e => setPrueba(e.target.checked)} />
          <span>Salida de prueba (tú pagas el pasaje completo)</span>
        </label>
      )}
      <p className="mut">Se guarda dónde estás para ponerlo en el mapa. Solo al empezar y al terminar.</p>
      <button className="big primario" type="submit" disabled={!lugar}>Empezar en {lugar || '…'}</button>
    </form>
  )
}

function TerminarSalida({ salida, calle, trabajador, onTerminar }: {
  salida: SalidaAbierta; calle: CalleConfig; trabajador: boolean
  onTerminar: (pasaje: number, incidentes: string, nota: string) => void
}) {
  const [pasaje, setPasaje] = useState(calle.pasaje > 0 ? String(calle.pasaje) : '')
  const [incidentes, setIncidentes] = useState<string[]>([])
  const [nota, setNota] = useState('')
  const yaPuesto = useRef(false)
  const [ahora] = useState(Date.now)
  const unidades = salida.ventas.reduce((a, v) => a + v.cantidad, 0)
  const devuelven = trabajador && (salida.prueba || unidades < calle.minimoPasaje)
  const texto = incidentes.join(', ').slice(0, 80)
  return (
    <form onSubmit={e => {
      e.preventDefault()
      if (yaPuesto.current) return
      yaPuesto.current = true
      onTerminar(Number(pasaje || 0), texto, nota.trim())
    }}>
      <h2>Terminar en {salida.lugar}</h2>
      <p className="mut">Llevas {unidades} vendido{unidades === 1 ? '' : 's'} en {duracion(salida.inicio, ahora)}.</p>
      <div className="campo">
        <label htmlFor="pasaje">¿Cuánto gastaste en pasajes (ida y vuelta)?</label>
        <CampoNumero id="pasaje" miles autoFocus value={pasaje} onCambio={setPasaje} placeholder="Ej. 7.800" />
        {devuelven && <small className="mut">Como {salida.prueba ? 'fue una salida de prueba' : 'vendiste menos de ' + calle.minimoPasaje}, se te devuelve el pasaje.</small>}
      </div>
      <div className="campo">
        <label>¿Pasó algo?</label>
        <div className="chips">
          {INCIDENTES.map(i => (
            <button type="button" key={i} className={incidentes.includes(i) ? 'on' : ''}
              onClick={() => setIncidentes(l => (l.includes(i) ? l.filter(x => x !== i) : [...l, i]))}>{i}</button>
          ))}
        </div>
      </div>
      <div className="campo">
        <label htmlFor="nota-salida">Algo más para el dueño (opcional)</label>
        <input id="nota-salida" maxLength={200} value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej: a las 5 llegó mucha gente" />
      </div>
      <button className="big primario" type="submit">Terminar salida</button>
    </form>
  )
}

/** Tres botones grandes: un toque y el dueño recibe el aviso con el lugar y un link al mapa. */
function Alerta({ avisar, onCerrar }: { avisar: (m: string) => void; onCerrar: () => void }) {
  const [enviando, setEnviando] = useState<TipoAlerta | null>(null)
  const mandar = async (tipo: TipoAlerta) => {
    if (enviando) return
    setEnviando(tipo)
    vibrar()
    try {
      const ubic = await ubicacion(5000)
      await api.sos({ clientUid: nuevoUid(), tipo, lat: ubic?.lat, lng: ubic?.lng })
      avisar('🚨 Alerta enviada al dueño')
      onCerrar()
    } catch {
      avisar('⚠️ No salió la alerta: no hay señal. Llámalo ya.')
      setEnviando(null)
    }
  }
  return (
    <div className="calle-alerta">
      <h2>¿Qué pasó?</h2>
      <p className="mut">Le llega al dueño por Telegram con quién eres, dónde estás y un link al mapa.</p>
      <button type="button" className="big peligro" disabled={!!enviando} onClick={() => void mandar('HURTO')}>
        {enviando === 'HURTO' ? 'Enviando…' : '🚨 Me robaron / hurto'}
      </button>
      <button type="button" className="big peligro" disabled={!!enviando} onClick={() => void mandar('POLICIA')}>
        {enviando === 'POLICIA' ? 'Enviando…' : '🚓 Llegó la policía'}
      </button>
      <button type="button" className="big peligro" disabled={!!enviando} onClick={() => void mandar('AYUDA')}>
        {enviando === 'AYUDA' ? 'Enviando…' : '🆘 Necesito ayuda'}
      </button>
      <button type="button" className="big ghost" disabled={!!enviando} onClick={onCerrar}>Cancelar</button>
    </div>
  )
}
