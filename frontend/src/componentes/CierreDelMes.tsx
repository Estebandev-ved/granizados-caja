import { useEffect, useState } from 'react'
import { api } from '../api'
import { avanceEquilibrio, cambio, moverMes, renglones } from '../cierre'
import { diaBogota } from '../estadoLocal'
import { pesos } from '../formato'
import { CATEGORIA_TEXTO } from '../reportes'
import type { CierreMes } from '../tipos'
import { Icono } from './Icono'
import { Personaje } from './Personaje'
import { Plegable } from './Plegable'

/**
 * Reportes → Cierre del mes: lo que de verdad le quedó al negocio. Resta lo que se ganó el equipo (que Hoy no resta),
 * dice cuánto te pagaste, cuántos granizados al día cubren los gastos y qué sabor deja más.
 */
export function CierreDelMes() {
  const actual = diaBogota().slice(0, 7)
  const [mes, setMes] = useState(actual)
  const [datos, setDatos] = useState<{ mes: string; c: CierreMes } | 'error' | null>(null)

  useEffect(() => {
    let vivo = true
    api.cierreMes(mes === actual ? undefined : mes)
      .then(c => { if (vivo) setDatos({ mes, c }) })
      .catch(() => { if (vivo) setDatos('error') })
    return () => { vivo = false }
  }, [mes, actual])

  const c = datos && datos !== 'error' && datos.mes === mes ? datos.c : null

  return (
    <section className="list cierre-mes">
      <div className="cierre-cabeza">
        <button type="button" className="cierre-flecha" aria-label="Mes anterior" onClick={() => setMes(m => moverMes(m, -1))}>‹</button>
        <h3><Icono nombre="calendario" /> {c ? 'Cierre de ' + c.nombre.toLowerCase() : 'Cierre del mes'}</h3>
        <button type="button" className="cierre-flecha" aria-label="Mes siguiente" disabled={mes >= actual}
          onClick={() => setMes(m => moverMes(m, 1))}>›</button>
      </div>

      {datos === 'error' && <p className="aviso">Sin señal para traer el cierre del mes.</p>}
      {!c && datos !== 'error' && <p className="mut">Cargando…</p>}
      {c && <Contenido c={c} />}
    </section>
  )
}

