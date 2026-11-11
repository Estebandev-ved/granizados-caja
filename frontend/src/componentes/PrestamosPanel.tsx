import { useState } from 'react'
import { api } from '../api'
import { pesos } from '../formato'
import type { LugarPlata, PrestamoEquipo, Trabajador } from '../tipos'
import { CampoNumero } from './CampoNumero'
import { Icono } from './Icono'

const RAPIDOS = [5_000, 10_000, 20_000]

export const NOMBRE_LUGAR: Record<LugarPlata, string> = { CAJA: 'la caja', CASA: 'la casa', NEQUI: 'Nequi' }

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })
}

/**
 * Plata que le prestas (adelantas) a un trabajador. Sale de Mi plata del lugar que escojas y se le descuenta sola en
 * el próximo «Ya le pagué». Mientras no se le descuente, se puede borrar si te equivocaste.
 */
export function PrestamosPanel({ t, prestamos, onCambio }: {
  t: Trabajador
  /** Los que todavía no se le descuentan. */
  prestamos: PrestamoEquipo[]
  onCambio: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [monto, setMonto] = useState('')
  const [lugar, setLugar] = useState<LugarPlata>('CAJA')
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const valor = Number(monto) || 0
  const total = prestamos.reduce((a, p) => a + p.monto, 0)

  const accion = async (hacer: () => Promise<unknown>) => {
    if (enviando) return
    setEnviando(true)
    setError('')
    try {
      await hacer()
      setMonto('')
      setNota('')
      setAbierto(false)
      onCambio()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar, revisa la señal.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="list">
      <h3><Icono nombre="moneda" /> Préstamos</h3>
      {prestamos.length ? (
        <>
          <p className="mut" style={{ margin: '0 0 6px' }}>Se le descuentan en el próximo pago: {pesos(total)}.</p>
          {prestamos.map(p => (
            <div className="row" key={p.id}>
              <span className="mut">{fecha(p.creadoEn)} · {pesos(p.monto)} de {NOMBRE_LUGAR[p.lugar]}{p.nota ? ' · ' + p.nota : ''}</span>
              <button className="chico-ghost" disabled={enviando} onClick={() => void accion(() => api.quitarPrestamo(p.id))}>Borrar</button>
            </div>
          ))}
        </>
      ) : <p className="mut" style={{ margin: '0 0 6px' }}>No le debes nada prestado. Si le adelantas plata, anótala acá y se le descuenta sola cuando le pagues.</p>}

      {t.activo && !abierto && (
        <button className="big ghost" style={{ marginTop: 8 }} onClick={() => setAbierto(true)}>Le presté plata</button>
      )}
      {abierto && (
        <div style={{ marginTop: 10 }}>
          <div className="chips izq" style={{ marginBottom: 8 }}>
            {RAPIDOS.map(n => <button key={n} type="button" className={valor === n ? 'on' : ''} onClick={() => setMonto(String(n))}>{pesos(n)}</button>)}
          </div>
          <div className="campo">
            <label htmlFor={'prestamo-' + t.id}>¿Cuánto le prestaste?</label>
            <CampoNumero id={'prestamo-' + t.id} miles max={9} value={monto} onCambio={setMonto} />
          </div>
          <div className="campo">
            <label>¿De dónde salió?</label>
            <div className="chips izq" role="radiogroup" aria-label="De dónde salió la plata">
              {(['CAJA', 'CASA', 'NEQUI'] as LugarPlata[]).map(l => (
                <button type="button" role="radio" aria-checked={lugar === l} key={l} className={lugar === l ? 'on' : ''}
                  onClick={() => setLugar(l)}>{l === 'CAJA' ? 'Caja' : l === 'CASA' ? 'Casa' : 'Nequi'}</button>
              ))}
            </div>
          </div>
          <div className="campo">
            <label htmlFor={'prestamo-nota-' + t.id}>Para qué (opcional)</label>
            <input id={'prestamo-nota-' + t.id} maxLength={120} value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej: para el bus" />
          </div>
          <p className="mut">Sale de tu plata en {NOMBRE_LUGAR[lugar]} y se le descuenta de su próximo pago. Él lo ve en Mi día.</p>
          {error && <p className="aviso">{error}</p>}
          <div className="acciones">
            <button className="big primario" disabled={valor <= 0 || enviando}
              onClick={() => void accion(() => api.prestar(t.id, { monto: valor, lugar, nota: nota.trim() || undefined }))}>
              {valor > 0 ? 'Le presté ' + pesos(valor) : 'Escribe el monto'}
            </button>
            <button className="big ghost" onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
