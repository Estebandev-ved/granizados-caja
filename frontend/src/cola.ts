import { get, set } from 'idb-keyval'
import { esRechazo, type ApiSync } from './api'
import type { Operacion } from './tipos'

// Cola de ventas y movimientos de inventario que aún no suben. Vive en IndexedDB: sobrevive a cerrar la app o recargar.

const CLAVE = 'gz_cola'

export async function cargarCola(): Promise<Operacion[]> {
  try {
    return (await get<Operacion[]>(CLAVE)) ?? []
  } catch {
    // Safari en modo privado a veces no deja usar IndexedDB
    try { return JSON.parse(localStorage.getItem(CLAVE) ?? '[]') } catch { return [] }
  }
}

export async function guardarCola(cola: Operacion[]): Promise<void> {
  try {
    await set(CLAVE, cola)
  } catch {
    try { localStorage.setItem(CLAVE, JSON.stringify(cola)) } catch { /* sin almacenamiento */ }
  }
}

export interface ResultadoSubida {
  /** Aceptadas por el servidor (nuevas o repetidas). */
  aceptadas: string[]
  /** El servidor dijo que están mal (ej. el sabor ya no existe): se sacan de la cola. */
  rechazadas: string[]
  /** Si se cortó (sin red, servidor caído), por qué. Lo que no alcanzó a subir se reintenta. */
  error?: unknown
}

const TAM_LOTE = 100

type Carga<K extends Operacion['tipo']> = Extract<Operacion, { tipo: K }>

/** Cada tipo de operación va a su endpoint. El cuerpo es el que espera cada ruta del backend. */
const SUBIR: { [K in Operacion['tipo']]: (op: Carga<K>, api: ApiSync) => Promise<unknown> } = {
  venta: (op, api) => api.venta({
    clientUid: op.clientUid, productoId: op.productoId, metodo: op.metodo,
    cantidad: op.cantidad, creadaEn: new Date(op.creadaEn).toISOString(),
  }),
  entrada: (op, api) => api.entrada({ clientUid: op.clientUid, productoId: op.productoId, cantidad: op.cantidad }),
  ajuste: (op, api) => api.movimiento({
    clientUid: op.clientUid, productoId: op.productoId, tipo: 'CONTEO', real: op.real,
  }),
  merma: (op, api) => api.movimiento({
    clientUid: op.clientUid, productoId: op.productoId, tipo: 'MERMA', cantidad: op.cantidad, motivo: op.motivo,
  }),
  recepcion: (op, api) => api.recibirPedido(op.pedidoId, op.clientUid, op.items, op.pagoLugar),
  gasto: (op, api) => api.gasto({
    clientUid: op.clientUid, categoria: op.categoria, concepto: op.concepto, monto: op.monto,
    creadoEn: new Date(op.creadaEn).toISOString(),
  }),
  arqueo: (op, api) => api.arqueo({
    clientUid: op.clientUid, contado: op.contado, nota: op.nota,
    creadoEn: new Date(op.creadaEn).toISOString(),
  }),
}

/** Truco de tipos: la tabla es una sola y cada rama recibe su propia forma. */
const TABLA = SUBIR as unknown as Record<Operacion['tipo'], (op: Operacion, api: ApiSync) => Promise<unknown>>

/** Sube la cola en orden. Las ventas seguidas van juntas en un solo lote, el resto una por una. */
export async function subirPendientes(cola: readonly Operacion[], api: ApiSync): Promise<ResultadoSubida> {
  const r: ResultadoSubida = { aceptadas: [], rechazadas: [] }
  let i = 0
  try {
    while (i < cola.length) {
      const op = cola[i]
      if (op.tipo === 'venta') {
        const grupo = []
        while (i < cola.length && grupo.length < TAM_LOTE) {
          const v = cola[i]
          if (v.tipo !== 'venta') break
          grupo.push({ clientUid: v.clientUid, productoId: v.productoId, metodo: v.metodo, cantidad: v.cantidad,
            creadaEn: new Date(v.creadaEn).toISOString() })
          i++
        }
        await subirLote(grupo, api, r)
      } else {
        try {
          await TABLA[op.tipo](op, api)
          r.aceptadas.push(op.clientUid)
        } catch (e) {
          if (!esRechazo(e)) throw e
          r.rechazadas.push(op.clientUid)
        }
        i++
      }
    }
  } catch (error) {
    r.error = error
  }
  return r
}

async function subirLote(grupo: Parameters<ApiSync['lote']>[0], api: ApiSync, r: ResultadoSubida) {
  try {
    for (const res of await api.lote(grupo)) {
      (res.estado === 'RECHAZADA' ? r.rechazadas : r.aceptadas).push(res.clientUid)
    }
  } catch (e) {
    if (!esRechazo(e)) throw e
    // El lote completo fue rechazado (una venta mal formada): se mandan una por una para no perder las buenas
    for (const v of grupo) {
      try {
        await api.venta(v)
        r.aceptadas.push(v.clientUid)
      } catch (e2) {
        if (!esRechazo(e2)) throw e2
        r.rechazadas.push(v.clientUid)
      }
    }
  }
}
