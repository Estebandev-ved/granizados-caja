import { useState } from 'react'
import { Personaje, type NombrePersonaje } from './Personaje'
import { Sheet } from './Sheet'

const DIAPOSITIVAS: { personaje: NombrePersonaje; titulo: string; texto: string }[] = [
  { personaje: 'sofia', titulo: 'Vende en dos toques', texto: 'Tocas el producto, tocas cómo te pagó y listo. Sin formularios ni vueltas.' },
  { personaje: 'nova', titulo: 'Funciona sin señal', texto: 'Si se cae el internet sigues vendiendo. Todo se sube solo cuando vuelve.' },
  { personaje: 'lucia', titulo: 'Inventario que se cuida solo', texto: 'Te avisa cuando algo se acaba y te arma el pedido para tu proveedor.' },
  { personaje: 'mateo', titulo: 'Tu equipo y tus metas', texto: 'Cada trabajador tiene su PIN, su carga y sus premios. Tú ves la cuenta clara.' },
]

/** Recorrido de cuatro tarjetas para quien todavía no tiene cuenta y quiere saber qué es esto. */
export function Recorrido({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [i, setI] = useState(0)
  const d = DIAPOSITIVAS[i]
  const ultima = i === DIAPOSITIVAS.length - 1
  const cerrar = () => { setI(0); onCerrar() }
  return (
    <Sheet abierto={abierto} onCerrar={cerrar}>
      <div className="recorrido" key={i}>
        <Personaje nombre={d.personaje} />
        <h2>{d.titulo}</h2>
        <p>{d.texto}</p>
      </div>
      <div className="bienvenida-puntos centro" aria-label={'Tarjeta ' + (i + 1) + ' de ' + DIAPOSITIVAS.length}>
        {DIAPOSITIVAS.map((_, k) => <i key={k} className={k <= i ? 'on' : ''} />)}
      </div>
      <button className="big primario" style={{ marginTop: 16 }} onClick={() => (ultima ? cerrar() : setI(i + 1))}>
        {ultima ? 'Entendido' : 'Siguiente'}
      </button>
    </Sheet>
  )
}
