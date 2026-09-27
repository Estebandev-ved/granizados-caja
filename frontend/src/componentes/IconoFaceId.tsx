export type ModoFaceId = 'quieto' | 'escaneando' | 'ok' | 'error'

/**
 * Ícono de Face ID animado, al estilo del iPhone:
 * - escaneando: la cara "gira" y las esquinas laten
 * - ok: las esquinas se cierran en un círculo y se dibuja el chulo
 * - error: tiembla en rojo
 */
export function IconoFaceId({ modo, tamano = 120 }: { modo: ModoFaceId; tamano?: number }) {
  return (
    <svg className={'faceid ' + modo} width={tamano} height={tamano} viewBox="0 0 120 120" fill="none"
         strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <defs>
        <linearGradient id="faceid-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c77dff" />
          <stop offset="1" stopColor="#ff3db8" />
        </linearGradient>
      </defs>
      <g className="faceid-esquinas" stroke="url(#faceid-grad)">
        <path d="M10 36V22a12 12 0 0 1 12-12h14" />
        <path d="M84 10h14a12 12 0 0 1 12 12v14" />
        <path d="M110 84v14a12 12 0 0 1-12 12H84" />
        <path d="M36 110H22a12 12 0 0 1-12-12V84" />
      </g>
      <g className="faceid-cara" stroke="url(#faceid-grad)">
        <path d="M42 44v9" />
        <path d="M78 44v9" />
        <path d="M61 44v19h-5" />
        <path d="M44 78c9 8 23 8 32 0" />
      </g>
      <circle className="faceid-circulo" cx="60" cy="60" r="50" stroke="#4ade80" />
      <path className="faceid-chulo" d="M38 61l15 15 29-31" stroke="#4ade80" />
    </svg>
  )
}
