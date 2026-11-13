import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import type { Carga } from '../carga'
import { diaBogota } from '../estadoLocal'
import { pesos } from '../formato'
import { MIN_DIAS, textoDias } from '../proyeccion'
import type { CuentaEquipo, Liquidacion, Producto, Proyeccion, Trabajador } from '../tipos'
import { AgregarCarga } from './AgregarCarga'
import { CargaDelDia } from './CargaDelDia'
import { ETIQUETA_PAGO, PagarTrabajador, comoSePago, fechaHora } from './PagoTrabajador'
import { NOMBRE_PAGO } from '../pagos'
import { CampoNumero } from './CampoNumero'
import { BaseVueltosPanel } from './BaseVueltosPanel'
import { EntregasDelTrabajador } from './EntregaAlDueno'
import { FaltantePanel } from './FaltantePanel'
import { NOMBRE_LUGAR, PrestamosPanel } from './PrestamosPanel'
import { Icono } from './Icono'
import { Plegable } from './Plegable'
import { Sheet } from './Sheet'
import { Unidades } from './Unidades'

type Panel = { tipo: 'nuevo' } | { tipo: 'ver'; id: number } | { tipo: 'carga'; id: number } | { tipo: 'agregar'; id: number } | { tipo: 'pagar'; id: number }

