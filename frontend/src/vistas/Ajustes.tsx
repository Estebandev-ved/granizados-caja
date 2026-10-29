import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, sesion, type ImportarResultado, type PasskeyInfo } from '../api'
import { CampoNumero } from '../componentes/CampoNumero'
import { Equipo } from '../componentes/Equipo'
import { Icono } from '../componentes/Icono'
import { PromoAjustes } from '../componentes/PromoAjustes'
import { IconoFaceId, type ModoFaceId } from '../componentes/IconoFaceId'
import { Sheet } from '../componentes/Sheet'
import { activarFaceId, esCancelacion, esErrorDeDominio, faceIdActivado, olvidarFaceId, soportaFaceId } from '../faceid'
import { aEntero, pesos } from '../formato'
import { useInstalarPWA } from '../instalarPwa'
import { leerPromo, nombrePromo, promoVigente } from '../promo'
import type { DatosProducto, Param, Producto, Tipo } from '../tipos'

const PRECIO_POR_TIPO: Record<Tipo, number> = { NORMAL: 6000, CREMOSO: 7000, GRANDE: 10000, CERVEZA: 5000 }

/** Cómo se llama cada ajuste, qué tipo de dato es y en qué sección vive. */
type Clase = 'dinero' | 'entero' | 'telefono' | 'texto'
interface Meta { titulo: string; icono: string; clase: Clase; unidad?: string; apagable?: boolean; max?: number }

const META_PARAM: Record<string, Meta> = {
  META_DIARIA: { titulo: 'Meta diaria de ventas', icono: 'trofeo', clase: 'dinero', apagable: true },
  META_EQUIPO: { titulo: 'Meta por trabajador', icono: 'trofeo', clase: 'entero', unidad: 'granizados al día', apagable: true, max: 4 },
  PREMIO_EQUIPO: { titulo: 'Premio por cumplir la meta', icono: 'moneda', clase: 'dinero', apagable: true },
  PROVEEDOR_WHATSAPP: { titulo: 'WhatsApp del proveedor', icono: 'celular', clase: 'telefono' },
  NOMBRE: { titulo: 'Tu nombre en el pedido', icono: 'cara', clase: 'texto' },
  DIAS_COBERTURA: { titulo: 'Días que debe alcanzar el pedido', icono: 'caja', clase: 'entero', unidad: 'días', max: 2 },
  DIAS_HISTORIAL: { titulo: 'Días de ventas que se miran', icono: 'reloj', clase: 'entero', unidad: 'días', max: 3 },
  PAGO_NEQUI: { titulo: 'Tu Nequi', icono: 'celular', clase: 'telefono' },
  PAGO_BREB: { titulo: 'Tu llave Bre-B', icono: 'billete', clase: 'texto' },
  PAGO_PRESENCIAL: { titulo: 'Pago en persona', icono: 'cara', clase: 'texto' },
}

const metaDe = (clave: string): Meta =>
  META_PARAM[clave] ?? { titulo: clave.replace(/_/g, ' ').toLowerCase(), icono: 'sliders', clase: 'texto' }

type SeccionId = 'sabores' | 'metas' | 'pedido' | 'cobros' | 'promo' | 'equipo' | 'seguridad' | 'datos'

const CLAVES: Record<'metas' | 'pedido' | 'cobros', string[]> = {
  metas: ['META_DIARIA', 'META_EQUIPO', 'PREMIO_EQUIPO'],
  pedido: ['NOMBRE', 'PROVEEDOR_WHATSAPP', 'DIAS_COBERTURA', 'DIAS_HISTORIAL'],
  cobros: ['PAGO_NEQUI', 'PAGO_BREB', 'PAGO_PRESENCIAL'],
}

/** Lo que se ve a la derecha de cada ajuste: plata con puntos, "Apagada" si es 0, unidad si la tiene. */
function valorBonito(c: Param): string {
  const m = metaDe(c.clave)
  const v = c.valor.trim()
  if (m.clase === 'dinero' || m.clase === 'entero') {
    const n = aEntero(v)
    if (m.apagable && n === 0) return 'Apagada'
    return m.clase === 'dinero' ? pesos(n) : n + (m.unidad ? ' ' + m.unidad.split(' ')[0] : '')
  }
  return v || 'Sin configurar'
}

interface Props {
  avisar: (m: string) => void
  onCambio: () => Promise<void>
}

type Panel = { tipo: 'producto'; producto: Producto | null } | { tipo: 'param'; param: Param }

