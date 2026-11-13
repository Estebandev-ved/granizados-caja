import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api } from '../api'
import { adjuntarComprobante, comprobantesPendientes } from '../comprobantes'

/**
 * Un botón que abre la cámara (o las fotos) y entrega la foto escogida. `camara` va directo a la cámara trasera:
 * es lo más rápido para tomarle foto al celular del cliente con el comprobante de Nequi.
 */
export function BotonFoto({ onFoto, camara = false, className = 'link fiado-boton', children }: {
  onFoto: (archivo: File) => void
  camara?: boolean
  className?: string
  children: ReactNode
}) {
  const entrada = useRef<HTMLInputElement>(null)
  return (
    <>
      <button type="button" className={className} onClick={() => entrada.current?.click()}>{children}</button>
      <input ref={entrada} type="file" accept="image/*" capture={camara ? 'environment' : undefined} hidden
        onChange={e => {
          const archivo = e.target.files?.[0]
          e.target.value = '' // así se puede escoger la misma foto otra vez
          if (archivo) onFoto(archivo)
        }} />
    </>
  )
}

// Las fotos ya vistas quedan en memoria: abrir otra vez la misma es instantáneo (no se vuelve a pedir al servidor)
const cacheFotos = new Map<string, Promise<string>>()

function urlDeComprobante(ventaUid: string): Promise<string> {
  let p = cacheFotos.get(ventaUid)
  if (!p) {
    p = api.verComprobante(ventaUid).then(b => URL.createObjectURL(b))
    p.catch(() => cacheFotos.delete(ventaUid)) // si falló, la próxima vez se intenta de nuevo
    cacheFotos.set(ventaUid, p)
  }
  return p
}

/** La foto del comprobante de una venta, pedida con el token. */
export function VerComprobante({ ventaUid, miniatura = false }: { ventaUid: string; miniatura?: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let vivo = true
    urlDeComprobante(ventaUid)
      .then(u => { if (vivo) setUrl(u) })
      .catch(() => { if (vivo) setError(true) })
    return () => { vivo = false }
  }, [ventaUid])
  if (error) return <p className="mut">No se pudo traer la foto, revisa la señal.</p>
  if (!url) return <p className="mut">Cargando la foto…</p>
  return <img className={miniatura ? 'comprobante-mini' : 'comprobante-foto'} src={url} alt="Comprobante de pago" />
}

/** Todas las fotos de comprobantes de las ventas dadas, en cuadrícula; tocar una la abre grande. */
export function GaleriaComprobantes({ ventas }: { ventas: { clientUid: string; sabor: string; hora: string; total: number }[] }) {
  const [abierta, setAbierta] = useState<string | null>(null)
  if (!ventas.length) return <p className="mut">Todavía no hay fotos de comprobantes hoy.</p>
  return (
    <div className="comprobante">
      {abierta && (
        <button type="button" className="comprobante-grande" onClick={() => setAbierta(null)} aria-label="Cerrar foto">
          <VerComprobante ventaUid={abierta} />
        </button>
      )}
      <div className="galeria-comprobantes">
        {ventas.map(v => (
          <button type="button" key={v.clientUid} className={'galeria-item' + (abierta === v.clientUid ? ' on' : '')}
            onClick={() => setAbierta(v.clientUid)}>
            <VerComprobante ventaUid={v.clientUid} miniatura />
            <small>{v.sabor} · {v.hora}</small>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Las ventas cuya foto todavía está en el celular esperando señal. Se actualiza solo. */
export function useComprobantesPendientes(): Set<string> {
  const [pendientes, setPendientes] = useState<Set<string>>(new Set())
  useEffect(() => {
    let vivo = true
    const traer = () => { void comprobantesPendientes().then(p => { if (vivo) setPendientes(p) }) }
    traer()
    window.addEventListener('gz:comprobantes', traer)
    return () => { vivo = false; window.removeEventListener('gz:comprobantes', traer) }
  }, [])
  return pendientes
}

/** Bloque para el panel de una venta ya hecha: ver la foto, o tomarla si todavía no tiene. */
export function ComprobanteDeVenta({ ventaUid, tiene, esperando, avisar }: {
  ventaUid: string
  /** El servidor ya tiene la foto. */
  tiene: boolean
  /** La foto está en el celular esperando señal. */
  esperando: boolean
  avisar: (m: string) => void
}) {
  return (
    <div className="comprobante">
      {tiene && <VerComprobante ventaUid={ventaUid} />}
      {esperando && <p className="mut">📎 La foto está guardada en el celular: sube sola cuando haya señal.</p>}
      <BotonFoto className="big ghost" onFoto={f => {
        adjuntarComprobante([ventaUid], f)
          .then(() => avisar('📎 Foto del comprobante guardada'))
          .catch(() => avisar('⚠️ No se pudo leer la foto'))
      }}>
        {tiene || esperando ? 'Cambiar la foto del comprobante' : '📷 Agregar foto del comprobante'}
      </BotonFoto>
    </div>
  )
}