/** Los que venden contigo: cada uno con su PIN, su carga del día y sus cuentas. Necesita señal (no pasa por la cola). */
export function Equipo({ productos, avisar }: { productos: Producto[]; avisar: (m: string) => void }) {
  const [lista, setLista] = useState<Trabajador[] | null>(null)
  const [panel, setPanel] = useState<Panel | null>(null)

  const cargar = useCallback(async () => {
    try { setLista(await api.equipo()) } catch { setLista(prev => prev ?? []) }
  }, [])
  useEffect(() => {
    let vivo = true
    api.equipo().then(l => { if (vivo) setLista(l) }).catch(() => { if (vivo) setLista(prev => prev ?? []) })
    // Se vuelve a pedir solo, para ver cuando el trabajador confirma o dice que no le llegó el pago
    const reloj = window.setInterval(() => {
      api.equipo().then(l => { if (vivo) setLista(l) }).catch(() => { /* se reintenta en la próxima vuelta */ })
    }, 10_000)
    return () => { vivo = false; window.clearInterval(reloj) }
  }, [])

  // Cómo viene vendiendo cada uno, para decir cuánto se hace (se pide una vez: cambia de un día para otro)
  const [proyecciones, setProyecciones] = useState<Proyeccion[]>([])
  useEffect(() => {
    let vivo = true
    api.proyeccionesEquipo().then(l => { if (vivo) setProyecciones(l) }).catch(() => { /* sin señal: no se muestra */ })
    return () => { vivo = false }
  }, [])

  const trabajador = panel && panel.tipo !== 'nuevo' ? lista?.find(t => t.id === panel.id) ?? null : null
  const activos = productos.filter(p => p.activo)
  const porPagarTotal = lista?.reduce((a, t) => a + (t.porPagar ?? 0), 0) ?? 0

  const guardar = async (accion: () => Promise<unknown>, mensaje: string) => {
    try {
      await accion()
      avisar('✓ ' + mensaje)
      await cargar()
      return true
    } catch (e) {
      avisar('⚠️ ' + (e instanceof Error ? e.message : 'No se pudo guardar'))
      return false
    }
  }

  return (
    <>
      <div className="equipo-resumen">
        <div><span>Activos</span><b>{lista?.filter(t => t.activo).length ?? 0}</b></div>
        <div><span>Vendido hoy</span><b>{pesos(lista?.reduce((a, t) => a + t.totalHoy, 0) ?? 0)}</b></div>
        <div className={porPagarTotal > 0 ? 'alerta' : ''}><span>Por pagar</span><b>{pesos(porPagarTotal)}</b></div>
      </div>
      <div className="list eq-lista">
        <div className="eq-encabezado">
          <h3>Personal</h3>
          <button type="button" className="chico-ghost fuerte" onClick={() => setPanel({ tipo: 'nuevo' })}>+ Agregar</button>
        </div>
        {lista?.map(t => {
          const llevo = t.carga.reduce((a, f) => a + f.llevo, 0)
          const vendi = t.carga.reduce((a, f) => a + f.vendi, 0)
          return (
            <div className={'eq-fila' + (t.activo ? '' : ' inactivo')} key={t.id} role="button" tabIndex={0}
              onClick={() => setPanel({ tipo: 'ver', id: t.id })}
              onKeyDown={e => { if (e.key === 'Enter') setPanel({ tipo: 'ver', id: t.id }) }}>
              <span className="eq-avatar">{t.nombre.trim().charAt(0).toUpperCase()}</span>
              <div className="eq-info">
                <b className="eq-nombre">{t.nombre}</b>
                <div className="eq-etiquetas">
                  {!t.activo && <span className="eq-tag">Desactivado</span>}
                  {t.ultimoPago === 'DISPUTADO' && <span className="eq-tag mal">Dice que no le pagaron</span>}
                  {t.ultimoPago === 'PENDIENTE' && <span className="eq-tag aviso-tag">Pago por confirmar</span>}
                  {(t.entregaPendiente ?? 0) > 0 && <span className="eq-tag aviso-tag">Dice que te entregó {pesos(t.entregaPendiente ?? 0)}</span>}
                  {t.ultimoPago === 'CONFIRMADO' && <span className="eq-tag ok">Pago confirmado ✓</span>}
                  {(t.porPagar ?? 0) > 0 && <span className="eq-tag pagar">Por pagar {pesos(t.porPagar ?? 0)}</span>}
                  {t.metaHoy != null && (
                    <span className={'eq-tag ' + (t.unidadesHoy >= t.metaHoy ? 'ok' : '')}>
                      Se propuso {t.metaHoy}{t.unidadesHoy >= t.metaHoy ? ' ✓' : ' · va en ' + t.unidadesHoy}
                    </span>
                  )}
                  {!t.terminosAceptadosEn && t.activo && <span className="eq-tag">Sin aceptar términos</span>}
                </div>
                {llevo > 0 ? (
                  <div className="eq-barra" aria-label={'Vendió ' + vendi + ' de ' + llevo}>
                    <div className="eq-barra-pista"><div className="eq-barra-barra" style={{ width: Math.min(100, Math.round(vendi * 100 / llevo)) + '%' }} /></div>
                    <span className="mut">{vendi} de {llevo} · quedan {llevo - vendi}</span>
                  </div>
                ) : <span className="mut eq-sin">{t.activo ? 'Sin carga hoy' : ''}</span>}
              </div>
              <div className="eq-monto">
                <b>{pesos(t.totalHoy)}</b>
                <small>{t.unidadesHoy} vendido{t.unidadesHoy === 1 ? '' : 's'}</small>
              </div>
              <span className="eq-flecha" aria-hidden="true">›</span>
            </div>
          )
        })}
        {lista && !lista.length && (
          <p className="mut">Todavía no tienes a nadie. Agrega a quien venda contigo: entra con su PIN, solo ve Vender y su día.</p>
        )}
      </div>

      <Sheet abierto={!!panel} onCerrar={() => setPanel(null)}>
        {panel?.tipo === 'nuevo' && (
          <FormNuevo onGuardar={async d => {
            if (await guardar(() => api.crearTrabajador(d), d.nombre + ' quedó en el equipo')) setPanel(null)
          }} />
        )}
        {panel?.tipo === 'ver' && trabajador && (
          <PanelTrabajador t={trabajador} productos={activos}
            proyeccion={proyecciones.find(x => x.vendedorId === trabajador.id) ?? null}
            onCarga={() => setPanel({ tipo: 'carga', id: trabajador.id })}
            onAgregar={() => setPanel({ tipo: 'agregar', id: trabajador.id })}
            onPagar={() => setPanel({ tipo: 'pagar', id: trabajador.id })}
            onCambioBase={() => void cargar()}
            onAnular={async pagoId => { await guardar(() => api.anularPagoTrabajador(pagoId), 'Pago anulado: sus cuentas volvieron') }}
            onCambiar={async (d, mensaje) => { await guardar(() => api.cambiarTrabajador(trabajador.id, d), mensaje) }} />
        )}
        {panel?.tipo === 'agregar' && trabajador && (
          <AgregarCarga trabajador={trabajador} productos={activos}
            onGuardar={async items => {
              if (await guardar(() => api.agregarCargaTrabajador(trabajador.id, items), 'Carga agregada a ' + trabajador.nombre)) {
                setPanel({ tipo: 'ver', id: trabajador.id })
              }
            }} />
        )}
        {panel?.tipo === 'pagar' && trabajador && <PagarPanel t={trabajador} guardar={guardar} volver={() => setPanel({ tipo: 'ver', id: trabajador.id })} />}
        {panel?.tipo === 'carga' && trabajador && (
          <CargaDelDia productos={activos} titulo={'Carga de ' + trabajador.nombre}
            ayuda="Cuántos de cada sabor le entregas para vender hoy. Él ve en Vender cuántos le quedan; el inventario de la casa baja cuando venda."
            textoQuitar="Quitarle la carga de hoy"
            actual={trabajador.carga.length ? cargaDe(trabajador) : null}
            onGuardar={async llevo => {
              const items = Object.entries(llevo).map(([id, n]) => ({ productoId: Number(id), llevo: n }))
              if (await guardar(() => api.cargarTrabajador(trabajador.id, items), 'Carga de ' + trabajador.nombre + ' guardada')) {
                setPanel({ tipo: 'ver', id: trabajador.id })
              }
            }}
            onLimpiar={async () => {
              if (await guardar(() => api.cargarTrabajador(trabajador.id, []), 'Carga quitada')) setPanel({ tipo: 'ver', id: trabajador.id })
            }} />
        )}
      </Sheet>
    </>
  )
}