/** Configuración de la caja, ordenada por temas. Necesita señal (no pasa por la cola). */
export function Ajustes({ avisar, onCambio }: Props) {
  const [productos, setProductos] = useState<Producto[] | null>(null)
  const [params, setParams] = useState<Param[]>([])
  const [error, setError] = useState(false)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [seccion, setSeccion] = useState<SeccionId | null>(null)

  const cargar = useCallback(() => Promise.all([api.productos(), api.config()]).then(
    ([ps, cs]) => { setProductos(ps); setParams(cs); setError(false) },
    () => setError(true)), [])

  useEffect(() => { void cargar() }, [cargar])

  const abrir = (s: SeccionId | null) => { setSeccion(s); window.scrollTo(0, 0) }

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

  const eliminarProducto = async (p: Producto) => {
    try {
      const r = await api.eliminarProducto(p.id)
      setPanel(null)
      avisar(r.borrado ? '✓ Sabor eliminado' : '✓ Sabor oculto (tiene ventas, el historial se queda)')
      await cargar()
      await onCambio()
    } catch (e) {
      avisar('⚠️ ' + (e instanceof Error ? e.message : 'No se pudo eliminar'))
    }
  }

  const guardarParam = async (clave: string, valor: string) => {
    try {
      await api.guardarConfig(clave, valor)
      setPanel(null)
      avisar('✓ Guardado')
      await cargar()
      await onCambio()
    } catch (e) {
      avisar('⚠️ ' + (e instanceof Error ? e.message : 'No se pudo guardar'))
    }
  }

  if (error) return <div className="vacio">Ajustes necesita señal.<br /><br /><button className="big ghost" onClick={cargar}>Reintentar</button></div>
  if (!productos) return <div className="vacio">Cargando…</div>

  const param = (clave: string) => params.find(p => p.clave === clave)
  const filas = (claves: string[]) => claves.map(param).filter((p): p is Param => !!p)
  const conocidas = new Set(Object.values(CLAVES).flat())
  const otras = params.filter(p => !conocidas.has(p.clave))

  const promo = leerPromo()
  const activos = productos.filter(p => p.activo).length
  const metaDiaria = aEntero(param('META_DIARIA')?.valor ?? '')

  const filaParam = (c: Param) => {
    const m = metaDe(c.clave)
    return (
      <div className="config-fila clic" key={c.clave} onClick={() => setPanel({ tipo: 'param', param: c })}>
        <span className="config-icono"><Icono nombre={m.icono} /></span>
        <div className="sabor-info"><b>{m.titulo}</b></div>
        <span className="config-valor">{valorBonito(c)}</span>
        <span className="chevron" aria-hidden="true">›</span>
      </div>
    )
  }

  let cuerpo: ReactNode
  let titulo = 'Ajustes'

  if (seccion === null) {
    cuerpo = (
      <>
        <div className="menu">
          <h3>Mi negocio</h3>
          <Entrada icono="vaso" titulo="Sabores y precios" detalle={`${activos} en la caja`} onClick={() => abrir('sabores')} />
          <Entrada icono="ticket" titulo="Promoción" detalle={promoVigente(promo) ? nombrePromo(promo, pesos) : 'Apagada'} onClick={() => abrir('promo')} />
          <Entrada icono="trofeo" titulo="Metas y premios" detalle={metaDiaria ? 'Meta ' + pesos(metaDiaria) : 'Sin meta'} onClick={() => abrir('metas')} />
          <Entrada icono="cara" titulo="Equipo" detalle="Trabajadores, PIN y cargas" onClick={() => abrir('equipo')} />
        </div>
        <div className="menu">
          <h3>Pedidos y cobros</h3>
          <Entrada icono="camion" titulo="Pedido al proveedor" detalle="WhatsApp y cobertura" onClick={() => abrir('pedido')} />
          <Entrada icono="billete" titulo="Cobro de fiados" detalle="Dónde te pagan" onClick={() => abrir('cobros')} />
        </div>
        <div className="menu">
          <h3>La app</h3>
          <Entrada icono="candado" titulo="Seguridad" detalle="Face ID" onClick={() => abrir('seguridad')} />
          <Entrada icono="calendario" titulo="Datos y celular" detalle="Instalar e importar ventas" onClick={() => abrir('datos')} />
        </div>
        <div className="acciones">
          <button className="big peligro" onClick={() => sesion.cerrar()}>Cerrar sesión</button>
        </div>
      </>
    )
  } else if (seccion === 'sabores') {
    titulo = 'Sabores y precios'
    cuerpo = (
      <>
        <div className="list">
          {productos.map(p => (
            <div className={'sabor-fila clic' + (p.activo ? '' : ' inactivo')} key={p.id} onClick={() => setPanel({ tipo: 'producto', producto: p })}>
              <span className="pago-avatar"><Icono nombre="vaso" /></span>
              <div className="sabor-info">
                <div className="sabor-cabeza"><b>{p.nombre}</b><b>{pesos(p.precio)}</b></div>
                <div className="sabor-pie"><span className="mut">mínimo {p.stockMinimo} · costo {pesos(p.costo)}{p.activo ? '' : ' · oculto'}</span></div>
              </div>
            </div>
          ))}
          {!productos.length && <p className="mut" style={{ padding: '12px 0' }}>Todavía no tienes sabores.</p>}
        </div>
        <div className="acciones">
          <button className="big primario" onClick={() => setPanel({ tipo: 'producto', producto: null })}>Agregar sabor o tamaño</button>
        </div>
      </>
    )
  } else if (seccion === 'metas') {
    titulo = 'Metas y premios'
    cuerpo = (
      <>
        <p className="ayuda">La meta diaria llena la barra de arriba y cuenta tu racha. La del equipo es por trabajador. Pon 0 para apagarlas.</p>
        <div className="list">{filas(CLAVES.metas).map(filaParam)}</div>
      </>
    )
  } else if (seccion === 'pedido') {
    titulo = 'Pedido al proveedor'
    cuerpo = (
      <>
        <p className="ayuda">Con esto la app arma el mensaje de WhatsApp para pedirle a Energy Cocktails, según lo que vendes.</p>
        <div className="list">{filas([...CLAVES.pedido, ...otras.map(o => o.clave)]).map(filaParam)}</div>
      </>
    )
  } else if (seccion === 'cobros') {
    titulo = 'Cobro de fiados'
    cuerpo = (
      <>
        <p className="ayuda">Esto le llega al cliente en el recordatorio, para que sepa dónde pagarte lo que debe.</p>
        <div className="list">{filas(CLAVES.cobros).map(filaParam)}</div>
      </>
    )
  } else if (seccion === 'promo') {
    titulo = 'Promoción'
    cuerpo = <PromoAjustes avisar={avisar} />
  } else if (seccion === 'equipo') {
    titulo = 'Equipo'
    cuerpo = <Equipo productos={productos} avisar={avisar} />
  } else if (seccion === 'seguridad') {
    titulo = 'Seguridad'
    cuerpo = <SeccionFaceId avisar={avisar} />
  } else {
    titulo = 'Datos y celular'
    cuerpo = (
      <>
        <SeccionInstalar />
        <SeccionImportar avisar={avisar} />
      </>
    )
  }

  return (
    <section className="ajustes">
      {seccion !== null && (
        <div className="sub-cab">
          <button type="button" className="atras" onClick={() => abrir(null)}><span aria-hidden="true">‹</span> Ajustes</button>
          <h2>{titulo}</h2>
        </div>
      )}
      {cuerpo}

      <Sheet abierto={!!panel} onCerrar={() => setPanel(null)}>
        {panel?.tipo === 'producto' && <FormProducto producto={panel.producto} onGuardar={guardarProducto} onEliminar={eliminarProducto} />}
        {panel?.tipo === 'param' && <FormParam param={panel.param} onGuardar={guardarParam} />}
      </Sheet>
    </section>
  )
}

