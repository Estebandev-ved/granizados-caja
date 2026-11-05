import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { pesos } from '../formato'
import type { BaseVueltos, Trabajador } from '../tipos'
import { CampoNumero } from './CampoNumero'
import { Icono } from './Icono'

const RAPIDOS = [10_000, 20_000, 50_000]

/** Plata de la caja en efectivo que le pasas al trabajador para que tenga con qué dar vueltos. Él la devuelve al cerrar. */
export function BaseVueltosPanel({ t, onCambio }: { t: Trabajador; onCambio: () => void }) {
  const [base, setBase] = useState<BaseVueltos | null>(null)
  const [monto, setMonto] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const traer = useCallback(() => api.baseTrabajador(t.id).then(setBase).catch(() => setBase(null)), [t.id])
  useEffect(() => { void traer() }, [traer])

  const accion = async (hacer: () => Promise<BaseVueltos>) => {
    if (enviando) return
    setEnviando(true)
    setError('')
    try {
      setBase(await hacer())
      setMonto('')
      onCambio()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar, revisa la señal.')
    } finally {
      setEnviando(false)
    }
  }

  const valor = Number(monto) || 0

  return (
    <div className="list">
      <h3><Icono nombre="billete" /> Plata para vueltos</h3>
      <p className="mut" style={{ margin: '0 0 8px' }}>
        Efectivo que le pasas de la caja para que tenga con qué devolver. Él te lo devuelve al terminar el día, junto con lo que recaudó.
      </p>
      {base && base.total > 0 && (
        <div className="row"><span>Le has pasado hoy</span><b>{pesos(base.total)}</b></div>
      )}
      {base?.entregas.map(e => (
        <div className="row" key={e.id}>
          <span className="mut">
            {new Date(e.creadaEn).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' })} · {pesos(e.monto)}
          </span>
          <button className="chico-ghost" disabled={enviando} onClick={() => void accion(() => api.quitarBase(e.id))}>Deshacer</button>
        </div>
      ))}
      {t.activo && (
        <>
          <div className="chips" style={{ marginTop: 10, marginBottom: 8 }}>
            {RAPIDOS.map(n => <button key={n} type="button" onClick={() => setMonto(String(n))}>{pesos(n)}</button>)}
          </div>
          <div className="campo">
            <label htmlFor={'base-' + t.id}>¿Cuánto le pasas?</label>
            <CampoNumero id={'base-' + t.id} max={8} value={monto} onCambio={setMonto} />
          </div>
          {error && <p className="aviso">{error}</p>}
          <button className="big primario" disabled={valor <= 0 || enviando} onClick={() => void accion(() => api.pasarBase(t.id, valor))}>
            {valor > 0 ? 'Le pasé ' + pesos(valor) + ' de la caja' : 'Escribe el monto'}
          </button>
        </>
      )}
    </div>
  )
}
