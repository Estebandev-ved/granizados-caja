import { useState } from 'react'
import { diaBogota } from '../estadoLocal'
import { aEntero, pesos } from '../formato'
import {
  leerPromos, MAX_NOMBRE_PROMO, MAX_PROMOS, nombrePromo, PROMO_INICIAL, promoVigente, rentabilidad, serializarPromos,
  textoDias, type Promo, type Rentabilidad, type TarifasEquipo,
} from '../promo'
import type { Param, Producto, Tipo } from '../tipos'
import { CampoNumero } from './CampoNumero'
import { Icono } from './Icono'
import { Sheet } from './Sheet'

const TIPOS: { tipo: Tipo; texto: string }[] = [
  { tipo: 'NORMAL', texto: 'Normal' }, { tipo: 'CREMOSO', texto: 'Cremoso' }, { tipo: 'GRANDE', texto: 'Grande' },
]

const LETRAS_DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

type Duracion = 'hoy' | 'siempre' | 'dias'

/** Las tarifas del equipo tal como están en Ajustes → Equipo. */
export function tarifasDe(params: readonly Param[]): TarifasEquipo {
  const v = (c: string) => aEntero(params.find(p => p.clave === c)?.valor ?? '')
  return { NORMAL: v('COMISION_NORMAL'), CREMOSO: v('COMISION_CREMOSO'), GRANDE: v('COMISION_GRANDE'), CERVEZA: v('COMISION_CERVEZA'), PROMO: v('COMISION_PROMO') }
}

function cuandoCorre(p: Promo): string {
  return p.dias.length ? 'los ' + textoDias(p.dias) : p.soloHoy ? 'solo hoy' : 'hasta que la apagues'
}

const VEREDICTO: Record<Rentabilidad['veredicto'], { texto: string; clase: string }> = {
  bien: { texto: 'Te sale rentable', clase: 'ok' },
  justo: { texto: 'Te deja muy poquito', clase: 'aviso-tag' },
  pierde: { texto: 'Pierdes plata', clase: 'mal' },
  'sin-datos': { texto: 'Falta el costo', clase: '' },
}

/**
 * Las promos, a tu gusto (hasta 3 a la vez): cuántos, a cuánto, a qué tamaños, cómo se llaman y cuándo corren.
 * Cada una dice si te sale rentable después de pagarle al trabajador. Se guardan en el servidor: Vender las aplica
 * en tu celular y en el de cada trabajador.
 */
export function PromoAjustes({ valor, productos, params, onGuardar, avisar }: {
  /** Lo que hay guardado en el servidor (JSON, vacío si no hay). */
  valor: string
  productos: Producto[]
  params: Param[]
  onGuardar: (json: string) => Promise<void>
  avisar: (m: string) => void
}) {
  const promos = leerPromos(valor)
  const tarifas = tarifasDe(params)
  // null = cerrado; -1 = una nueva; si no, la posición de la que se edita
  const [editando, setEditando] = useState<number | null>(null)

  const guardarLista = async (lista: Promo[], mensaje: string) => {
    try {
      await onGuardar(serializarPromos(lista))
      setEditando(null)
      avisar(mensaje)
    } catch (e) {
      avisar('⚠️ ' + (e instanceof Error ? e.message : 'No se pudo guardar'))
    }
  }

  return (
    <>
      <div className="list">
        <h3><Icono nombre="ticket" /> Promociones</h3>
        {promos.map((p, i) => {
          const r = rentabilidad(p, productos, tarifas)
          const vigente = promoVigente(p)
          return (
            <div className="config-fila clic" key={i} onClick={() => setEditando(i)}>
              <span className="config-icono"><Icono nombre="ticket" /></span>
              <div className="sabor-info">
                <b>{nombrePromo(p, pesos)}</b>
                <div className="sabor-pie">
                  <span className="mut">
                    {TIPOS.filter(t => p.tipos.includes(t.tipo)).map(t => t.texto.toLowerCase()).join(', ')} · {cuandoCorre(p)}
                  </span>
                </div>
                <span className={'eq-tag ' + VEREDICTO[r.veredicto].clase}>{VEREDICTO[r.veredicto].texto}</span>
              </div>
              <span className="config-valor">{vigente ? 'Prendida hoy' : p.activa && p.dias.length ? 'Programada' : 'Apagada'}</span>
            </div>
          )
        })}
        {!promos.length && <p className="mut">No tienes promociones. Crea una y Vender la cobra sola.</p>}
        {promos.length < MAX_PROMOS && (
          <button className="big ghost" style={{ marginTop: 8 }} onClick={() => setEditando(-1)}>＋ Agregar una promo</button>
        )}
        <p className="ayuda">Pueden correr varias a la vez (ej. una de normales y otra de cremosos). Le llegan al celular de cada trabajador.</p>
      </div>

      <Sheet abierto={editando !== null} onCerrar={() => setEditando(null)}>
        {editando !== null && (
          <FormPromo
            inicial={editando >= 0 ? promos[editando] : { ...PROMO_INICIAL, activa: true, soloHoy: false }}
            nueva={editando < 0} productos={productos} tarifas={tarifas}
            onGuardar={p => {
              const lista = editando >= 0 ? promos.map((x, i) => (i === editando ? p : x)) : [...promos, p]
              void guardarLista(lista, p.activa ? '✓ Promo ' + nombrePromo(p, pesos) + ' guardada' : '✓ Promo guardada, apagada')
            }}
            onQuitar={editando >= 0 ? () => void guardarLista(promos.filter((_, i) => i !== editando), '✓ Promo quitada') : undefined} />
        )}
      </Sheet>
    </>
  )
}