function Entrada({ icono, titulo, detalle, onClick }: { icono: string; titulo: string; detalle: string; onClick: () => void }) {
  return (
    <button type="button" className="menu-fila" onClick={onClick}>
      <span className="config-icono"><Icono nombre={icono} /></span>
      <span className="menu-texto"><b>{titulo}</b><small>{detalle}</small></span>
      <span className="chevron" aria-hidden="true">›</span>
    </button>
  )
}

function FormProducto({ producto, onGuardar, onEliminar }: {
  producto: Producto | null
  onGuardar: (id: number | null, d: DatosProducto) => void
  onEliminar: (p: Producto) => void
}) {
  const [confirmando, setConfirmando] = useState(false)
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

  const p = aEntero(precio)
  const c = aEntero(costo)
  const valido = sabor.trim().length > 0 && p > 0 // un precio vacío o en 0 no es un precio
  const margen = p - c
  return (
    <form onSubmit={e => {
      e.preventDefault()
      if (valido) onGuardar(producto?.id ?? null, {
        sabor: sabor.trim(), tipo, precio: p, costo: c, stockMinimo: aEntero(minimo), activo,
      })
    }}>
      <h2>{producto ? 'Editar sabor' : 'Nuevo sabor'}</h2>
      <p>{producto ? 'El stock se cambia desde Inventario.' : 'Para un cremoso o grande de un sabor que ya existe, usa el mismo nombre.'}</p>
      <div className="campo">
        <label htmlFor="sabor">Sabor</label>
        <input id="sabor" value={sabor} maxLength={80} onChange={e => setSabor(e.target.value)} placeholder="Ej: Piña colada" />
      </div>
      <div className="campo">
        <label htmlFor="tipo">Tamaño o tipo</label>
        <select id="tipo" value={tipo} onChange={e => cambiarTipo(e.target.value as Tipo)}>
          <option value="NORMAL">Normal</option>
          <option value="CREMOSO">Cremoso</option>
          <option value="GRANDE">Grande</option>
          <option value="CERVEZA">Cerveza</option>
        </select>
      </div>
      <div className="dos">
        <div className="campo">
          <label htmlFor="precio">Precio de venta</label>
          <CampoNumero id="precio" miles max={7} value={precio} onCambio={setPrecio} />
        </div>
        <div className="campo">
          <label htmlFor="costo">Costo</label>
          <CampoNumero id="costo" miles max={7} value={costo} onCambio={setCosto} descrito="nota-costo" />
          <small id="nota-costo" className="mut">Lo que te cuesta comprarlo</small>
        </div>
      </div>
      {p > 0 && (
        <p className={margen < 0 ? 'aviso' : 'mut'} style={{ marginTop: -4 }}>
          {margen < 0 ? 'Ojo: vendes por debajo del costo (' + pesos(margen) + ' por vaso)' : 'Ganas ' + pesos(margen) + ' por vaso'}
        </p>
      )}
      <div className="campo">
        <label htmlFor="minimo">Avisarme cuando queden</label>
        <CampoNumero id="minimo" max={3} value={minimo} onCambio={setMinimo} />
      </div>
      <label className="interruptor">
        <span>Mostrar en la caja</span>
        <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} />
      </label>
      <button className="big primario" type="submit" disabled={!valido}>Guardar</button>
      {producto && producto.stock <= 0 && (confirmando ? (
        <button className="big peligro" type="button" onClick={() => onEliminar(producto)}>Sí, quitar {producto.nombre}</button>
      ) : (
        <button className="big ghost" type="button" onClick={() => setConfirmando(true)}>Eliminar sabor</button>
      ))}
      {producto && producto.stock > 0 && <p className="mut">Para eliminarlo primero deja el stock en 0 desde Inventario.</p>}
    </form>
  )
}

