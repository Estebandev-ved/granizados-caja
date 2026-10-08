import { useEffect, useState } from 'react'
import { api } from '../api'
import { pesos } from '../formato'
import { diaBogota } from '../estadoLocal'
import {
  armarSemanas, DIAS_SEMANA, fechaCorta, rangoSemanas, totalPrimerosDias, variacion, type Semana,
} from '../reportes'
import { Icono } from './Icono'

/** Esta semana contra la pasada, día por día, y el total de las últimas 4 semanas. Siempre lunes a domingo. */
export function ComparaSemanas() {
  const [semanas, setSemanas] = useState<Semana[] | null>(null)
  const hoy = diaBogota()

  useEffect(() => {
    let vivo = true
    const { desde, hasta } = rangoSemanas(hoy)
    api.reportes(desde, hasta)
      .then(r => { if (vivo) setSemanas(armarSemanas(r.porDia, hoy)) })
      .catch(() => { /* sin señal: el bloque simplemente no sale */ })
    return () => { vivo = false }
  }, [hoy])

  if (!semanas || semanas.every(s => s.total === 0)) return null

  const actual = semanas[semanas.length - 1]
  const pasada = semanas[semanas.length - 2]
  const corrido = actual.dias.filter(d => !d.futuro).length // días de esta semana que ya pasaron (con hoy)
  const mismoTramo = totalPrimerosDias(pasada, corrido)
  const delta = variacion(actual.total, mismoTramo)
  const maxDia = Math.max(...actual.dias.map(d => d.total), ...pasada.dias.map(d => d.total), 1)
  const maxSemana = Math.max(...semanas.map(s => s.total), 1)
  const recientes = [...semanas].reverse() // de la más nueva a la más vieja

  return (
    <section className="bloque">
      <h2><Icono nombre="semana" /> Semana contra semana</h2>

      <div className="cards">
        <div className="card">
          <div className="k">Esta semana</div>
          <div className="v">{pesos(actual.total)}</div>
          <div className="desglose"><span>{actual.unidades} granizados</span></div>
        </div>
        <div className="card">
          <div className="k">Pasada, mismo tramo</div>
          <div className="v">{pesos(mismoTramo)}</div>
          <div className="desglose">
            {delta ? <span className={delta.clase}>{delta.texto.replace(' vs anterior', '')}</span> : <span>igual</span>}
          </div>
        </div>
      </div>

      <div className="comparar">
        {actual.dias.map((d, i) => (
          <div className={'comparar-col' + (d.dia === hoy ? ' hoy' : '')} key={d.dia}>
            <div className="comparar-pistas">
              <div className="comparar-pista">
                <div className="comparar-barra antes" style={{ height: Math.round(pasada.dias[i].total / maxDia * 100) + '%' }} />
              </div>
              <div className="comparar-pista">
                <div className="comparar-barra ahora" style={{ height: d.futuro ? '0%' : Math.round(d.total / maxDia * 100) + '%' }} />
              </div>
            </div>
            <span className="barras-eje">{DIAS_SEMANA[i]}</span>
          </div>
        ))}
      </div>
      <p className="leyenda"><i className="antes" /> semana pasada <i className="ahora" /> esta semana</p>

      <div className="dias" style={{ marginTop: 14 }}>
        {recientes.map((s, i) => {
          const previa = recientes[i + 1]
          const d = previa ? variacion(s.total, previa.total) : null
          return (
            <div className="dia-fila" key={s.inicio}>
              <span className="dia-nombre" style={{ whiteSpace: 'nowrap' }}>{i === 0 ? 'Esta' : fechaCorta(s.inicio).slice(0, -3)}</span>
              <div className="dia-pista"><div className="dia-barra" style={{ width: Math.round(s.total / maxSemana * 100) + '%' }} /></div>
              <span className="dia-valor">
                {pesos(s.total)}
                {d && <span className={d.clase}>{d.pct > 0 ? '▲' : '▼'} {Math.abs(d.pct)}%</span>}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
