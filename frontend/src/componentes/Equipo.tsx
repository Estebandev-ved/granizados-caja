import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import type { Carga } from '../carga'
import { diaBogota } from '../estadoLocal'
import { pesos } from '../formato'
import type { Liquidacion, Producto, Trabajador } from '../tipos'
import { CargaDelDia } from './CargaDelDia'
import { CampoNumero } from './CampoNumero'
import { Icono } from './Icono'
import { Sheet } from './Sheet'

type Panel = { tipo: 'nuevo' } | { tipo: 'ver'; id: number } | { tipo: 'carga'; id: number }

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
      <div className="list">
        <h3><Icono nombre="cara" /> Equipo</h3>
        <p className="mut" style={{ margin: '0 0 6px' }}>
          Quienes venden contigo entran con su propio PIN, solo ven Vender y su día, y venden de lo que les cargues.
        </p>
        {lista?.map(t => (
          <div className={'sabor-fila clic' + (t.activo ? '' : ' inactivo')} key={t.id} onClick={() => setPanel({ tipo: 'ver', id: t.id })}>
            <span className="pago-avatar"><Icono nombre="cara" /></span>
            <div className="sabor-info">
              <div className="sabor-cabeza"><b>{t.nombre}</b><b>{pesos(t.totalHoy)}</b></div>
              <div className="sabor-pie">
                <span className="mut">
                  {t.activo ? '' : 'desactivado · '}hoy {t.unidadesHoy} vendido{t.unidadesHoy === 1 ? '' : 's'}
                  {t.carga.length ? ' · le quedan ' + t.carga.reduce((a, f) => a + f.queda, 0) : ' · sin carga'}
                </span>
              </div>
            </div>
          </div>
        ))}
        {lista && !lista.length && <p className="mut">Todavía no tienes a nadie en el equipo.</p>}
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
            onCambiar={async (d, mensaje) => { await guardar(() => api.cambiarTrabajador(trabajador.id, d), mensaje) }} />
        )}
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

function PanelTrabajador({ t, onCarga, onCambiar }: {
  t: Trabajador
  onCarga: () => void
  onCambiar: (d: { nombre?: string; pin?: string; comisionPct?: number; activo?: boolean }, mensaje: string) => Promise<void>
}) {
  const [rango, setRango] = useState<'hoy' | 'semana'>('hoy')
  const [cuentas, setCuentas] = useState<Liquidacion | null | 'error'>(null)
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(t.nombre)
  const [pin, setPin] = useState('')
  const [comision, setComision] = useState(String(t.comisionPct))

  useEffect(() => {
    let vivo = true
    const hoy = diaBogota()
    const desde = rango === 'hoy' ? hoy : diaBogota(Date.now() - 6 * 86_400_000)
    api.liquidacionEquipo(desde, hoy)
      .then(l => { if (vivo) setCuentas(l.find(x => x.vendedorId === t.id) ?? null) })
      .catch(() => { if (vivo) setCuentas('error') })
    return () => { vivo = false }
  }, [rango, t.id, t.totalHoy])

  return (
    <>
      <h2>{t.nombre}</h2>
      <p>{t.activo ? 'Comisión ' + t.comisionPct + '%' : 'Desactivado: ya no puede entrar'}</p>

      <div className="chips">
        <button className={rango === 'hoy' ? 'on' : ''} onClick={() => setRango('hoy')}>Hoy</button>
        <button className={rango === 'semana' ? 'on' : ''} onClick={() => setRango('semana')}>Últimos 7 días</button>
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
          <div className="list">
            <div className="row"><span>Total vendido</span><b>{pesos(cuentas.total)}</b></div>
            <div className="row"><span>Su comisión ({cuentas.comisionPct}%)</span><b>{pesos(cuentas.comision)}</b></div>
            {cuentas.diasMeta > 0 && (
              <div className="row">
                <span>Premio por meta ({cuentas.diasMeta} día{cuentas.diasMeta === 1 ? '' : 's'})</span><b>{pesos(cuentas.bonos)}</b>
              </div>
            )}
            <div className="row">
              <span>{cuentas.saldo >= 0 ? 'Te debe entregar' : 'Le debes'}</span>
              <b>{pesos(Math.abs(cuentas.saldo))}</b>
            </div>
          </div>
          <p className="mut">El Nequi entra a tu cuenta; por eso lo que te entrega es el efectivo menos su comisión y su premio.</p>
        </>
      )}

      {t.carga.length > 0 && (
        <div className="list">
          <h3><Icono nombre="caja" /> Su carga de hoy</h3>
          {t.carga.map(f => (
            <div className="row" key={f.productoId}>
              <span>{f.nombre}</span>
              <b>{f.vendi} / {f.llevo} · quedan {f.queda}</b>
            </div>
          ))}
        </div>
      )}

      <div className="acciones">
        <button className="big primario" onClick={onCarga} disabled={!t.activo}>
          {t.carga.length ? 'Cambiar su carga de hoy' : 'Darle carga para hoy'}
        </button>
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
