import { useEffect, useState } from 'react'
import { api } from '../api'
import { pesos } from '../formato'
import { estimar, ganariaHoyCon, MIN_DIAS, textoDias } from '../proyeccion'
import type { FrecuenciaPago, PremiosDia, Proyeccion } from '../tipos'
import { Icono } from './Icono'

/**
 * «Cuánto te vas a hacer»: lo que la app cree que el trabajador gana hoy (según cómo va y cómo viene vendiendo) y lo
 * que eso da a la semana, la quincena y el mes. Resalta el periodo en que él escogió cobrar. Necesita señal; sin ella
 * no sale (no es algo para adivinar).
 */
export function CuantoTeHaces({ premios, pago }: { premios: PremiosDia; pago: FrecuenciaPago | null }) {
  const [datos, setDatos] = useState<Proyeccion | null>(null)
  const [ahora, setAhora] = useState(() => new Date())
  const vendidas = premios.vendidas

  useEffect(() => {
    let vivo = true
    api.miProyeccion().then(d => { if (vivo) { setDatos(d); setAhora(new Date()) } }).catch(() => { /* sin señal: no se muestra */ })
    return () => { vivo = false }
  }, [vendidas]) // con cada venta cambia lo que se le debe y la hora de la primera

  if (!datos) return null
  const e = estimar(premios, datos, ahora)
  const sig = premios.siguiente
  const porque = e.base === 'ritmo' ? 'según cómo vas hoy y cómo vienes vendiendo'
    : e.base === 'historia' ? 'en un día normal tuyo vendes ' + datos.unidadesDia
      : e.base === 'meta' ? 'si cumples tu meta de ' + premios.metaPropia
        : 'con lo que llevas vendido'
  const destacado = pago === 'QUINCENAL' ? 'quincena' : pago === 'SEMANAL' ? 'semana' : null

  return (
    <div className="list proyeccion">
      <h3><Icono nombre="reloj" /> Cuánto te vas a hacer</h3>
      {e.unidadesHoy === null ? (
        <p className="mut proyeccion-nota">
          Ponte una meta en Vender o haz tu primera venta y te digo cuánto te harías hoy, a la semana y al mes.
        </p>
      ) : (
        <>
          <div className="proyeccion-hoy">
            <span>Hoy te haces cerca de</span>
            <b>{pesos(Math.max(0, e.ganaHoy))}</b>
            <small>
              {e.unidadesHoy > vendidas
                ? <>cerrando con unos {e.unidadesHoy} granizados (vas en {vendidas}) · {porque}</>
                : <>con los {vendidas} que llevas · {porque}</>}
            </small>
          </div>
          {sig && sig.granizados > e.unidadesHoy && (
            <p className="proyeccion-empuje">
              Si llegas a <b>{sig.granizados}</b> te haces <b>{pesos(Math.max(0, ganariaHoyCon(premios, sig.granizados)))}</b>: {pesos(sig.total)} son de premio.
            </p>
          )}
          <div className="carga-totales">
            <div className={destacado === 'semana' ? 'on' : ''}><b>{pesos(e.semana)}</b><span>a la semana</span></div>
            <div className={destacado === 'quincena' ? 'on' : ''}><b>{pesos(e.quincena)}</b><span>a la quincena</span></div>
            <div><b>{pesos(e.mes)}</b><span>al mes</span></div>
          </div>
          <p className="mut proyeccion-nota">
            {e.pocosDatos
              ? <>Es un ejemplo: si todos los días vendes eso y trabajas {textoDias(e.diasSemana)} a la semana. Cuando lleves {MIN_DIAS} días vendiendo, la cuenta sale de tus ventas de verdad.</>
              : <>Un día tuyo deja unos {pesos(datos.ganaDia)} y vienes trabajando {textoDias(e.diasSemana)} a la semana. Es un cálculo aproximado con tus últimas 4 semanas.</>}
          </p>
        </>
      )}
      {!e.pocosDatos && datos.mejorGana > 0 && (
        <div className="row"><span>Tu mejor día</span><b>{datos.mejorUnidades} granizados · {pesos(datos.mejorGana)}</b></div>
      )}
      {datos.pendiente !== 0 && (
        <div className="row">
          <span>{datos.pendiente > 0 ? 'Te deben hasta ahora' : 'Quedas debiendo'}</span>
          <b>{pesos(Math.abs(datos.pendiente))}</b>
        </div>
      )}
    </div>
  )
}
