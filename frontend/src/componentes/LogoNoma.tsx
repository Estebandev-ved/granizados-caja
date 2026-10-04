/** El logo de NOMA / Antigravity: círculo rojo con dos rombos. */
export function LogoNoma({ tamano = 32 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="#E53935" />
      <path d="M24 12L32 20L24 28L16 20L24 12Z" fill="#fff" />
      <path d="M24 20L32 28L24 36L16 28L24 20Z" fill="#fff" opacity="0.6" />
    </svg>
  )
}
