// Tipos que devuelve la API del backend (Spring Boot).

export type Tipo = 'NORMAL' | 'CREMOSO' | 'GRANDE'
export type Metodo = 'NEQUI' | 'EFECTIVO'
export type TipoMovimiento = 'ENTRADA' | 'CONTEO' | 'MERMA'
export type MotivoMerma = 'DANADO' | 'REGALADO' | 'VENCIDO'
export type EstadoPedido = 'ENVIADO' | 'RECIBIDO' | 'CANCELADO'
export type CategoriaGasto = 'HIELO' | 'TRANSPORTE' | 'EMPAQUE' | 'OTRO'

export interface Producto {
  id: number
  sabor: string
  tipo: Tipo
  nombre: string
  precio: number
  /** Cuánto cuesta comprarlo. 0 = todavía no lo pusiste. */
  costo: number
  stock: number
  stockMinimo: number
  activo: boolean
  orden: number
}

export interface PorSabor {
  sabor: string
  unidades: number
}

/** Todo en pesos enteros. `ganancia = total - costo - gastos - mermas`. */
export interface ResumenDia {
  total: number
  nequi: number
  efectivo: number
  unidades: number
  porSabor: PorSabor[]
  costo: number
  gastos: number
  mermas: number
  ganancia: number
}

export interface VentaReciente {
  clientUid: string
  hora: string
  sabor: string
  total: number
  metodo: Metodo
  /** Solo en el celular: todavía no ha subido al servidor. */
  pendiente?: boolean
}

export interface Estado {
  productos: Producto[]
  hoy: ResumenDia
  ultimas: VentaReciente[]
  /** Día en Bogotá, "2026-09-25". */
  dia: string
  /** El pedido que está en camino, si hay uno. Trae sus items para poder recibirlo sin señal. */
  pedido: PedidoEnCamino | null
  /** Meta del día. `valor = 0` = apagada; `racha` = días seguidos cumpliéndola. */
  meta: Meta
}

export interface Meta {
  valor: number
  racha: number
}

/** Lo que muestra el banner: hay un pedido que todavía no ha llegado. */
export interface PedidoEnCamino {
  id: number
  totalUnidades: number
  items: ItemPedidoRecibido[]
}

export interface ItemPedidoRecibido {
  productoId: number
  sabor: string
  pedida: number
  recibida: number
}

/** Historial de pedidos (`GET /api/pedidos`). */
export interface Pedido {
  id: number
  estado: EstadoPedido
  creadoEn: string
  recibidoEn: string | null
  totalUnidades: number
  costoTotal: number
  items: ItemPedidoRecibido[]
}

export interface ItemPedido {
  productoId: number
  sabor: string
  pedir: number
  promedioDia: number
  /** Cuánto cuesta cada unidad: sirve para ver cuánto vas a pagar por lo que edites. */
  costo: number
}

export interface PedidoSugerido {
  items: ItemPedido[]
  total: number
  costoTotal: number
  mensaje: string
  link: string
  tieneProveedor: boolean
}

/** Lo que responde `POST /api/pedidos` cuando se arma el pedido. */
export interface PedidoCreado {
  id: number
  estado: EstadoPedido
  totalUnidades: number
  costoTotal: number
  mensaje: string
  link: string
  tieneProveedor: boolean
}

/** Una línea del pedido que se envía: cuántas unidades de cada sabor. */
export interface LineaPedido {
  productoId: number
  cantidad: number
}

export interface Param {
  clave: string
  valor: string
  nota: string | null
}

// ---------------------------------------------------------------- reportes

export interface ReporteTotales {
  ventas: number
  unidades: number
  nequi: number
  efectivo: number
  costo: number
  gastos: number
  mermas: number
  ganancia: number
}

export interface ReporteDia {
  /** "2026-09-25" en Bogotá. */
  dia: string
  unidades: number
  total: number
  ganancia: number
}

/** Una barra del gráfico: la clave es la hora (0-23) o el día de la semana (0-6, lunes=0). */
export interface ReporteBarra {
  clave: number
  nombre: string
  unidades: number
}

export interface ReporteSabor {
  sabor: string
  unidades: number
  ingresos: number
  ganancia: number
}

export interface ReporteCategoriaGasto {
  categoria: CategoriaGasto
  monto: number
}

/** Ventas, unidades y ganancia del periodo inmediatamente anterior, de igual duración. */
export interface ReporteComparacion {
  ventas: number
  unidades: number
  ganancia: number
}

/** Lo que responde `GET /api/reportes`. */
export interface Reporte {
  desde: string
  hasta: string
  totales: ReporteTotales
  porDia: ReporteDia[]
  porHora: ReporteBarra[]
  porDiaSemana: ReporteBarra[]
  porSabor: ReporteSabor[]
  pedidos: Pedido[]
  arqueos: CierreCaja[]
  porCategoriaGasto: ReporteCategoriaGasto[]
  anterior: ReporteComparacion
}

/** Un cierre de caja: `diferencia` negativa = faltó plata. */
export interface CierreCaja {
  dia: string
  esperado: number
  contado: number
  diferencia: number
  nota: string | null
}

export interface DatosProducto {
  sabor: string
  tipo: Tipo
  precio: number
  costo?: number
  stockMinimo: number
  activo?: boolean
  orden?: number
}

/** Un gasto del día (hielo, transporte, empaque u otro). */
export interface Gasto {
  clientUid: string
  categoria: CategoriaGasto
  concepto: string
  monto: number
  creadaEn: number
}

/** Lo que el celular guarda en la cola mientras no ha subido. */
export type Operacion =
  | { tipo: 'venta'; clientUid: string; productoId: number; metodo: Metodo; cantidad: number; creadaEn: number }
  | { tipo: 'entrada'; clientUid: string; productoId: number; cantidad: number; creadaEn: number }
  | { tipo: 'ajuste'; clientUid: string; productoId: number; real: number; creadaEn: number }
  | { tipo: 'merma'; clientUid: string; productoId: number; cantidad: number; motivo: MotivoMerma; creadaEn: number }
  | { tipo: 'gasto'; clientUid: string; categoria: CategoriaGasto; concepto: string; monto: number; creadaEn: number }
  | { tipo: 'recepcion'; clientUid: string; pedidoId: number; items: LineaPedido[]; creadaEn: number }
  | { tipo: 'arqueo'; clientUid: string; contado: number; nota: string; creadaEn: number }

export interface RespuestaVenta {
  clientUid: string
  estado: 'REGISTRADA' | 'REPETIDA' | 'RECHAZADA'
  error: string | null
}
