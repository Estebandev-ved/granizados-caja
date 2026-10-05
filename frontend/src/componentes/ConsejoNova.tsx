import { useState, type ReactNode } from 'react'
import { diaBogota } from '../estadoLocal'
import { Personaje, type NombrePersonaje } from './Personaje'

const PREFIJO = 'gz_consejo_'

function yaCerrado(clave: string): boolean {
  try { return localStorage.getItem(PREFIJO + clave) === diaBogota() } catch { return false }
}

/**
 * Consejo corto con un personaje al lado. Se puede cerrar y no vuelve a salir el mismo día
 * (así los personajes acompañan sin estorbar).
 */
export function ConsejoNova({ clave, personaje = 'nova', children }: { clave: string; personaje?: NombrePersonaje; children: ReactNode }) {
  const [oculto, setOculto] = useState(() => yaCerrado(clave))
  if (oculto) return null
  const cerrar = () => {
    try { localStorage.setItem(PREFIJO + clave, diaBogota()) } catch { /* modo privado */ }
    setOculto(true)
  }
  return (
    <div className="nova-tip">
      <Personaje nombre={personaje} libre />
      <p>{children}</p>
      <button className="nova-tip-x" onClick={cerrar} aria-label="Cerrar consejo">×</button>
    </div>
  )
}
