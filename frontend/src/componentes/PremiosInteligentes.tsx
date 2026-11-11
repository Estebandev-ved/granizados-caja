import { useEffect, useState } from 'react'
import { api } from '../api'
import { pesos } from '../formato'
import { analizarEscalon, PARTE_MAXIMA, PARTE_TRABAJADOR, sugerirPremios, type AnalisisEscalon } from '../premios'
import type { DatosPremios, Escalon } from '../tipos'
import { Icono } from './Icono'

const VEREDICTO: Record<AnalisisEscalon['veredicto'], { texto: string; clase: string }> = {
  bien: { texto: 'Les sirve a los dos', clase: 'ok' },
  mucho: { texto: 'Le das casi todo lo extra', clase: 'aviso-tag' },
  pierde: { texto: 'Pierdes plata', clase: 'mal' },
  'dia-normal': { texto: 'Paga un día normal', clase: 'aviso-tag' },
}

/**
 * Ajustes → Equipo: mira tus premios con lo que de verdad pasa en tus ventas. Un premio sirve si paga por vender más
 * que en un día normal y te deja parte de esa ganancia extra. Sugiere unos premios donde el trabajador se lleva el
 * 35 % de lo extra; con «Usar estos» quedan en la lista de arriba para que los revises y guardes.
 */
export function PremiosInteligentes({ escalones, rebaja, onUsar }: {
  escalones: Escalon[]
  rebaja: number
  onUsar: (escalones: Escalon[], rebaja: number | null) => void
}) {
  const [datos, setDatos] = useState<DatosPremios | null | 'error'>(null)
  const [verPromo, setVerPromo] = useState(false)
  useEffect(() => {
    let vivo = true
    api.datosPremios().then(d => { if (vivo) setDatos(d) }).catch(() => { if (vivo) setDatos('error') })
    return () => { vivo = false }
  }, [])

  if (datos === null) return null
  if (datos === 'error') return <p className="aviso">No se pudo traer el análisis de premios, revisa la señal.</p>
  if (datos.margenNormal <= 0) {
    return (
      <div className="list">
        <h3><Icono nombre="grafico" /> ¿Te convienen estos premios?</h3>
        <p className="mut">Todavía no hay ventas del equipo con costo para hacer la cuenta. Pon el costo de cada sabor y vuelve en unos días.</p>
      </div>
    )
  }

  const ordenados = [...escalones].sort((a, b) => a.granizados - b.granizados)
  const analisis = ordenados.map(e => analizarEscalon(e, datos, verPromo, rebaja))
  const sugerencia = sugerirPremios(datos)
  const malos = analisis.filter(a => a.veredicto !== 'bien').length

  return (
    <div className="list premios-intel">
      <h3><Icono nombre="grafico" /> ¿Te convienen estos premios?</h3>
      <p className="mut">
        {datos.pocosDatos
          ? `Todavía hay pocos días de ventas del equipo: supongo que un día normal son ${datos.base} granizados.`
          : `En las últimas 4 semanas, un día normal de tu equipo son ${datos.base} granizados (el mejor fue ${datos.mejorDia}).`}
        {' '}Cada granizado te deja {pesos(datos.margenNormal)} ya pagada la comisión
        {datos.margenPromo !== null ? ` (en promo, ${pesos(datos.margenPromo)})` : ''}.
      </p>

      {analisis.length > 0 && (
        <>
          <div className="chips izq" style={{ margin: '8px 0' }}>
            <button type="button" className={!verPromo ? 'on' : ''} onClick={() => setVerPromo(false)}>Día normal</button>
            <button type="button" className={verPromo ? 'on' : ''} onClick={() => setVerPromo(true)}>Día de promo</button>
          </div>
          {analisis.map(a => (
            <div className="premio-analisis" key={a.granizados}>
              <div className="sabor-cabeza">
                <b>{a.granizados} granizados → {pesos(a.premio)}</b>
                <span className={'eq-tag ' + VEREDICTO[a.veredicto].clase}>{VEREDICTO[a.veredicto].texto}</span>
              </div>
              <span className="mut">
                {a.veredicto === 'dia-normal'
                  ? 'Eso ya lo vende en un día normal: le pagas sin que venda más.'
                  : a.extra > 0
                    ? `Los ${a.granizados - datos.base} de más te dejan ${pesos(a.extra)}: él se lleva ${a.pct}% y a ti te quedan ${pesos(a.teQueda)}.`
                    : 'No te deja nada de más.'}
              </span>
            </div>
          ))}
          <p className={malos ? 'aviso' : 'mut'}>
            {malos
              ? `${malos === 1 ? 'Un premio' : malos + ' premios'} no te convienen. Lo sano es que él se lleve hasta el ${PARTE_MAXIMA}% de lo que vende de más.`
              : 'Todos tus premios pagan por vender más de lo normal y te dejan ganancia. ✓'}
          </p>
        </>
      )}

      {sugerencia.escalones.length > 0 && (
        <div className="premios-sugeridos">
          <b>Premios sugeridos</b>
          <span className="mut">Él se lleva el {PARTE_TRABAJADOR}% de lo que te dejan los granizados de más; tú, el resto.</span>
          {sugerencia.escalones.map(e => (
            <div className="row" key={e.granizados}><span>{e.granizados} granizados</span><b>{pesos(e.total)}</b></div>
          ))}
          {sugerencia.rebaja !== null && (
            <div className="row"><span>En día de promo bajan</span><b>{pesos(sugerencia.rebaja)}</b></div>
          )}
          <button type="button" className="big ghost" onClick={() => onUsar(sugerencia.escalones, sugerencia.rebaja)}>
            Usar estos (los revisas y guardas)
          </button>
        </div>
      )}

      {datos.faltanCostos && <p className="mut">Hay sabores sin costo: la cuenta sale más alta de lo que es. Ponles el costo en Sabores y precios.</p>}
      {datos.sinTarifas && <p className="mut">Le pagas a tu equipo un porcentaje: la comisión no está restada en esta cuenta.</p>}
      <p className="mut">La cuenta usa las comisiones ya guardadas.</p>
    </div>
  )
}
