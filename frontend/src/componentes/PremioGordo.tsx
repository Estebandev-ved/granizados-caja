import { useEffect, useRef, useState } from 'react'
import { pesos, vibrar } from '../formato'
import { premioGordo } from '../premios'
import type { PremiosDia } from '../tipos'
import { Confeti } from './Confeti'
import { Sheet } from './Sheet'

const ORO = ['#f9a825', '#ffc857', '#ffe08a', '#fb8c00', '#e53935', '#ffffff']
const CLAVE = 'gz_premio_gordo'

/**
 * El premio gordo: el escalón más alto del día. Aquí vive todo lo vistoso: la hoja que se abre al tocar el trofeo de la
 * barra (cuánto es, cuánto falta) y la pantalla completa con confeti dorado que sale una sola vez al día, al ganarlo.
 */
export function PremioGordo({ premios, dia, abierto, onCerrar }: {
  premios: PremiosDia
  dia: string
  abierto: boolean
  onCerrar: () => void
}) {
  const gordo = premioGordo(premios)
  const meta = gordo?.granizados ?? 0
  const vendidas = premios.vendidas
  const [ganado, setGanado] = useState(false)
  const antes = useRef<number | null>(null)

  // Se gana al cruzar la meta por una venta de verdad (no al abrir la app con el día ya hecho), y una sola vez al día
  useEffect(() => {
    if (!meta) { antes.current = null; return }
    const previo = antes.current
    antes.current = vendidas
    if (previo === null || previo >= meta || vendidas < meta) return
    let ya = ''
    try { ya = localStorage.getItem(CLAVE) ?? '' } catch { /* modo privado */ }
    if (ya === dia) return
    try { localStorage.setItem(CLAVE, dia) } catch { /* modo privado */ }
    vibrar()
    const id = window.setTimeout(() => setGanado(true), 0)
    return () => window.clearTimeout(id)
  }, [meta, vendidas, dia])

  if (!gordo) return null
  const faltan = Math.max(0, meta - vendidas)
  const pct = Math.min(100, Math.round(vendidas * 100 / meta))

  return (
    <>
      <Sheet abierto={abierto} onCerrar={onCerrar}>
        <div className="gordo-hoja">
          <div className="gordo-trofeo" aria-hidden="true">🏆</div>
          <span className="gordo-etiqueta">Premio gordo{premios.diaPromo ? ' · día de promo' : ''}</span>
          <b className="gordo-monto">{pesos(gordo.total)}</b>
          <p className="gordo-sub">
            {faltan === 0 ? '¡Ya lo ganaste hoy! Eres una máquina.' : `Véndete ${meta} granizados hoy y es tuyo.`}
          </p>
          <div className="gordo-pista" role="progressbar" aria-valuemin={0} aria-valuemax={meta} aria-valuenow={Math.min(vendidas, meta)}>
            <div className="gordo-relleno" style={{ width: pct + '%' }} />
          </div>
          <div className="gordo-cuenta">
            <span>{vendidas} vendido{vendidas === 1 ? '' : 's'}</span>
            <span>{faltan === 0 ? '¡Meta cumplida!' : faltan === 1 ? '¡Te falta 1!' : 'Te faltan ' + faltan}</span>
          </div>
          {premios.premio > 0 && faltan > 0 && <p className="gordo-sub">Hoy ya llevas {pesos(premios.premio)} de premio.</p>}
          <button type="button" className="gordo-boton" onClick={onCerrar}>{faltan === 0 ? '¡Genial!' : '¡Vamos por él!'}</button>
        </div>
      </Sheet>

      {ganado && (
        <div className="gordo-ganado" role="dialog" aria-modal="true" aria-label="Ganaste el premio gordo" onClick={() => setGanado(false)}>
          <div className="gordo-rayos" aria-hidden="true" />
          <div className="gordo-centro">
            <div className="gordo-trofeo grande" aria-hidden="true">🏆</div>
            <span className="gordo-etiqueta">¡Premio gordo!</span>
            <b className="gordo-monto grande">{pesos(gordo.total)}</b>
            <p>Vendiste {vendidas} granizados hoy. ¡Eres una máquina!</p>
            <button type="button" className="gordo-boton" onClick={() => setGanado(false)}>¡Vamos por más!</button>
          </div>
          <Confeti duracion={5000} cantidad={170} colores={ORO} />
        </div>
      )}
    </>
  )
}
