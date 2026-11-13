// Tipos que devuelve la API del backend (Spring Boot).

export type Tipo = 'NORMAL' | 'CREMOSO' | 'GRANDE' | 'CERVEZA'
/** CONSUMO: un trabajador se toma (o compra) uno de su carga; no entra plata y lo que no era gratis se le descuenta. */
/** FALTANTE: granizados que faltaron en la carga de un trabajador (lo anota el dueño en Equipo, no sale de Vender). */
export type Metodo = 'NEQUI' | 'EFECTIVO' | 'FIADO' | 'MIXTO' | 'REGALO' | 'CONSUMO' | 'FALTANTE'
export type TipoMovimiento = 'ENTRADA' | 'CONTEO' | 'MERMA'
export type MotivoMerma = 'DANADO' | 'REGALADO' | 'VENCIDO'
export type EstadoPedido = 'ENVIADO' | 'RECIBIDO' | 'CANCELADO'
/** Una de las de siempre (HIELO, TRANSPORTE…, ver `CATEGORIAS_GASTO`) o el nombre de una categoría propia del negocio. */
export type CategoriaGasto = string

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

/** La parte de cerveza (ya está dentro de los totales). `ganancia = total - costo`. */
export interface Cerveza {
  unidades: number
  total: number
  costo: number
  ganancia: number
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
  /** Ingresos extra que cuentan como ganancia (ya están sumados en `ganancia`). */
  ingresos?: number
  /** Solo lo que vendió el dueño en persona, sin el equipo: su carga del día cuenta con esto. */
  propias?: PorSabor[]
  cerveza?: Cerveza
  /** Lo que se ganó hoy el equipo (comisión + premios − descuentos) que no está anotado como gasto «Trabajadores». Ya va restado en `ganancia`. */
  equipo?: number
}

/** La meta del día de un trabajador (la pone el dueño en Ajustes). */
export interface MetaEquipo {
  unidades: number
  premio: number
  vendidas: number
  racha: number
}

/** Un sabor de la carga de un trabajador. */
export interface FilaCargaEquipo {
  productoId: number
  nombre: string
  llevo: number
  vendi: number
  queda: number
}

/** Cada cuánto prefiere cobrar un trabajador. */
export type FrecuenciaPago = 'DIARIO' | 'SEMANAL' | 'QUINCENAL'

/** Un escalón de premio: con tantos granizados en el día ganas ese total (no se suma al anterior). */
export interface Escalon {
  granizados: number
  total: number
}

/** Lo que lleva ganado hoy un trabajador. `gratis` son los granizados que puede tomarse sin pagar. */
export interface PremiosDia {
  vendidas: number
  comision: number
  premio: number
  escalones: Escalon[]
  siguiente: Escalon | null
  gratis: number
  /** Hoy corre la promo: los premios ya vienen con la rebaja. */
  diaPromo: boolean
  /** Los que se ha tomado hoy, y lo que se le descuenta por los que pasaron de los gratis. */
  consumidos?: number
  descuento?: number
  /** Lo que se le descuenta hoy por granizados que faltaron en su carga. */
  faltantes?: number
  /** Cuánto gana por granizado, normal y en promo. */
  tarifas?: TarifasDia
  /** Cuántos se propuso vender hoy (null = no ha escogido). */
  metaPropia?: number | null
}

/** Lo que gana el trabajador por granizado. `porcentaje` solo si le pagan un % de lo vendido. */
export interface TarifasDia {
  normal: number
  cremoso: number
  grande: number
  cerveza: number
  /** Lo que gana por cada uno vendido en promo. */
  promo: number
  /** Lo que bajan los premios en día de promo. */
  rebajaPromo: number
  porcentaje: number | null
}

/** Cómo viene vendiendo un trabajador en las últimas 4 semanas (sin hoy), para estimar cuánto se va a hacer. */
export interface Proyeccion {
  vendedorId: number
  nombre: string
  /** Días que trabajó en esas semanas. */
  dias: number
  /** Promedio de un día suyo: granizados y lo ganado (ya con premios y descuentos). */
  unidadesDia: number
  ganaDia: number
  mejorUnidades: number
  mejorGana: number
  /** Cuántos días trabaja a la semana. */
  diasSemana: number
  /** Lo que suele durar su jornada, de la primera a la última venta (0 = no se sabe). */
  minutosDia: number
  /** La hora de su primera venta de hoy. */
  primeraHoy: string | null
  /** Lo que se le debe hasta ahora, con lo de hoy y menos lo prestado (negativo = él debe). */
  pendiente: number
}

