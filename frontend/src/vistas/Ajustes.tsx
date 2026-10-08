import { useCallback, useEffect, useState } from 'react'
import { api, sesion, type ImportarResultado, type PasskeyInfo } from '../api'
import { Icono } from '../componentes/Icono'
import { PromoAjustes } from '../componentes/PromoAjustes'
import { IconoFaceId, type ModoFaceId } from '../componentes/IconoFaceId'
import { Sheet } from '../componentes/Sheet'
import { activarFaceId, esCancelacion, esErrorDeDominio, faceIdActivado, olvidarFaceId, soportaFaceId } from '../faceid'
import { pesos } from '../formato'
import { useInstalarPWA } from '../instalarPwa'
import type { DatosProducto, Param, Producto, Tipo } from '../tipos'

const PRECIO_POR_TIPO: Record<Tipo, number> = { NORMAL: 6000, CREMOSO: 7000, GRANDE: 10000 }

const ICONO_PARAM: Record<string, string> = {
  DIAS_COBERTURA: 'caja', DIAS_HISTORIAL: 'reloj', META_DIARIA: 'trofeo',
  NOMBRE: 'cara', PROVEEDOR_WHATSAPP: 'celular',
}

interface Props {
  avisar: (m: string) => void
  onCambio: () => Promise<void>
}

type Panel = { tipo: 'producto'; producto: Producto | null } | { tipo: 'param'; param: Param }

/** Editar sabores, precios y la configuración. Necesita señal (no pasa por la cola). */
export function Ajustes({ avisar, onCambio }: Props) {
  const [productos, setProductos] = useState<Producto[] | null>(null)
  const [params, setParams] = useState<Param[]>([])
  const [error, setError] = useState(false)
  const [panel, setPanel] = useState<Panel | null>(null)

  const cargar = useCallback(() => Promise.all([api.productos(), api.config()]).then(
    ([ps, cs]) => { setProductos(ps); setParams(cs); setError(false) },
    () => setError(true)), [])

  useEffect(() => { void cargar() }, [cargar])

  const guardarProducto = async (id: number | null, d: DatosProducto) => {
    try {
      if (id) await api.editarProducto(id, d)
      else await api.crearProducto(d)
      setPanel(null)
      avisar('✓ Guardado')
      await cargar()
      await onCambio()
    } catch (e) {
      avisar('⚠️ ' + (e instanceof Error ? e.message : 'No se pudo guardar'))
    }
  }

  const guardarParam = async (clave: string, valor: string) => {
    try {
      await api.guardarConfig(clave, valor)
      setPanel(null)
      avisar('✓ Guardado')
      await cargar()
    } catch (e) {
      avisar('⚠️ ' + (e instanceof Error ? e.message : 'No se pudo guardar'))
    }
  }

  if (error) return <div className="vacio">Ajustes necesita señal.<br /><br /><button className="big ghost" onClick={cargar}>Reintentar</button></div>
  if (!productos) return <div className="vacio">Cargando…</div>

  return (
    <section>
      <div className="list">
        <h3><Icono nombre="vaso" /> Sabores</h3>
        {productos.map(p => (
          <div className={'sabor-fila clic' + (p.activo ? '' : ' inactivo')} key={p.id} onClick={() => setPanel({ tipo: 'producto', producto: p })}>
            <span className="pago-avatar"><Icono nombre="vaso" /></span>
            <div className="sabor-info">
              <div className="sabor-cabeza"><b>{p.nombre}</b><b>{pesos(p.precio)}</b></div>
              <div className="sabor-pie"><span className="mut">mínimo {p.stockMinimo} · costo {pesos(p.costo)}{p.activo ? '' : ' · oculto'}</span></div>
            </div>
          </div>
        ))}
      </div>
      <div className="acciones" style={{ marginBottom: 14 }}>
        <button className="big primario" onClick={() => setPanel({ tipo: 'producto', producto: null })}>Agregar sabor o tamaño</button>
      </div>

      <div className="list">
        <h3><Icono nombre="sliders" /> Configuración</h3>
        {params.map(c => (
          <div className="config-fila clic" key={c.clave} onClick={() => setPanel({ tipo: 'param', param: c })}>
            <span className="config-icono"><Icono nombre={ICONO_PARAM[c.clave] ?? 'sliders'} /></span>
            <div className="sabor-info">
              <b>{c.clave.replace(/_/g, ' ').toLowerCase()}</b>
              {c.nota && <div className="sabor-pie"><span className="mut">{c.nota}</span></div>}
            </div>
            <span className="config-valor">{c.valor || '—'}</span>
          </div>
        ))}
      </div>

      <PromoAjustes avisar={avisar} />

      <SeccionInstalar />

      <SeccionFaceId avisar={avisar} />

      <SeccionImportar avisar={avisar} />

      <div className="acciones">
        <button className="big peligro" onClick={() => sesion.cerrar()}>Cerrar sesión</button>
      </div>

      <Sheet abierto={!!panel} onCerrar={() => setPanel(null)}>
        {panel?.tipo === 'producto' && <FormProducto producto={panel.producto} onGuardar={guardarProducto} />}
        {panel?.tipo === 'param' && <FormParam param={panel.param} onGuardar={guardarParam} />}
      </Sheet>
    </section>
  )
}

