import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import type { Carga } from '../carga'
import { diaBogota } from '../estadoLocal'
import { pesos } from '../formato'
import type { CuentaEquipo, Liquidacion, MetodoPagoEquipo, Producto, Trabajador } from '../tipos'
import { AgregarCarga } from './AgregarCarga'
import { CargaDelDia } from './CargaDelDia'
import { ETIQUETA_PAGO, PagarTrabajador, fechaHora } from './PagoTrabajador'
import { NOMBRE_PAGO } from '../pagos'
import { CampoNumero } from './CampoNumero'
import { BaseVueltosPanel } from './BaseVueltosPanel'
import { Icono } from './Icono'
import { Sheet } from './Sheet'

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
        <div><b>{lista?.filter(t => t.activo).length ?? 0}</b><span>en el equipo</span></div>
        <div><b>{pesos(lista?.reduce((a, t) => a + t.totalHoy, 0) ?? 0)}</b><span>vendido hoy</span></div>
        <div className={porPagarTotal > 0 ? 'alerta' : ''}><b>{pesos(porPagarTotal)}</b><span>por pagar</span></div>
      </div>
      <div className="list">
        <h3><Icono nombre="cara" /> Tu equipo</h3>
        {lista?.map(t => {
          const llevo = t.carga.reduce((a, f) => a + f.llevo, 0)
          const vendi = t.carga.reduce((a, f) => a + f.vendi, 0)
          return (
            <div className={'eq-fila' + (t.activo ? '' : ' inactivo')} key={t.id} role="button" tabIndex={0}
              onClick={() => setPanel({ tipo: 'ver', id: t.id })}
              onKeyDown={e => { if (e.key === 'Enter') setPanel({ tipo: 'ver', id: t.id }) }}>
              <span className="eq-avatar">{t.nombre.trim().charAt(0).toUpperCase()}</span>
              <div className="eq-info">
                <div className="sabor-cabeza"><b>{t.nombre}</b><b>{pesos(t.totalHoy)}</b></div>
                <div className="eq-etiquetas">
                  {!t.activo && <span className="eq-tag">Desactivado</span>}
                  {t.ultimoPago === 'DISPUTADO' && <span className="eq-tag mal">Dice que no le pagaron</span>}
                  {t.ultimoPago === 'PENDIENTE' && <span className="eq-tag aviso-tag">Pago por confirmar</span>}
                  {(t.porPagar ?? 0) > 0 && <span className="eq-tag pagar">Por pagar {pesos(t.porPagar ?? 0)}</span>}
                  {!t.terminosAceptadosEn && t.activo && <span className="eq-tag">Sin aceptar términos</span>}
                </div>
                {llevo > 0 ? (
                  <div className="eq-barra" aria-label={'Vendió ' + vendi + ' de ' + llevo}>
                    <div className="eq-barra-pista"><div className="eq-barra-barra" style={{ width: Math.min(100, Math.round(vendi * 100 / llevo)) + '%' }} /></div>
                    <span className="mut">{vendi} de {llevo} · quedan {llevo - vendi}</span>
                  </div>
                ) : <span className="mut">{t.activo ? 'Sin carga hoy' : ''}</span>}
              </div>
            </div>
          )
        })}
        {lista && !lista.length && (
          <p className="mut">Todavía no tienes a nadie. Agrega a quien venda contigo: entra con su PIN, solo ve Vender y su día.</p>
        )}
      </div>
      <div className="acciones" style={{ marginBottom: 14 }}>
        <button className="big primario" onClick={() => setPanel({ tipo: 'nuevo' })}>Agregar a alguien</button>
      </div>

      <Sheet abierto={!!panel} onCerrar={() => setPanel(null)}>
        {panel?.tipo === 'nuevo' && (
          <FormNuevo onGuardar={async d => {
            if (await guardar(() => api.crearTrabajador(d), d.nombre + ' quedó en el equipo')) setPanel(null)
          }} />
        )}
        {panel?.tipo === 'ver' && trabajador && (
          <PanelTrabajador t={trabajador}
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
  if (p.comision + p.bonos <= 0) {
    return (
      <>
        <h2>Nada por pagarle</h2>
        <p>{t.nombre} no tiene comisiones pendientes desde su último pago.</p>
        <div className="acciones"><button className="big ghost" onClick={volver}>Volver</button></div>
      </>
    )
  }
  return (
    <PagarTrabajador nombre={t.nombre} comision={p.comision} bonos={p.bonos} unidades={p.unidades}
      onPagar={async (metodo: MetodoPagoEquipo, monto: number) => {
        if (await guardar(() => api.pagarTrabajador(t.id, metodo, monto), 'Pago de ' + t.nombre + ' guardado. Sus cuentas arrancan de cero')) volver()
      }} />
  )
}

function PanelTrabajador({ t, onCarga, onAgregar, onPagar, onAnular, onCambiar, onCambioBase }: {
  t: Trabajador
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
  const porPagar = pendiente ? pendiente.comision + pendiente.bonos : t.porPagar ?? 0
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
          <p>{t.activo ? 'Comisión ' + t.comisionPct + '%' : 'Desactivado: ya no puede entrar'}</p>
        </div>
      </div>
      <div className="eq-datos">
        <span>{t.frecuenciaPago ? 'Cobra ' + NOMBRE_PAGO[t.frecuenciaPago] : 'Aún no escoge cuándo cobrar'}</span>
        <span>
          {t.terminosAceptadosEn
            ? '✓ Términos aceptados el ' + new Date(t.terminosAceptadosEn).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' })
            : 'Sin aceptar los términos'}
        </span>
      </div>

      <div className={'por-pagar' + (porPagar > 0 ? ' hay' : '')}>
        <span className="por-pagar-k">Por pagarle</span>
        <b>{pesos(porPagar)}</b>
        <span className="mut">
          {pendiente
            ? pendiente.unidades + ' granizado' + (pendiente.unidades === 1 ? '' : 's') + (cuenta && cuenta !== 'error' && cuenta.desde ? ' desde su último pago' : ' en total')
              + (pendiente.bonos > 0 ? ' · incluye ' + pesos(pendiente.bonos) + ' de premios' : '')
            : 'Calculando…'}
        </span>
        <button className="big primario" onClick={onPagar} disabled={porPagar <= 0}>Ya le pagué {porPagar > 0 ? pesos(porPagar) : ''}</button>
      </div>

      {cuenta && cuenta !== 'error' && cuenta.pagos.length > 0 && (
        <div className="list">
          <h3><Icono nombre="moneda" /> Sus pagos</h3>
          {cuenta.pagos.map(p => (
            <div className="pago-hist" key={p.id}>
              <div className="sabor-cabeza">
                <b>{pesos(p.monto)} · {p.metodo === 'EFECTIVO' ? 'Efectivo' : 'Nequi'}</b>
                <span className={'eq-tag ' + (p.estado === 'CONFIRMADO' ? 'ok' : p.estado === 'DISPUTADO' ? 'mal' : p.estado === 'PENDIENTE' ? 'aviso-tag' : '')}>
                  {ETIQUETA_PAGO[p.estado]}
                </span>
              </div>
              <span className="mut">
                {fechaHora(p.creadoEn)} · {p.unidades} granizado{p.unidades === 1 ? '' : 's'}
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
      )}

      <BaseVueltosPanel t={t} onCambio={onCambioBase} />

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
            <div className="row">
              <span>{cuentas.saldo >= 0 ? 'Te debe entregar' : 'Le debes'}</span>
              <b>{pesos(Math.abs(cuentas.saldo))}</b>
            </div>
            <p className="mut" style={{ margin: '6px 0 0' }}>El Nequi entra a tu cuenta; por eso lo que te entrega es el efectivo menos su comisión y su premio.</p>
          </>
        )}
      </div>

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
    </>
  )
}
