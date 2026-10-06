import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError } from './api'
import { cargarCola, guardarCola, subirPendientes } from './cola'
import { diaBogota, estadoVisible, nuevoUid } from './estadoLocal'
import type { CategoriaGasto, Estado, LineaPedido, LugarPlata, Metodo, MotivoMerma, Operacion, Producto, VentaReciente } from './tipos'

const CLAVE_ESTADO = 'gz_estado'
const CLAVE_CONFIRMADAS = 'gz_confirmadas'

function leer<T>(clave: string, porDefecto: T): T {
  try { return JSON.parse(localStorage.getItem(clave) ?? 'null') ?? porDefecto } catch { return porDefecto }
}

function guardar(clave: string, valor: unknown) {
  try { localStorage.setItem(clave, JSON.stringify(valor)) } catch { /* sin espacio */ }
}

interface Confirmada {
  op: Operacion
  /** Cuándo la aceptó el servidor. Un estado pedido después de esto ya la incluye. */
  en: number
}

export type EstadoSync = 'al-dia' | 'pendiente' | 'sin-senal'

/**
 * Toda la lógica de la caja.
 * Vender y reponer nunca esperan al servidor: van a la cola y se ven al instante.
 * La cola sube en segundo plano, con reintentos cada vez más espaciados (3s, 6s… hasta 30s).
 */