function FormProducto({ producto, onGuardar }: { producto: Producto | null; onGuardar: (id: number | null, d: DatosProducto) => void }) {
  const [sabor, setSabor] = useState(producto?.sabor ?? '')
  const [tipo, setTipo] = useState<Tipo>(producto?.tipo ?? 'NORMAL')
  const [precio, setPrecio] = useState(String(producto?.precio ?? PRECIO_POR_TIPO.NORMAL))
  const [costo, setCosto] = useState(String(producto?.costo ?? 0))
  const [minimo, setMinimo] = useState(String(producto?.stockMinimo ?? 3))
  const [activo, setActivo] = useState(producto?.activo ?? true)

  const cambiarTipo = (t: Tipo) => {
    setTipo(t)
    if (!producto) setPrecio(String(PRECIO_POR_TIPO[t]))
  }

  const valido = sabor.trim() && Number(precio) >= 0 && Number(costo) >= 0 && Number(minimo) >= 0
  return (
    <form onSubmit={e => {
      e.preventDefault()
      if (valido) onGuardar(producto?.id ?? null, {
        sabor: sabor.trim(), tipo, precio: Number(precio), costo: Number(costo), stockMinimo: Number(minimo), activo,
      })
    }}>
      <h2>{producto ? 'Editar sabor' : 'Nuevo sabor'}</h2>
      <p>{producto ? 'El stock se cambia desde Inventario.' : 'Para un cremoso o grande de un sabor que ya existe, usa el mismo nombre.'}</p>
      <div className="campo">
        <label htmlFor="sabor">Sabor</label>
        <input id="sabor" value={sabor} maxLength={80} onChange={e => setSabor(e.target.value)} placeholder="Ej: Piña colada" />
      </div>
      <div className="campo">
        <label htmlFor="tipo">Tamaño</label>
        <select id="tipo" value={tipo} onChange={e => cambiarTipo(e.target.value as Tipo)}>
          <option value="NORMAL">Normal</option>
          <option value="CREMOSO">Cremoso</option>
          <option value="GRANDE">Grande</option>
        </select>
      </div>
      <div className="dos">
        <div className="campo">
          <label htmlFor="precio">Precio</label>
          <input id="precio" inputMode="numeric" value={precio} onChange={e => setPrecio(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="campo">
          <label htmlFor="costo">Costo</label>
          <input id="costo" inputMode="numeric" value={costo} onChange={e => setCosto(e.target.value.replace(/\D/g, ''))}
            aria-describedby="nota-costo" />
          <small id="nota-costo" className="mut">Lo que te cuesta comprarlo</small>
        </div>
      </div>
      <div className="campo">
        <label htmlFor="minimo">Avisar con</label>
        <input id="minimo" inputMode="numeric" value={minimo} onChange={e => setMinimo(e.target.value.replace(/\D/g, ''))} />
      </div>
      <label className="interruptor">
        <span>Mostrar en la caja</span>
        <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} />
      </label>
      <button className="big primario" type="submit" disabled={!valido}>Guardar</button>
    </form>
  )
}

/** Instalar la app en la pantalla de inicio. En Chrome/Android sale un prompt; en iPhone hay que explicarlo a mano. */
function SeccionInstalar() {
  const { modo, instalar } = useInstalarPWA()
  const [ayuda, setAyuda] = useState(false)

  if (modo === 'instalada' || modo === 'no-disponible') return null

  return (
    <>
      <div className="acciones" style={{ marginBottom: 14 }}>
        <button className="big ghost" style={{ justifyContent: 'center' }}
          onClick={() => modo === 'ios' ? setAyuda(true) : void instalar()}>
          <Icono nombre="instalar" /> Instalar en la pantalla de inicio
        </button>
      </div>

      <Sheet abierto={ayuda} onCerrar={() => setAyuda(false)}>
        <h2><Icono nombre="instalar" /> Instalar en el iPhone</h2>
        <p>Safari no deja abrir esto solo, pero son dos toques:</p>
        <div className="list">
          <div className="row"><span><Icono nombre="compartir" /> 1. Toca <b>Compartir</b> abajo en Safari</span></div>
          <div className="row"><span><Icono nombre="cuadrado" /> 2. Elige <b>Agregar a inicio</b></span></div>
        </div>
        <button className="big primario" onClick={() => setAyuda(false)}>Listo</button>
      </Sheet>
    </>
  )
}

/** Activar o quitar el Face ID. Cada celular registra su propia llave. */
function SeccionFaceId({ avisar }: { avisar: (m: string) => void }) {
  const [llaves, setLlaves] = useState<PasskeyInfo[]>([])
  const [soporta, setSoporta] = useState(false)
  const [modo, setModo] = useState<ModoFaceId>('quieto')

  const cargar = useCallback(() => api.passkeys().then(setLlaves, () => setLlaves([])), [])

  useEffect(() => {
    void cargar()
    void soportaFaceId().then(setSoporta)
  }, [cargar])

  const activar = async () => {
    setModo('escaneando')
    try {
      await activarFaceId()
      setModo('ok')
      avisar('✓ Face ID activado')
      await cargar()
    } catch (e) {
      setModo('quieto')
      if (esErrorDeDominio(e)) avisar('⚠️ Este dominio no está habilitado para Face ID (revisa WEBAUTHN_RP_ID)')
      else if (!esCancelacion(e)) avisar('⚠️ No se pudo activar Face ID')
    } finally {
      setTimeout(() => setModo('quieto'), 1200)
    }
  }

  const quitar = async (id: number) => {
    try {
      await api.borrarPasskey(id)
      const quedan = llaves.filter(l => l.id !== id)
      setLlaves(quedan)
      if (!quedan.length) olvidarFaceId()
      avisar('Face ID quitado')
    } catch {
      avisar('⚠️ No se pudo quitar')
    }
  }

  return (
    <>
      <div className="list">
        <h3><Icono nombre="cara" /> Face ID</h3>
        {llaves.length === 0 && <div className="row"><span className="mut">Todavía no está activado</span></div>}
        {llaves.map(l => (
          <div className="row" key={l.id}>
            <span>{l.nombre}<br /><small className="mut">
              {l.usadaEn ? 'usado ' + new Date(l.usadaEn).toLocaleDateString('es-CO') : 'activado ' + new Date(l.creadaEn).toLocaleDateString('es-CO')}
            </small></span>
            <button className="quitar" onClick={() => void quitar(l.id)}>Quitar</button>
          </div>
        ))}
      </div>
      {soporta && !faceIdActivado() && (
        <div className="acciones" style={{ marginBottom: 14 }}>
          <button className="big ghost faceid-fila" style={{ justifyContent: 'center' }} onClick={activar} disabled={modo === 'escaneando'}>
            <IconoFaceId modo={modo} tamano={28} /> Activar Face ID en este celular
          </button>
        </div>
      )}
    </>
  )
}

/** Sube un CSV de ventas de otro sistema. No toca el stock; el mismo archivo se puede resubir sin duplicar. */
function SeccionImportar({ avisar }: { avisar: (m: string) => void }) {
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<ImportarResultado | null>(null)

  const subir = async (archivo: File) => {
    setCargando(true)
    setResultado(null)
    try {
      const texto = await archivo.text()
      const r = await api.importarVentas(texto)
      setResultado(r)
      avisar(r.importadas ? `✓ ${r.importadas} venta${r.importadas === 1 ? '' : 's'} importada${r.importadas === 1 ? '' : 's'}` : 'Nada nuevo para importar')
    } catch (e) {
      avisar('⚠️ ' + (e instanceof Error ? e.message : 'No se pudo importar'))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="list">
      <h3><Icono nombre="calendario" /> Importar ventas históricas</h3>
      <p className="mut" style={{ padding: '0 4px 10px' }}>
        Un CSV con columnas <b>fecha;sabor;cantidad;precioUnitario</b> (fecha AAAA-MM-DD). No toca el stock y puedes
        resubir el mismo archivo sin que se dupliquen las ventas.
      </p>
      <label className="big ghost" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: cargando ? 'default' : 'pointer' }}>
        {cargando ? 'Importando…' : 'Elegir archivo CSV'}
        <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} disabled={cargando}
          onChange={e => { const archivo = e.target.files?.[0]; e.target.value = ''; if (archivo) void subir(archivo) }} />
      </label>
      {resultado && (
        <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
          <span>✓ {resultado.importadas} importada{resultado.importadas === 1 ? '' : 's'}
            {resultado.repetidas > 0 ? ` · ${resultado.repetidas} ya estaba${resultado.repetidas === 1 ? '' : 'n'}` : ''}
          </span>
          {resultado.errores.length > 0 && (
            <span className="aviso">
              {resultado.errores.length} fila{resultado.errores.length === 1 ? '' : 's'} con problema:
              {resultado.errores.slice(0, 8).map(e => <small key={e.fila} style={{ display: 'block' }}>fila {e.fila}: {e.motivo}</small>)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function FormParam({ param, onGuardar }: { param: Param; onGuardar: (clave: string, valor: string) => void }) {
  const [valor, setValor] = useState(param.valor)
  const numerico = param.clave !== 'NOMBRE'
  return (
    <form onSubmit={e => { e.preventDefault(); onGuardar(param.clave, valor) }}>
      <h2>{param.clave.replace(/_/g, ' ').toLowerCase()}</h2>
      <p>{param.nota}</p>
      <div className="campo">
        <input value={valor} inputMode={numerico ? 'numeric' : 'text'} autoFocus onChange={e => setValor(e.target.value)} />
      </div>
      <button className="big primario" type="submit">Guardar</button>
    </form>
  )
}
