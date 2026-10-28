import { pesos } from '../formato'
import { NIVELES, nivelAlcanzado } from '../logros'
import type { MetaEquipo } from '../tipos'

/** La barra de logros de un trabajador: lleva sus granizados del día contra la meta del dueño. */
export function BarraLogros({ meta }: { meta: MetaEquipo }) {
  const nivel = nivelAlcanzado(meta)
  const tope = Math.ceil(meta.unidades * 1.5)
  const pct = Math.min(100, Math.round(meta.vendidas / tope * 100))
  const cumplida = nivel >= 2
  const siguiente = NIVELES[nivel]
  const faltan = siguiente ? Math.ceil(meta.unidades * siguiente.fraccion) - meta.vendidas : 0

  return (
    <div className="barra-meta logros" role="progressbar" aria-valuemin={0} aria-valuemax={tope} aria-valuenow={meta.vendidas}
      aria-label={`${meta.vendidas} de ${meta.unidades} granizados, meta de hoy`}>
      <div className="barra-meta-cabeza">
        <span className={'k' + (cumplida ? ' on' : '')}>
          {nivel === 0 ? `Meta de hoy · ${meta.unidades}` : NIVELES[nivel - 1].nombre}
        </span>
        <span className="n">
          {meta.vendidas}/{meta.unidades}
          {siguiente ? ` · faltan ${faltan}` : ' · ¡lo lograste!'}
        </span>
      </div>
      <div className="logros-pista">
        <div className="barra-meta-pista">
          <div className={'barra-meta-barra' + (cumplida ? ' on' : '')} style={{ width: pct + '%' }} />
        </div>
        {NIVELES.map((n, i) => (
          <span key={n.nombre} className={'logro-hito' + (nivel > i ? ' on' : '')}
            style={{ left: Math.round(n.fraccion / 1.5 * 100) + '%' }} aria-hidden="true">
            {i === 1 ? '★' : '•'}
          </span>
        ))}
      </div>
      <div className="logros-pie">
        {meta.premio > 0 && (
          <span className={cumplida ? 'on' : ''}>{cumplida ? '✓ Ganaste ' : 'Premio por la meta: '}{pesos(meta.premio)}</span>
        )}
        {meta.racha > 0 && <span className="on">{meta.racha} día{meta.racha === 1 ? '' : 's'} seguido{meta.racha === 1 ? '' : 's'} cumpliendo</span>}
      </div>
    </div>
  )
}
