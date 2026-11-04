import { useState } from 'react'
import { api, sesion } from '../api'
import { vendidasHoy } from '../carga'
import { Icono } from '../componentes/Icono'
import { Personaje } from '../componentes/Personaje'
import { Sheet } from '../componentes/Sheet'
import { pesos } from '../formato'
import { PagoPreferido } from '../componentes/PagoPreferido'
import { NOMBRE_PAGO } from '../pagos'
import { TerminosTrabajo } from '../componentes/TerminosTrabajo'
import type { CierreTurno, Estado, FrecuenciaPago, Terminos, VentaReciente } from '../tipos'

/** El día de un trabajador: lo suyo y nada más (sin costos, ganancia ni lo de los demás). */
export function MiDia({ estado, pago, onElegirPago, onDeshacer }: {
  estado: Estado
  pago: FrecuenciaPago | null
  onElegirPago: (f: FrecuenciaPago) => Promise<void>
  onDeshacer: (v: VentaReciente) => Promise<void>
}) {
  const h = estado.hoy
  const [borrar, setBorrar] = useState<VentaReciente | null>(null)
  const [cierre, setCierre] = useState<CierreTurno | null>(null)
  const [cerrando, setCerrando] = useState(false)
  const [errorCierre, setErrorCierre] = useState('')
  const [terminos, setTerminos] = useState<Terminos | null>(null)
  const [cambiandoPago, setCambiandoPago] = useState(false)
  const premios = estado.premios

  const verTerminos = () => { api.terminos().then(setTerminos).catch(() => setErrorCierre('No se pudieron traer los términos, revisa la señal.')) }

  const cerrarDia = async () => {
    setCerrando(true)
    setErrorCierre('')
    try {
      setCierre(await api.cerrarTurno())
    } catch {
      setErrorCierre('No se pudo cerrar. Revisa la señal e intenta otra vez.')
    } finally {
      setCerrando(false)
    }
  }
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
      <div className="mi-hero">
        <div className="mi-hero-texto">
          <span className="mi-hero-saludo">{sesion.nombre ? 'Hola, ' + sesion.nombre : 'Mi día'}</span>
          <b className="mi-hero-monto">{pesos(premios ? premios.comision + premios.premio : h.total)}</b>
          <span className="mi-hero-pie">{premios ? 'ganado hoy' : 'vendido hoy'} · {h.unidades} granizado{h.unidades === 1 ? '' : 's'}</span>
          {premios?.siguiente && (
            <span className="mi-hero-sig">
              Te faltan {premios.siguiente.granizados - premios.vendidas} para ganar {pesos(premios.siguiente.total)} de premio
            </span>
          )}
        </div>
        <Personaje nombre="sofia" libre />
      </div>

      {premios && (
        <div className="list ganado">
          <h3><Icono nombre="moneda" /> Lo que llevas ganado hoy</h3>
          <div className="row"><span>Comisión por tus {premios.vendidas} granizados</span><b>{pesos(premios.comision)}</b></div>
          {premios.escalones.length > 0 && (
            <div className="row"><span>Premio del día</span><b>{pesos(premios.premio)}</b></div>
          )}
          <div className="row"><span><b>Total ganado</b></span><b>{pesos(premios.comision + premios.premio)}</b></div>
          {premios.diaPromo && premios.escalones.length > 0 && (
            <p className="mut" style={{ margin: '6px 0 0' }}>
              Hoy es día de promo: se vende más barato, así que los premios son un poco menores que en un día normal.
            </p>
          )}
        </div>
      )}

      <div className="list recaudo">
        <h3><Icono nombre="cara" /> Lo que recaudaste</h3>
        <div className="recaudo-fila">
          <span>{h.unidades} granizado{h.unidades === 1 ? '' : 's'}</span>
          <span>{pesos(h.efectivo)} efectivo</span>
          <span>{pesos(h.nequi)} Nequi</span>
        </div>
        <p className="mut" style={{ margin: 0 }}>
          Total {pesos(h.total)}. El efectivo se lo entregas al dueño; el Nequi ya le llegó a él.
        </p>
      </div>

      {premios && (
        <div className="regalo">
          <Personaje nombre="nova" libre />
          <p>
            {premios.gratis > 0
              ? <><b>Tu granizado del día:</b> tienes derecho a tomarte {premios.gratis === 1 ? '1' : premios.gratis} sin costo, te lo ganaste. Del siguiente en adelante se cobra al precio de venta.</>
              : <>Los granizados del puesto son para vender. Si te tomas uno, se cobra al precio de venta.</>}
          </p>
        </div>
      )}

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
        <button className="big" onClick={() => void cerrarDia()} disabled={cerrando}>{cerrando ? 'Cerrando…' : 'Terminé mi día'}</button>
        {errorCierre && <p className="aviso" style={{ textAlign: 'center' }}>{errorCierre}</p>}
        <button className="big ghost" onClick={() => setCambiandoPago(true)}>
          {pago ? 'Me pagan ' + NOMBRE_PAGO[pago] + ' · cambiar' : 'Escoger cada cuánto me pagan'}
        </button>
        <button className="big ghost" onClick={verTerminos}>Ver mis términos del trabajo</button>
        <button className="big peligro" onClick={() => sesion.cerrar()}>Cerrar sesión</button>
      </div>

      <Sheet abierto={cambiandoPago} onCerrar={() => setCambiandoPago(false)}>
        <PagoPreferido actual={pago} onElegir={async f => { await onElegirPago(f); setCambiandoPago(false) }} />
      </Sheet>

      <Sheet abierto={!!terminos} onCerrar={() => setTerminos(null)}>
        {terminos && <TerminosTrabajo terminos={terminos} />}
      </Sheet>

      <Sheet abierto={!!cierre} onCerrar={() => setCierre(null)}>
        {cierre && (
          <>
            <Personaje nombre="exito" />
            {cierre.comision + cierre.bonos > 0
              ? <h2>Hoy ganaste {pesos(cierre.comision + cierre.bonos)}</h2>
              : <h2>{cierre.entregar >= 0 ? 'Entrega ' + pesos(cierre.entregar) : 'Te deben ' + pesos(-cierre.entregar)}</h2>}
            <p>
              Vendiste {cierre.unidades}: {pesos(cierre.comision)} de comisión
              {cierre.bonos > 0 && <> y {pesos(cierre.bonos)} de premio por la meta</>}.
            </p>
            {cierre.comision + cierre.bonos > 0 && (
              <p className="recaudo-cierre">
                {cierre.entregar >= 0 ? 'Entrega ' + pesos(cierre.entregar) : 'Te deben ' + pesos(-cierre.entregar)}
                {' '}({pesos(cierre.efectivo)} en efectivo y {pesos(cierre.nequi)} por Nequi, {pesos(cierre.total)} en total).
              </p>
            )}
            <p>
              {cierre.devuelve.length
                ? 'Devuelve: ' + cierre.devuelve.map(f => f.queda + ' ' + f.nombre).join(', ')
                : 'No devuelves nada.'}
            </p>
            <p className="mut">Ya le avisamos al dueño.</p>
            <div className="acciones">
              <button className="big" onClick={() => setCierre(null)}>Listo</button>
            </div>
          </>
        )}
      </Sheet>

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
