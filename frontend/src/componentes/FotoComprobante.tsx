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

/** La foto del comprobante de una venta, pedida con el token. */
export function VerComprobante({ ventaUid }: { ventaUid: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let vivo = true
    let creada: string | null = null
    api.verComprobante(ventaUid)
      .then(b => {
        creada = URL.createObjectURL(b)
        if (vivo) setUrl(creada)
        else URL.revokeObjectURL(creada)
      })
      .catch(() => { if (vivo) setError(true) })
    return () => { vivo = false; if (creada) URL.revokeObjectURL(creada) }
  }, [ventaUid])
  if (error) return <p className="mut">No se pudo traer la foto, revisa la señal.</p>
  if (!url) return <p className="mut">Cargando la foto…</p>
  return <img className="comprobante-foto" src={url} alt="Comprobante de pago" />
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
