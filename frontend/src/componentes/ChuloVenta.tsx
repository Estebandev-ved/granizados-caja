/** Confirmación de venta: un círculo que se dibuja con su chulo, casi un parpadeo. Decorativo. */
export function ChuloVenta() {
  return (
    <div className="chulo-venta" aria-hidden="true">
      <svg viewBox="0 0 52 52" width="84" height="84" fill="none" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <circle className="chulo-circulo" cx="26" cy="26" r="22" />
        <path className="chulo-marca" d="M15 27l8 8 14-16" />
      </svg>
    </div>
  )
}