/** La carga que ya tiene hoy, en la forma que entiende el selector. */
function cargaDe(t: Trabajador): Carga {
  return { dia: diaBogota(), items: Object.fromEntries(t.carga.map(f => [f.productoId, { llevo: f.llevo, antes: 0 }])) }
}

function FormNuevo({ onGuardar }: { onGuardar: (d: { nombre: string; pin: string; comisionPct: number }) => void }) {
  const [nombre, setNombre] = useState('')
  const [pin, setPin] = useState('')
  const [comision, setComision] = useState('0')
  const valido = nombre.trim().length > 0 && /^\d{4,8}$/.test(pin) && Number(comision) >= 0 && Number(comision) <= 100

  return (
    <form onSubmit={e => {
      e.preventDefault()
      if (valido) onGuardar({ nombre: nombre.trim(), pin, comisionPct: Number(comision) })
    }}>
      <h2>Nuevo en el equipo</h2>
      <p>Le das su PIN y con eso entra a la app. Solo verá Vender y su día.</p>
      <div className="campo">
        <label htmlFor="eq-nombre">Nombre</label>
        <input id="eq-nombre" autoFocus maxLength={60} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Juan" />
      </div>
      <div className="dos">
        <div className="campo">
          <label htmlFor="eq-pin">PIN (4 a 8 números)</label>
          <CampoNumero id="eq-pin" max={8} conCeros value={pin} onCambio={setPin} />
        </div>
        <div className="campo">
          <label htmlFor="eq-com">Comisión %</label>
          <CampoNumero id="eq-com" max={3} value={comision} onCambio={v => setComision(Number(v) > 100 ? '100' : v)} />
        </div>
      </div>
      <div className="acciones">
        <button className="big primario" type="submit" disabled={!valido}>Agregar</button>
      </div>
    </form>
  )
}

