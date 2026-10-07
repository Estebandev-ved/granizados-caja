import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'
import type {
  CategoriaGasto, DatosProducto, Estado, EstadoPedido, LineaPedido, Metodo, MotivoMerma, Param, Pedido, PedidoCreado,
  LugarPlata, MovimientoPlata, Negocio, PedidoSugerido, Producto, RecomendacionCompra, Reporte, RespuestaVenta, SaldoPlata,
  TipoMovimiento,
} from './tipos'

// Vacío = mismo dominio (en Railway el backend sirve el frontend). En desarrollo Vite hace proxy a :8080.
const BASE = import.meta.env.VITE_API_URL ?? ''
const CLAVE_TOKEN = 'gz_token'

export class ApiError extends Error {
  status: number

  constructor(status: number, mensaje: string) {
    super(mensaje)
    this.status = status
  }
}

/** 4xx = el dato está mal y reintentar no lo arregla. 401/402/408/429 sí se pueden reintentar (402: suscripción vencida, lo pendiente espera a que renueve). */
export function esRechazo(e: unknown): boolean {
  return e instanceof ApiError && e.status >= 400 && e.status < 500 && ![401, 402, 408, 429].includes(e.status)
}

/** El `negocio_id` del token (sin verificarlo: solo sirve para separar lo guardado en el celular; el servidor es quien manda). */
export function negocioDelToken(token: string | null): number | null {
  if (!token) return null
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const n = JSON.parse(atob(b64)).negocio_id
    return typeof n === 'number' ? n : null
  } catch { return null }
}

/** Lo que el celular guarda de un negocio y no debe verlo otro que entre después en el mismo celular. */
const LOCAL_POR_NEGOCIO = ['gz_estado', 'gz_confirmadas', 'gz_meta_celebrada', 'gz_plata_pedido']

export const sesion = {
  get token(): string | null {
    try { return localStorage.getItem(CLAVE_TOKEN) } catch { return null }
  },
  /** Negocio de la sesión actual. Los tokens sin el claim (los de antes) son el negocio 1. */
  get negocioId(): number {
    return negocioDelToken(this.token) ?? 1
  },
  guardar(token: string) {
    const antes = negocioDelToken(this.token)
    const ahora = negocioDelToken(token)
    try {
      // Entra otro negocio al mismo celular: se limpia lo que quedó del anterior (la cola pendiente se guarda aparte por negocio)
      if (antes !== null && ahora !== null && antes !== ahora) LOCAL_POR_NEGOCIO.forEach(k => localStorage.removeItem(k))
      localStorage.setItem(CLAVE_TOKEN, token)
    } catch { /* modo privado */ }
  },
  cerrar() {
    try { localStorage.removeItem(CLAVE_TOKEN) } catch { /* modo privado */ }
    window.dispatchEvent(new Event('gz:sesion'))
  },
}

async function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json'
  const token = sesion.token
  if (token) headers.Authorization = 'Bearer ' + token

  const control = new AbortController()
  const limite = setTimeout(() => control.abort(), 20000)
  let r: Response
  try {
    r = await fetch(BASE + ruta, {
      method: metodo, headers, signal: control.signal,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
  } finally {
    clearTimeout(limite)
  }

  if (r.status === 401 && ruta !== '/api/auth/login' && !ruta.startsWith('/api/passkey/login')) sesion.cerrar()
  if (!r.ok) {
    let mensaje = 'Error ' + r.status
    try { mensaje = (await r.json()).error ?? mensaje } catch { /* sin cuerpo */ }
    throw new ApiError(r.status, mensaje)
  }
  if (r.status === 204) return undefined as T
  // Algunos endpoints responden 200 sin cuerpo cuando no hay nada (ej. el cierre de caja de hoy): eso es null, no un error
  const texto = await r.text()
  return (texto ? JSON.parse(texto) : null) as T
}

/** Mismo token, pero el cuerpo es texto (el CSV de los reportes). */
async function pedirTexto(ruta: string): Promise<string> {
  const headers: Record<string, string> = {}
  const token = sesion.token
  if (token) headers.Authorization = 'Bearer ' + token

  const r = await fetch(BASE + ruta, { headers })
  if (r.status === 401) sesion.cerrar()
  if (!r.ok) throw new ApiError(r.status, 'Error ' + r.status)
  return r.text()
}

/** Sube texto plano (un CSV) y espera JSON de vuelta (el resultado de importar). */
async function pedirEnviandoTexto<T>(ruta: string, texto: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'text/plain;charset=utf-8' }
  const token = sesion.token
  if (token) headers.Authorization = 'Bearer ' + token

  const r = await fetch(BASE + ruta, { method: 'POST', headers, body: texto })
  if (r.status === 401) sesion.cerrar()
  if (!r.ok) {
    let mensaje = 'Error ' + r.status
    try { mensaje = (await r.json()).error ?? mensaje } catch { /* sin cuerpo */ }
    throw new ApiError(r.status, mensaje)
  }
  return r.json() as Promise<T>
}

