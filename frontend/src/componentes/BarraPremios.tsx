import { pesos } from '../formato'
import type { PremiosDia } from '../tipos'

/** Los premios del día de un trabajador: cuántos lleva y cuánto le falta para el siguiente escalón. */
export function BarraPremios({ premios }: { premios: PremiosDia }) {
  const { escalones, vendidas, premio, siguiente } = premios
  if (!escalones.length) return null

  const tope = escalones[escalones.length - 1].granizados
  const pct = Math.min(100, Math.round(vendidas / tope * 100))
  const alcanzados = escalones.filter(e => vendidas >= e.granizados).length

  return (
    <div className="barra-meta logros" role="progressbar" aria-valuemin={0} aria-valuemax={tope} aria-valuenow={vendidas}
      aria-label={`${vendidas} de ${tope} granizados para el premio máximo de hoy`}>
      <div className="barra-meta-cabeza">
        <span className={'k' + (premio > 0 ? ' on' : '')}>
          {premio > 0 ? 'Premio de hoy · ' + pesos(premio) : premios.diaPromo ? 'Premios de promo' : 'Premios de hoy'}
        </span>
        <span className="n">
          {vendidas}
          {siguiente ? ` · ${siguiente.granizados - vendidas} para ganar ${pesos(siguiente.total)}` : ' · ¡el máximo!'}
        </span>
      </div>
      <div className="logros-pista">
        <div className="barra-meta-pista">
          <div className={'barra-meta-barra' + (premio > 0 ? ' on' : '')} style={{ width: pct + '%' }} />
        </div>
        {escalones.map((e, i) => (
          <span key={e.granizados} className={'logro-hito' + (alcanzados > i ? ' on' : '')}
            style={{ left: Math.round(e.granizados / tope * 100) + '%' }} aria-hidden="true">
            {i === escalones.length - 1 ? '★' : '•'}
          </span>
        ))}
      </div>
    </div>
  )
}
