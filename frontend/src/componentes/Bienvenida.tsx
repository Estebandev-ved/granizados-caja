import { useState } from 'react'
import { api } from '../api'
import { aEntero, pesos } from '../formato'
import { RUBROS, textoPerfil, type Rubro } from '../perfil'
import { Personaje } from './Personaje'

export const CLAVE_BIENVENIDA = 'gz_bienvenida'

type Destino = 'ajustes' | null
interface Props {
  avisar: (m: string) => void
  /** Si ya hay productos en la caja, no se ofrece crear los de ejemplo. */
  tieneProductos: boolean
  /** Se llama al terminar o saltar. `ajustes` = llevarlo a configurar su equipo. */
  onTerminar: (destino: Destino) => void
}

const METAS = [100_000, 200_000, 300_000, 500_000]

/** Primera vez del dueño: cuatro preguntas cortas sobre cómo opera, y la caja queda lista para su negocio. */
export function Bienvenida({ avisar, tieneProductos, onTerminar }: Props) {
  const pasos = tieneProductos ? (['negocio', 'opera', 'meta'] as const) : (['negocio', 'opera', 'productos', 'meta'] as const)
  const [paso, setPaso] = useState(0)
  const [nombre, setNombre] = useState('')
  const [rubro, setRubro] = useState<Rubro | null>(null)
  const [equipo, setEquipo] = useState<boolean | null>(null)
  const [fiados, setFiados] = useState<boolean | null>(null)
  const [elegidos, setElegidos] = useState<Set<number>>(new Set())
  const [cantidad, setCantidad] = useState(10)
  const [meta, setMeta] = useState(0)
  const [whatsapp, setWhatsapp] = useState('')
  const [guardando, setGuardando] = useState(false)

  const actual = pasos[paso]
  const ultimo = paso === pasos.length - 1
  const plantilla = rubro ? RUBROS[rubro].plantilla : []

  const marcarVista = () => { try { localStorage.setItem(CLAVE_BIENVENIDA, '1') } catch { /* sin storage: se verá otra vez */ } }
  const saltar = () => { marcarVista(); onTerminar(null) }

  const elegirRubro = (r: Rubro) => {
    setRubro(r)
    setElegidos(new Set(RUBROS[r].plantilla.map((_, i) => i)))
  }
  const alternar = (i: number) => setElegidos(s => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })

  const puedeSeguir =
    actual === 'negocio' ? nombre.trim().length > 0 && rubro !== null
    : actual === 'opera' ? equipo !== null && fiados !== null
    : actual === 'meta' ? whatsapp.trim() === '' || aEntero(whatsapp) > 0
    : true

  const terminar = async () => {
    if (!rubro) return
    setGuardando(true)
    try {
      // El perfil va primero: es lo que hace que esta pantalla no vuelva a salir
      await api.guardarConfig('PERFIL', textoPerfil({ nombre, rubro, equipo: equipo === true, fiados: fiados === true }))
      if (!tieneProductos) {
        for (const i of [...elegidos].sort((a, b) => a - b)) {
          const m = plantilla[i]
          const p = await api.crearProducto({ sabor: m.sabor, tipo: m.tipo, precio: m.precio, stockMinimo: 2 })
          if (cantidad > 0) await api.entrada({ clientUid: 'bienvenida-' + p.id, productoId: p.id, cantidad })
        }
      }
      if (meta > 0) await api.guardarConfig('META_DIARIA', String(meta))
      if (whatsapp.trim()) await api.guardarConfig('PROVEEDOR_WHATSAPP', whatsapp.trim())
      marcarVista()
      avisar('✓ Todo listo, a vender')
      onTerminar(equipo ? 'ajustes' : null)
    } catch (e) {
      avisar('⚠️ ' + (e instanceof Error ? e.message : 'No se pudo guardar'))
      setGuardando(false)
    }
  }

  return (
    <div className="bienvenida" role="dialog" aria-modal="true" aria-label="Bienvenida">
      <div className="bienvenida-tope">
        <div className="bienvenida-puntos" aria-label={'Paso ' + (paso + 1) + ' de ' + pasos.length}>
          {pasos.map((_, i) => <i key={i} className={i <= paso ? 'on' : ''} />)}
        </div>
        <button className="link" onClick={saltar}>Saltar</button>
      </div>

      <div className="bienvenida-cuerpo" key={actual}>
        {actual === 'negocio' && <>
          <Personaje nombre="nova" />
          <h1>¡Hola! Armemos tu caja</h1>
          <p>Unas preguntas rápidas para dejar la app como la necesitas. Lo cambias después en Ajustes.</p>
          <input className="campo-bienvenida" maxLength={40} placeholder="¿Cómo se llama tu negocio?" autoComplete="off"
            value={nombre} onChange={e => setNombre(e.target.value)} />
          <div className="opciones">
            {(Object.keys(RUBROS) as Rubro[]).map(r => (
              <button key={r} className={'opcion' + (rubro === r ? ' on' : '')} onClick={() => elegirRubro(r)}>
                <b>{RUBROS[r].titulo}</b><small>{RUBROS[r].detalle}</small>
              </button>
            ))}
          </div>
        </>}

        {actual === 'opera' && <>
          <Personaje nombre="lucia" />
          <h1>¿Cómo opera tu negocio?</h1>
          <h2>¿Vendes tú solo o con equipo?</h2>
          <div className="opciones cuadricula">
            <button className={'opcion' + (equipo === false ? ' on' : '')} onClick={() => setEquipo(false)}><b>Yo solo</b><small>Vendo en persona</small></button>
            <button className={'opcion' + (equipo === true ? ' on' : '')} onClick={() => setEquipo(true)}><b>Con equipo</b><small>Otros venden y ganan comisión</small></button>
          </div>
          <h2>¿Les fías a tus clientes?</h2>
          <div className="opciones cuadricula">
            <button className={'opcion' + (fiados === false ? ' on' : '')} onClick={() => setFiados(false)}><b>No</b><small>Todo se paga al momento</small></button>
            <button className={'opcion' + (fiados === true ? ' on' : '')} onClick={() => setFiados(true)}><b>Sí</b><small>Llevo quién me debe</small></button>
          </div>
        </>}

        {actual === 'productos' && <>
          <Personaje nombre="sofia" />
          <h1>Tus primeros productos</h1>
          {plantilla.length > 0 ? <>
            <p>Escoge los que vendes (los precios los ajustas después en Ajustes) y con cuántos arrancas cada uno:</p>
            <div className="qty compacta">
              <button aria-label="Menos" onClick={() => setCantidad(c => Math.max(0, c - 5))}>−</button>
              <span>{cantidad}</span>
              <button aria-label="Más" onClick={() => setCantidad(c => Math.min(500, c + 5))}>+</button>
            </div>
            <div className="opciones">
              {plantilla.map((m, i) => (
                <button key={i} className={'opcion fila' + (elegidos.has(i) ? ' on' : '')} onClick={() => alternar(i)} aria-pressed={elegidos.has(i)}>
                  <span><b>{m.sabor}</b><small>{rubro ? RUBROS[rubro].etiquetas[m.tipo] : ''}</small></span>
                  <span className="opcion-precio">{pesos(m.precio)}</span>
                </button>
              ))}
            </div>
          </> : <p>Después de esto agrega tus productos en <b>Ajustes → Sabores y precios</b>. Toma un minuto: nombre, precio y listo.</p>}
        </>}

        {actual === 'meta' && <>
          <Personaje nombre="sofia" />
          <h1>¿Cuánto quieres vender al día?</h1>
          <p>Te mostramos una barra de progreso y tu racha de días cumpliendo la meta. Puedes dejarla sin meta.</p>
          <div className="opciones cuadricula">
            {METAS.map(m => (
              <button key={m} className={'opcion' + (meta === m ? ' on' : '')} onClick={() => setMeta(m)}><b>{pesos(m)}</b></button>
            ))}
            <button className={'opcion' + (meta === 0 ? ' on' : '')} onClick={() => setMeta(0)}><b>Sin meta</b></button>
          </div>
          <h2>¿Tienes proveedor? (opcional)</h2>
          <input className="campo-bienvenida" inputMode="numeric" placeholder="Su WhatsApp con indicativo, ej: 573001234567"
            value={whatsapp} onChange={e => setWhatsapp(e.target.value.replace(/[^\d+\s]/g, ''))} />
          <ul className="bienvenida-lista">
            <li>Nequi, efectivo, mitad y mitad y regalos ya vienen listos.</li>
            <li>Sin señal sigues vendiendo: todo se sube solo cuando vuelve.</li>
          </ul>
        </>}
      </div>

      <div className="bienvenida-pie">
        {paso > 0 && <button className="big ghost" onClick={() => setPaso(paso - 1)}>Atrás</button>}
        {!ultimo
          ? <button className="big primario" disabled={!puedeSeguir} onClick={() => setPaso(paso + 1)}>Siguiente</button>
          : <button className="big primario" disabled={guardando || !puedeSeguir} onClick={terminar}>
              {guardando ? 'Preparando tu caja…' : equipo ? 'Listo, configurar equipo' : 'Listo, a vender'}
            </button>}
      </div>
    </div>
  )
}
