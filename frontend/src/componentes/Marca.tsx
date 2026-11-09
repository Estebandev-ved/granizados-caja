import { iniciales, usePerfil } from '../perfil'
import { LogoNoma } from './LogoNoma'

/** Logo y nombre de la plataforma. */
export function Marca({ compacta = false }: { compacta?: boolean }) {
  const { nombre } = usePerfil()
  // Con nombre propio, el negocio es el protagonista: monograma y nombre. Sin él, la marca de la plataforma.
  if (nombre) {
    return (
      <div className={'marca' + (compacta ? ' compacta' : '')}>
        <span className="monograma" aria-hidden="true">{iniciales(nombre)}</span>
        <div><b className="marca-negocio">{nombre}</b></div>
      </div>
    )
  }
  return (
    <div className={'marca' + (compacta ? ' compacta' : '')}>
      <LogoNoma tamano={compacta ? 22 : 56} />
      <div>
        <b>Antigravity</b>
        <span>Caja</span>
      </div>
    </div>
  )
}