function Contenido({ c }: { c: CierreMes }) {
  if (c.unidades === 0 && c.gastos === 0) {
    return <p className="mut">No hubo ventas ni gastos en {c.nombre.toLowerCase()}.</p>
  }
  const vsAnterior = cambio(c.gananciaReal, c.anterior.gananciaReal)
  return (
    <>
      <div className="cierre-grande">
        <span className="mut">Ganancia real{c.enCurso ? ' hasta hoy' : ''}</span>
        <b className={c.gananciaReal < 0 ? 'falta' : ''}>{pesos(c.gananciaReal)}</b>
        <span className="mut">
          {c.enCurso ? 'Día ' + c.diasTranscurridos + ' de ' + c.diasDelMes : c.diasConVenta + ' días con ventas'}
          {vsAnterior !== null && c.anterior.unidades > 0 && (
            <> · <span className={vsAnterior >= 0 ? 'delta-up' : 'delta-down'}>{vsAnterior >= 0 ? '▲' : '▼'} {Math.abs(vsAnterior)}%</span> vs {c.anterior.nombre.split(' ')[0].toLowerCase()}</>
          )}
        </span>
      </div>

      <div className="cierre-tabla">
        {renglones(c).map(r => (
          <div className={'cierre-renglon ' + r.clase} key={r.texto}>
            <span>
              {r.texto}
              {r.nota && <small>{r.nota}</small>}
            </span>
            <b className={r.clase === 'total' && r.monto < 0 ? 'falta' : ''}>
              {r.clase === 'resta' ? '−' : r.clase === 'suma' && r.texto !== 'Vendiste' ? '+' : ''}{pesos(r.monto)}
            </b>
          </div>
        ))}
      </div>

      {c.proyeccion !== null && c.unidades > 0 && (
        <p className="mut">Si sigues a este ritmo, cierras {c.nombre.split(' ')[0].toLowerCase()} con unos <b>{pesos(c.proyeccion)}</b> de ganancia.</p>
      )}

      <Equilibrio c={c} />

      {c.consejos.length > 0 && (
        <div className="nova-tip cierre-consejos">
          <Personaje nombre="nova" libre />
          <ul>{c.consejos.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}

      {c.porSabor.length > 0 && (
        <Plegable icono="trofeo" titulo="Lo que deja cada sabor"
          resumen={c.porSabor[0].sabor + ' deja más: ' + pesos(c.porSabor[0].ganancia)}>
          <PorSabor c={c} />
        </Plegable>
      )}

      {c.gastosPorCategoria.length > 0 && (
        <Plegable icono="moneda" titulo="En qué se fue la plata" resumen={pesos(c.gastos) + ' en gastos'}>
          <ul className="ranking">
            {c.gastosPorCategoria.map(g => (
              <li key={g.categoria}>
                <span className="sabor">{CATEGORIA_TEXTO[g.categoria] ?? g.categoria}</span>
                <span className="n">{pesos(g.monto)} · {Math.round(g.monto * 100 / Math.max(c.gastos, 1))}%</span>
              </li>
            ))}
          </ul>
        </Plegable>
      )}
    </>
  )
}

/** Cuántos al día cubren los gastos frente a cuántos vende, con una barra. */
function Equilibrio({ c }: { c: CierreMes }) {
  const e = c.equilibrio
  const avance = avanceEquilibrio(c)
  if (e.granizadosAlDia === null || avance === null) {
    if (e.dejaPorGranizado <= 0 && c.unidades > 0) {
      return <p className="aviso">Con lo que cuesta el producto y el equipo, cada granizado no te está dejando nada. Revisa precios y costos.</p>
    }
    return null
  }
  const cubre = avance >= 100
  return (
    <div className={'cierre-equilibrio' + (cubre ? ' bien' : ' mal')}>
      <div className="cierre-equilibrio-titulo">
        <b>Punto de equilibrio: {e.granizadosAlDia} al día</b>
        <span>vendes {String(e.promedioAlDia).replace('.', ',')}</span>
      </div>
      <div className="eq-barra-pista">
        <div className="eq-barra-barra" style={{ width: Math.min(100, avance) + '%' }} />
      </div>
      <p className="mut">
        Tus gastos son unos {pesos(e.gastoPorDia)} al día y cada granizado te deja {pesos(e.dejaPorGranizado)} (ya pagado el producto y el equipo).
        {' '}{cubre
          ? `Los cubriste ${e.diasQueCubrieron} de ${e.diasConVenta} días con ventas: de ahí en adelante todo es ganancia.`
          : `Te faltan ${Math.ceil(e.granizadosAlDia - e.promedioAlDia)} al día para cubrirlos.`}
      </p>
    </div>
  )
}

function PorSabor({ c }: { c: CierreMes }) {
  const conVentas = c.porSabor.filter(s => s.unidades > 0)
  const max = Math.max(...conVentas.map(s => s.porUnidad), 1)
  return (
    <>
      <p className="mut">Ordenados por lo que te dejaron en total, ya pagado el producto y la comisión de quien lo vendió.</p>
      {conVentas.map(s => (
        <div className="cierre-sabor" key={s.sabor}>
          <div className="cierre-sabor-fila">
            <b>{s.sabor}</b>
            <span>{pesos(s.ganancia)}</span>
          </div>
          <div className="eq-barra-pista"><div className="eq-barra-barra" style={{ width: Math.max(0, Math.round(s.porUnidad * 100 / max)) + '%' }} /></div>
          <span className="mut">{s.unidades} vendidos · deja {pesos(s.porUnidad)} c/u · {s.pctGanancia}% de la ganancia</span>
        </div>
      ))}
    </>
  )
}