/** Pide las cuentas pendientes del trabajador (desde su último pago) y las deja al día cuando cambia algo. */
function useCuenta(t: Trabajador) {
  const [cuenta, setCuenta] = useState<CuentaEquipo | null | 'error'>(null)
  useEffect(() => {
    let vivo = true
    api.cuentaTrabajador(t.id)
      .then(c => { if (vivo) setCuenta(c) })
      .catch(() => { if (vivo) setCuenta('error') })
    return () => { vivo = false }
  }, [t.id, t.totalHoy, t.porPagar, t.ultimoPago])
  return cuenta
}

/** «Ya le pagué»: confirma monto y método; el trabajador recibe la pregunta en su celular. */
function PagarPanel({ t, guardar, volver }: {
  t: Trabajador
  guardar: (accion: () => Promise<unknown>, mensaje: string) => Promise<boolean>
  volver: () => void
}) {
  const cuenta = useCuenta(t)
  if (cuenta === 'error') return <p className="aviso">No se pudieron traer las cuentas, revisa la señal.</p>
  if (!cuenta) return <p className="mut">Calculando…</p>
  const p = cuenta.pendiente
  const saldoAnterior = cuenta.saldoAnterior ?? 0
  const consumos = p.consumos ?? 0
  const faltantes = p.faltantes ?? 0
  const prestamos = (cuenta.prestamos ?? []).reduce((a, x) => a + x.monto, 0)
  const debido = p.comision + p.bonos - consumos - faltantes - prestamos + saldoAnterior
  if (debido <= 0) {
    return (
      <>
        <h2>Nada por pagarle</h2>
        <p>
          {debido < 0
            ? 'Con lo que se tomó, lo que faltó y lo que le prestaste, ' + t.nombre + ' te queda debiendo ' + pesos(-debido) + ': se le descuenta de lo próximo que gane.'
            : t.nombre + ' no tiene comisiones pendientes desde su último pago.'}
        </p>
        <div className="acciones"><button className="big ghost" onClick={volver}>Volver</button></div>
      </>
    )
  }
  return (
    <PagarTrabajador nombre={t.nombre} comision={p.comision} bonos={p.bonos} unidades={p.unidades} saldoAnterior={saldoAnterior}
      consumos={consumos} faltantes={faltantes} prestamos={prestamos}
      onPagar={async pago => {
        const falta = pago.quedaDebiendo ? debido - pago.monto : 0
        const mensaje = 'Pago de ' + t.nombre + ' guardado. ' + (falta > 0 ? 'Le quedas debiendo ' + pesos(falta) : 'Sus cuentas arrancan de cero')
        if (await guardar(() => api.pagarTrabajador(t.id, pago), mensaje)) volver()
      }} />
  )
}

