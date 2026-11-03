import { useState } from 'react'
import { sesion } from '../api'
import { vendidasHoy } from '../carga'
import { Icono } from '../componentes/Icono'
import { Personaje } from '../componentes/Personaje'
import { Sheet } from '../componentes/Sheet'
import { pesos } from '../formato'
import type { Estado, VentaReciente } from '../tipos'

/** El día de un trabajador: lo suyo y nada más (sin costos, ganancia ni lo de los demás). */
export function MiDia({ estado, onDeshacer }: { estado: Estado; onDeshacer: (v: VentaReciente) => Promise<void> }) {
  const h = estado.hoy
  const [borrar, setBorrar] = useState<VentaReciente | null>(null)
  // Su "stock" es lo que le queda de la carga; lo que llevó = lo que le queda + lo que ya vendió
  const filas = estado.productos
    .map(p => {
      const vendi = vendidasHoy(h.porSabor, p)
      return { p, vendi, queda: p.stock, llevo: p.stock + vendi }
    })
    .filter(f => f.llevo > 0)
  const llevo = filas.reduce((a, f) => a + f.llevo, 0)
  const queda = filas.reduce((a, f) => a + f.queda, 0)

  return (
    <section>
      <div className="list">
        <h3><Icono nombre="cara" /> {sesion.nombre ? 'Hola, ' + sesion.nombre : 'Mi día'}</h3>
        <div className="carga-totales">
          <div><b>{h.unidades}</b><span>vendí</span></div>
          <div><b>{pesos(h.efectivo)}</b><span>efectivo</span></div>
          <div><b>{pesos(h.nequi)}</b><span>Nequi</span></div>
        </div>
        <p className="mut" style={{ margin: 0 }}>
          Total {pesos(h.total)}. El efectivo es lo que le entregas al dueño; el Nequi ya le llegó a él.
        </p>
      </div>

      <div className="list">
        <h3><Icono nombre="caja" /> Lo que llevé hoy</h3>
        {filas.length ? (
          <>
            <div className="carga-totales">
              <div><b>{llevo}</b><span>llevé</span></div>
              <div><b>{h.unidades}</b><span>vendí</span></div>
              <div><b>{queda}</b><span>me quedan</span></div>
            </div>
            {filas.map(f => (
              <div className="sabor-fila" key={f.p.id}>
                <div className="sabor-info">
                  <div className="sabor-cabeza"><b>{f.p.nombre}</b><b>{f.vendi} / {f.llevo}</b></div>
                  <div className="sabor-pie">
                    <span className="mut">{f.queda === 0 ? 'se acabó' : 'te quedan ' + f.queda}</span>
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : <p className="mut" style={{ margin: 0 }}>Nada cargado por ahora. Pídele al dueño que te anote lo que sacas a vender.</p>}
      </div>

      {estado.ultimas.length ? (
        <div className="list">
          <h3><Icono nombre="reloj" /> Mis ventas de hoy</h3>
          <p className="mut" style={{ margin: '0 0 6px' }}>Toca una venta para borrarla si te equivocaste.</p>
          {estado.ultimas.map(u => (
            <button type="button" className="pago-fila" key={u.clientUid} onClick={() => setBorrar(u)}>
              <span className={'pago-avatar ' + (u.metodo === 'EFECTIVO' ? 'e' : 'n')}>
                <Icono nombre={u.metodo === 'EFECTIVO' ? 'billete' : 'celular'} />
              </span>
              <div className="pago-info">
                <b>{u.metodo === 'EFECTIVO' ? 'Efectivo' : u.metodo === 'MIXTO' ? 'Efectivo + Nequi' : 'Nequi'}</b>
                <span className="mut">{u.sabor} · {u.hora}{u.pendiente && <span className="pend-tag" title="Sin subir"> ⏳</span>}</span>
              </div>
              <b>{pesos(u.total)}</b>
            </button>
          ))}
        </div>
      ) : <div className="vacio"><Personaje nombre="sofia" />Aún no has vendido hoy</div>}

      <div className="acciones">
        <button className="big peligro" onClick={() => sesion.cerrar()}>Cerrar sesión</button>
      </div>

      <Sheet abierto={!!borrar} onCerrar={() => setBorrar(null)}>
        {borrar && (
          <>
            <h2>¿Borrar esta venta?</h2>
            <p>{borrar.sabor} · {pesos(borrar.total)} · {borrar.hora}</p>
            <div className="acciones">
              <button className="big peligro" onClick={() => { void onDeshacer(borrar); setBorrar(null) }}>Sí, borrar</button>
              <button className="big ghost" onClick={() => setBorrar(null)}>No</button>
            </div>
          </>
        )}
      </Sheet>
    </section>
  )
}
