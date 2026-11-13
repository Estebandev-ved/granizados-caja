import { useEffect, useState } from 'react'
import { api } from '../api'
import { pesos } from '../formato'
import { fechaCorta } from '../reportes'
import type { ComprobanteItem } from '../tipos'
import { GaleriaComprobantes } from './FotoComprobante'
import { Plegable } from './Plegable'

/**
 * Reportes → Comprobantes: las fotos de pago de los últimos 30 días (después el servidor las borra), agrupadas por día.
 * Las miniaturas solo se piden al abrir cada día, así la pantalla no se demora.
 */
export function ComprobantesGuardados() {
  const [lista, setLista] = useState<ComprobanteItem[] | null>(null)

  useEffect(() => {
    let vivo = true
    api.comprobantes().then(l => { if (vivo) setLista(l) }).catch(() => { if (vivo) setLista(null) })
    return () => { vivo = false }
  }, [])

  if (!lista || !lista.length) return null
  const dias: { fecha: string; ventas: ComprobanteItem[] }[] = []
  for (const c of lista) {
    const ultimo = dias[dias.length - 1]
    if (ultimo && ultimo.fecha === c.fecha) ultimo.ventas.push(c)
    else dias.push({ fecha: c.fecha, ventas: [c] })
  }
  return (
    <Plegable icono="celular" titulo="Comprobantes de pago" resumen={lista.length + (lista.length === 1 ? ' foto' : ' fotos') + ' · últimos 30 días'}>
      <p className="mut">Las fotos de Nequi de cada venta, por día. Se borran solas a los 30 días.</p>
      {dias.map(d => <Dia key={d.fecha} fecha={d.fecha} ventas={d.ventas} />)}
    </Plegable>
  )
}

function Dia({ fecha, ventas }: { fecha: string; ventas: ComprobanteItem[] }) {
  const [abierto, setAbierto] = useState(false)
  const total = ventas.reduce((a, v) => a + v.total, 0)
  return (
    <div className="comprobante">
      <button type="button" className="chip-link" onClick={() => setAbierto(a => !a)}>
        {abierto ? '▾' : '▸'} {fechaCorta(fecha)} · {ventas.length} {ventas.length === 1 ? 'foto' : 'fotos'} · {pesos(total)}
      </button>
      {abierto && <GaleriaComprobantes ventas={ventas.map(v => ({
        clientUid: v.ventaUid, sabor: v.sabor + (v.vendedor ? ' · ' + v.vendedor : ''), hora: v.hora, total: v.total }))} />}
    </div>
  )
}
