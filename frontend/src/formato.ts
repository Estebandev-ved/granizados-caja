/** 18000 → "$18.000" */
export function pesos(n: number): string {
  return (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function vibrar() {
  try { navigator.vibrate?.(15) } catch { /* iOS no tiene vibrate */ }
}