function PanelTrabajador({ t, productos, proyeccion, onCarga, onAgregar, onPagar, onAnular, onCambiar, onCambioBase }: {
  t: Trabajador
  /** Cómo viene vendiendo en las últimas semanas (null = no se pudo traer). */
  proyeccion: Proyeccion | null
  productos: Producto[]
  onCambioBase: () => void
  onCarga: () => void
  onAgregar: () => void
  onPagar: () => void
  onAnular: (pagoId: number) => Promise<void>
  onCambiar: (d: { nombre?: string; pin?: string; comisionPct?: number; activo?: boolean }, mensaje: string) => Promise<void>
}) {
  const [rango, setRango] = useState<'hoy' | 'semana' | 'quincena'>('hoy')
  const [cuentas, setCuentas] = useState<Liquidacion | null | 'error'>(null)
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(t.nombre)
  const [pin, setPin] = useState('')
  const [comision, setComision] = useState(String(t.comisionPct))
  const cuenta = useCuenta(t)
  const pendiente = cuenta && cuenta !== 'error' ? cuenta.pendiente : null
  const saldoAnterior = cuenta && cuenta !== 'error' ? cuenta.saldoAnterior ?? 0 : 0
  const consumos = pendiente?.consumos ?? 0
  const faltantes = pendiente?.faltantes ?? 0
  const prestamos = cuenta && cuenta !== 'error' ? cuenta.prestamos ?? [] : []
  const prestado = prestamos.reduce((a, x) => a + x.monto, 0)
  const porPagar = pendiente ? pendiente.comision + pendiente.bonos - consumos - faltantes - prestado + saldoAnterior : t.porPagar ?? 0
  const llevo = t.carga.reduce((a, f) => a + f.llevo, 0)
  const vendi = t.carga.reduce((a, f) => a + f.vendi, 0)

  useEffect(() => {
    let vivo = true
    const hoy = diaBogota()
    const desde = rango === 'hoy' ? hoy : diaBogota(Date.now() - (rango === 'semana' ? 6 : 14) * 86_400_000)
    api.liquidacionEquipo(desde, hoy)
      .then(l => { if (vivo) setCuentas(l.find(x => x.vendedorId === t.id) ?? null) })
      .catch(() => { if (vivo) setCuentas('error') })
    return () => { vivo = false }
  }, [rango, t.id, t.totalHoy])

  return (
    <>
      <div className="eq-cabeza">
        <span className="eq-avatar grande">{t.nombre.trim().charAt(0).toUpperCase()}</span>
        <div>
          <h2>{t.nombre}</h2>
          <p>{t.activo ? 'Vendedor' : 'Desactivado: ya no puede entrar'}{t.frecuenciaPago ? ' · cobra ' + NOMBRE_PAGO[t.frecuenciaPago] : ''}</p>
        </div>
      </div>
      <div className="eq-datos">
        <span className={'eq-tag ' + (t.terminosAceptadosEn ? 'ok' : 'aviso-tag')}>
          {t.terminosAceptadosEn
            ? 'Términos aceptados ' + new Date(t.terminosAceptadosEn).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })
            : 'Sin aceptar términos'}
        </span>
        {!t.frecuenciaPago && <span className="eq-tag">Sin frecuencia de pago</span>}
      </div>

      <div className="eq-kpis">
        <div><span>Vendido hoy</span><b>{pesos(t.totalHoy)}</b><small>{t.unidadesHoy} granizado{t.unidadesHoy === 1 ? '' : 's'}</small></div>
        <div><span>Carga</span><b>{llevo ? vendi + ' / ' + llevo : '—'}</b><small>{llevo ? 'quedan ' + (llevo - vendi) : 'sin carga hoy'}</small></div>
        <div><span>Meta de hoy</span><b>{t.metaHoy ?? '—'}</b><small>{t.metaHoy != null ? (t.unidadesHoy >= t.metaHoy ? 'cumplida' : 'faltan ' + (t.metaHoy - t.unidadesHoy)) : 'no la ha puesto'}</small></div>
        <div><span>Base para vueltos</span><b>{pesos(t.baseHoy ?? 0)}</b><small>{(t.baseHoy ?? 0) > 0 ? 'la devuelve al cerrar' : 'no le has pasado'}</small></div>
      </div>

      {proyeccion && (
        <div className="eq-proyeccion">
          <b><Icono nombre="reloj" /> Cuánto se hace</b>
          {proyeccion.dias >= MIN_DIAS ? (
            <>
              <span>
                En un día suyo vende unos <b>{proyeccion.unidadesDia}</b> y se gana <b>{pesos(proyeccion.ganaDia)}</b>.
                {' '}Viene trabajando {textoDias(proyeccion.diasSemana)} a la semana: se hace cerca de{' '}
                <b>{pesos(Math.round(proyeccion.ganaDia * proyeccion.diasSemana / 500) * 500)}</b> a la semana
                y <b>{pesos(Math.round(proyeccion.ganaDia * proyeccion.diasSemana * 30 / 7 / 500) * 500)}</b> al mes.
              </span>
              <small className="mut">
                Su mejor día: {proyeccion.mejorUnidades} granizados, {pesos(proyeccion.mejorGana)}. Sale de sus últimas 4 semanas (trabajó {textoDias(proyeccion.dias)}), ya con premios y descuentos.
              </small>
            </>
          ) : (
            <span className="mut">
              {proyeccion.dias > 0
                ? <>Ha trabajado {textoDias(proyeccion.dias)} en las últimas 4 semanas: vendió unos {proyeccion.unidadesDia} por día y se ganó {pesos(proyeccion.ganaDia)} por día. </>
                : <>Todavía no ha trabajado ningún día completo. </>}
              Con {MIN_DIAS} días ya se puede calcular cuánto se hace a la semana y al mes.
            </span>
          )}
        </div>
      )}

      <div className={'por-pagar' + (porPagar > 0 ? ' hay' : '')}>
        <span className="por-pagar-k">Por pagarle</span>
        <b>{porPagar < 0 ? 'Te debe ' + pesos(-porPagar) : pesos(porPagar)}</b>
        <span className="mut">
          {pendiente
            ? <><Unidades n={pendiente.unidades} />{(cuenta && cuenta !== 'error' && cuenta.desde ? ' desde su último pago' : ' en total')
              + (pendiente.bonos > 0 ? ' · incluye ' + pesos(pendiente.bonos) + ' de premios' : '')
              + (saldoAnterior > 0 ? ' · más ' + pesos(saldoAnterior) + ' que le quedaste debiendo' : '')
              + ((pendiente.consumidos ?? 0) > 0
                ? ' · se tomó ' + pendiente.consumidos + (consumos > 0 ? ': ya van descontados ' + pesos(consumos) : ' (gratis)')
                : '')
              + (faltantes > 0 ? ' · faltaron ' + (pendiente.unidadesFaltantes ?? 0) + ': ya van descontados ' + pesos(faltantes) : '')
              + (prestado > 0 ? ' · le prestaste ' + pesos(prestado) + ', ya va descontado' : '')}</>
            : 'Calculando…'}
        </span>
        <button className="big primario" onClick={onPagar} disabled={porPagar <= 0}>Ya le pagué {porPagar > 0 ? pesos(porPagar) : ''}</button>
      </div>

      {cuenta && cuenta !== 'error' && cuenta.pagos.length > 0 && (
        <Plegable icono="moneda" titulo="Historial de pagos" resumen={ETIQUETA_PAGO[cuenta.pagos[0].estado]}
          alerta={cuenta.pagos[0].estado === 'PENDIENTE' || cuenta.pagos[0].estado === 'DISPUTADO'}>
        <div className="list">
          <h3><Icono nombre="moneda" /> Sus pagos</h3>
          {cuenta.pagos.map(p => (
            <div className="pago-hist" key={p.id}>
              <div className="sabor-cabeza">
                <b>{pesos(p.monto)} · {comoSePago(p)}</b>
                <span className={'eq-tag ' + (p.estado === 'CONFIRMADO' ? 'ok' : p.estado === 'DISPUTADO' ? 'mal' : p.estado === 'PENDIENTE' ? 'aviso-tag' : '')}>
                  {ETIQUETA_PAGO[p.estado]}
                </span>
              </div>
              <span className="mut">
                {fechaHora(p.creadoEn)} · <Unidades n={p.unidades} />
                {(p.consumos ?? 0) > 0 && <> · se le descontaron {pesos(p.consumos ?? 0)} de lo que se tomó</>}
                {(p.faltantes ?? 0) > 0 && <> · {pesos(p.faltantes ?? 0)} de faltantes</>}
                {(p.prestamos ?? 0) > 0 && <> · {pesos(p.prestamos ?? 0)} de préstamos</>}
                {p.lugarEfectivo && p.metodo !== 'NEQUI' && <> · el efectivo salió de {NOMBRE_LUGAR[p.lugarEfectivo]}</>}
                {(p.saldo ?? 0) > 0 && p.estado !== 'ANULADO' && <> · quedaron pendientes {pesos(p.saldo ?? 0)}</>}
                {p.firma && <> · firmó el paz y salvo: <b>{p.firma}</b></>}
              </span>
              {(p.estado === 'PENDIENTE' || p.estado === 'DISPUTADO') && (
                <button className="chico-ghost" onClick={() => void onAnular(p.id)}>
                  {p.estado === 'DISPUTADO' ? 'No se le pagó: anular y volver a contar' : 'Anular este pago'}
                </button>
              )}
            </div>
          ))}
        </div>
        </Plegable>
      )}

      <Plegable icono="billetera" titulo="Préstamos" resumen={prestado > 0 ? pesos(prestado) + ' por descontar' : 'Ninguno'} alerta={prestado > 0}>
        <PrestamosPanel t={t} prestamos={prestamos} onCambio={onCambioBase} />
      </Plegable>

      <Plegable icono="billete" titulo="Entregas de plata" resumen={(t.entregaPendiente ?? 0) > 0 ? pesos(t.entregaPendiente ?? 0) + ' por confirmar' : 'Al día'}
        alerta={(t.entregaPendiente ?? 0) > 0} abierto={(t.entregaPendiente ?? 0) > 0}>
        <EntregasDelTrabajador id={t.id} version={String(t.entregaPendiente ?? 0) + (t.ultimaEntrega ?? '')} onCambio={onCambioBase} />
      </Plegable>

      <Plegable icono="billete" titulo="Base para vueltos" resumen={(t.baseHoy ?? 0) > 0 ? pesos(t.baseHoy ?? 0) + ' hoy' : 'Sin base hoy'}>
        <BaseVueltosPanel t={t} onCambio={onCambioBase} />
      </Plegable>

      <Plegable icono="caja" titulo="Carga de hoy" resumen={llevo ? 'vendió ' + vendi + ' de ' + llevo : 'Sin carga'}>
      <div className="list">
        <h3><Icono nombre="caja" /> Su carga de hoy</h3>
        {t.carga.length > 0 ? (
          <>
            <div className="eq-barra grande">
              <div className="eq-barra-pista"><div className="eq-barra-barra" style={{ width: Math.min(100, Math.round(vendi * 100 / Math.max(1, llevo))) + '%' }} /></div>
              <span className="mut">vendió {vendi} de {llevo} · le quedan {llevo - vendi}</span>
            </div>
            {t.carga.map(f => (
              <div className="row" key={f.productoId}>
                <span>{f.nombre}</span>
                <b>{f.vendi} / {f.llevo} · quedan {f.queda}</b>
              </div>
            ))}
          </>
        ) : <p className="mut" style={{ margin: 0 }}>No le has dado carga hoy.</p>}
        <div className="acciones" style={{ marginTop: 10 }}>
          {t.carga.length > 0 ? (
            <>
              <button className="big primario" onClick={onAgregar} disabled={!t.activo}>Agregarle más carga</button>
              <button className="big ghost" onClick={onCarga} disabled={!t.activo}>Corregir su carga</button>
            </>
          ) : (
            <button className="big primario" onClick={onCarga} disabled={!t.activo}>Darle carga para hoy</button>
          )}
        </div>
      </div>

      </Plegable>

      <Plegable icono="alerta" titulo="Faltantes" resumen="Si las cuentas no dan">
        <FaltantePanel t={t} productos={productos} onCambio={onCambioBase} />
      </Plegable>

      <Plegable icono="grafico" titulo="Ventas y cuentas" resumen="Hoy, 7 y 15 días">
      <div className="list">
        <h3><Icono nombre="reloj" /> Lo que ha vendido</h3>
        <div className="chips">
          <button className={rango === 'hoy' ? 'on' : ''} onClick={() => setRango('hoy')}>Hoy</button>
          <button className={rango === 'semana' ? 'on' : ''} onClick={() => setRango('semana')}>Últimos 7 días</button>
          <button className={rango === 'quincena' ? 'on' : ''} onClick={() => setRango('quincena')}>Últimos 15 días</button>
        </div>
        {cuentas === 'error' && <p className="aviso">No se pudieron traer las cuentas, revisa la señal.</p>}
        {cuentas === null && <p className="mut">Sin ventas en este rango.</p>}
        {cuentas && cuentas !== 'error' && (
          <>
            <div className="carga-totales">
              <div><b>{cuentas.unidades}</b><span>vendió</span></div>
              <div><b>{pesos(cuentas.efectivo)}</b><span>efectivo</span></div>
              <div><b>{pesos(cuentas.nequi)}</b><span>Nequi</span></div>
            </div>
            <div className="row"><span>Total vendido</span><b>{pesos(cuentas.total)}</b></div>
            <div className="row"><span>Su comisión</span><b>{pesos(cuentas.comision)}</b></div>
            {cuentas.diasMeta > 0 && (
              <div className="row">
                <span>Premio por meta ({cuentas.diasMeta} día{cuentas.diasMeta === 1 ? '' : 's'})</span><b>{pesos(cuentas.bonos)}</b>
              </div>
            )}
            {(cuentas.consumidos ?? 0) > 0 && (
              <div className="row"><span>Se tomó {cuentas.consumidos}</span><b>{(cuentas.consumos ?? 0) > 0 ? '−' + pesos(cuentas.consumos ?? 0) : 'gratis'}</b></div>
            )}
            {(cuentas.faltantes ?? 0) > 0 && (
              <div className="row"><span>Faltaron {cuentas.unidadesFaltantes}</span><b>−{pesos(cuentas.faltantes ?? 0)}</b></div>
            )}
            <div className="row">
              <span>{cuentas.saldo >= 0 ? 'Te debe entregar' : 'Le debes'}</span>
              <b>{pesos(Math.abs(cuentas.saldo))}</b>
            </div>
            <p className="mut" style={{ margin: '6px 0 0' }}>El Nequi entra a tu cuenta; por eso lo que te entrega es el efectivo menos su comisión y su premio.</p>
          </>
        )}
      </div>

      </Plegable>

      <Plegable icono="candado" titulo="Datos y acceso" resumen={'Comisión ' + t.comisionPct + '%'}>
      <div className="acciones">
        <button className="big ghost" onClick={() => setEditando(e => !e)}>{editando ? 'Cerrar edición' : 'Cambiar nombre, PIN o comisión'}</button>
      </div>

      {editando && (
        <form className="fiado-form" style={{ marginTop: 12 }} onSubmit={async e => {
          e.preventDefault()
          await onCambiar({
            nombre: nombre.trim() || undefined, pin: pin || undefined, comisionPct: Number(comision) || 0,
          }, 'Cambios guardados')
          setPin('')
          setEditando(false)
        }}>
          <div className="campo">
            <label htmlFor="ed-nombre">Nombre</label>
            <input id="ed-nombre" maxLength={60} value={nombre} onChange={e => setNombre(e.target.value)} />
          </div>
          <div className="dos">
            <div className="campo">
              <label htmlFor="ed-pin">PIN nuevo (opcional)</label>
              <CampoNumero id="ed-pin" max={8} conCeros value={pin} onCambio={setPin} placeholder="Vacío = no cambia" />
            </div>
            <div className="campo">
              <label htmlFor="ed-com">Comisión %</label>
              <CampoNumero id="ed-com" max={3} value={comision} onCambio={v => setComision(Number(v) > 100 ? '100' : v)} />
            </div>
          </div>
          <button className="big primario" type="submit" disabled={pin.length > 0 && pin.length < 4}>Guardar</button>
        </form>
      )}

      <div className="acciones" style={{ marginTop: 12 }}>
        <button className={'big ' + (t.activo ? 'peligro' : 'ghost')}
          onClick={() => void onCambiar({ activo: !t.activo }, t.activo ? t.nombre + ' desactivado' : t.nombre + ' activado')}>
          {t.activo ? 'Desactivar (ya no puede entrar)' : 'Volver a activar'}
        </button>
      </div>
      </Plegable>
    </>
  )
}
