import { useMemo, useState } from 'react'
import { aEntero, pesos } from '../formato'
import type { Param } from '../tipos'
import { Icono } from './Icono'
import { PremiosInteligentes } from './PremiosInteligentes'

const TARIFAS = [
  { clave: 'COMISION_NORMAL', titulo: 'Granizado Normal' },
  { clave: 'COMISION_CREMOSO', titulo: 'Granizado Cremoso' },
  { clave: 'COMISION_GRANDE', titulo: 'Granizado Grande' },
  { clave: 'COMISION_CERVEZA', titulo: 'Cerveza' },
]

/** Las que cambian lo que dicen los términos del trabajo: el equipo tiene que aceptarlos otra vez. */
const CAMBIAN_TERMINOS = ['COMISION_NORMAL', 'COMISION_CREMOSO', 'COMISION_GRANDE', 'COMISION_CERVEZA', 'COMISION_PROMO', 'GRANIZADOS_GRATIS']

const CLAVES_NUMERICAS = [...CAMBIAN_TERMINOS, 'PREMIO_REBAJA_PROMO']

const MAX_ESCALONES = 12

interface Escalon { granizados: number; total: number }

function leerEscalones(texto: string): Escalon[] {
  return texto.split(',')
    .map(p => p.trim().split(':'))
    .filter(p => p.length === 2 && p[0] !== '' && p[1] !== '')
    .map(p => ({ granizados: Number(p[0]), total: Number(p[1]) }))
    .filter(e => Number.isInteger(e.granizados) && Number.isInteger(e.total))
}

const escribirEscalones = (es: Escalon[]) =>
  [...es].sort((a, b) => a.granizados - b.granizados).map(e => e.granizados + ':' + e.total).join(',')

function desdeParams(params: Param[]) {
  const valor = (clave: string) => params.find(p => p.clave === clave)?.valor ?? ''
  const numeros: Record<string, number> = {}
  for (const c of CLAVES_NUMERICAS) numeros[c] = c === 'GRANIZADOS_GRATIS' ? Number(valor(c) || 1) : aEntero(valor(c))
  return { numeros, escalones: leerEscalones(valor('PREMIOS_ESCALONES')) }
}

/** Una barra con botones − y +: para cambiar una cantidad de plata sin escribir. */
function Barra({ etiqueta, valor, max, paso, onCambio, apagado }: {
  etiqueta: string; valor: number; max: number; paso: number; onCambio: (n: number) => void; apagado?: string
}) {
  const mover = (d: number) => onCambio(Math.min(max, Math.max(0, valor + d)))
  return (
    <div className="barra-ajuste">
      <div className="barra-ajuste-cabeza">
        <span>{etiqueta}</span>
        <b className={valor === 0 && apagado ? 'apagado' : ''}>{valor === 0 && apagado ? apagado : pesos(valor)}</b>
      </div>
      <div className="barra-ajuste-pista">
        <button type="button" className="paso-boton" aria-label={'Bajar ' + etiqueta} onClick={() => mover(-paso)}>−</button>
        <input type="range" min={0} max={max} step={paso} value={valor} aria-label={etiqueta}
          onChange={e => onCambio(Number(e.target.value))} />
        <button type="button" className="paso-boton" aria-label={'Subir ' + etiqueta} onClick={() => mover(paso)}>+</button>
      </div>
    </div>
  )
}

/** Un número con botones − y +. */
function Paso({ etiqueta, valor, min, max, paso, formato, onCambio }: {
  etiqueta: string; valor: number; min: number; max: number; paso: number; formato: (n: number) => string; onCambio: (n: number) => void
}) {
  const mover = (d: number) => onCambio(Math.min(max, Math.max(min, valor + d)))
  return (
    <div className="paso">
      <button type="button" className="paso-boton" aria-label={'Bajar ' + etiqueta} onClick={() => mover(-paso)}>−</button>
      <b>{formato(valor)}</b>
      <button type="button" className="paso-boton" aria-label={'Subir ' + etiqueta} onClick={() => mover(paso)}>+</button>
    </div>
  )
}

/**
 * Las comisiones y premios del equipo, a mano: barras para las tarifas, un renglón por escalón de premio y un solo
 * botón para guardar. Lo que se cambia solo vale para las ventas nuevas.
 */
