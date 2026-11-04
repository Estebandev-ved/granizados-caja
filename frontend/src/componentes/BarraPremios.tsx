import { pesos } from '../formato'
import type { PremiosDia } from '../tipos'
import { Personaje } from './Personaje'

/** Lo que Sofía le dice al trabajador según qué tan cerca está del próximo premio. */
function mensaje(p: PremiosDia, alcanzados: number): string {
  const { siguiente, vendidas } = p
  if (!siguiente) return '¡Llegaste al premio máximo del día! Eres una máquina.'
  const faltan = siguiente.granizados - vendidas
  const previo = alcanzados > 0 ? p.escalones[alcanzados - 1].granizados : 0
  const avance = (vendidas - previo) / (siguiente.granizados - previo)
  if (vendidas === 0) return `Con tu primer granizado arranca la barra. ¡Vamos por ${pesos(siguiente.total)}!`
  if (faltan === 1) return `¡Solo 1 más y ganas ${pesos(siguiente.total)}!`
  if (avance >= 0.6 || faltan <= 3) return `¡Ya casi! ${faltan} más y ganas ${pesos(siguiente.total)}`
  if (p.premio > 0) return `Ya llevas ${pesos(p.premio)} de premio. Faltan ${faltan} para ${pesos(siguiente.total)}`
  return `Faltan ${faltan} para ganar ${pesos(siguiente.total)}`
}

/**
 * La barra de premios del trabajador: se llena con cada granizado, cada escalón es un círculo que se prende al llegar,
 * el próximo late para llamar la atención y Sofía le dice qué tan cerca está.
 */
export function BarraPremios({ premios }: { premios: PremiosDia }) {
  const { escalones, vendidas, premio, siguiente } = premios
  if (!escalones.length) return null

  const n = escalones.length
  const alcanzados = escalones.filter(e => vendidas >= e.granizados).length
  // Cada escalón ocupa el mismo tramo de la barra, así cada granizado se nota
  const previo = alcanzados > 0 ? escalones[alcanzados - 1].granizados : 0
  const tramo = siguiente ? Math.min(1, Math.max(0, (vendidas - previo) / (siguiente.granizados - previo))) : 0
  const pct = siguiente ? Math.round((alcanzados + tramo) / n * 100) : 100

  return (
    <div className={'premios' + (siguiente ? '' : ' completo')} role="progressbar" aria-valuemin={0}
      aria-valuemax={escalones[n - 1].granizados} aria-valuenow={vendidas}
      aria-label={`${vendidas} granizados vendidos, premio de hoy ${pesos(premio)}`}>
      <div className="premios-cabeza">
        <div>
          <span className="premios-etiqueta">{premios.diaPromo ? 'Tu premio · día de promo' : 'Tu premio de hoy'}</span>
          <b className="premios-monto">{pesos(premio)}</b>
        </div>
        <span className="premios-conteo">{vendidas} vendido{vendidas === 1 ? '' : 's'}</span>
      </div>
      <div className="premios-pista">
        <div className="premios-relleno" style={{ width: pct + '%' }} />
        {escalones.map((e, i) => {
          const alcanzado = vendidas >= e.granizados
          const proximo = !alcanzado && i === alcanzados
          return (
            <span key={e.granizados} className={'premios-hito' + (alcanzado ? ' on' : '') + (proximo ? ' sig' : '')}
              style={{ left: ((i + 1) / n * 100) + '%' }} aria-hidden="true">
              {alcanzado ? '✓' : e.granizados}
            </span>
          )
        })}
      </div>
      <div className="premios-pie">
        <Personaje nombre="sofia" libre />
        <p>{mensaje(premios, alcanzados)}</p>
      </div>
    </div>
  )
}
