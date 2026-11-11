import { useState, type ReactNode } from 'react'
import { Icono } from './Icono'

/**
 * Una sección que se abre y se cierra, con su resumen a la derecha (ej. «Préstamos · $5.000 por descontar»).
 * Lo que va adentro solo se monta al abrirla. Si adentro hay una tarjeta `.list` con su título, el título se esconde
 * (ya está en la cabeza) y la tarjeta queda sin borde.
 */
export function Plegable({ icono, titulo, resumen, alerta = false, abierto: inicial = false, children }: {
  icono: string
  titulo: string
  resumen?: ReactNode
  /** Pinta el resumen como algo pendiente. */
  alerta?: boolean
  abierto?: boolean
  children: ReactNode
}) {
  const [abierto, setAbierto] = useState(inicial)
  return (
    <section className={'plegable' + (abierto ? ' abierto' : '')}>
      <button type="button" className="plegable-cabeza" aria-expanded={abierto} onClick={() => setAbierto(a => !a)}>
        <span className="plegable-icono"><Icono nombre={icono} /></span>
        <span className="plegable-texto">
          <span className="plegable-titulo">{titulo}</span>
          {resumen !== undefined && <span className={'plegable-resumen' + (alerta ? ' alerta' : '')}>{resumen}</span>}
        </span>
        <span className="plegable-flecha" aria-hidden="true">›</span>
      </button>
      {abierto && <div className="plegable-cuerpo">{children}</div>}
    </section>
  )
}