export function TarifasEquipo({ params, onGuardar }: { params: Param[]; onGuardar: (cambios: Record<string, string>) => Promise<void> }) {
  const original = useMemo(() => desdeParams(params), [params])
  const [numeros, setNumeros] = useState(original.numeros)
  const [escalones, setEscalones] = useState(original.escalones)
  const [guardando, setGuardando] = useState(false)

  // Cuando el servidor devuelve lo guardado, la pantalla se pone igual
  const [visto, setVisto] = useState(original)
  if (visto !== original) {
    setVisto(original)
    setNumeros(original.numeros)
    setEscalones(original.escalones)
  }

  const poner = (clave: string, n: number) => setNumeros(ns => ({ ...ns, [clave]: n }))

  const ordenados = [...escalones].sort((a, b) => a.granizados - b.granizados)
  const repetido = ordenados.some((e, i) => i > 0 && e.granizados === ordenados[i - 1].granizados)
  const bajan = ordenados.some((e, i) => i > 0 && e.total < ordenados[i - 1].total)
  const error = repetido ? 'Hay dos escalones con los mismos granizados.' : bajan ? 'Un escalón más alto no puede pagar menos que el anterior.' : ''

  const cambios: Record<string, string> = {}
  for (const c of CLAVES_NUMERICAS) if (numeros[c] !== original.numeros[c]) cambios[c] = String(numeros[c])
  const textoEscalones = escribirEscalones(escalones)
  if (textoEscalones !== escribirEscalones(original.escalones)) cambios.PREMIOS_ESCALONES = textoEscalones
  const hayCambios = Object.keys(cambios).length > 0
  const tocaTerminos = Object.keys(cambios).some(c => CAMBIAN_TERMINOS.includes(c))

  const rebaja = numeros.PREMIO_REBAJA_PROMO

  const cambiarEscalon = (i: number, parte: Partial<Escalon>) =>
    setEscalones(es => es.map((e, j) => (j === i ? { ...e, ...parte } : e)))
  const agregar = () => {
    const ultimo = ordenados[ordenados.length - 1]
    setEscalones(es => [...es, ultimo ? { granizados: Math.min(999, ultimo.granizados + 5), total: ultimo.total + 2000 } : { granizados: 12, total: 2000 }])
  }

  const guardar = async () => {
    if (!hayCambios || error || guardando) return
    setGuardando(true)
    try {
      await onGuardar(cambios)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <div className="list">
        <h3><Icono nombre="moneda" /> Comisión por granizado</h3>
        <p className="ayuda">Lo que gana cada trabajador por cada granizado que vende. Con todas en $0 gana su porcentaje.</p>
        {TARIFAS.map(t => (
          <Barra key={t.clave} etiqueta={t.titulo} valor={numeros[t.clave]} max={3000} paso={100} apagado="No paga"
            onCambio={n => poner(t.clave, n)} />
        ))}
      </div>

      <div className="list">
        <h3><Icono nombre="ticket" /> Días de promo</h3>
        <p className="ayuda">Cuando se vende con la promo hay menos margen: por eso la comisión y los premios son un poco menores.</p>
        <Barra etiqueta="Comisión por granizado en promo" valor={numeros.COMISION_PROMO} max={3000} paso={100} apagado="La normal"
          onCambio={n => poner('COMISION_PROMO', n)} />
        <Barra etiqueta="Los premios bajan" valor={rebaja} max={10000} paso={500} apagado="No bajan"
          onCambio={n => poner('PREMIO_REBAJA_PROMO', n)} />
      </div>

      <div className="list">
        <h3><Icono nombre="trofeo" /> Premios del día</h3>
        <p className="ayuda">Mientras más granizados venda en el día, más gana. Cada escalón es lo que lleva en total, no se suma al anterior.</p>
        {ordenados.length === 0 && <p className="mut" style={{ margin: '4px 0 10px' }}>Sin premios por ahora.</p>}
        {escalones.map((e, i) => (
          <div className="escalon-fila" key={i}>
            <div className="escalon-campos">
              <div className="escalon-campo">
                <small>Granizados</small>
                <Paso etiqueta={'granizados del escalón ' + (i + 1)} valor={e.granizados} min={1} max={999} paso={1} formato={n => String(n)}
                  onCambio={n => cambiarEscalon(i, { granizados: n })} />
              </div>
              <div className="escalon-campo">
                <small>Gana en total</small>
                <Paso etiqueta={'premio del escalón ' + (i + 1)} valor={e.total} min={0} max={500000} paso={500} formato={pesos}
                  onCambio={n => cambiarEscalon(i, { total: n })} />
              </div>
              <button type="button" className="escalon-x" aria-label={'Quitar el escalón ' + (i + 1)}
                onClick={() => setEscalones(es => es.filter((_, j) => j !== i))}>×</button>
            </div>
            {rebaja > 0 && (
              <small className="mut">Día de promo: {e.total - rebaja > 0 ? pesos(e.total - rebaja) : 'no paga'}</small>
            )}
          </div>
        ))}
        {error && <p className="aviso">{error}</p>}
        <button type="button" className="big ghost agregar-escalon" disabled={escalones.length >= MAX_ESCALONES} onClick={agregar}>
          + Agregar escalón
        </button>
      </div>

      <PremiosInteligentes escalones={escalones} rebaja={rebaja}
        onUsar={(nuevos, nuevaRebaja) => {
          setEscalones(nuevos)
          if (nuevaRebaja !== null) poner('PREMIO_REBAJA_PROMO', nuevaRebaja)
        }} />

      <div className="list">
        <h3><Icono nombre="vaso" /> Granizados de regalo</h3>
        <p className="ayuda">Los que el trabajador puede tomarse sin pagar por cada día que trabaja.</p>
        <div className="escalon-fila">
          <Paso etiqueta="granizados gratis por día" valor={numeros.GRANIZADOS_GRATIS} min={0} max={5} paso={1}
            formato={n => (n === 0 ? 'Ninguno' : n + ' por día')} onCambio={n => poner('GRANIZADOS_GRATIS', n)} />
        </div>
      </div>

      {hayCambios && (
        <div className="guardar-barra">
          {tocaTerminos && <small>El equipo tendrá que aceptar los términos otra vez.</small>}
          <div className="guardar-botones">
            <button type="button" className="big ghost" disabled={guardando}
              onClick={() => { setNumeros(original.numeros); setEscalones(original.escalones) }}>Descartar</button>
            <button type="button" className="big primario" disabled={guardando || !!error} onClick={() => void guardar()}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
