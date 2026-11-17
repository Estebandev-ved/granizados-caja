import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { EMOJI_VEREDICTO, TEXTO_VEREDICTO, hora12 } from '../calle'
import { pesos } from '../formato'
import type { LugarCalle, ResumenCalle, SalidaCalleDto, TipoAlerta, VeredictoLugar } from '../tipos'
import { Plegable } from './Plegable'

const COLOR_VAR: Record<VeredictoLugar, string> = { BUENO: '--ok', REGULAR: '--warn', MALO: '--bad', SIN_DATOS: '--mut' }
const TEXTO_ALERTA: Record<TipoAlerta, string> = { HURTO: '🚨 Hurto', POLICIA: '🚓 Policía', AYUDA: '🆘 Pidió ayuda' }
/** Medellín, para cuando todavía no hay ningún lugar con punto en el mapa. */
const CENTRO_POR_DEFECTO: [number, number] = [6.2476, -75.5658]

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' })
const horaDe = (iso: string) => new Date(iso).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' })

function colorDe(v: VeredictoLugar): string {
  return getComputedStyle(document.documentElement).getPropertyValue(COLOR_VAR[v]).trim() || '#888'
}

/** Lo que dice el globo de un lugar. Se arma con nodos de texto: el nombre lo escribió alguien, no se pega como HTML. */
function globo(l: LugarCalle): HTMLElement {
  const d = document.createElement('div')
  const t = document.createElement('b')
  t.textContent = l.nombre
  const p = document.createElement('div')
  p.textContent = EMOJI_VEREDICTO[l.veredicto] + ' ' + TEXTO_VEREDICTO[l.veredicto]
    + (l.ritmo4h !== null ? ' · ' + l.ritmo4h + ' en 4 horas' : '')
  d.append(t, p)
  return d
}

/** El mapa con cada lugar pintado según lo que se vende ahí, el ranking y las alertas. Solo el dueño. */
export function MapaCalle() {
  return (
    <Plegable icono="mapa" titulo="Lugares de la calle" resumen="Mapa, ranking y alertas">
      <MapaCuerpo />
    </Plegable>
  )
}