export function useCaja(avisar: (mensaje: string) => void) {
  const [base, setBase] = useState<Estado | null>(() => leer<Estado | null>(CLAVE_ESTADO, null))
  const [cola, setColaState] = useState<Operacion[]>([])
  // Se guardan en el celular: si subieron justo antes de perder la señal y recargas la app, se siguen viendo
  const [confirmadas, setConfirmadas] = useState<Confirmada[]>(() => leer<Confirmada[]>(CLAVE_CONFIRMADAS, []))
  const [colaCargada, setColaCargada] = useState(false)
  const [enLinea, setEnLinea] = useState(() => navigator.onLine)
  const [hoy, setHoy] = useState(diaBogota)

  const colaRef = useRef<Operacion[]>([])
  const enVuelo = useRef(new Set<string>())
  const reintento = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const espera = useRef(0)
  const avisarRef = useRef(avisar)
  useEffect(() => { avisarRef.current = avisar }, [avisar])

  const setCola = useCallback((cambio: (c: Operacion[]) => Operacion[]) => {
    const nueva = cambio(colaRef.current)
    colaRef.current = nueva
    setColaState(nueva)
    void guardarCola(nueva)
  }, [])

  /** Trae el estado del servidor. No lo aplica mientras hay una subida en curso (llegaría a medias). */
  const refrescar = useCallback(async () => {
    if (enVuelo.current.size) return
    const pedidoEn = Date.now()
    try {
      const e = await api.estado()
      if (enVuelo.current.size) return
      setBase(e)
      guardar(CLAVE_ESTADO, e)
      setConfirmadas(cs => cs.filter(c => c.en > pedidoEn))
    } catch {
      // Sin señal: seguimos con lo guardado
    }
  }, [])

  const sincronizar = useCallback(async function sincronizar(): Promise<void> {
    clearTimeout(reintento.current)
    if (enVuelo.current.size || !colaRef.current.length) return
    const tanda = [...colaRef.current]
    tanda.forEach(o => enVuelo.current.add(o.clientUid))

    const r = await subirPendientes(tanda, api)
    enVuelo.current.clear()

    const aceptadas = new Set(r.aceptadas)
    const salen = new Set([...r.aceptadas, ...r.rechazadas])
    const ahora = Date.now()
    setConfirmadas(cs => [...cs, ...tanda.filter(o => aceptadas.has(o.clientUid)).map(op => ({ op, en: ahora }))])
    setCola(c => c.filter(o => !salen.has(o.clientUid)))
    if (r.rechazadas.length) {
      avisarRef.current(`⚠️ Se descartaron ${r.rechazadas.length}: el sabor ya no existe`)
    }

    if (r.error) {
      if (r.error instanceof ApiError && r.error.status === 401) return // toca volver a entrar con el PIN
      espera.current = Math.min(espera.current ? espera.current * 2 : 3000, 30000)
      reintento.current = setTimeout(() => void sincronizar(), espera.current)
      return
    }
    espera.current = 0
    if (colaRef.current.length) return sincronizar() // llegaron más mientras subía
    return refrescar()
  }, [refrescar, setCola])

  useEffect(() => { guardar(CLAVE_CONFIRMADAS, confirmadas) }, [confirmadas])

  // Arranque: cargar la cola guardada y sincronizar
  useEffect(() => {
    void cargarCola().then(c => {
      colaRef.current = c
      setColaState(c)
      setColaCargada(true)
      void sincronizar().then(refrescar)
    })
  }, [refrescar, sincronizar])

  // Volver a la app, recuperar la señal o cambiar de día
  useEffect(() => {
    const alVolver = () => {
      if (document.hidden) return
      setHoy(diaBogota())
      espera.current = 0
      void sincronizar().then(refrescar)
    }
    const conSenal = () => { setEnLinea(true); espera.current = 0; void sincronizar() }
    const sinSenal = () => setEnLinea(false)
    const reloj = setInterval(() => setHoy(diaBogota()), 60_000)
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('online', conSenal)
    window.addEventListener('offline', sinSenal)
    return () => {
      clearInterval(reloj)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('online', conSenal)
      window.removeEventListener('offline', sinSenal)
    }
  }, [refrescar, sincronizar])

  const estado = useMemo(
    () => estadoVisible(base, confirmadas.map(c => c.op), cola, hoy),
    [base, confirmadas, cola, hoy])

  const vender = useCallback((p: Producto, metodo: Metodo, cantidad: number) => {
    const op: Operacion = { tipo: 'venta', clientUid: nuevoUid(), productoId: p.id, metodo, cantidad, creadaEn: Date.now() }
    setCola(c => [...c, op])
    void sincronizar()
    return op.clientUid
  }, [setCola, sincronizar])

  const reponer = useCallback((p: Producto, cantidad: number) => {
    const op: Operacion = { tipo: 'entrada', clientUid: nuevoUid(), productoId: p.id, cantidad, creadaEn: Date.now() }
    setCola(c => [...c, op])
    void sincronizar()
  }, [setCola, sincronizar])

  const contar = useCallback((p: Producto, real: number) => {
    const op: Operacion = { tipo: 'ajuste', clientUid: nuevoUid(), productoId: p.id, real, creadaEn: Date.now() }
    setCola(c => [...c, op])
    void sincronizar()
  }, [setCola, sincronizar])

  /** "Contar todo": todos los conteos entran juntos a la cola, en el orden en que se muestran. */
  const contarTodo = useCallback((lista: readonly Producto[], reales: Readonly<Record<number, number>>) => {
    setCola(c => [...c, ...lista.map(p => ({
      tipo: 'ajuste', clientUid: nuevoUid(), productoId: p.id, real: reales[p.id] ?? p.stock, creadaEn: Date.now(),
    } as Operacion))])
    void sincronizar()
  }, [setCola, sincronizar])

  const mermar = useCallback((p: Producto, cantidad: number, motivo: MotivoMerma) => {
    const op: Operacion = { tipo: 'merma', clientUid: nuevoUid(), productoId: p.id, cantidad, motivo, creadaEn: Date.now() }
    setCola(c => [...c, op])
    void sincronizar()
  }, [setCola, sincronizar])

  /** "Llegó el pedido": se ve al instante (suma stock y baja el banner) y sube cuando haya señal. */
  const llegoElPedido = useCallback((pedidoId: number, items: LineaPedido[], pagoLugar?: LugarPlata) => {
    const op: Operacion = { tipo: 'recepcion', clientUid: nuevoUid(), pedidoId, items, pagoLugar, creadaEn: Date.now() }
    setCola(c => [...c, op])
    void sincronizar()
  }, [setCola, sincronizar])

  /** Gasto del día: se ve al instante en la ganancia y sube cuando haya señal. */
  const registrarGasto = useCallback((categoria: CategoriaGasto, concepto: string, monto: number) => {
    const op: Operacion = { tipo: 'gasto', clientUid: nuevoUid(), categoria, concepto, monto, creadaEn: Date.now() }
    setCola(c => [...c, op])
    void sincronizar()
  }, [setCola, sincronizar])

  /** Cerrar la caja: anota lo que habia en el cajon y sube cuando haya senal. */
  const cerrarCaja = useCallback((contado: number, nota: string, casa?: number, nequi?: number) => {
    const op: Operacion = { tipo: 'arqueo', clientUid: nuevoUid(), contado, nota, casa, nequi, creadaEn: Date.now() }
    setCola(c => [...c, op])
    void sincronizar()
  }, [setCola, sincronizar])

  /** Cancelar no es offline: necesita al servidor para cambiar el estado del pedido. */
  const cancelarPedido = useCallback(async (pedidoId: number) => {
    try {
      await api.cancelarPedido(pedidoId)
    } catch {
      avisarRef.current('⚠️ No se pudo cancelar, revisa la señal')
      return false
    }
    setBase(b => (b ? { ...b, pedido: null } : b))
    await refrescar()
    return true
  }, [refrescar])

  /** Si la venta no ha subido se borra aquí mismo, sin internet. Si ya subió, se borra en el servidor. */
  const deshacer = useCallback(async (v: Pick<VentaReciente, 'clientUid'>) => {
    if (colaRef.current.some(o => o.clientUid === v.clientUid)) {
      if (enVuelo.current.has(v.clientUid)) {
        avisarRef.current('Se está subiendo, intenta en un segundo')
        return
      }
      setCola(c => c.filter(o => o.clientUid !== v.clientUid))
      avisarRef.current('Venta borrada')
      return
    }
    try {
      await api.deshacer(v.clientUid)
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) {
        avisarRef.current('⚠️ No se pudo, revisa la señal')
        return
      }
    }
    setConfirmadas(cs => cs.filter(c => c.op.clientUid !== v.clientUid))
    setBase(b => b && { ...b, ultimas: b.ultimas.filter(u => u.clientUid !== v.clientUid) })
    avisarRef.current('Venta borrada')
    await refrescar()
  }, [refrescar, setCola])

  const sync: EstadoSync = !enLinea ? 'sin-senal' : cola.length ? 'pendiente' : 'al-dia'

  return {
    estado, cola, colaCargada, sync, vender, reponer, contar, contarTodo, mermar, registrarGasto, cerrarCaja,
    llegoElPedido, cancelarPedido, deshacer,
    recargar: async () => { espera.current = 0; await sincronizar(); await refrescar() },
  }
}
