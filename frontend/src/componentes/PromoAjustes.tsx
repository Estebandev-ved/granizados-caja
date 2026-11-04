import { useState } from 'react'
import { diaBogota } from '../estadoLocal'
import { pesos } from '../formato'
import { leerPromo, nombrePromo, promoVigente, serializarPromo, textoDias, type Promo } from '../promo'
import type { Tipo } from '../tipos'
import { CampoNumero } from './CampoNumero'
import { Icono } from './Icono'
import { Sheet } from './Sheet'

const TIPOS: { tipo: Tipo; texto: string }[] = [
  { tipo: 'NORMAL', texto: 'Normal' }, { tipo: 'CREMOSO', texto: 'Cremoso' }, { tipo: 'GRANDE', texto: 'Grande' },
]

const LETRAS_DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

type Duracion = 'hoy' | 'siempre' | 'dias'

/**
 * La promo, a tu gusto: cuántos, a cuánto, a qué tamaños y cuándo corre (hoy, hasta apagarla o ciertos días de la semana).
 * Se guarda en el servidor: Vender la aplica solo en tu celular y en el de cada trabajador.
 */
export function PromoAjustes({ valor, onGuardar, avisar }: {
  /** Lo que hay guardado en el servidor (JSON, vacío si no hay). */
  valor: string
  onGuardar: (json: string) => Promise<void>
  avisar: (m: string) => void
}) {
  const promo = leerPromo(valor)
  const [abierto, setAbierto] = useState(false)
  const vigente = promoVigente(promo)

  const guardar = async (nueva: Promo) => {
    try {
      await onGuardar(serializarPromo(nueva))
      setAbierto(false)
      avisar(nueva.activa ? '✓ Promo ' + nombrePromo(nueva, pesos) + ' prendida' : '✓ Promo apagada')
    } catch (e) {
      avisar('⚠️ ' + (e instanceof Error ? e.message : 'No se pudo guardar'))
    }
  }

  const cuando = promo.dias.length ? 'los ' + textoDias(promo.dias) : promo.soloHoy ? 'solo hoy' : 'hasta que la apagues'

  return (
    <>
      <div className="list">
        <h3><Icono nombre="ticket" /> Promoción</h3>
        <div className="config-fila clic" onClick={() => setAbierto(true)}>
          <span className="config-icono"><Icono nombre="ticket" /></span>
          <div className="sabor-info">
            <b>{nombrePromo(promo, pesos)}</b>
            <div className="sabor-pie">
              <span className="mut">
                {TIPOS.filter(t => promo.tipos.includes(t.tipo)).map(t => t.texto.toLowerCase()).join(', ')}
                {' · '}{cuando}
              </span>
            </div>
          </div>
          <span className="config-valor">{vigente ? 'Prendida hoy' : promo.activa && promo.dias.length ? 'Programada' : 'Apagada'}</span>
        </div>
        <p className="ayuda">Le llega al celular de cada trabajador: ellos también la venden solita.</p>
      </div>

      <Sheet abierto={abierto} onCerrar={() => setAbierto(false)}>
        {abierto && <FormPromo inicial={promo} onGuardar={guardar} />}
      </Sheet>
    </>
  )
}

function FormPromo({ inicial, onGuardar }: { inicial: Promo; onGuardar: (p: Promo) => void }) {
  const [activa, setActiva] = useState(inicial.activa && (inicial.dias.length > 0 || promoVigente(inicial)))
  const [cantidad, setCantidad] = useState(String(inicial.cantidad))
  const [precio, setPrecio] = useState(String(inicial.precio))
  const [tipos, setTipos] = useState<Tipo[]>(inicial.tipos)
  const [duracion, setDuracion] = useState<Duracion>(inicial.dias.length ? 'dias' : inicial.soloHoy ? 'hoy' : 'siempre')
  const [dias, setDias] = useState<number[]>(inicial.dias.length ? inicial.dias : [3])

  const n = Number(cantidad)
  const valor = Number(precio)
  const valido = Number.isInteger(n) && n >= 2 && n <= 10 && valor > 0 && tipos.length > 0 && (duracion !== 'dias' || dias.length > 0)

  const alternar = (t: Tipo) => setTipos(ts => (ts.includes(t) ? ts.filter(x => x !== t) : [...ts, t]))
  const alternarDia = (d: number) => setDias(ds => (ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d]))

  return (
    <form onSubmit={e => {
      e.preventDefault()
      if (!valido) return
      // Si ya estaba corriendo hoy conserva su día; si la prendes ahora, empieza hoy
      const dia = activa && promoVigente(inicial) ? inicial.dia : diaBogota()
      onGuardar({
        activa, cantidad: n, precio: Math.round(valor), tipos, dia,
        soloHoy: duracion === 'hoy',
        dias: duracion === 'dias' ? [...dias].sort((a, b) => a - b) : [],
      })
    }}>
      <h2>Promoción</h2>
      <p>Cuando está prendida, Vender cobra el combo solo, en tu celular y en el de cada trabajador, y deja la cuenta bien en Hoy y Reportes.</p>

      <div className="campo">
        <label>Estado</label>
        <div className="chips" style={{ justifyContent: 'flex-start', marginBottom: 0 }}>
          <button type="button" className={activa ? 'on' : ''} onClick={() => setActiva(true)}>Prendida</button>
          <button type="button" className={!activa ? 'on' : ''} onClick={() => setActiva(false)}>Apagada</button>
        </div>
      </div>

      <div className="campo">
        <label>Cuántos lleva</label>
        <CampoNumero max={2} value={cantidad} onCambio={setCantidad} />
        <small>De 2 a 10 granizados.</small>
      </div>

      <div className="campo">
        <label>Precio del combo</label>
        <CampoNumero miles value={precio} onCambio={setPrecio} />
        <small>{valido ? nombrePromo({ cantidad: n, precio: valor }, pesos) : 'Revisa los datos'}</small>
      </div>

      <div className="campo">
        <label>A cuáles aplica</label>
        <div className="chips" style={{ justifyContent: 'flex-start', marginBottom: 0 }}>
          {TIPOS.map(t => (
            <button type="button" key={t.tipo} className={tipos.includes(t.tipo) ? 'on' : ''} onClick={() => alternar(t.tipo)}>
              {t.texto}
            </button>
          ))}
        </div>
        <small>Si el combo no ahorra frente al precio normal de un tamaño, a ese no se le aplica.</small>
      </div>

      <div className="campo">
        <label>Cuándo corre</label>
        <div className="chips" style={{ justifyContent: 'flex-start', marginBottom: 0 }}>
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
    </form>
  )
}
