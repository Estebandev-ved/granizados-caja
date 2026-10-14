import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { nuevoUid } from '../estadoLocal'
import { enlaceRecordatorio } from '../fiados'
import { pesos } from '../formato'
import type { Fiado } from '../tipos'
import { Icono } from './Icono'

function diasDesde(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

/** Los que te deben: se ve en Hoy. Necesita señal; sin ella simplemente no sale. */
export function MeDeben({ avisar, versionVentas }: { avisar: (m: string) => void; versionVentas: number }) {
  const [lista, setLista] = useState<Fiado[]>([])
  const [cobrando, setCobrando] = useState<number | null>(null)
  const [poniendoCel, setPoniendoCel] = useState<number | null>(null)
  const [cel, setCel] = useState('')

  const cargar = useCallback(() => {
    api.fiados().then(setLista).catch(() => { /* sin señal: no se muestra */ })
  }, [])
  // Se vuelve a pedir cuando cambian las ventas de hoy (por si acabas de fiar algo)
  useEffect(() => { cargar() }, [cargar, versionVentas])

  if (!lista.length) return null
  const total = lista.reduce((a, f) => a + f.monto, 0)

  const cobrar = async (f: Fiado, lugar: 'CAJA' | 'NEQUI') => {
    try {
      await api.cobrarFiado(f.id, lugar, nuevoUid())
      avisar('✓ ' + f.cliente + ' pagó ' + pesos(f.monto))
      setCobrando(null)
      cargar()
    } catch {
      avisar('⚠️ No se pudo anotar el pago, revisa la señal')
    }
  }

  const guardarCel = async (f: Fiado) => {
    try {
      await api.telefonoFiado(f.id, cel)
      setPoniendoCel(null)
      setCel('')
      cargar()
    } catch {
      avisar('⚠️ No se pudo guardar el número')
    }
  }

  return (
    <div className="list">
      <h3><Icono nombre="ticket" /> Me deben <span className="deuda-total">{pesos(total)}</span></h3>
      {lista.map(f => {
        const enlace = enlaceRecordatorio(f)
        const dias = diasDesde(f.creadaEn)
        return (
          <div className="deuda-fila" key={f.id}>
            <div className="deuda-cabeza">
              <b>{f.cliente}</b>
              <b>{pesos(f.monto)}</b>
            </div>
            <span className="mut">{f.detalle} · {dias === 0 ? 'hoy' : 'hace ' + dias + (dias === 1 ? ' día' : ' días')}</span>

            {poniendoCel === f.id && (
              <form className="campo" onSubmit={e => { e.preventDefault(); void guardarCel(f) }}>
                <label htmlFor={'cel-' + f.id}>Celular de {f.cliente}</label>
                <input id={'cel-' + f.id} inputMode="tel" autoFocus value={cel} onChange={e => setCel(e.target.value)} placeholder="3001234567" />
                <button type="submit" className="big ghost" disabled={cel.replace(/\D/g, '').length < 7}>Guardar número</button>
              </form>
            )}

            {cobrando === f.id ? (
              <div className="deuda-acciones">
                <button type="button" className="big cash" onClick={() => void cobrar(f, 'CAJA')}>Pagó en efectivo</button>
                <button type="button" className="big nequi" onClick={() => void cobrar(f, 'NEQUI')}>Pagó por Nequi</button>
                <button type="button" className="big ghost" onClick={() => setCobrando(null)}>Cancelar</button>
              </div>
            ) : (
              <div className="deuda-acciones">
                {enlace ? (
                  <a className="big ghost" style={{ textAlign: 'center', textDecoration: 'none' }} href={enlace}
                    target="_blank" rel="noopener noreferrer">Recordar por WhatsApp</a>
                ) : (
                  <button type="button" className="big ghost" onClick={() => { setPoniendoCel(f.id); setCel('') }}>Pedir su número</button>
                )}
                <button type="button" className="big primario" onClick={() => setCobrando(f.id)}>Ya pagó</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
