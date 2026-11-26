import { useMemo, useState } from 'react'
import { aEntero, pesos } from '../formato'
import type { Param, Producto, Tipo } from '../tipos'
import { CampoNumero } from './CampoNumero'

const TIPOS: { tipo: Tipo; titulo: string }[] = [
  { tipo: 'NORMAL', titulo: 'Refrescante / Normal' },
  { tipo: 'CREMOSO', titulo: 'Cremoso' },
  { tipo: 'GRANDE', titulo: 'Grande' },
  { tipo: 'CERVEZA', titulo: 'Cerveza' },
]

const CLAVE_PRECIO: Record<Tipo, string> = { NORMAL: 'CALLE_PRECIO_NORMAL', CREMOSO: 'CALLE_PRECIO_CREMOSO', GRANDE: 'CALLE_PRECIO_GRANDE', CERVEZA: 'CALLE_PRECIO_CERVEZA' }
const CLAVE_COM: Record<Tipo, string> = { NORMAL: 'CALLE_COM_NORMAL', CREMOSO: 'CALLE_COM_CREMOSO', GRANDE: 'CALLE_COM_GRANDE', CERVEZA: 'CALLE_COM_CERVEZA' }
const OTRAS = ['CALLE_COM_COMBO', 'CALLE_PASAJE', 'CALLE_MINIMO_PASAJE', 'CALLE_BUENO', 'CALLE_REGULAR']
const NUMERICAS = [...Object.values(CLAVE_PRECIO), ...Object.values(CLAVE_COM), ...OTRAS]

/** Los de la prueba que se habló: refrescante $7.000 y cremoso $9.000, comisión $1.800 y $2.300. El Grande lo pones tú. */
const SUGERIDOS: Record<string, number> = {
  CALLE_PRECIO_NORMAL: 7000, CALLE_PRECIO_CREMOSO: 9000, CALLE_COM_NORMAL: 1800, CALLE_COM_CREMOSO: 2300,
  CALLE_COM_COMBO: 1500, CALLE_PASAJE: 7800, CALLE_MINIMO_PASAJE: 12, CALLE_BUENO: 25, CALLE_REGULAR: 15,
}

function desde(params: Param[]): Record<string, string> {
  const r: Record<string, string> = {}
  for (const c of NUMERICAS) r[c] = String(aEntero(params.find(p => p.clave === c)?.valor ?? ''))
  return r
}

/**
 * El plan de ventas en la calle: un botón lo prende o lo apaga y aquí se ponen sus precios y comisiones. Mientras esté
 * prendido, quien sale a vender «empieza una salida» y lo que venda en ella cobra el precio y la comisión de la calle.
 * Un precio o comisión en $0 deja el de siempre (por ejemplo el Grande).
 */
