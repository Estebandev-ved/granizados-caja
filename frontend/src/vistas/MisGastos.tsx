import { Icono } from '../componentes/Icono'
import { pesos } from '../formato'
import { CATEGORIA_TEXTO, fechaCorta, variacion } from '../reportes'
import type { CategoriaGasto, Reporte, ReporteCategoriaGasto, ReporteDiaGasto } from '../tipos'

interface Props {
  periodo: string
  datos: Reporte
  onBorrar: (clientUid: string) => void
  onVolver: () => void
}

/** Página completa de gastos: totales, por categoría, por día y recomendaciones. Se abre desde Reportes. */
export function MisGastos({ periodo, datos, onBorrar, onVolver }: Props) {
  const t = datos.totales
  const vGastos = variacion(t.gastos, datos.anterior.gastos)
  const promedioDia = datos.gastosPorDia.length ? Math.round(t.gastos / datos.gastosPorDia.length) : 0
  const recos = recomendaciones(datos)
  const sinGastos = datos.gastosDetalle.length === 0

  return (
    <section>
      <button className="link" onClick={onVolver} style={{ padding: '0 0 10px' }}>‹ Volver a Reportes</button>
      <h1 style={{ fontSize: 22, marginBottom: 2 }}>Mis gastos</h1>
      <p className="mut" style={{ marginBottom: 14 }}>{periodo}</p>

      <div className="cards">
        <div className="card full">
          <div className="k"><Icono nombre="moneda" /> Total gastado</div>
          <div className="v">{pesos(t.gastos)}</div>
          <div className="desglose">
            <span>{datos.gastosDetalle.length} gasto{datos.gastosDetalle.length === 1 ? '' : 's'}</span>
            {vGastos && <span className={vGastos.clase}>{vGastos.texto}</span>}
          </div>
        </div>
        <div className="card">
          <div className="k">Promedio/día</div>
          <div className="v">{pesos(promedioDia)}</div>
        </div>
        <div className="card">
          <div className="k">% de lo vendido</div>
          <div className="v">{t.ventas ? Math.round(t.gastos / t.ventas * 100) : 0}%</div>
        </div>
      </div>

      {recos.length > 0 && (
        <div className="list">
          <h3><Icono nombre="alerta" /> Para tener en cuenta</h3>
          {recos.map((r, i) => (
            <div className="row" key={i}><span>{r}</span></div>
          ))}
        </div>
      )}

      {sinGastos ? (
        <div className="vacio">No has registrado gastos en {periodo.toLowerCase()}.</div>
      ) : (
        <>
          <section className="bloque">
            <h2><Icono nombre="moneda" /> Por categoría</h2>
            <PorCategoria datos={datos.porCategoriaGasto} total={t.gastos} />
          </section>

          <section className="bloque">
            <h2><Icono nombre="calendario" /> Por día</h2>
            <PorDia datos={datos.gastosPorDia} />
          </section>

          <section className="bloque">
            <h2><Icono nombre="ticket" /> Detalle</h2>
            <div className="list">
              {datos.gastosDetalle.map(g => (
                <div className="row" key={g.clientUid}>
                  <span>
                    <b>{CATEGORIA_TEXTO[g.categoria] ?? g.categoria}</b>{g.concepto ? ' · ' + g.concepto : ''}
                    <br /><small className="mut">{fechaCorta(g.dia)} · {g.hora} · {pesos(g.monto)}</small>
                  </span>
                  <button className="quitar" onClick={() => onBorrar(g.clientUid)}>Borrar</button>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </section>
  )
}

/** Insights simples derivados de los datos del periodo: cambio total, categoría más fuerte y la que más subió. */
function recomendaciones(datos: Reporte): string[] {
  const out: string[] = []
  const t = datos.totales
  const anterior = datos.anterior

  const vTotal = variacion(t.gastos, anterior.gastos)
  if (vTotal) {
    out.push(`Tus gastos ${vTotal.pct > 0 ? 'subieron' : 'bajaron'} ${Math.abs(vTotal.pct)}% frente al periodo anterior (${pesos(anterior.gastos)} → ${pesos(t.gastos)}).`)
  }

  const top = datos.porCategoriaGasto[0]
  if (top && t.gastos > 0) {
    const pct = Math.round(top.monto / t.gastos * 100)
    if (pct >= 50 && datos.porCategoriaGasto.length > 1) {
      out.push(`Más de la mitad de tus gastos son de ${CATEGORIA_TEXTO[top.categoria] ?? top.categoria} (${pesos(top.monto)}, ${pct}%). Si consigues mejor precio ahí, ahorras rápido.`)
    } else {
      out.push(`Lo que más gastas es ${CATEGORIA_TEXTO[top.categoria] ?? top.categoria}: ${pesos(top.monto)} (${pct}% del total).`)
    }
  }

  const mayorSubida = categoriaQueMasSubio(datos.porCategoriaGasto, datos.porCategoriaGastoAnterior)
  if (mayorSubida) {
    const nombre = CATEGORIA_TEXTO[mayorSubida.categoria] ?? mayorSubida.categoria
    if (mayorSubida.antes === 0) {
      out.push(`Es la primera vez que registras gastos de ${nombre} en este periodo: ${pesos(mayorSubida.actual)}.`)
    } else {
      const pct = Math.round((mayorSubida.actual - mayorSubida.antes) / mayorSubida.antes * 100)
      out.push(`${nombre} subió ${pesos(mayorSubida.actual - mayorSubida.antes)} (${pct}%) respecto al periodo anterior.`)
    }
  }

  return out.slice(0, 3)
}

/** La categoría cuyo gasto más creció frente al periodo anterior (mínimo 20% de subida, o una categoría nueva). */
function categoriaQueMasSubio(
  actuales: ReporteCategoriaGasto[],
  anteriores: ReporteCategoriaGasto[],
): { categoria: CategoriaGasto; actual: number; antes: number } | null {
  const mapaAnterior = new Map(anteriores.map(c => [c.categoria, c.monto]))
  let mejor: { categoria: CategoriaGasto; actual: number; antes: number } | null = null
  for (const c of actuales) {
    const antes = mapaAnterior.get(c.categoria) ?? 0
    const sube = c.monto - antes
    if (sube <= 0) continue
    if (antes > 0 && sube / antes < 0.2) continue
    if (!mejor || sube > mejor.actual - mejor.antes) mejor = { categoria: c.categoria, actual: c.monto, antes }
  }
  return mejor
}

function PorCategoria({ datos, total }: { datos: ReporteCategoriaGasto[]; total: number }) {
  const max = Math.max(...datos.map(d => d.monto), 1)
  return (
    <div className="dias">
      {datos.map(d => (
        <div className="dia-fila" key={d.categoria}>
          <span className="dia-nombre">{CATEGORIA_TEXTO[d.categoria] ?? d.categoria}</span>
          <div className="dia-pista">
            <div className="dia-barra" style={{ width: Math.round(d.monto / max * 100) + '%' }} />
          </div>
          <span className="dia-valor">
            {pesos(d.monto)}
            <span className="mut">{total ? Math.round(d.monto / total * 100) : 0}%</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function PorDia({ datos }: { datos: ReporteDiaGasto[] }) {
  const max = Math.max(...datos.map(d => d.monto), 1)
  return (
    <div className="dias">
      {datos.map(d => (
        <div className="dia-fila" key={d.dia}>
          <span className="dia-nombre">{fechaCorta(d.dia)}</span>
          <div className="dia-pista">
            <div className="dia-barra" style={{ width: Math.round(d.monto / max * 100) + '%' }} />
          </div>
          <span className="dia-valor">{pesos(d.monto)}</span>
        </div>
      ))}
    </div>
  )
}
