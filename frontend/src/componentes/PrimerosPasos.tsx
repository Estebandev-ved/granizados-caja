import { useEffect, useState } from 'react'
import type { Estado } from '../tipos'
import { Personaje } from './Personaje'

const CLAVE = 'gz_pasos_ok'
type Vista = 'vender' | 'inventario' | 'hoy' | 'reportes' | 'ajustes'

/** Lista corta para el dueño nuevo: se tacha sola y desaparece cuando termina (o cuando la cierra). */
export function PrimerosPasos({ estado, onIr }: { estado: Estado; onIr: (v: Vista) => void }) {
  const [oculto, setOculto] = useState(() => { try { return !!localStorage.getItem(CLAVE) } catch { return false } })

  const pasos: { texto: string; hecho: boolean; ir: Vista | null }[] = [
    { texto: 'Agrega tus productos', hecho: estado.productos.length > 0, ir: 'ajustes' },
    { texto: 'Anota cuánto tienes de cada uno', hecho: estado.productos.some(p => p.stock > 0), ir: 'inventario' },
    { texto: 'Haz tu primera venta', hecho: estado.hoy.unidades > 0 || estado.ultimas.length > 0, ir: null },
    { texto: 'Ponte una meta diaria', hecho: estado.meta.valor > 0, ir: 'ajustes' },
  ]
  const hechos = pasos.filter(p => p.hecho).length
  const completo = hechos === pasos.length

  useEffect(() => {
    if (completo) { try { localStorage.setItem(CLAVE, '1') } catch { /* sin storage */ } }
  }, [completo])

  if (oculto || completo) return null
  const cerrar = () => { try { localStorage.setItem(CLAVE, '1') } catch { /* sin storage */ } setOculto(true) }

  return (
    <div className="primeros-pasos">
      <div className="pp-cabeza">
        <Personaje nombre="nova" libre />
        <div><b>Primeros pasos</b><small>{hechos} de {pasos.length} listos</small></div>
        <button className="pp-cerrar" aria-label="Cerrar" onClick={cerrar}>✕</button>
      </div>
      <div className="pp-barra"><span style={{ width: (hechos / pasos.length) * 100 + '%' }} /></div>
      {pasos.map(p => (
        <button key={p.texto} className={'pp-paso' + (p.hecho ? ' hecho' : '')} disabled={p.hecho || !p.ir} onClick={() => p.ir && onIr(p.ir)}>
          <span className="pp-check" aria-hidden="true">{p.hecho ? '✓' : ''}</span>
          <span>{p.texto}</span>
          {!p.hecho && p.ir && <span className="chevron" aria-hidden="true">›</span>}
        </button>
      ))}
    </div>
  )
}