function FormPromo({ inicial, nueva, productos, tarifas, onGuardar, onQuitar }: {
  inicial: Promo
  nueva: boolean
  productos: Producto[]
  tarifas: TarifasEquipo
  onGuardar: (p: Promo) => void
  onQuitar?: () => void
}) {
  const [activa, setActiva] = useState(nueva || (inicial.activa && (inicial.dias.length > 0 || promoVigente(inicial))))
  const [nombre, setNombre] = useState(inicial.nombre)
  const [cantidad, setCantidad] = useState(String(inicial.cantidad))
  const [precio, setPrecio] = useState(String(inicial.precio))
  const [tipos, setTipos] = useState<Tipo[]>(inicial.tipos)
  const [duracion, setDuracion] = useState<Duracion>(inicial.dias.length ? 'dias' : inicial.soloHoy ? 'hoy' : 'siempre')
  const [dias, setDias] = useState<number[]>(inicial.dias.length ? inicial.dias : [3])
  const [quitando, setQuitando] = useState(false)

  const n = Number(cantidad)
  const valor = Number(precio)
  const valido = Number.isInteger(n) && n >= 2 && n <= 10 && valor > 0 && tipos.length > 0 && (duracion !== 'dias' || dias.length > 0)

  const alternar = (t: Tipo) => setTipos(ts => (ts.includes(t) ? ts.filter(x => x !== t) : [...ts, t]))
  const alternarDia = (d: number) => setDias(ds => (ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d]))

  const armar = (): Promo => ({
    activa, cantidad: n, precio: Math.round(valor), tipos, nombre: nombre.trim().slice(0, MAX_NOMBRE_PROMO),
    // Si ya estaba corriendo hoy conserva su día; si la prendes ahora, empieza hoy
    dia: activa && promoVigente(inicial) ? inicial.dia : diaBogota(),
    soloHoy: duracion === 'hoy',
    dias: duracion === 'dias' ? [...dias].sort((a, b) => a - b) : [],
  })

  return (
    <form onSubmit={e => {
      e.preventDefault()
      if (valido) onGuardar(armar())
    }}>
      <h2>{nueva ? 'Nueva promo' : 'Promo'}</h2>

      <div className="campo">
        <label>Estado</label>
        <div className="chips izq">
          <button type="button" className={activa ? 'on' : ''} onClick={() => setActiva(true)}>Prendida</button>
          <button type="button" className={!activa ? 'on' : ''} onClick={() => setActiva(false)}>Apagada</button>
        </div>
      </div>

      <div className="dos">
        <div className="campo">
          <label htmlFor="promo-cantidad">Cuántos lleva</label>
          <CampoNumero id="promo-cantidad" max={2} value={cantidad} onCambio={setCantidad} />
        </div>
        <div className="campo">
          <label htmlFor="promo-precio">Precio del combo</label>
          <CampoNumero id="promo-precio" miles value={precio} onCambio={setPrecio} />
        </div>
      </div>

      <div className="campo">
        <label htmlFor="promo-nombre">Cómo se llama (opcional)</label>
        <input id="promo-nombre" maxLength={MAX_NOMBRE_PROMO} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: refrescantes" />
        <small>{valido ? 'En Vender sale: ' + nombrePromo({ cantidad: n, precio: valor, nombre: nombre.trim() }, pesos) : 'Revisa los datos (de 2 a 10 granizados)'}</small>
      </div>

      <div className="campo">
        <label>A cuáles aplica</label>
        <div className="chips izq">
          {TIPOS.map(t => (
            <button type="button" key={t.tipo} className={tipos.includes(t.tipo) ? 'on' : ''} onClick={() => alternar(t.tipo)}>
              {t.texto}
            </button>
          ))}
        </div>
      </div>

      {valido && <Calculo r={rentabilidad(armar(), productos, tarifas)} cantidad={n} />}

      <div className="campo">
        <label>Cuándo corre</label>
        <div className="chips izq">
          <button type="button" className={duracion === 'dias' ? 'on' : ''} onClick={() => setDuracion('dias')}>Ciertos días</button>
          <button type="button" className={duracion === 'hoy' ? 'on' : ''} onClick={() => setDuracion('hoy')}>Solo hoy</button>
          <button type="button" className={duracion === 'siempre' ? 'on' : ''} onClick={() => setDuracion('siempre')}>Hasta que la apague</button>
        </div>
        {duracion === 'dias' && (
          <>
            <div className="chips dias-promo" style={{ justifyContent: 'flex-start', margin: '10px 0 0' }}>
              {LETRAS_DIAS.map((letra, i) => (
                <button type="button" key={letra + i} className={dias.includes(i + 1) ? 'on' : ''} onClick={() => alternarDia(i + 1)}
                  aria-label={textoDias([i + 1])} aria-pressed={dias.includes(i + 1)}>
                  {letra}
                </button>
              ))}
            </div>
            <small>{dias.length ? 'Se prende sola ' + (dias.length === 1 ? 'todos los ' : 'los ') + textoDias(dias) + (dias.length === 1 ? '' : ' de cada semana') + '.' : 'Escoge al menos un día.'}</small>
          </>
        )}
      </div>

      <button className="big primario" type="submit" disabled={!valido}>Guardar</button>
      {onQuitar && (quitando
        ? <button className="big peligro" type="button" onClick={onQuitar}>Sí, quitar esta promo</button>
        : <button className="big ghost" type="button" onClick={() => setQuitando(true)}>Quitar esta promo</button>)}
    </form>
  )
}

