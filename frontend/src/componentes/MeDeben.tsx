import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../api'
import { nuevoUid } from '../estadoLocal'
import { enlaceRecordatorio, recordadoHoy } from '../fiados'
import { pesos } from '../formato'
import type { ListaFiados, PersonaFiado } from '../tipos'
import { Icono } from './Icono'

type Accion = { cliente: string; que: 'cobrar' | 'celular' | 'bot' }

function diasDesde(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

/** Los que te deben, una tarjeta por persona con todo junto. Necesita señal; sin ella simplemente no sale. */
export function MeDeben({ avisar, versionVentas }: { avisar: (m: string) => void; versionVentas: number }) {
  const [lista, setLista] = useState<ListaFiados | null>(null)
  const [accion, setAccion] = useState<Accion | null>(null)
  const [cel, setCel] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(() => {
    api.fiados().then(setLista).catch(() => { /* sin señal: no se muestra */ })
  }, [])
  // Se vuelve a pedir cuando cambian las ventas de hoy (por si acabas de fiar algo)
  useEffect(() => { cargar() }, [cargar, versionVentas])

  if (!lista || !lista.personas.length) return null

  const ids = (p: PersonaFiado) => p.deudas.map(d => d.id)
  const cerrar = () => { setAccion(null); setCel(''); setEnviando(false) }
  const error = (e: unknown, porDefecto: string) => avisar('⚠️ ' + (e instanceof ApiError || e instanceof Error ? e.message : porDefecto))

  const cobrar = async (p: PersonaFiado, lugar: 'CAJA' | 'NEQUI') => {
    try {
      await api.cobrarFiado(ids(p), lugar, nuevoUid())
      avisar('✓ ' + p.cliente + ' pagó ' + pesos(p.total))
      cerrar()
      cargar()
    } catch (e) { error(e, 'No se pudo anotar el pago, revisa la señal') }
  }

  const guardarCel = async (p: PersonaFiado) => {
    try {
      await api.telefonoFiado(p.deudas[0].id, cel)
      cerrar()
      cargar()
    } catch (e) { error(e, 'No se pudo guardar el número') }
  }

  const enviarBot = async (p: PersonaFiado) => {
    setEnviando(true)
    try {
      await api.recordarFiado(ids(p))
      avisar('✓ Recordatorio enviado a ' + p.cliente)
      cerrar()
      cargar()
    } catch (e) {
      setEnviando(false)
      error(e, 'No se pudo enviar')
    }
  }

  return (
    <div className="list">
      <h3><Icono nombre="ticket" /> Me deben <span className="deuda-total">{pesos(lista.total)}</span></h3>
      {lista.personas.map(p => {
        const enlace = enlaceRecordatorio(p)
        const abierta = accion?.cliente === p.cliente ? accion.que : null
        const avisado = recordadoHoy(p)
        return (
          <div className="deuda-fila" key={p.cliente}>
            <div className="deuda-cabeza">
              <b>{p.cliente}</b>
              <b>{pesos(p.total)}</b>
            </div>
            <ul className="deuda-detalle mut">
              {p.deudas.map(d => {
                const dias = diasDesde(d.creadaEn)
                return <li key={d.id}>{d.detalle} · {pesos(d.monto)} · {dias === 0 ? 'hoy' : 'hace ' + dias + (dias === 1 ? ' día' : ' días')}</li>
              })}
            </ul>
            {p.telefono && <span className="mut">📱 {p.telefono}{avisado ? ' · ya le avisaste hoy' : ''}</span>}

            {abierta === 'celular' && (
              <form className="campo" onSubmit={e => { e.preventDefault(); void guardarCel(p) }}>
                <label htmlFor={'cel-' + p.cliente}>Celular de {p.cliente}</label>
                <input id={'cel-' + p.cliente} inputMode="tel" autoFocus value={cel} onChange={e => setCel(e.target.value)} placeholder="3001234567" />
                <button type="submit" className="big ghost" disabled={cel.replace(/\D/g, '').length < 7}>Guardar número</button>
                <button type="button" className="big ghost" onClick={cerrar}>Cancelar</button>
              </form>
            )}

            {abierta === 'bot' && (
              <div className="deuda-vista">
                <p className="mut">Esto le llega a {p.telefono} por WhatsApp:</p>
                <pre className="deuda-mensaje">{p.mensaje}</pre>
                <div className="deuda-acciones">
                  <button type="button" className="big primario" disabled={enviando} onClick={() => void enviarBot(p)}>
                    {enviando ? 'Enviando…' : 'Enviar ahora'}
                  </button>
                  <button type="button" className="big ghost" onClick={cerrar}>Cancelar</button>
                </div>
              </div>
            )}

            {abierta === 'cobrar' && (
              <div className="deuda-acciones">
                <button type="button" className="big cash" onClick={() => void cobrar(p, 'CAJA')}>Pagó en efectivo</button>
                <button type="button" className="big nequi" onClick={() => void cobrar(p, 'NEQUI')}>Pagó por Nequi</button>
                <button type="button" className="big ghost" onClick={cerrar}>Cancelar</button>
              </div>
            )}

            {!abierta && (
              <div className="deuda-acciones">
                {!p.telefono && (
                  <button type="button" className="big ghost" onClick={() => setAccion({ cliente: p.cliente, que: 'celular' })}>Pedir su número</button>
                )}
                {p.telefono && lista.bot && (
                  <button type="button" className="big ghost" disabled={avisado}
                    onClick={() => setAccion({ cliente: p.cliente, que: 'bot' })}>
                    {avisado ? 'Ya se le avisó hoy' : 'Enviar recordatorio'}
                  </button>
                )}
                {enlace && !lista.bot && (
                  <a className="big ghost" style={{ textAlign: 'center', textDecoration: 'none' }} href={enlace}
                    target="_blank" rel="noopener noreferrer">Recordar por WhatsApp</a>
                )}
                <button type="button" className="big primario" onClick={() => setAccion({ cliente: p.cliente, que: 'cobrar' })}>Ya pagó</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