export function PlanCalle({ params, productos, onGuardar }: {
  params: Param[]
  productos: Producto[]
  onGuardar: (cambios: Record<string, string>) => Promise<void>
}) {
  const original = useMemo(() => desde(params), [params])
  const activo = params.find(p => p.clave === 'CALLE_ACTIVO')?.valor === '1'
  const [valores, setValores] = useState(original)
  const [guardando, setGuardando] = useState(false)
  const [visto, setVisto] = useState(original)
  if (visto !== original) {
    setVisto(original)
    setValores(original)
  }

  const n = (c: string) => aEntero(valores[c] ?? '')
  const poner = (c: string, v: string) => setValores(vs => ({ ...vs, [c]: v }))

  const cambios: Record<string, string> = {}
  for (const c of NUMERICAS) if (n(c) !== aEntero(original[c])) cambios[c] = String(n(c))
  const hayCambios = Object.keys(cambios).length > 0
  const errorUmbral = n('CALLE_REGULAR') > n('CALLE_BUENO') ? 'Lo regular no puede pedir más que lo bueno.' : ''

  // Lo que te queda por granizado: el precio de la calle (o el de siempre) − el costo del sabor − lo que gana el trabajador
  const margen = (t: Tipo) => {
    const ps = productos.filter(p => p.activo && p.tipo === t)
    if (!ps.length) return null
    const precio = n(CLAVE_PRECIO[t]) || Math.round(ps.reduce((a, p) => a + p.precio, 0) / ps.length)
    const costo = Math.round(ps.reduce((a, p) => a + p.costo, 0) / ps.length)
    if (costo <= 0) return { precio, queda: null as number | null }
    return { precio, queda: precio - costo - n(CLAVE_COM[t]) }
  }

  const guardar = async () => {
    if (!hayCambios || errorUmbral || guardando) return
    setGuardando(true)
    try { await onGuardar(cambios) } finally { setGuardando(false) }
  }
  const alternar = async () => {
    if (guardando) return
    setGuardando(true)
    try { await onGuardar({ CALLE_ACTIVO: activo ? '0' : '1' }) } finally { setGuardando(false) }
  }

  const campo = (id: string, etiqueta: string, miles: boolean, ayuda?: string) => (
    <div className="campo" key={id}>
      <label htmlFor={id}>{etiqueta}</label>
      <CampoNumero id={id} miles={miles} value={valores[id] === '0' ? '' : valores[id]} placeholder="0 = el de siempre"
        onCambio={d => poner(id, d || '0')} />
      {ayuda && <small className="mut">{ayuda}</small>}
    </div>
  )

  return (
    <>
      <div className={'calle-hero' + (activo ? ' on' : '')}>
        <b>{activo ? '🛒 Plan de la calle prendido' : 'Plan de ventas en la calle'}</b>
        <p>
          {activo
            ? 'Quien salga a vender empieza una salida desde Vender: los precios y comisiones de la calle se aplican solos y la app mide cada lugar.'
            : 'Al prenderlo, en Vender aparece «Empezar salida». Cada salida mide cuánto se vende en ese lugar y se ve en el mapa de Reportes.'}
        </p>
        <button type="button" className={'big ' + (activo ? 'ghost' : 'primario')} disabled={guardando} onClick={() => void alternar()}>
          {activo ? 'Apagar el plan de la calle' : 'Activar plan de ventas en la calle'}
        </button>
        {hayCambios && !activo && <small className="mut">Hay cambios sin guardar abajo.</small>}
      </div>

      <div className="list">
        <h3>Precio en la calle</h3>
        <p className="ayuda">Lo que cobra quien está en una salida. Con $0 se cobra el precio de siempre.</p>
        {TIPOS.map(t => {
          const m = margen(t.tipo)
          return (
            <div key={t.tipo}>
              {campo(CLAVE_PRECIO[t.tipo], t.titulo, true)}
              {m && (
                <small className="mut calle-margen">
                  Cobras {pesos(m.precio)}{m.queda !== null ? ' · te queda ' + pesos(m.queda) + ' después de costo y comisión' : ''}
                </small>
              )}
            </div>
          )
        })}
      </div>

      <div className="list">
        <h3>Comisión en la calle</h3>
        <p className="ayuda">Lo que gana el trabajador por cada uno que vende en una salida. Incluye el pasaje en el día normal.</p>
        {TIPOS.map(t => campo(CLAVE_COM[t.tipo], t.titulo, true))}
        {campo('CALLE_COM_COMBO', 'En combo (promo), por granizado', true, 'Con $0 gana la comisión de cada tipo.')}
      </div>

      <div className="list">
        <h3>Pasajes</h3>
        <p className="ayuda">
          Se le devuelve el pasaje si vende menos del mínimo, o siempre en una salida de prueba que tú marcas, y va solo en su
          próximo pago (Equipo → «Ya le pagué») y en su cierre del día. Si vende más, ya le queda en la comisión.
        </p>
        {campo('CALLE_PASAJE', 'Lo que cuesta ir y volver', true, 'Ida y vuelta. Es solo lo que se sugiere al cerrar la salida.')}
        {campo('CALLE_MINIMO_PASAJE', 'Mínimo para que no se le devuelva', false, 'Granizados en la salida.')}
      </div>

      <div className="list">
        <h3>¿Cuándo es bueno un lugar?</h3>
        <p className="ayuda">Se mide en granizados en 4 horas de venta. Lo que no llega a «regular» es un lugar malo.</p>
        {campo('CALLE_BUENO', 'Bueno desde', false)}
        {campo('CALLE_REGULAR', 'Regular desde', false)}
        {errorUmbral && <p className="aviso">{errorUmbral}</p>}
      </div>

      <div className="acciones">
        <button type="button" className="big ghost" disabled={guardando}
          onClick={() => setValores(vs => ({ ...vs, ...Object.fromEntries(Object.entries(SUGERIDOS).map(([k, v]) => [k, String(v)])) }))}>
          Usar los números del plan ($7.000 / $9.000)
        </button>
      </div>

      {hayCambios && (
        <div className="guardar-barra">
          <div className="guardar-botones">
            <button type="button" className="big ghost" disabled={guardando} onClick={() => setValores(original)}>Descartar</button>
            <button type="button" className="big primario" disabled={guardando || !!errorUmbral} onClick={() => void guardar()}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