// Opciones de WebAuthn tal como las arma el servidor (van directo a @simplewebauthn/browser)
type OpcionesFaceId<T> = { solicitud: string; opciones: { publicKey: T } }
type RespuestaFaceId = { solicitud: string; credencial: string; nombre?: string }
export interface PasskeyInfo { id: number; nombre: string; creadaEn: string; usadaEn: string | null }

type VentaApi ={ clientUid: string; productoId: number; metodo: Metodo; cantidad: number; creadaEn: string; total?: number }
type EntradaApi = { clientUid: string; productoId: number; cantidad: number }
/** Un movimiento de inventario: `cantidad` para ENTRADA/MERMA, `real` para CONTEO. */
type MovimientoApi = {
  clientUid: string
  productoId: number
  tipo: TipoMovimiento
  cantidad?: number
  real?: number
  motivo?: MotivoMerma
}
type RespuestaMovimiento = { clientUid: string; estado: string; error: string | null }
type GastoApi = { clientUid: string; categoria: CategoriaGasto; concepto: string; monto: number; creadoEn: string }
type ArqueoApi = { clientUid: string; contado: number; nota: string | null; creadoEn: string; casa?: number; nequi?: number }

export const api = {
  login: (pin: string) => pedir<{ token: string }>('POST', '/api/auth/login', { pin }),
  estado: () => pedir<Estado>('GET', '/api/estado'),
  venta: (v: VentaApi) => pedir<RespuestaVenta>('POST', '/api/ventas', v),
  lote: (ventas: VentaApi[]) => pedir<RespuestaVenta[]>('POST', '/api/ventas/lote', { ventas }),
  deshacer: (clientUid: string) => pedir<void>('DELETE', '/api/ventas/' + encodeURIComponent(clientUid)),
  entrada: (e: EntradaApi) => pedir<{ estado: string }>('POST', '/api/inventario/entradas', e),
  movimiento: (m: MovimientoApi) => pedir<RespuestaMovimiento>('POST', '/api/inventario/movimientos', m),
  gasto: (g: GastoApi) => pedir<{ clientUid: string; estado: string; error: string | null }>('POST', '/api/gastos', g),
  borrarGasto: (clientUid: string) => pedir<void>('DELETE', '/api/gastos/' + encodeURIComponent(clientUid)),
  arqueo: (a: ArqueoApi) => pedir<{ clientUid: string; estado: string; error: string | null }>('POST', '/api/arqueo', a),
  cierreHoy: () => pedir<ArqueoHoy | null>('GET', '/api/arqueo'),
  negocio: () => pedir<Negocio>('GET', '/api/negocio'),
  plata: () => pedir<SaldoPlata>('GET', '/api/plata'),
  contarPlata: (c: { clientUid: string; caja: number; casa: number; nequi: number }) =>
    pedir<{ estado: string }>('POST', '/api/plata/conteo', c),
  ingreso: (i: { clientUid: string; concepto: string; monto: number; lugar: LugarPlata; cuentaGanancia: boolean }) =>
    pedir<{ estado: string }>('POST', '/api/ingresos', i),
  trasladar: (t: { clientUid: string; monto: number; desde: LugarPlata; hacia: LugarPlata }) =>
    pedir<{ estado: string }>('POST', '/api/plata/traslado', t),
  crearMeta: (m: { clientUid: string; nombre: string; objetivo: number }) =>
    pedir<{ estado: string }>('POST', '/api/plata/metas', m),
  aportarMeta: (metaId: number, a: { clientUid: string; monto: number }) =>
    pedir<{ estado: string }>('POST', '/api/plata/metas/' + metaId + '/aporte', a),
  borrarMeta: (metaId: number) => pedir<void>('DELETE', '/api/plata/metas/' + metaId),
  movimientosPlata: (dias = 14) => pedir<MovimientoPlata[]>('GET', '/api/plata/movimientos?dias=' + dias),
  recomendacion: () => pedir<RecomendacionCompra>('GET', '/api/pedido/recomendacion'),
  borrarIngreso: (clientUid: string) => pedir<void>('DELETE', '/api/ingresos/' + encodeURIComponent(clientUid)),
  pedido: (presupuesto?: number, dias?: number) => {
    const q = new URLSearchParams()
    if (presupuesto !== undefined) q.set('presupuesto', String(presupuesto))
    if (dias !== undefined) q.set('dias', String(dias))
    return pedir<PedidoSugerido>('GET', '/api/pedido/sugerido' + (q.size ? '?' + q : ''))
  },
  crearPedido: (items: LineaPedido[]) => pedir<PedidoCreado>('POST', '/api/pedidos', { items }),
  pedidos: (estado?: EstadoPedido) => pedir<Pedido[]>('GET', '/api/pedidos' + (estado ? '?estado=' + estado : '')),
  recibirPedido: (pedidoId: number, clientUid: string, items: LineaPedido[], pagoLugar?: LugarPlata) =>
    pedir<{ estado: string }>('POST', '/api/pedidos/' + pedidoId + '/recibido', { clientUid, items, pagoLugar }),
  cancelarPedido: (pedidoId: number) => pedir<{ estado: string }>('POST', '/api/pedidos/' + pedidoId + '/cancelar'),
  productos: () => pedir<Producto[]>('GET', '/api/productos'),
  reportes: (desde: string, hasta: string) => pedir<Reporte>('GET', `/api/reportes?desde=${desde}&hasta=${hasta}`),
  /** El CSV del periodo. En el iPhone lo comparte (AirDrop, WhatsApp, Archivos); si no se puede, lo descarga. */
  descargarReporte: async (desde: string, hasta: string) => {
    const texto = await pedirTexto(`/api/reportes/ventas.csv?desde=${desde}&hasta=${hasta}`)
    const nombre = `ventas-${desde}_${hasta}.csv`
    const archivo = new File([texto], nombre, { type: 'text/csv;charset=utf-8' })

    if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [archivo] })) {
      try {
        await navigator.share({ files: [archivo], title: nombre })
        return
      } catch (e) {
        // El usuario cerró la hoja o el navegador no lo dejó: seguimos con la descarga
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }

    const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  },
  crearProducto: (d: DatosProducto) => pedir<Producto>('POST', '/api/productos', d),
  editarProducto: (id: number, d: DatosProducto) => pedir<Producto>('PUT', '/api/productos/' + id, d),
  config: () => pedir<Param[]>('GET', '/api/config'),
  guardarConfig: (clave: string, valor: string) => pedir<Param>('PUT', '/api/config/' + clave, { valor }),
  passkeyEntradaOpciones: () => pedir<OpcionesFaceId<PublicKeyCredentialRequestOptionsJSON>>('POST', '/api/passkey/login/opciones'),
  passkeyEntrar: (r: RespuestaFaceId) => pedir<{ token: string }>('POST', '/api/passkey/login', r),
  passkeyRegistroOpciones: () => pedir<OpcionesFaceId<PublicKeyCredentialCreationOptionsJSON>>('POST', '/api/passkey/registro/opciones'),
  passkeyRegistrar: (r: RespuestaFaceId) => pedir<PasskeyInfo>('POST', '/api/passkey/registro', r),
  passkeys: () => pedir<PasskeyInfo[]>('GET', '/api/passkey'),
  borrarPasskey: (id: number) => pedir<void>('DELETE', '/api/passkey/' + id),
  /** Ventas históricas de otro sistema. CSV: fecha;sabor;cantidad;precioUnitario[;metodo]. No toca el stock. */
  importarVentas: (csv: string) => pedirEnviandoTexto<ImportarResultado>('/api/ventas/importar', csv),
}

export interface ImportarResultado {
  importadas: number
  repetidas: number
  errores: { fila: number; motivo: string }[]
}

export type ApiSync = Pick<typeof api, 'lote' | 'venta' | 'entrada' | 'movimiento' | 'gasto' | 'arqueo' | 'recibirPedido'>

/** El cierre de hoy (`GET /api/arqueo`): nulo si todavía no cerraste. */
export interface ArqueoHoy { esperado: number; contado: number; diferencia: number; nota: string | null }