/** `GET /api/equipo/premios/datos`: lo que dicen las últimas semanas para armar premios que convengan. */
export interface DatosPremios {
  /** Granizados que vende un trabajador en un día normal (la mediana). */
  base: number
  diasAnalizados: number
  mejorDia: number
  /** Lo que te deja cada granizado ya pagada la comisión, normal y en promo (null = no hay ventas en promo). */
  margenNormal: number
  margenPromo: number | null
  pocosDatos: boolean
  faltanCostos: boolean
  sinTarifas: boolean
}

export interface SeccionTerminos {
  titulo: string
  lineas: string[]
}

/** Los términos del trabajo. `aceptadaEn` es null mientras el trabajador no acepte esta versión. */
export interface Terminos {
  version: string
  titulo: string
  secciones: SeccionTerminos[]
  aceptadaEn: string | null
  /** Cada cuánto prefiere cobrar (null = todavía no escogió). */
  frecuenciaPago: FrecuenciaPago | null
}

export interface Trabajador {
  id: number
  nombre: string
  comisionPct: number
  activo: boolean
  unidadesHoy: number
  totalHoy: number
  carga: FilaCargaEquipo[]
  /** Cuándo aceptó la versión actual de los términos (null = todavía no). */
  terminosAceptadosEn?: string | null
  frecuenciaPago?: FrecuenciaPago | null
  /** Comisiones y premios que se le deben desde su último pago. */
  porPagar?: number
  /** Estado de su último pago (null = nunca se le ha pagado). */
  ultimoPago?: EstadoPagoEquipo | null
  /** Plata de la caja que se le pasó hoy para dar vueltos. */
  baseHoy?: number
  /** Plata que dice haberte entregado y todavía no confirmas. */
  entregaPendiente?: number
  ultimaEntrega?: EstadoEntregaEquipo | null
  /** Cuántos se propuso vender hoy (null = no ha escogido). */
  metaHoy?: number | null
}

export type EstadoEntregaEquipo = 'PENDIENTE' | 'RECIBIDA' | 'NO_RECIBIDA'

/** Lo que el trabajador dice que le entregó al dueño, separado por cómo le pagaron. */
export interface EntregaEquipo {
  id: number
  vendedorId: number
  nombre: string
  monto: number
  efectivo: number
  nequi: number
  transferencia: number
  estado: EstadoEntregaEquipo
  creadaEn: string
  respondidaEn: string | null
}

export interface BaseVueltos {
  total: number
  entregas: { id: number; monto: number; creadaEn: string }[]
}

export type MetodoPagoEquipo = 'EFECTIVO' | 'NEQUI' | 'MIXTO'
export type EstadoPagoEquipo = 'PENDIENTE' | 'CONFIRMADO' | 'DISPUTADO' | 'ANULADO'

/**
 * Un pago de comisiones a un trabajador. Si recibió efectivo trae el paz y salvo (`texto`) que firma con su nombre.
 * Con MIXTO, `montoEfectivo` es la parte en efectivo y el resto fue por Nequi. `saldo` = lo que quedó pendiente después.
 */
export interface PagoEquipo {
  id: number
  vendedorId: number
  nombre: string
  metodo: MetodoPagoEquipo
  estado: EstadoPagoEquipo
  monto: number
  montoEfectivo?: number
  saldo?: number
  comision: number
  bonos: number
  unidades: number
  totalVendido: number
  efectivo: number
  desde: string | null
  hasta: string
  creadoEn: string
  respondidoEn: string | null
  texto: string | null
  firma: string | null
  /** Lo que se le descontó en este pago por los granizados que se tomó. */
  consumos?: number
  /** Lo que se le descontó por préstamos y por faltantes de su carga. */
  prestamos?: number
  faltantes?: number
  /** De dónde salió el efectivo (null = pago de antes, que no movía Mi plata). */
  lugarEfectivo?: LugarPlata | null
}

/** Plata que le prestaste a un trabajador. `pagoId` null = todavía no se le descuenta. */
export interface PrestamoEquipo {
  id: number
  vendedorId: number
  monto: number
  lugar: LugarPlata
  nota: string | null
  creadoEn: string
  pagoId: number | null
}

