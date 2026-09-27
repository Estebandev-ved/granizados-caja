import { pesos } from '../formato'

interface Props {
  total: number
  meta: number
  racha: number
}

/** La barra de la meta del día. Con meta en 0 está apagada y no se dibuja. */
export function BarraMeta({ total, meta, racha }: Props) {
  if (meta <= 0) return null

  const cumplida = total >= meta
  const falta = Math.max(meta - total, 0)
  const pct = Math.min(100, Math.round(total / meta * 100))

  return (
    <div className="barra-meta" role="progressbar" aria-valuemin={0} aria-valuemax={meta} aria-valuenow={total}
      aria-label={cumplida ? `Meta cumplida, racha de ${racha} día${racha === 1 ? '' : 's'}` : 'Meta de hoy'}>
      <div className="barra-meta-cabeza">
        <span className={'k' + (cumplida ? ' on' : '')}>{cumplida ? '✓ Meta cumplida' : 'Meta ' + pesos(meta)}</span>
        <span className="n">
          {cumplida
            ? `racha ${racha} día${racha === 1 ? '' : 's'}`
            : `faltan ${pesos(falta)}`}
        </span>
      </div>
      <div className="barra-meta-pista">
        <div className={'barra-meta-barra' + (cumplida ? ' on' : '')} style={{ width: pct + '%' }} />
      </div>
    </div>
  )
}