/** Instalar la app en la pantalla de inicio. En Chrome/Android sale un prompt; en iPhone hay que explicarlo a mano. */
function SeccionInstalar() {
  const { modo, instalar } = useInstalarPWA()
  const [ayuda, setAyuda] = useState(false)

  if (modo === 'instalada') {
    return <div className="list"><div className="row"><span>✓ Ya está instalada en este celular</span></div></div>
  }
  if (modo === 'no-disponible') return null

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
      <p className="ayuda">Entra a la caja con la cara en vez del PIN. Cada celular activa el suyo.</p>
      <div className="list">
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
  const m = metaDe(param.clave)
  const numerico = m.clase === 'dinero' || m.clase === 'entero'
  // Los números se editan como dígitos limpios; el texto, tal cual
  const [valor, setValor] = useState(numerico ? String(aEntero(param.valor)) : param.valor)
  const n = aEntero(valor)
  // Los días no pueden ser 0 (el servidor lo rechaza); las metas sí, es como apagarlas
  const valido = !numerico || m.apagable || n >= 1

  const campo = (() => {
    if (m.clase === 'dinero') return <CampoNumero id="param" miles max={10} autoFocus value={valor} onCambio={setValor} />
    if (m.clase === 'entero') return <CampoNumero id="param" max={m.max ?? 3} autoFocus value={valor} onCambio={setValor} />
    return (
      <input id="param" autoFocus value={valor} inputMode={m.clase === 'telefono' ? 'tel' : 'text'} maxLength={m.clase === 'telefono' ? 20 : 120}
        onChange={e => setValor(e.target.value)} />
    )
  })()

  return (
    <form onSubmit={e => {
      e.preventDefault()
      if (valido) onGuardar(param.clave, numerico ? String(n) : valor.trim())
    }}>
      <h2>{m.titulo}</h2>
      <p>{param.nota}</p>
      <div className="campo">
        <label htmlFor="param">{m.unidad ? m.unidad : m.clase === 'dinero' ? 'Pesos' : 'Valor'}</label>
        {campo}
        {m.clase === 'dinero' && n > 0 && <small>{pesos(n)}</small>}
        {m.apagable && n === 0 && numerico && <small>Está apagada. Pon un número para prenderla.</small>}
        {!valido && <small className="aviso">Tiene que ser mínimo 1</small>}
      </div>
      <button className="big primario" type="submit" disabled={!valido}>Guardar</button>
    </form>
  )
}