function MapaCuerpo() {
  const [datos, setDatos] = useState<ResumenCalle | null>(null)
  const [error, setError] = useState(false)
  const [abierto, setAbierto] = useState<number | null>(null)
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const marcas = useRef(new Map<number, L.CircleMarker>())

  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let vivo = true
    api.calleResumen().then(d => { if (vivo) setDatos(d) }, () => { if (vivo) setError(true) })
    return () => { vivo = false }
  }, [intento])

  // Se arma el mapa cuando llegan los datos, y se desarma al salir
  useEffect(() => {
    if (!datos || !contenedor.current || mapa.current) return
    const conPunto = datos.lugares.filter(l => l.lat !== null && l.lng !== null)
    // En el celular el mapa no atrapa el dedo al hacer scroll por la página: se mueve con dos dedos o con los botones + y −
    const m = L.map(contenedor.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, dragging: !L.Browser.mobile })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    for (const l of conPunto) {
      const c = colorDe(l.veredicto)
      const marca = L.circleMarker([l.lat as number, l.lng as number], { radius: 11, color: c, fillColor: c, fillOpacity: .55, weight: 3 })
      marca.bindPopup(globo(l)).addTo(m)
      marcas.current.set(l.id, marca)
    }
    if (conPunto.length > 1) m.fitBounds(L.latLngBounds(conPunto.map(l => [l.lat as number, l.lng as number] as [number, number])), { padding: [30, 30], maxZoom: 16 })
    else if (conPunto.length === 1) m.setView([conPunto[0].lat as number, conPunto[0].lng as number], 15)
    else m.setView(CENTRO_POR_DEFECTO, 12)
    mapa.current = m
    const todas = marcas.current
    return () => { m.remove(); mapa.current = null; todas.clear() }
  }, [datos])

  const ver = (l: LugarCalle) => {
    setAbierto(a => (a === l.id ? null : l.id))
    const marca = marcas.current.get(l.id)
    if (marca && mapa.current && l.lat !== null && l.lng !== null) {
      mapa.current.flyTo([l.lat, l.lng], 16, { duration: .6 })
      marca.openPopup()
    }
  }

  if (error) {
    return (
      <div className="calle-vacio">
        <p>No se pudo cargar el mapa. Revisa la señal.</p>
        <button type="button" className="big ghost" onClick={() => { setError(false); setIntento(i => i + 1) }}>Reintentar</button>
      </div>
    )
  }
  if (!datos) return <p className="mut">Cargando…</p>

  const sinLugares = datos.lugares.length === 0
  const buenos = datos.lugares.filter(l => l.veredicto === 'BUENO').length

  return (
    <div className="calle-mapa">
      {sinLugares ? (
        <p className="mut">
          Todavía no hay salidas. {datos.config.activo
            ? 'Cuando alguien empiece una salida desde Vender, el lugar aparece aquí.'
            : 'Prende el plan en Ajustes → Plan de ventas en la calle y empieza una salida desde Vender.'}
        </p>
      ) : (
        <p className="mut">{datos.lugares.length} lugar{datos.lugares.length === 1 ? '' : 'es'} · {buenos} bueno{buenos === 1 ? '' : 's'}
          {' '}(25 o más en 4 horas = bueno: lo cambias en Ajustes).</p>
      )}
      <div ref={contenedor} className="calle-mapa-caja" role="application" aria-label="Mapa de los lugares donde se ha vendido" />
      <div className="calle-leyenda">
        {(['BUENO', 'REGULAR', 'MALO', 'SIN_DATOS'] as VeredictoLugar[]).map(v => <span key={v}>{EMOJI_VEREDICTO[v]} {TEXTO_VEREDICTO[v]}</span>)}
      </div>

      {!sinLugares && (
        <div className="list">
          <h3>Ranking de lugares</h3>
          {datos.lugares.map(l => (
            <div key={l.id} className="calle-lugar">
              <button type="button" className="calle-lugar-cab" aria-expanded={abierto === l.id} onClick={() => ver(l)}>
                <span className="calle-lugar-emoji" aria-hidden="true">{EMOJI_VEREDICTO[l.veredicto]}</span>
                <span className="calle-lugar-texto">
                  <b>{l.nombre}</b>
                  <small>
                    {l.ritmo4h !== null ? l.ritmo4h + ' en 4 h' : 'Sin datos'} · {l.salidas} salida{l.salidas === 1 ? '' : 's'}
                    {l.mejorHora !== null ? ' · pico ' + hora12(l.mejorHora) : ''}
                  </small>
                </span>
                <span className={'calle-lugar-plata' + (l.meDeja < 0 ? ' neg' : '')}>{pesos(l.meDeja)}</span>
              </button>
              {abierto === l.id && (
                <div className="calle-lugar-det">
                  <p className="mut">
                    {TEXTO_VEREDICTO[l.veredicto]} · {l.unidades} vendidos en {l.horas} h · pasaje promedio {pesos(l.pasajePromedio)}
                    {l.alertas > 0 ? ` · ⚠️ ${l.alertas} alerta${l.alertas === 1 ? '' : 's'}` : ''}
                    {l.lat === null ? ' · sin punto en el mapa (faltó el GPS)' : ''}
                  </p>
                  {datos.salidas.filter(s => s.lugarId === l.id).map(s => <FilaSalida key={s.clientUid} s={s} />)}
                </div>
              )}
            </div>
          ))}
          <small className="mut">«Te deja» = lo vendido − costo − comisión − pasajes que le devuelves. No incluye hielo ni pérdidas.</small>
        </div>
      )}

      {datos.alertas.length > 0 && (
        <div className="list">
          <h3>Alertas</h3>
          {datos.alertas.slice(0, 10).map(a => (
            <div key={a.id} className="calle-alerta-fila">
              <b>{TEXTO_ALERTA[a.tipo]}</b>
              <span>{a.quien}{a.lugar ? ' · ' + a.lugar : ''} · {fecha(a.creadaEn)} {horaDe(a.creadaEn)}</span>
              {a.lat !== null && a.lng !== null && (
                <a href={`https://maps.google.com/?q=${a.lat},${a.lng}`} target="_blank" rel="noreferrer">Ver dónde</a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FilaSalida({ s }: { s: SalidaCalleDto }) {
  return (
    <div className="calle-salida-fila">
      <span>{EMOJI_VEREDICTO[s.veredicto]} {fecha(s.inicio)} · {s.quien}{s.prueba ? ' · prueba' : ''}{s.abierta ? ' · en curso' : ''}</span>
      <small className="mut">
        {s.unidades} vendidos en {s.horas} h{s.ritmo4h !== null ? ` (${s.ritmo4h} en 4 h)` : ''} · pasaje {pesos(s.pasaje)}
        {s.pasajeADevolver > 0 ? ` · devolverle ${pesos(s.pasajeADevolver)}` : ''}
        {s.incidentes ? ' · ' + s.incidentes : ''}{s.nota ? ' · “' + s.nota + '”' : ''}
      </small>
    </div>
  )
}