/** Las cuentas de un combo: lo que cobras, lo que te cuesta, lo del trabajador y lo que te queda, con un veredicto claro. */
function Calculo({ r, cantidad }: { r: Rentabilidad; cantidad: number }) {
  if (!r.aplica.length) {
    return (
      <div className="rentable mal">
        <b>Esta promo no le hace descuento a ningún producto</b>
        <p>{cantidad} sueltos cuestan lo mismo o menos que el combo, así que Vender no la va a aplicar. Bájale el precio.</p>
      </div>
    )
  }
  const sinCosto = r.sinCosto.length > 0
  return (
    <div className={'rentable ' + (r.veredicto === 'pierde' ? 'mal' : r.veredicto === 'justo' ? 'justo' : r.veredicto === 'bien' ? 'bien' : '')}>
      <b>
        {r.veredicto === 'bien' && '✓ Te sale rentable'}
        {r.veredicto === 'justo' && '⚠️ Te deja muy poquito'}
        {r.veredicto === 'pierde' && '✕ Con esta promo pierdes plata'}
        {r.veredicto === 'sin-datos' && 'Falta el costo de algunos productos'}
      </b>
      {r.producto > 0 && (
        <>
          <div className="row"><span>Cobras por combo</span><b>{pesos(r.cobras)}</b></div>
          <div className="row"><span>Te cuesta el producto</span><b>−{pesos(r.producto)}</b></div>
          <div className="row"><span>Le pagas al trabajador</span><b>{r.trabajador > 0 ? '−' + pesos(r.trabajador) : r.hayTarifas ? '$0' : 'su %'}</b></div>
          <div className="row"><span><b>Te queda si lo vende él</b></span><b>{pesos(r.quedaConTrabajador)} ({r.pct}%)</b></div>
          <div className="row"><span>Te queda si lo vendes tú</span><b>{pesos(r.quedaTu)}</b></div>
          <p className="mut">
            Sueltos, esos {cantidad} te dejarían {pesos(r.sueltos)} con trabajador.
            {r.veredicto !== 'bien' && r.sugerido > r.cobras && <> Para que te quede al menos el 20 %, cóbralo a <b>{pesos(r.sugerido)}</b> o baja lo que le pagas en promo.</>}
            {!r.hayTarifas && ' Le pagas a tu equipo un porcentaje: eso no está restado acá.'}
          </p>
        </>
      )}
      {sinCosto && <p className="mut">Ponle el costo a {r.sinCosto.map(p => p.nombre).join(', ')} en Sabores y precios para que la cuenta salga completa.</p>}
      {r.sinDescuento.length > 0 && (
        <p className="mut">Ojo: a {r.sinDescuento.map(p => p.nombre + ' (' + pesos(p.precio) + ')').join(', ')} no le aplica, porque {cantidad} sueltos no cuestan más que el combo.</p>
      )}
      <p className="mut">La cuenta se hace con los que más te cuestan, para no llevarte sorpresas.</p>
    </div>
  )
}
