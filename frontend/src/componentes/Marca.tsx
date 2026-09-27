import logo from '../assets/logo-dopa.png'

/** Logo y nombre de la empresa. */
export function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <div className={'marca' + (compacta ? ' compacta' : '')}>
      <img src={logo} alt="" width={compacta ? 22 : 64} height={compacta ? 22 : 64} />
      <div>
        <b>Dopamina</b>
        <span>Cocktails</span>
      </div>
    </div>
  )
}
