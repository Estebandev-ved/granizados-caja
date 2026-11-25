import { useEffect, useState } from 'react'
import { api } from '../api'
import type { NotaTrabajador, Trabajador } from '../tipos'
import { Icono } from './Icono'

const MAX = 300

function cuando(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' })
}

/**
 * Equipo → un trabajador → Notas: el dueño le deja un aviso corto (o a todo el equipo) y ve si ya lo leyó. Al
 * trabajador no le salta nada encima: le aparece un punto en Mi día y una línea en Vender hasta que la marque leída.
 */
export function NotasPanel({ t }: { t: Trabajador }) {
  const [notas, setNotas] = useState<NotaTrabajador[] | null>(null)
  const [texto, setTexto] = useState('')
  const [aTodos, setATodos] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [borrar, setBorrar] = useState<number | null>(null)

  const cargar = () => api.notasDe(t.id).then(setNotas).catch(() => setError('No se pudieron traer las notas, revisa la señal.'))
  useEffect(() => {
    let vivo = true
    api.notasDe(t.id).then(l => { if (vivo) setNotas(l) }).catch(() => { if (vivo) setError('No se pudieron traer las notas, revisa la señal.') })
    return () => { vivo = false }
  }, [t.id])

  const mandar = async () => {
    const limpio = texto.trim()
    if (!limpio || enviando) return
    setEnviando(true)
    setError('')
    try {
      if (aTodos) await api.notaATodos(limpio)
      else await api.escribirNota(t.id, limpio)
      setTexto('')
      setATodos(false)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo mandar, revisa la señal.')
    } finally {
      setEnviando(false)
    }
  }

  const quitar = async (id: number) => {
    if (borrar !== id) { setBorrar(id); return }
    try {
      await api.borrarNota(id)
      setBorrar(null)
      await cargar()
    } catch {
      setError('No se pudo borrar, revisa la señal.')
    }
  }

  return (
    <div className="list">
      <h3><Icono nombre="cara" /> Notas para {t.nombre}</h3>
      <p className="ayuda">Un aviso corto que le aparece en Mi día. No le interrumpe la venta: le sale un punto hasta que lo lea.</p>
      <form onSubmit={e => { e.preventDefault(); void mandar() }}>
        <div className="campo">
          <label htmlFor={'nota-' + t.id}>Escríbele</label>
          <textarea id={'nota-' + t.id} className="nota-texto" maxLength={MAX} rows={3} value={texto}
            placeholder="Ej: Mañana empezamos a las 8. Acuérdate de tomar la foto del Nequi."
            onChange={e => setTexto(e.target.value)} />
          <small className="mut">{texto.length}/{MAX}</small>
        </div>
        <label className="check-fila">
          <input type="checkbox" checked={aTodos} onChange={e => setATodos(e.target.checked)} />
          <span>Mandársela a todo el equipo</span>
        </label>
        <button className="big primario" type="submit" disabled={!texto.trim() || enviando}>
          {enviando ? 'Mandando…' : aTodos ? 'Mandar a todos' : 'Mandar a ' + t.nombre}
        </button>
      </form>
      {error && <p className="aviso">{error}</p>}
      {notas && notas.length > 0 && (
        <div className="notas-lista">
          {notas.map(n => (
            <div className="nota-item" key={n.id}>
              <p>{n.texto}</p>
              <small className={n.leidaEn ? 'ok-dinero' : 'mut'}>
                {cuando(n.creadaEn)} · {n.leidaEn ? '✓ La leyó ' + cuando(n.leidaEn) : 'Todavía no la lee'}
              </small>
              <button type="button" className="link" onClick={() => void quitar(n.id)}>
                {borrar === n.id ? 'Toca otra vez para borrarla' : 'Borrar'}
              </button>
            </div>
          ))}
        </div>
      )}
      {notas && notas.length === 0 && <p className="mut">Todavía no le has dejado notas.</p>}
    </div>
  )
}

/** Mi día del trabajador: las notas sin leer arriba, con «Listo, la leí»; las ya leídas, plegadas. */
export function MisNotas({ notas, onLeida }: { notas: NotaTrabajador[]; onLeida: (id: number) => Promise<void> }) {
  const [verLeidas, setVerLeidas] = useState(false)
  const [leyendo, setLeyendo] = useState<number | null>(null)
  if (!notas.length) return null
  const nuevas = notas.filter(n => !n.leidaEn)
  const leidas = notas.filter(n => n.leidaEn)

  const leer = async (id: number) => {
    if (leyendo !== null) return
    setLeyendo(id)
    try {
      await onLeida(id)
    } finally {
      setLeyendo(null)
    }
  }

  return (
    <div className={'list mis-notas' + (nuevas.length ? ' con-nuevas' : '')} id="mis-notas">
      <h3>📝 {nuevas.length ? (nuevas.length === 1 ? 'Tienes una nota nueva' : 'Tienes ' + nuevas.length + ' notas nuevas') : 'Tus notas'}</h3>
      {nuevas.map(n => (
        <div className="nota-item nueva" key={n.id}>
          <p>{n.texto}</p>
          <small className="mut">{cuando(n.creadaEn)}</small>
          <button type="button" className="chico-ghost fuerte" disabled={leyendo === n.id} onClick={() => void leer(n.id)}>
            {leyendo === n.id ? 'Guardando…' : 'Listo, la leí ✓'}
          </button>
        </div>
      ))}
      {leidas.length > 0 && (
        <button type="button" className="link" onClick={() => setVerLeidas(v => !v)}>
          {verLeidas ? 'Ocultar las que ya leíste' : 'Ver las que ya leíste (' + leidas.length + ')'}
        </button>
      )}
      {verLeidas && leidas.map(n => (
        <div className="nota-item" key={n.id}>
          <p>{n.texto}</p>
          <small className="mut">{cuando(n.creadaEn)}</small>
        </div>
      ))}
    </div>
  )
}