/** Lo que se le debe a un trabajador desde su último pago, más sus pagos recientes. */
export interface CuentaEquipo {
  desde: string | null
  pendiente: Liquidacion
  pagos: PagoEquipo[]
  /** Lo que quedó pendiente de su último pago: se le debe además de la comisión y los premios de `pendiente`. */
  saldoAnterior?: number
  /** Lo que le prestaste y se le descuenta en el próximo pago. */
  prestamos?: PrestamoEquipo[]
}

/** Lo que ve el trabajador al cerrar su día. `entregar` negativo = el dueño le debe. */
export interface CierreTurno {
  unidades: number
  total: number
  efectivo: number
  nequi: number
  comision: number
  bonos: number
  /** Base para vueltos que se le pasó y que devuelve junto con el efectivo. */
  base: number
  entregar: number
  devuelve: FilaCargaEquipo[]
  /** Los que se tomó hoy y lo que se le descuenta por ellos (ya va sumado en `entregar`). */
  consumidos?: number
  consumos?: number
  /** Lo que se le descuenta por granizados que faltaron (ya va en `entregar`). */
  faltantes?: number
}

/** Cuentas de un trabajador. `saldo` = efectivo − comisión: positivo, te debe entregar; negativo, le debes. */
export interface Liquidacion {
  vendedorId: number
  nombre: string
  comisionPct: number
  unidades: number
  total: number
  efectivo: number
  nequi: number
  comision: number
  /** Días del rango en que cumplió la meta y lo que ganó por eso. */
  diasMeta: number
  bonos: number
  saldo: number
  /** Granizados que se tomó él (no cuentan como vendidos) y lo que se le descuenta por los que no eran gratis. */
  consumidos?: number
  consumos?: number
  /** Granizados que faltaron en su carga y lo que se le descuenta (al precio de venta). */
  unidadesFaltantes?: number
  faltantes?: number
  /** Días del rango en que vendió algo. */
  dias?: number
}

/** Un día de trabajo en el historial de Reportes. */
export interface DiaTrabajado {
  dia: string
  unidades: number
  total: number
  efectivo: number
  nequi: number
  comision: number
  bonos: number
  consumidos: number
  consumos: number
  unidadesFaltantes: number
  faltantes: number
}

/** `GET /api/equipo/historial`: todo lo de un trabajador en el rango. */
export interface HistorialTrabajador {
  vendedorId: number
  nombre: string
  activo: boolean
  totales: Liquidacion
  dias: DiaTrabajado[]
  pagos: PagoEquipo[]
  prestamos: PrestamoEquipo[]
}

export interface VentaReciente {
  clientUid: string
  hora: string
  sabor: string
  total: number
  metodo: Metodo
  /** Solo CONSUMO y FALTANTE: lo que se le descuenta al trabajador (0 = era gratis). */
  cargo?: number
  /** Tiene foto del comprobante de pago. */
  comprobante?: boolean
  /** Quién la hizo: el nombre del trabajador; null o vacío = el dueño. */
  vendedor?: string | null
  /** Cuántos granizados fueron (las de un celular sin actualizar no lo traen: se cuenta 1). */
  cantidad?: number
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
  /** Solo para un trabajador: su meta de granizados del día (ausente o null = apagada). */
  metaEquipo?: MetaEquipo | null
  /** Solo para un trabajador: lo que lleva ganado hoy y sus escalones de premio. */
  premios?: PremiosDia | null
  /** La promoción del negocio (JSON), para que la vendan todos los celulares. Ausente = no hay. */
  promo?: string | null
  /** El perfil del negocio (JSON: nombre, rubro, funciones). Ausente = negocio de antes, todo prendido. */
  perfil?: string | null
  /** Solo para el dueño: categorías de gasto que ha usado en los últimos meses (incluye las propias). */
  categoriasGasto?: string[] | null
  /** Solo para el dueño: lo gastado en el mes que va, por categoría. */
  gastosMes?: Record<string, number> | null
  /** Solo para el dueño: topes de gasto al mes por categoría (JSON). */
  topesGasto?: string | null
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
  /** Bono/descuento que te hizo el proveedor en pesos. */
  bono: number
  /** Lo que de verdad se le pagó (bruto − bono). Null si todavía no ha llegado. */
  pagado: number | null
  items: ItemPedidoRecibido[]
}

