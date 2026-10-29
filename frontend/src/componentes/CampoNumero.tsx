import { miles, soloDigitos } from '../formato'

interface Props {
  id?: string
  /** Solo dígitos, tal cual se guardan en el estado ("150000"). */
  value: string
  onCambio: (digitos: string) => void
  /** Con `miles` se ve "150.000" mientras escribes (plata); sin él se ve el número limpio (cantidades, PIN, %). */
  miles?: boolean
  /** Largo máximo en dígitos. */
  max?: number
  placeholder?: string
  autoFocus?: boolean
  disabled?: boolean
  autoComplete?: string
  descrito?: string
  /** Para PIN: "0123" no puede quedar en "123". */
  conCeros?: boolean
}

/** Campo numérico del celular: solo dígitos, sin ceros de más, con tope y puntos de miles si es plata. */
export function CampoNumero({ id, value, onCambio, miles: conMiles = false, max = 9, ...resto }: Props) {
  return (
    <input id={id} inputMode="numeric" autoComplete={resto.autoComplete ?? 'off'}
      placeholder={resto.placeholder} autoFocus={resto.autoFocus} disabled={resto.disabled} aria-describedby={resto.descrito}
      value={conMiles ? miles(value) : value}
      onChange={e => onCambio(soloDigitos(e.target.value, max, resto.conCeros))} />
  )
}
