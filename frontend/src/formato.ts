/** 18000 → "$18.000". Nunca devuelve "$NaN" ni "-$0". */
export function pesos(n: number): string {
  const v = Number.isFinite(n) ? Math.round(n) : 0
  return (v < 0 ? '-$' : '$') + miles(Math.abs(v))
}

/** 150000 → "150.000" (separador de miles colombiano) */
export function miles(n: number | string): string {
  const digitos = String(n).replace(/\D/g, '')
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Deja solo dígitos, sin ceros a la izquierda y con un tope de largo ("007x" → "7"). */
export function soloDigitos(v: string, max = 9, conCeros = false): string {
  const d = v.replace(/\D/g, '')
  return (conCeros ? d : d.replace(/^0+(?=\d)/, '')).slice(0, max)
}

/** Texto de dígitos → entero seguro (vacío o inválido = 0). */
export function aEntero(v: string): number {
  const n = Number(v.replace(/\D/g, ''))
  return Number.isSafeInteger(n) ? n : 0
}

export function vibrar() {
  try { navigator.vibrate?.(15) } catch { /* iOS no tiene vibrate */ }
}
