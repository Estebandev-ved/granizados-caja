import { useState } from 'react'
import type { Terminos } from '../tipos'

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Bogota' })
}

/**
 * Los términos del trabajo. Con `onAceptar` es la pantalla que el trabajador tiene que aceptar para empezar;
 * sin él, solo se lee (y dice cuándo los aceptó).
 */
export function TerminosTrabajo({ terminos, onAceptar }: { terminos: Terminos; onAceptar?: () => Promise<void> }) {
  const [leido, setLeido] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const aceptar = async () => {
    if (!onAceptar || enviando) return
    setEnviando(true)
    try {
      await onAceptar()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="terminos">
      <h2>{terminos.titulo}</h2>
      {terminos.secciones.map(s => (
        <section key={s.titulo}>
          <h3>{s.titulo}</h3>
          <ul>{s.lineas.map(l => <li key={l}>{l}</li>)}</ul>
        </section>
      ))}
      {onAceptar ? (
        <div className="terminos-pie">
          <label className="terminos-check">
            <input type="checkbox" checked={leido} onChange={e => setLeido(e.target.checked)} />
            <span>Leí los términos, los entendí y estoy de acuerdo.</span>
          </label>
          <button className="big" disabled={!leido || enviando} onClick={() => void aceptar()}>
            {enviando ? 'Guardando…' : 'Aceptar y empezar'}
          </button>
        </div>
      ) : terminos.aceptadaEn && (
        <p className="mut">Los aceptaste el {fechaLarga(terminos.aceptadaEn)}.</p>
      )}
    </div>
  )
}
