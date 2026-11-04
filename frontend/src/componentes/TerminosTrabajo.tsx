import { useState } from 'react'
import type { Terminos } from '../tipos'
import { Icono } from './Icono'
import { Personaje } from './Personaje'

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Bogota' })
}

/** Un ícono por apartado, para que el texto largo se lea por pedazos. */
const ICONOS: Record<string, string> = {
  'Antes de empezar': 'cara',
  'Tu trabajo': 'vaso',
  'Lo que ganas': 'moneda',
  'El efectivo y el producto': 'caja',
  'Tu granizado': 'trofeo',
  'Cambios y salida': 'refrescar',
}

/**
 * Los términos del trabajo, contados por Nova. Con `onAceptar` es la pantalla que el trabajador tiene que aceptar para
 * empezar; sin él, solo se lee (y dice cuándo los aceptó).
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
      <div className="terminos-hero">
        <Personaje nombre="nova" libre />
        <div>
          <h2>{terminos.titulo}</h2>
          <p>{onAceptar ? 'Nova te cuenta cómo funciona el trabajo. Léelo con calma.' : 'Esto es lo que acordamos.'}</p>
        </div>
      </div>
      {terminos.secciones.map(s => (
        <section className="terminos-seccion" key={s.titulo}>
          <h3>
            <span className="terminos-icono"><Icono nombre={ICONOS[s.titulo] ?? 'cara'} /></span>
            {s.titulo}
          </h3>
          <ul>{s.lineas.map(l => <li key={l}>{l}</li>)}</ul>
        </section>
      ))}
      {onAceptar ? (
        <div className="terminos-pie">
          <label className="terminos-check">
            <input type="checkbox" checked={leido} onChange={e => setLeido(e.target.checked)} />
            <span>Leí los términos, los entendí y estoy de acuerdo.</span>
          </label>
          <button className="big primario" disabled={!leido || enviando} onClick={() => void aceptar()}>
            {enviando ? 'Guardando…' : 'Aceptar y empezar'}
          </button>
        </div>
      ) : terminos.aceptadaEn && (
        <p className="mut">Los aceptaste el {fechaLarga(terminos.aceptadaEn)}.</p>
      )}
    </div>
  )
}
