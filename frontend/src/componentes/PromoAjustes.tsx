import { useState } from 'react'
import { diaBogota } from '../estadoLocal'
import { pesos } from '../formato'
import { guardarPromo, leerPromo, nombrePromo, promoVigente, type Promo } from '../promo'
import type { Tipo } from '../tipos'
import { Icono } from './Icono'
import { Sheet } from './Sheet'

const TIPOS: { tipo: Tipo; texto: string }[] = [
  { tipo: 'NORMAL', texto: 'Normal' }, { tipo: 'CREMOSO', texto: 'Cremoso' }, { tipo: 'GRANDE', texto: 'Grande' },
]

/** La promo del día, a tu gusto: cuántos, a cuánto, a qué tamaños y cuánto dura. Vender solo la aplica. */
export function PromoAjustes({ avisar }: { avisar: (m: string) => void }) {
  const [promo, setPromo] = useState(leerPromo)
  const [abierto, setAbierto] = useState(false)
  const vigente = promoVigente(promo)

  const guardar = (nueva: Promo) => {
    guardarPromo(nueva)
    setPromo(nueva)
    setAbierto(false)
    avisar(nueva.activa ? '✓ Promo ' + nombrePromo(nueva, pesos) + ' prendida' : '✓ Promo apagada')
  }

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
                {' · '}{promo.soloHoy ? 'solo hoy' : 'hasta que la apagues'}
              </span>
            </div>
          </div>
          <span className="config-valor">{vigente ? 'Prendida' : 'Apagada'}</span>
        </div>
      </div>

      <Sheet abierto={abierto} onCerrar={() => setAbierto(false)}>
        {abierto && <FormPromo inicial={promo} onGuardar={guardar} />}
      </Sheet>
    </>
  )
}

function FormPromo({ inicial, onGuardar }: { inicial: Promo; onGuardar: (p: Promo) => void }) {
  const [activa, setActiva] = useState(promoVigente(inicial))
  const [cantidad, setCantidad] = useState(String(inicial.cantidad))
  const [precio, setPrecio] = useState(String(inicial.precio))
  const [tipos, setTipos] = useState<Tipo[]>(inicial.tipos)
  const [soloHoy, setSoloHoy] = useState(inicial.soloHoy)

  const n = Number(cantidad)
  const valor = Number(precio)
  const valido = Number.isInteger(n) && n >= 2 && n <= 10 && valor > 0 && tipos.length > 0

  const alternar = (t: Tipo) => setTipos(ts => (ts.includes(t) ? ts.filter(x => x !== t) : [...ts, t]))

  return (
    <form onSubmit={e => {
      e.preventDefault()
      if (!valido) return
      // Si ya estaba corriendo hoy conserva su día; si la prendes ahora, empieza hoy
      const dia = activa && promoVigente(inicial) ? inicial.dia : diaBogota()
      onGuardar({ activa, cantidad: n, precio: Math.round(valor), tipos, soloHoy, dia })
    }}>
      <h2>Promoción</h2>
      <p>Cuando está prendida, Vender cobra el combo solo y deja la cuenta bien en Hoy y Reportes.</p>

      <div className="campo">
        <label>Estado</label>
        <div className="chips" style={{ justifyContent: 'flex-start', marginBottom: 0 }}>
          <button type="button" className={activa ? 'on' : ''} onClick={() => setActiva(true)}>Prendida</button>
          <button type="button" className={!activa ? 'on' : ''} onClick={() => setActiva(false)}>Apagada</button>
        </div>
      </div>

      <div className="campo">
        <label>Cuántos lleva</label>
        <input value={cantidad} inputMode="numeric" onChange={e => setCantidad(e.target.value.replace(/\D/g, ''))} />
        <small>De 2 a 10 granizados.</small>
      </div>

      <div className="campo">
        <label>Precio del combo</label>
        <input value={precio} inputMode="numeric" onChange={e => setPrecio(e.target.value.replace(/\D/g, ''))} />
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
        <label>Cuánto dura</label>
        <div className="chips" style={{ justifyContent: 'flex-start', marginBottom: 0 }}>
          <button type="button" className={soloHoy ? 'on' : ''} onClick={() => setSoloHoy(true)}>Solo hoy</button>
          <button type="button" className={!soloHoy ? 'on' : ''} onClick={() => setSoloHoy(false)}>Hasta que la apague</button>
        </div>
      </div>

      <button className="big primario" type="submit" disabled={!valido}>Guardar</button>
    </form>
  )
}
