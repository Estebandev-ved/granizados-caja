import { useEffect, useState } from 'react'
import { api } from '../api'
import { pesos } from '../formato'
import { escaleraAuto } from '../premios'
import type { BonosEquipo, BonoTrabajador, Escalon } from '../tipos'

const PARTES = [30, 35, 40, 45]

/**
 * Ajustes → Equipo: los bonos automáticos («lo que vendes de más, lo partimos»). La app saca el día normal de cada
 * trabajador y arma su escalera; aquí se prenden, se escoge qué parte de lo extra se lleva el trabajador y se ve cómo le
 * queda a cada uno antes de guardar (misma cuenta que el servidor, `escaleraAuto`).
 */
export function BonosAutomaticos({ activo, parte, rebaja, onActivo, onParte }: {
  activo: boolean
  parte: number
  /** Lo que bajan los premios en promo si todavía no hay ventas en promo para saber cuánto deja un granizado. */
  rebaja: number
  onActivo: (activo: boolean) => void
  onParte: (parte: number) => void
}) {
  const [datos, setDatos] = useState<BonosEquipo | null | 'error'>(null)
  useEffect(() => {
    let vivo = true
    api.bonosEquipo().then(d => { if (vivo) setDatos(d) }).catch(() => { if (vivo) setDatos('error') })
    return () => { vivo = false }
  }, [])

  return (
    <div className="list">
      <h3>⚡ Bonos automáticos</h3>
      <p className="ayuda">
        La app arma sola los premios de cada trabajador con sus propias ventas. Lo que venda por encima de su día normal
        lo parten: una parte para él y el resto para ti. Solo pagas por granizados que no se iban a vender.
      </p>
      <div className="chips">
        <button type="button" className={activo ? 'on' : ''} onClick={() => onActivo(true)}>Automáticos</button>
        <button type="button" className={activo ? '' : 'on'} onClick={() => onActivo(false)}>A mano</button>
      </div>
      {!activo && <p className="mut">Con «A mano» mandan los premios del día que tú pones abajo.</p>}
      {activo && (
        <>
          <p className="mut" style={{ margin: '10px 0 4px' }}>¿Cuánto de lo extra se lleva el trabajador?</p>
          <div className="chips">
            {PARTES.map(n => (
              <button type="button" key={n} className={parte === n ? 'on' : ''} onClick={() => onParte(n)}>
                {n} %{n === 40 ? ' (recomendado)' : ''}
              </button>
            ))}
          </div>
          <p className="mut">
            Pasando un 30 % arriba de su día normal se lleva 5 puntos más (máximo 45 %), para que valga la pena ir por el
            premio gordo. A ti siempre te queda el 55 % o más de cada granizado de más, y todo lo de un día normal.
          </p>
          {datos === null && <p className="mut">Cargando cómo le queda a cada uno…</p>}
          {datos === 'error' && <p className="aviso">No se pudo traer cómo le queda a cada uno, revisa la señal.</p>}
          {datos && datos !== 'error' && !datos.trabajadores.length && <p className="mut">Todavía no tienes trabajadores activos.</p>}
          {datos && datos !== 'error' && datos.trabajadores.map(t => (
            <Trabajador key={t.vendedorId} t={t} parte={parte} rebaja={rebaja} />
          ))}
        </>
      )}
    </div>
  )
}

function Trabajador({ t, parte, rebaja }: { t: BonoTrabajador; parte: number; rebaja: number }) {
  if (t.margen <= 0) {
    return (
      <div className="bono-trabajador">
        <b>{t.nombre}</b>
        <p className="aviso">Todavía no se sabe cuánto deja cada granizado (faltan ventas con costo). Mientras tanto le aplican los premios a mano.</p>
      </div>
    )
  }
  const normal = escaleraAuto(t.base, t.margen, parte)
  const promo = t.margenPromo !== null
    ? escaleraAuto(t.base, t.margenPromo, parte)
    : normal.map(e => ({ granizados: e.granizados, total: Math.max(0, e.total - rebaja) })).filter(e => e.total > 0)
  const paraEl = Math.floor(t.margen * parte / 100)
  return (
    <div className="bono-trabajador">
      <b>{t.nombre}</b>
      <small className="mut">
        Su día normal: {t.base} granizados{t.pocosDatos ? ' (todavía usa el del equipo: lleva pocos días)' : ' (sus últimas 4 semanas)'}
      </small>
      <small>Cada granizado de más: <b>{pesos(paraEl)}</b> para él y <b>{pesos(t.margen - paraEl)}</b> para ti, además de su comisión.</small>
      <Escalera escalones={normal} />
      {promo.length > 0 && <small className="mut">Día de promo: {promo.map(e => e.granizados + ' → ' + pesos(e.total)).join(' · ')}</small>}
    </div>
  )
}

function Escalera({ escalones }: { escalones: Escalon[] }) {
  if (!escalones.length) return <small className="mut">Con estos números no alcanza para un premio.</small>
  return (
    <div className="bono-escalera">
      {escalones.map((e, i) => (
        <span key={e.granizados} className={i === escalones.length - 1 ? 'gordo' : ''}>
          <small>{i === escalones.length - 1 ? '🏆 ' : ''}{e.granizados}</small>
          <b>{pesos(e.total)}</b>
        </span>
      ))}
    </div>
  )
}