export interface ItemPedido {
  productoId: number
  sabor: string
  pedir: number
  promedioDia: number
  /** Cuánto cuesta cada unidad: sirve para ver cuánto vas a pagar por lo que edites. */
  costo: number
  /** Lo que pediría si no hubiera límite de plata. */
  ideal: number
}

export interface PedidoSugerido {
  items: ItemPedido[]
  total: number
  costoTotal: number
  mensaje: string
  link: string
  tieneProveedor: boolean
  /** Plata que dijiste que tienes, lo que de verdad se puede gastar (sin la reserva) y si tocó recortar. */
  presupuesto: number | null
  disponible: number | null
  recortado: boolean
  /** Para cuántos días de venta se calculó el pedido. */
  dias: number
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
  cerveza?: Cerveza
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

/** Un gasto tal cual quedó registrado, para la lista de "Mis gastos" en Reportes. */
export interface ReporteGasto {
  clientUid: string
  dia: string
  hora: string
  categoria: CategoriaGasto
  concepto: string
  monto: number
  /** De dónde salió la plata. */
  lugar?: LugarPlata
}

/** Lo gastado en un día del periodo, para la gráfica de "Mis gastos". */
export interface ReporteDiaGasto {
  dia: string
  monto: number
}

/** Ventas, gastos, unidades y ganancia del periodo inmediatamente anterior, de igual duración. */
export interface ReporteComparacion {
  ventas: number
  unidades: number
  ganancia: number
  gastos: number
}

/** Lo fiado en el periodo: cuánto ya se cobró y cuánto sigue sin entrar. */
export interface ReporteFiados {
  cobrado: number
  pendiente: number
  unidadesCobradas: number
  unidadesPendientes: number
}

export interface ReporteTipo {
  tipo: 'NORMAL' | 'CREMOSO' | 'GRANDE' | 'CERVEZA'
  unidades: number
  ventas: number
  ganancia: number
}

/** Cómo compran. Una compra son las ventas del mismo minuto; `descuento` es lo que se dejó de cobrar frente al precio de lista. */
export interface ReporteAnalisis {
  compras: number
  comprasDeVarios: number
  unidadesPorCompra: number
  ticketPromedio: number
  diasConVenta: number
  diasDelPeriodo: number
  unidadesConDescuento: number
  descuento: number
  porTipo: ReporteTipo[]
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
  porCategoriaGastoAnterior: ReporteCategoriaGasto[]
  gastosDetalle: ReporteGasto[]
  gastosPorDia: ReporteDiaGasto[]
  anterior: ReporteComparacion
  fiados: ReporteFiados
  analisis: ReporteAnalisis
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
  | { tipo: 'venta'; clientUid: string; productoId: number; metodo: Metodo; cantidad: number; creadaEn: number; /** Lo cobrado si hubo promo; si falta, precio × cantidad. */ total?: number; /** Solo FIADO: quién debe y su celular. */ cliente?: string; telefono?: string; /** Solo MIXTO: cuánto de lo cobrado fue en efectivo (el resto, Nequi). */ efectivo?: number }
  | { tipo: 'entrada'; clientUid: string; productoId: number; cantidad: number; creadaEn: number }
  | { tipo: 'ajuste'; clientUid: string; productoId: number; real: number; creadaEn: number }
  | { tipo: 'merma'; clientUid: string; productoId: number; cantidad: number; motivo: MotivoMerma; creadaEn: number }
  | { tipo: 'gasto'; clientUid: string; categoria: CategoriaGasto; concepto: string; monto: number; /** De dónde salió la plata (si falta, de la caja). */ lugar?: LugarPlata; creadaEn: number }
  | { tipo: 'recepcion'; clientUid: string; pedidoId: number; items: LineaPedido[]; pagoLugar?: LugarPlata; /** Bono/descuento del proveedor en pesos. */ bono?: number; creadaEn: number }
  | { tipo: 'arqueo'; clientUid: string; contado: number; nota: string; casa?: number; nequi?: number; creadaEn: number }

export interface RespuestaVenta {
  clientUid: string
  estado: 'REGISTRADA' | 'REPETIDA' | 'RECHAZADA'
  error: string | null
}

/** `GET /api/negocio`: desde qué día vende y cuántos días lleva en operación (0 si aún no hay ventas). */
/** Un fiado suelto dentro de lo que debe una persona. */
export interface DeudaFiado {
  id: number
  detalle: string
  monto: number
  creadaEn: string
}

/** Todo lo que te debe una persona (sus fiados juntos). `mensaje` ya viene armado por el servidor. */
export interface PersonaFiado {
  cliente: string
  telefono: string | null
  total: number
  deudas: DeudaFiado[]
  mensaje: string
  recordadoEn: string | null
}

export interface ListaFiados {
  /** true si el bot de WhatsApp está configurado en el servidor. */
  bot: boolean
  total: number
  personas: PersonaFiado[]
}

export interface ClienteConocido {
  cliente: string
  telefono: string | null
}

export interface Negocio {
  inicio: string | null
  dias: number
}

/** Dónde está la plata: efectivo en la caja, efectivo en la casa, o en Nequi. */
export type LugarPlata = 'CAJA' | 'CASA' | 'NEQUI'

export interface IngresoPlata {
  clientUid: string
  concepto: string
  monto: number
  lugar: LugarPlata
  creadoEn: string
  cuentaGanancia: boolean
}

/** Una meta o "sobre": plata apartada para algo. `objetivo` 0 = sin tope. */
export interface MetaPlata {
  id: number
  nombre: string
  objetivo: number
  apartado: number
}

/** Un renglón del historial de la plata; `monto` va con signo y los traslados llevan 0. */
export interface MovimientoPlata {
  tipo: 'VENTAS' | 'INGRESO' | 'GASTO' | 'PAGO_PEDIDO' | 'TRASLADO' | 'PAGO_EQUIPO' | 'PRESTAMO' | 'RETIRO'
  dia: string
  hora: string
  concepto: string
  monto: number
  lugar: LugarPlata
  clientUid: string | null
  /** Solo en las ventas: quién las hizo ("Tú" = el dueño, o el nombre del trabajador). */
  quien?: string | null
}

export interface OpcionCompra {
  dias: number
  unidades: number
  costo: number
  alcanza: boolean
}

/** `GET /api/pedido/recomendacion`: cuánto cuesta pedir para varios días y cuál conviene. */
export interface RecomendacionCompra {
  libre: number | null
  disponible: number | null
  opciones: OpcionCompra[]
  recomendado: number | null
  motivo: string
}

/** `GET /api/plata`. Si `contadoEn` es null todavía no has contado y los montos no significan nada. */
export interface SaldoPlata {
  caja: number
  casa: number
  nequi: number
  total: number
  /** Lo que está apartado en metas y `libre` = total − apartado: lo que puedes gastar. */
  apartado: number
  libre: number
  contadoEn: string | null
  ingresos: IngresoPlata[]
  metas: MetaPlata[]
}

// ------------------------------------------------------------------ control del negocio

/** El cierre de un mes (GET /api/reportes/mes): la ganancia de verdad, con lo del equipo restado. */
export interface CierreMes {
  mes: string
  nombre: string
  desde: string
  hasta: string
  enCurso: boolean
  diasDelMes: number
  diasTranscurridos: number
  diasConVenta: number
  unidades: number
  ventas: number
  costo: number
  mermas: number
  /** Sin los de «Trabajadores» (esos van en `equipo`). */
  gastos: number
  ingresos: number
  equipo: number
  equipoApp: number
  gastoTrabajadores: number
  /** Bonos/descuentos que te hizo el proveedor este mes (ya restados del pago, acá sumados para que los veas). */
  bonosProveedor: number
  gananciaApp: number
  gananciaReal: number
  retiros: number
  quedaEnNegocio: number
  proyeccion: number | null
  gastosPorCategoria: { categoria: string; monto: number }[]
  equilibrio: {
    gastosDelMes: number
    gastoPorDia: number
    dejaPorGranizado: number
    granizadosAlDia: number | null
    promedioAlDia: number
    diasQueCubrieron: number
    diasConVenta: number
  }
  porSabor: SaborDelMes[]
  anterior: { mes: string; nombre: string; unidades: number; ventas: number; gastos: number; equipo: number; gananciaReal: number; retiros: number }
  consejos: string[]
}

export interface SaborDelMes {
  sabor: string
  unidades: number
  ventas: number
  costo: number
  equipo: number
  ganancia: number
  porUnidad: number
  pctGanancia: number
}

/** Una venta que alguien borró (GET /api/ventas/borradas). */
export interface VentaBorrada {
  ventaUid: string
  deQuien: string
  borro: string
  borroTrabajador: boolean
  sabor: string
  cantidad: number
  total: number
  metodo: string
  vendidaEn: string
  borradaEn: string
}
