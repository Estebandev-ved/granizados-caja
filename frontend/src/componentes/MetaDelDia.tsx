import { useState } from 'react'
import { pesos } from '../formato'
import { ganariaCon, opcionesMeta, premioAl } from '../premios'
import type { PremiosDia } from '../tipos'
import { CampoNumero } from './CampoNumero'
import { Personaje } from './Personaje'
import { Sheet } from './Sheet'

const CLAVE_LISTO = 'gz_meta_lista'

/**
 * La meta del día que se pone el trabajador. Al empezar: «¿cuántos te sientes capaz de vender hoy?», con los escalones
 * de premio como opciones y lo que ganaría con cada uno. Cuando la cumple: «¿vas por más?» con las siguientes. Lo vendido
 * nunca vuelve a cero: la meta sube y la cuenta del día sigue, así los premios se pagan una sola vez.
 */
export function MetaDelDia({ premios, dia, onMeta }: {
  premios: PremiosDia
  dia: string
  onMeta: (meta: number) => Promise<void>
}) {
  const meta = premios.metaPropia ?? null
  const [otra, setOtra] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [listo, setListo] = useState(() => { try { return localStorage.getItem(CLAVE_LISTO) === dia } catch { return false } })

  const escoger = async (n: number) => {
    if (enviando || n < 1) return
    setEnviando(true)
    try {
      await onMeta(n)
      setOtra(null)
    } finally {
      setEnviando(false)
    }
  }
  const terminar = () => {
    setListo(true)
    try { localStorage.setItem(CLAVE_LISTO, dia) } catch { /* modo privado */ }
  }

  const cumplida = meta !== null && premios.vendidas >= meta
  if (meta !== null && !cumplida) {
    const faltan = meta - premios.vendidas
    const premio = premioAl(premios, meta)
    return (
      <div className="meta-propia">
        <span>Tu meta: <b>{meta}</b> · te {faltan === 1 ? 'falta 1' : 'faltan ' + faltan}{premio > 0 ? ' · premio de ' + pesos(premio) : ''}</span>
        <button type="button" className="link" onClick={() => setOtra(String(meta))}>Cambiar</button>
        {otra !== null && <Otra valor={otra} onCambio={setOtra} enviando={enviando} onListo={n => void escoger(n)} />}
      </div>
    )
  }
  if (cumplida && listo) return null

  // La pregunta va en una sola línea y las opciones se abren aparte: en Vender lo primero son los sabores
  const opciones = opcionesMeta(premios, meta ?? 0)
  const cerrar = () => { setAbierto(false); setOtra(null) }
  return (
    <>
      <div className="meta-propia invita">
        <button type="button" className="meta-invita" onClick={() => setAbierto(true)}>
          <b>{cumplida ? '🎉 ¡Cumpliste tu meta de ' + meta + '!' : '🎯 Ponte tu meta de hoy'}</b>
          <span>{cumplida ? '¿Vas por más? Mira cuánto sumas' : 'y mira cuánto te harías'} ›</span>
        </button>
        {cumplida && <button type="button" className="link" onClick={terminar}>Por hoy no</button>}
      </div>
      <Sheet abierto={abierto} onCerrar={cerrar}>
        <div className="meta-propia pregunta">
          {cumplida ? (
            <>
              <Personaje nombre="sofia" libre />
              <h2>¡Cumpliste tu meta de {meta}! ¿Vas por más?</h2>
              <span className="mut">Lo que llevas sigue contando: no vuelve a cero.</span>
            </>
          ) : (
            <>
              <h2>¿Cuántos te sientes capaz de vender hoy?</h2>
              <span className="mut">Escoge tu meta. Mientras más vendes, más ganas.</span>
            </>
          )}
          <div className="meta-opciones">
            {opciones.map(n => {
              const masPremio = premioAl(premios, n) - premioAl(premios, Math.max(meta ?? 0, premios.vendidas))
              return (
                <button type="button" key={n} disabled={enviando} onClick={() => void escoger(n).then(cerrar)}>
                  <b>{n}</b>
                  <small>{cumplida && masPremio > 0 ? '+' + pesos(masPremio) + ' de premio' : 'ganas ~' + pesos(ganariaCon(premios, n))}</small>
                </button>
              )
            })}
          </div>
          {otra === null
            ? <button type="button" className="link" onClick={() => setOtra('')}>Otra cantidad</button>
            : <Otra valor={otra} onCambio={setOtra} enviando={enviando} onListo={n => void escoger(n).then(cerrar)} />}
        </div>
      </Sheet>
    </>
  )
}

function Otra({ valor, onCambio, enviando, onListo }: { valor: string; onCambio: (v: string) => void; enviando: boolean; onListo: (n: number) => void }) {
  const n = Number(valor) || 0
  return (
    <form className="meta-otra" onSubmit={e => { e.preventDefault(); if (n > 0) onListo(n) }}>
      <CampoNumero max={3} value={valor} onCambio={onCambio} placeholder="¿Cuántos?" autoFocus />
      <button className="chico-ghost fuerte" type="submit" disabled={enviando || n <= 0}>Listo</button>
    </form>
  )
}
