import { filasCarga, leerCarga } from '../carga'
import type { PorSabor, Producto } from '../tipos'
import { Icono } from './Icono'

/** En Hoy: de lo que llevaste, cuánto vendiste y cuánto te queda por sabor. No sale si hoy no armaste carga. */
export function ResumenCarga({ productos, porSabor, hoy }: { productos: Producto[]; porSabor: PorSabor[]; hoy: string }) {
  const carga = leerCarga(hoy)
  if (!carga) return null
  const filas = filasCarga(carga, productos, porSabor)
  if (!filas.length) return null

  const llevo = filas.reduce((a, f) => a + f.llevo, 0)
  const vendi = filas.reduce((a, f) => a + f.vendi, 0)
  const queda = filas.reduce((a, f) => a + f.queda, 0)

  return (
    <div className="list">
      <h3><Icono nombre="caja" /> Lo que llevé hoy</h3>
      <div className="carga-totales">
        <div><b>{llevo}</b><span>llevé</span></div>
        <div><b>{vendi}</b><span>vendí</span></div>
        <div><b>{queda}</b><span>me quedan</span></div>
      </div>
      {filas.map(f => (
        <div className="sabor-fila" key={f.producto.id}>
          <div className="sabor-info">
            <div className="sabor-cabeza"><b>{f.producto.nombre}</b><b>{f.vendi} / {f.llevo}</b></div>
            <div className="sabor-pie">
              <span className="mut">{f.queda === 0 ? 'se acabó' : 'te quedan ' + f.queda}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
