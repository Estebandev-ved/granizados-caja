import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { pesos } from '../formato'
import type { EntregaEquipo } from '../tipos'
import { CampoNumero } from './CampoNumero'
import { Icono } from './Icono'
import { fechaHora } from './PagoTrabajador'

export const ETIQUETA_ENTREGA: Record<EntregaEquipo['estado'], string> = {
  PENDIENTE: 'Esperando que el dueño confirme',
  RECIBIDA: 'El dueño confirmó',
  NO_RECIBIDA: 'El dueño dice que no la recibió',
}

function detalle(e: EntregaEquipo): string {
  const partes: string[] = []
  if (e.efectivo > 0) partes.push(pesos(e.efectivo) + ' en efectivo')
  if (e.nequi > 0) partes.push(pesos(e.nequi) + ' por Nequi')
  if (e.transferencia > 0) partes.push(pesos(e.transferencia) + ' por otra transferencia')
  return partes.join(' · ')
}

/** El trabajador dice cuánto le entregó al dueño (efectivo, Nequi u otra transferencia) y ve si el dueño ya lo confirmó. */
export function EntregaAlDueno({ sugerido }: { sugerido?: number }) {
  const [lista, setLista] = useState<EntregaEquipo[]>([])
  const [efectivo, setEfectivo] = useState(sugerido && sugerido > 0 ? String(sugerido) : '')
  const [nequi, setNequi] = useState('')
  const [transferencia, setTransferencia] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const traer = useCallback(() => api.misEntregas().then(setLista).catch(() => { /* sin señal: se vuelve a pedir */ }), [])
  useEffect(() => {
    void traer()
    const reloj = window.setInterval(() => { void traer() }, 15_000)
    return () => window.clearInterval(reloj)
  }, [traer])

  const e = Number(efectivo) || 0
  const n = Number(nequi) || 0
  const t = Number(transferencia) || 0
  const total = e + n + t
  const pendiente = lista.find(x => x.estado === 'PENDIENTE')

  const enviar = async () => {
    if (enviando || total <= 0) return
    setEnviando(true)
    setError('')
    try {
      await api.entregarAlDueno(e, n, t)
      setEfectivo('')
      setNequi('')
      setTransferencia('')
      await traer()
    } catch (x) {
      setError(x instanceof Error ? x.message : 'No se pudo guardar, revisa la señal.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="list">
      <h3><Icono nombre="billete" /> Lo que le entregué al dueño</h3>
      {!pendiente && (
        <>
          <p className="mut" style={{ margin: '0 0 8px' }}>
            Escribe cuánto le diste, separado por cómo te pagaron. Le llega un aviso y él confirma si es verdad.
          </p>
          <div className="campo">
            <label htmlFor="ent-efectivo">En efectivo</label>
            <CampoNumero id="ent-efectivo" max={8} value={efectivo} onCambio={setEfectivo} />
          </div>
          <div className="campo">
            <label htmlFor="ent-nequi">Lo que pagaron por Nequi</label>
            <CampoNumero id="ent-nequi" max={8} value={nequi} onCambio={setNequi} />
          </div>
          <div className="campo">
            <label htmlFor="ent-otra">Lo que pagaron por otra transferencia</label>
            <CampoNumero id="ent-otra" max={8} value={transferencia} onCambio={setTransferencia} />
          </div>
          {error && <p className="aviso">{error}</p>}
          <button className="big primario" disabled={total <= 0 || enviando} onClick={() => void enviar()}>
            {total > 0 ? 'Le entregué ' + pesos(total) : 'Escribe cuánto entregaste'}
          </button>
        </>
      )}
      {pendiente && (
        <p className="mut" style={{ margin: 0 }}>
          Dijiste que entregaste {pesos(pendiente.monto)}. Falta que el dueño lo confirme.
        </p>
      )}
      {lista.map(x => (
        <div className="pago-hist" key={x.id}>
          <div className="sabor-cabeza">
            <b>{pesos(x.monto)}</b>
            <span className={'eq-tag ' + (x.estado === 'RECIBIDA' ? 'ok' : x.estado === 'NO_RECIBIDA' ? 'mal' : 'aviso-tag')}>
              {ETIQUETA_ENTREGA[x.estado]}
            </span>
          </div>
          <span className="mut">{fechaHora(x.creadaEn)} · {detalle(x)}</span>
        </div>
      ))}
    </div>
  )
}

/** Lo que el trabajador dice que te entregó: tú confirmas si es verdad. */
export function EntregasDelTrabajador({ id, version, onCambio }: { id: number; version: string; onCambio: () => void }) {
  const [lista, setLista] = useState<EntregaEquipo[]>([])
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let vivo = true
    api.entregasTrabajador(id).then(l => { if (vivo) setLista(l) }).catch(() => { /* sin señal */ })
    return () => { vivo = false }
  }, [id, version])

  const responder = async (entrega: EntregaEquipo, recibida: boolean) => {
    if (enviando) return
    setEnviando(true)
    setError('')
    try {
      const nueva = await api.responderEntrega(entrega.id, recibida)
      setLista(l => l.map(x => (x.id === nueva.id ? nueva : x)))
      onCambio()
    } catch (x) {
      setError(x instanceof Error ? x.message : 'No se pudo guardar, revisa la señal.')
    } finally {
      setEnviando(false)
    }
  }

  if (!lista.length) return null
  return (
    <div className="list">
      <h3><Icono nombre="billete" /> Lo que dice que te entregó</h3>
      {error && <p className="aviso">{error}</p>}
      {lista.map(x => (
        <div className="pago-hist" key={x.id}>
          <div className="sabor-cabeza">
            <b>{pesos(x.monto)}</b>
            <span className={'eq-tag ' + (x.estado === 'RECIBIDA' ? 'ok' : x.estado === 'NO_RECIBIDA' ? 'mal' : 'aviso-tag')}>
              {x.estado === 'RECIBIDA' ? 'La recibiste ✓' : x.estado === 'NO_RECIBIDA' ? 'Dijiste que no' : 'Por confirmar'}
            </span>
          </div>
          <span className="mut">{fechaHora(x.creadaEn)} · {detalle(x)}</span>
          {x.estado === 'PENDIENTE' && (
            <div className="acciones">
              <button className="big primario" disabled={enviando} onClick={() => void responder(x, true)}>Sí, la recibí</button>
              <button className="big ghost" disabled={enviando} onClick={() => void responder(x, false)}>No es verdad</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
