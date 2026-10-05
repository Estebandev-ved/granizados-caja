import { useEffect, useState } from 'react'
import { api, ApiError } from '../api'
import { Icono } from '../componentes/Icono'
import { MiPlata } from '../componentes/MiPlata'
import { Personaje } from '../componentes/Personaje'
import { diaBogota } from '../estadoLocal'
import { pesos, vibrar } from '../formato'
import { fechaCorta, PERIODOS, restarDias, rangoDe, variacion, type Periodo } from '../reportes'
import type { Reporte, ReporteBarra } from '../tipos'
import { MisGastos } from './MisGastos'

interface Props {
  avisar: (m: string) => void
}

export function Reportes({ avisar }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const [propios, setPropios] = useState(() => {
    const hoy = diaBogota()
    return { desde: restarDias(hoy, 6), hasta: hoy }
  })
  const [datos, setDatos] = useState<Reporte | null>(null)
  const [error, setError] = useState(false)
  // Lo que ya cargamos: así "cargando" se deriva del estado y no hay que apagarlo en el efecto
  const [cargado, setCargado] = useState<string | null>(null)
  const [misGastos, setMisGastos] = useState(false)

  const { desde, hasta } = rangoDe(periodo, diaBogota(), propios)
  const clave = desde + '/' + hasta
  const cargando = cargado !== clave

  useEffect(() => {
    let vivo = true
    api.reportes(desde, hasta)
      .then(r => {
        if (!vivo) return
        setDatos(r)
        setError(false)
        setCargado(clave)
      })
      .catch(e => {
        if (!vivo) return
        setDatos(null)
        setError(true)
        setCargado(clave)
        avisar(e instanceof ApiError ? e.message : 'Sin señal para cargar el reporte')
      })
    return () => { vivo = false }
  }, [desde, hasta, clave, avisar])

  const exportar = () => {
    api.descargarReporte(desde, hasta)
      .then(() => avisar('✓ CSV descargado'))
      .catch(e => avisar(e instanceof ApiError ? e.message : 'No se pudo descargar'))
  }

  const borrarGasto = (clientUid: string) => {
    vibrar()
    api.borrarGasto(clientUid)
      .then(() => {
        avisar('✓ Gasto borrado')
        return api.reportes(desde, hasta).then(setDatos)
      })
      .catch(e => avisar(e instanceof ApiError ? e.message : 'No se pudo borrar, revisa la señal'))
  }

  const t = datos ? datos.totales : null
  const vacio = !!t && t.ventas === 0 && t.gastos === 0 && t.mermas === 0

  if (misGastos && datos) {
    return <MisGastos periodo={PERIODOS[periodo]} datos={datos} onBorrar={borrarGasto} onVolver={() => setMisGastos(false)} />
  }

  return (
    <section>
      <MiPlata avisar={avisar} />

      <div className="chips">
        {(Object.keys(PERIODOS) as Periodo[]).map(p => (
          <button key={p} className={periodo === p ? 'on' : ''} onClick={() => setPeriodo(p)}>{PERIODOS[p]}</button>
        ))}
      </div>

      {periodo === 'personalizado' && (
        <div className="rango">
          <label>Desde
            <input type="date" value={desde} max={hasta}
              onChange={e => setPropios(p => ({ ...p, desde: e.target.value }))} />
          </label>
          <label>Hasta
            <input type="date" value={hasta} max={diaBogota()} min={desde}
              onChange={e => setPropios(p => ({ ...p, hasta: e.target.value }))} />
          </label>
        </div>
      )}

      {cargando && <p className="mut centro">Cargando el reporte…</p>}

      {!cargando && error && <p className="aviso">No pude cargar el reporte. Revisa la señal e intenta otra vez.</p>}

      {!cargando && !error && vacio && (
        <div className="vacio"><Personaje nombre="vacio-pedidos" />No pasó nada en {PERIODOS[periodo].toLowerCase()}. Vende algo y vuelve</div>
      )}

      {!cargando && !error && datos && t && !vacio && (() => {
        const vVentas = variacion(t.ventas, datos.anterior.ventas)
        const vGanancia = variacion(t.ganancia, datos.anterior.ganancia)
        return (
        <>
          <div className="cards">
            <div className="card full">
              <div className="k"><Icono nombre="billete" /> Vendido</div>
              <div className="v">{pesos(t.ventas)}</div>
              <div className="desglose">
                <span>nequi {pesos(t.nequi)}</span>
                <span>efectivo {pesos(t.efectivo)}</span>
                {vVentas && <span className={vVentas.clase}>{vVentas.texto}</span>}
              </div>
            </div>
            <div className="card full ganancia">
              <div className="k"><Icono nombre="grafico" /> Ganancia</div>
              <div className="v">{pesos(t.ganancia)}</div>
              <div className="desglose">
                <span>producto {pesos(t.costo)}</span>
                {t.gastos > 0 && <span>gastos {pesos(t.gastos)}</span>}
                {t.mermas > 0 && <span>mermas {pesos(t.mermas)}</span>}
                {vGanancia && <span className={vGanancia.clase}>{vGanancia.texto}</span>}
              </div>
            </div>
            <div className="card">
              <div className="k"><Icono nombre="vaso" /> Granizados</div>
              <div className="v">{t.unidades}</div>
            </div>
            <div className="card">
              <div className="k"><Icono nombre="caja" /> Pedidos</div>
              <div className="v">{datos.pedidos.length}</div>
            </div>
          </div>

          {datos.gastosDetalle.length > 0 && (
            <button className="accion" style={{ marginBottom: 14 }} onClick={() => setMisGastos(true)}>
              <span className="accion-icono"><Icono nombre="moneda" /></span>
              <span className="accion-texto">
                <b>Mis gastos</b>
                <small>{datos.gastosDetalle.length} · {pesos(t.gastos)}</small>
              </span>
            </button>
          )}

          <section className="bloque">
            <h2><Icono nombre="calendario" /> Por día</h2>
            {datos.porDia.length > 1
              ? <>
                  <PorDias datos={datos.porDia} />
                  <MejorDia datos={datos.porDia} />
                </>
              : <p className="mut">{datos.porDia.length ? 'Un solo día en este periodo.' : 'Sin ventas en este periodo.'}</p>}
          </section>

          <section className="bloque">
            <h2><Icono nombre="reloj" /> Horas pico</h2>
            <Barras datos={datos.porHora} salto={3} eje={h => h.clave + 'h'} />
            <p className="mut">{textoPico(datos.porHora, 'de', 'hora')}</p>
          </section>

          <section className="bloque">
            <h2><Icono nombre="semana" /> Días de la semana</h2>
            <Barras datos={datos.porDiaSemana} salto={1} eje={d => d.nombre.slice(0, 3)} finde={d => d.clave === 5 || d.clave === 6} />
            <p className="mut">{textoPico(datos.porDiaSemana, 'de', 'día')}</p>
          </section>

          <section className="bloque">
            <h2><Icono nombre="trofeo" /> Lo que mejor se va</h2>
            <ol className="ranking">
              {datos.porSabor.map((s, i) => (
                <li key={s.sabor}>
                  <span className="sabor"><b className="rank">{i + 1}</b>{s.sabor}</span>
                  <span className="n">{s.unidades} · {pesos(s.ingresos)}</span>
                </li>
              ))}
            </ol>
          </section>

          {datos.arqueos.length > 0 && (
            <section className="bloque">
              <h2><Icono nombre="candado" /> Cierre de caja</h2>
              <ul className="ranking">
                {datos.arqueos.map(a => (
                  <li key={a.dia}>
                    <span className="sabor">{fechaCorta(a.dia)}</span>
                    <span className={a.diferencia === 0 ? 'n' : a.diferencia < 0 ? 'n falta' : 'n'}>
                      {a.diferencia === 0
                        ? 'cuadró'
                        : (a.diferencia < 0 ? 'faltaron ' : 'sobraron ') + pesos(Math.abs(a.diferencia))}
                      {a.nota ? ' · ' + a.nota : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <button className="big ghost" onClick={exportar}>Descargar CSV</button>
        </>
        )
      })()}
    </section>
  )
}

function textoPico(datos: ReporteBarra[], pre: string, nombre: string): string {
  const conVenta = datos.filter(d => d.unidades > 0)
  if (!conVenta.length) return 'Sin ventas en el periodo.'
  const pico = conVenta.reduce((a, b) => (b.unidades > a.unidades ? b : a))
  return `${pico.unidades} unidad${pico.unidades === 1 ? '' : 'es'} ${pre} ${nombre} ${pico.nombre}.`
}

function PorDias({ datos }: { datos: Reporte['porDia'] }) {
  const max = Math.max(...datos.map(d => d.total), 1)
  return (
    <div className="dias">
      {datos.map((d, i) => {
        const anterior = datos[i - 1]
        const delta = anterior && anterior.total > 0 ? Math.round((d.total - anterior.total) / anterior.total * 100) : null
        return (
          <div className={'dia-fila' + (esFinDeSemana(d.dia) ? ' finde' : '')} key={d.dia}>
            <span className="dia-nombre">{fechaCorta(d.dia)}</span>
            <div className="dia-pista">
              <div className="dia-barra" style={{ width: Math.round(d.total / max * 100) + '%' }} />
            </div>
            <span className="dia-valor">
              {pesos(d.total)}
              {delta !== null && delta !== 0 && (
                <span className={delta > 0 ? 'delta-up' : 'delta-down'}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta)}%</span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Barras verticales de 0 a 100% del pico, con el eje abajo. Resalta el pico y, si aplica, el fin de semana. */
function Barras({ datos, salto, eje, finde }: {
  datos: ReporteBarra[]
  salto: number
  eje: (d: ReporteBarra) => string
  finde?: (d: ReporteBarra) => boolean
}) {
  const max = Math.max(...datos.map(d => d.unidades), 1)
  const pico = datos.reduce((a, b) => (b.unidades > a.unidades ? b : a), datos[0])
  return (
    <div className="barras">
      {datos.map(d => {
        const esPico = d.unidades > 0 && d === pico
        return (
          <div className={'barras-col' + (esPico ? ' pico' : '') + (finde?.(d) ? ' finde' : '')} key={d.clave}>
            <span className="barras-valor">{esPico ? d.unidades : ''}</span>
            <div className="barras-pista">
              <div className="barras-barra" style={{ height: Math.round(d.unidades / max * 100) + '%' }} />
            </div>
            <span className="barras-eje">{d.clave % salto === 0 ? eje(d) : ''}</span>
          </div>
        )
      })}
    </div>
  )
}

function esFinDeSemana(dia: string): boolean {
  const [a, m, d] = dia.split('-').map(Number)
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay()
  return dow === 0 || dow === 6
}

function MejorDia({ datos }: { datos: Reporte['porDia'] }) {
  const mejor = datos.reduce((a, d) => (d.total > a.total ? d : a), datos[0])
  if (!mejor || mejor.total <= 0) return null
  const [, mes, dia] = mejor.dia.split('-')
  return (
    <div className="nova-tip" style={{ marginTop: 12 }}>
      <Personaje nombre="sofia" libre />
      <p>Tu mejor día fue el {Number(dia)}/{Number(mes)}: {pesos(mejor.total)} y {mejor.unidades} granizados.</p>
    </div>
  )
}
