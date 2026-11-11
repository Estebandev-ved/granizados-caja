import { useEffect, useState } from 'react'
import { api } from '../api'
import { pesos } from '../formato'
import { fechaCorta } from '../reportes'
import type { HistorialTrabajador } from '../tipos'
import { Icono } from './Icono'
import { comoSePago } from './PagoTrabajador'
import { NOMBRE_LUGAR } from './PrestamosPanel'

/**
 * Reportes → Tu equipo: por trabajador, lo que vendió, lo que ganó y lo que se le descontó en el periodo, día por día,
 * con sus pagos y préstamos. Sirve para comparar y para revisar con él si algo no cuadra.
 */
export function HistorialEquipo({ desde, hasta }: { desde: string; hasta: string }) {
  const [lista, setLista] = useState<HistorialTrabajador[] | null | 'error'>(null)
  const [abierto, setAbierto] = useState<number | null>(null)

  useEffect(() => {
    let vivo = true
    api.historialEquipo(desde, hasta)
      .then(l => { if (vivo) setLista(l) })
      .catch(() => { if (vivo) setLista('error') })
    return () => { vivo = false }
  }, [desde, hasta])

  if (lista === null) return null
  if (lista === 'error') return <p className="aviso">No se pudo traer el historial del equipo, revisa la señal.</p>
  if (!lista.length) return null
  const maximo = Math.max(...lista.map(h => h.totales.unidades), 1)

  return (
    <section className="bloque">
      <h2><Icono nombre="cara" /> Tu equipo</h2>
      {lista.map(h => {
        const t = h.totales
        const descuentos = (t.consumos ?? 0) + (t.faltantes ?? 0)
        const ganado = t.comision + t.bonos - descuentos
        const dias = t.dias ?? h.dias.length
        const prestado = h.prestamos.reduce((a, p) => a + p.monto, 0)
        const pagado = h.pagos.reduce((a, p) => a + p.monto, 0)
        const ver = abierto === h.vendedorId
        return (
          <div className="list historial-eq" key={h.vendedorId}>
            <button type="button" className="historial-cabeza" aria-expanded={ver} onClick={() => setAbierto(ver ? null : h.vendedorId)}>
              <span className="eq-avatar">{h.nombre.trim().charAt(0).toUpperCase()}</span>
              <span className="historial-nombre">
                <b>{h.nombre}{!h.activo && <span className="mut"> · desactivado</span>}</b>
                <span className="mut">{t.unidades} vendidos · {dias} día{dias === 1 ? '' : 's'}{dias > 0 ? ' · ' + Math.round(t.unidades / dias) + ' por día' : ''}</span>
              </span>
              <b>{pesos(t.total)}</b>
            </button>
            <div className="eq-barra-pista"><div className="eq-barra-barra" style={{ width: Math.round(t.unidades * 100 / maximo) + '%' }} /></div>

            {ver && (
              <>
                <div className="carga-totales" style={{ marginTop: 10 }}>
                  <div><b>{pesos(t.efectivo)}</b><span>efectivo</span></div>
                  <div><b>{pesos(t.nequi)}</b><span>Nequi</span></div>
                  <div><b>{pesos(ganado)}</b><span>ganó</span></div>
                </div>
                <div className="row"><span>Comisión</span><b>{pesos(t.comision)}</b></div>
                {t.bonos > 0 && <div className="row"><span>Premios</span><b>{pesos(t.bonos)}</b></div>}
                {(t.consumidos ?? 0) > 0 && (
                  <div className="row"><span>Se tomó {t.consumidos}</span><b>{(t.consumos ?? 0) > 0 ? '−' + pesos(t.consumos ?? 0) : 'gratis'}</b></div>
                )}
                {(t.faltantes ?? 0) > 0 && (
                  <div className="row"><span>Faltaron {t.unidadesFaltantes}</span><b>−{pesos(t.faltantes ?? 0)}</b></div>
                )}
                {pagado > 0 && <div className="row"><span>Le pagaste en el periodo</span><b>{pesos(pagado)}</b></div>}
                {prestado > 0 && <div className="row"><span>Le prestaste en el periodo</span><b>{pesos(prestado)}</b></div>}

                <h3 style={{ marginTop: 12 }}>Día por día</h3>
                {h.dias.map(d => (
                  <div className="row" key={d.dia}>
                    <span>
                      {fechaCorta(d.dia)} · {d.unidades} vendidos
                      {d.consumidos > 0 && <span className="mut"> · se tomó {d.consumidos}</span>}
                      {d.unidadesFaltantes > 0 && <span className="aviso"> · faltaron {d.unidadesFaltantes}</span>}
                    </span>
                    <b>{pesos(d.total)}</b>
                  </div>
                ))}
                {!h.dias.length && <p className="mut">No vendió en este periodo.</p>}

                {(h.pagos.length > 0 || h.prestamos.length > 0) && <h3 style={{ marginTop: 12 }}>Pagos y préstamos</h3>}
                {h.pagos.map(p => (
                  <div className="row" key={'p' + p.id}>
                    <span className="mut">{fechaCorta(p.creadoEn.slice(0, 10))} · le pagaste ({comoSePago(p)}){p.estado === 'PENDIENTE' ? ' · sin confirmar' : p.estado === 'DISPUTADO' ? ' · dice que no le llegó' : ''}</span>
                    <b>{pesos(p.monto)}</b>
                  </div>
                ))}
                {h.prestamos.map(p => (
                  <div className="row" key={'q' + p.id}>
                    <span className="mut">{fechaCorta(p.creadoEn.slice(0, 10))} · le prestaste de {NOMBRE_LUGAR[p.lugar]}{p.pagoId ? ' · ya descontado' : ' · por descontar'}</span>
                    <b>{pesos(p.monto)}</b>
                  </div>
                ))}
              </>
            )}
          </div>
        )
      })}
      <p className="mut">Toca a alguien para ver su día a día. Lo que ganó ya tiene restado lo que se tomó y lo que faltó.</p>
    </section>
  )
}
