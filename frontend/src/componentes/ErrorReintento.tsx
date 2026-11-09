import { Personaje } from './Personaje'

/** Cuando algo necesita señal y no hay: personaje, qué pasó y un botón para reintentar. */
export function ErrorReintento({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <div className="vacio error-reintento" role="alert">
      <Personaje nombre="error" />
      <p>{mensaje}</p>
      <button className="big ghost" onClick={onReintentar}>Reintentar</button>
    </div>
  )
}
