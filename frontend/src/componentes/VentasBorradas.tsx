import { useEffect, useState } from 'react'
import { api } from '../api'
import { pesos } from '../formato'
import { fechaCorta } from '../reportes'
import type { VentaBorrada } from '../tipos'
import { Plegable } from './Plegable'

const METODO: Record<string, string> = {
  EFECTIVO: 'efectivo', NEQUI: 'Nequi', MIXTO: 'mixto', FIADO: 'fiado', REGALO: 'regalo', CONSUMO: 'se la tomó', FALTANTE: 'faltante',
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' })
const dia = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

/**
 * Reportes → Ventas borradas: cada venta que se deshizo en el periodo, de quién era y quién la borró. Las que borró un
 * trabajador salen marcadas: una venta en efectivo cobrada y borrada es la forma más fácil de que se pierda plata.
 */
export function VentasBorradas({ desde, hasta }: { desde: string; hasta: string }) {
  const [lista, setLista] = useState<VentaBorrada[] | null>(null)

  useEffect(() => {
    let vivo = true
    api.ventasBorradas(desde, hasta)
      .then(l => { if (vivo) setLista(l) })
      .catch(() => { if (vivo) setLista(null) })
    return () => { vivo = false }
  }, [desde, hasta])

  if (!lista || !lista.length) return null
  const deEquipo = lista.filter(b => b.borroTrabajador)
  const plata = deEquipo.reduce((a, b) => a + b.total, 0)
  return (
    <Plegable icono="alerta" titulo="Ventas borradas" alerta={deEquipo.length > 0}
      resumen={deEquipo.length
        ? deEquipo.length + ' del equipo · ' + pesos(plata)
        : lista.length + (lista.length === 1 ? ' borrada por ti' : ' borradas por ti')}>
      <p className="mut">Cada venta que se deshizo. Si un trabajador borra ventas que sí cobró, la plata no aparece en las cuentas: pregúntale.</p>
      {lista.map(b => (
        <div className={'pago-fila' + (b.borroTrabajador ? ' borrada-equipo' : '')} key={b.ventaUid + b.borradaEn}>
          <div className="pago-info">
            <b>{b.cantidad} {b.sabor} · {pesos(b.total)}</b>
            <span className="mut">
              {fechaCorta(dia(b.borradaEn))} · la borró {b.borro === 'Tú' ? 'tú' : b.borro} a las {hora(b.borradaEn)}
              {' '}(vendida {hora(b.vendidaEn)}{b.deQuien !== b.borro ? ' por ' + (b.deQuien === 'Tú' ? 'ti' : b.deQuien) : ''}) · {METODO[b.metodo] ?? b.metodo}
            </span>
          </div>
        </div>
      ))}
    </Plegable>
  )
}
