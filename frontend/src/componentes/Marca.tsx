import { LogoNoma } from './LogoNoma'

/** Logo y nombre de la plataforma. */
export function Marca({ compacta = false }: { compacta?: boolean }) {
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
