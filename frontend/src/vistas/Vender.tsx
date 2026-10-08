import { useMemo, useRef, useState } from 'react'
import { armarCarga, guardarCarga, leerCarga, quedaDeCarga } from '../carga'
import { CargaDelDia } from '../componentes/CargaDelDia'
import { Sheet } from '../componentes/Sheet'
import { TarjetaProducto } from '../componentes/TarjetaProducto'
import { pesos, vibrar } from '../formato'
import { aplicaPromo, leerPromo, nombrePromo, promoVigente, totalConPromo, type Promo } from '../promo'
import type { Metodo, PorSabor, Producto, Tipo } from '../tipos'

interface Props {
  productos: Producto[]
  /** Lo vendido hoy por sabor: sirve para saber cuánto te queda de lo que llevas. */
  porSabor: PorSabor[]
  /** `total` solo viene cuando hubo promo (lo realmente cobrado). */
  onVender: (p: Producto, metodo: Metodo, cantidad: number, total?: number) => void
}

type Filtro = 'todos' | Tipo
const ETIQUETA_TIPO: Record<Tipo, string> = { NORMAL: 'Normal', CREMOSO: 'Cremoso', GRANDE: 'Grande' }

export function Vender({ productos, porSabor, onVender }: Props) {
  const [elegido, setElegido] = useState<Producto | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  // La promo se configura en Ajustes; aquí solo se aplica
  const [promo] = useState<Promo | null>(() => { const p = leerPromo(); return promoVigente(p) ? p : null })
  const hayPromo = !!promo && productos.some(p => aplicaPromo(promo, p))
  // Lo que llevo hoy: cuántos de cada sabor saqué a vender
  const [carga, setCarga] = useState(() => leerCarga())
  const [armando, setArmando] = useState(false)

  const tiposPresentes = useMemo(
    () => (Object.keys(ETIQUETA_TIPO) as Tipo[]).filter(t => productos.some(p => p.tipo === t)),
    [productos])

  /** Lo que te queda de la carga: undefined = no hay carga hoy, null = ese sabor no lo llevas. */
  const queda = (p: Producto) => (carga ? quedaDeCarga(carga, p, porSabor) : undefined)

  // Con carga armada, "agotado" es lo que ya no te queda en la mano (o no llevas); si no, el inventario de la casa
  const agotado = (p: Producto) => {
    const q = queda(p)
    return q === undefined ? p.stock <= 0 : q === null || q <= 0
  }

  // Los agotados al final; el resto en el orden de Ajustes
  const orden = [...productos]
    .filter(p => filtro === 'todos' || p.tipo === filtro)
    .sort((a, b) => Number(agotado(a)) - Number(agotado(b)))

  const resumen = useMemo(() => {
    if (!carga) return null
    let llevo = 0, resta = 0
    for (const p of productos) {
      const q = quedaDeCarga(carga, p, porSabor)
      if (q === null) continue
      llevo += carga.items[p.id].llevo
      resta += q
    }
    return { llevo, resta }
  }, [carga, productos, porSabor])

  const guardar = (llevo: Record<number, number>) => {
    guardarCarga(armarCarga(carga, llevo, productos, porSabor))
    setCarga(leerCarga())
    setArmando(false)
  }
  const limpiar = () => {
    guardarCarga(null)
    setCarga(null)
    setArmando(false)
  }

  return (
    <section>
      <div className="modo">Toca un sabor para vender</div>
      {hayPromo && promo && (
        <div className="promo-aviso"><b>{nombrePromo(promo, pesos)}</b> · promo prendida</div>
      )}
      <button type="button" className={'carga-boton' + (carga ? ' on' : '')} onClick={() => setArmando(true)}>
        <b>Lo que llevo hoy</b>
        <span>{resumen ? `Te quedan ${resumen.resta} de ${resumen.llevo}` : 'Toca para anotar lo que sacas a vender'}</span>
      </button>
      {tiposPresentes.length > 1 && (
        <div className="chips categorias">
          <button className={filtro === 'todos' ? 'on' : ''} onClick={() => setFiltro('todos')}>Todos</button>
          {tiposPresentes.map(t => (
            <button key={t} className={filtro === t ? 'on' : ''} onClick={() => setFiltro(t)}>{ETIQUETA_TIPO[t]}</button>
          ))}
        </div>
      )}
      <div className="grid">
        {orden.map(p => <TarjetaProducto key={p.id} p={p} onClick={() => setElegido(p)} restante={queda(p)} />)}
        {!orden.length && <p className="mut" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px 0' }}>Nada por aquí</p>}
      </div>
      <Sheet abierto={armando} onCerrar={() => setArmando(false)}>
        <CargaDelDia productos={productos} actual={carga} onGuardar={guardar} onLimpiar={limpiar} />
      </Sheet>
      <Sheet abierto={!!elegido} onCerrar={() => setElegido(null)}>
        {elegido && (
          <PanelVenta p={elegido} queda={queda(elegido)} promo={promo && aplicaPromo(promo, elegido) ? promo : null}
            onPagar={(metodo, cantidad, total) => {
              setElegido(null)
              onVender(elegido, metodo, cantidad, total)
            }} />
        )}
      </Sheet>
    </section>
  )
}

function PanelVenta({ p, promo, queda, onPagar }: {
  p: Producto
  promo: Promo | null
  /** Lo que te queda de la carga de hoy (undefined = no hay carga, null = ese sabor no lo llevas). */
  queda?: number | null
  onPagar: (m: Metodo, cantidad: number, total?: number) => void
}) {
  const [cantidad, setCantidad] = useState(1)
  const [billete, setBillete] = useState<number | null>(null)
  const pagado = useRef(false) // un doble toque en Nequi no puede registrar dos ventas

  const pagar = (m: Metodo) => {
    if (pagado.current) return
    pagado.current = true
    vibrar()
    onPagar(m, cantidad, promo && total < p.precio * cantidad ? total : undefined)
  }

  // Con carga armada manda lo que llevas en la mano; si no, el inventario de la casa
  const conCarga = queda !== undefined
  const disponible = conCarga ? (queda ?? 0) : p.stock
  const total = promo ? totalConPromo(promo, p, cantidad) : p.precio * cantidad

  return (
    <>
      <h2>{p.nombre}</h2>
      <p className={disponible - cantidad < 0 ? 'aviso' : ''}>
        {pesos(total)}{promo && total < p.precio * cantidad ? ' (promo ' + nombrePromo(promo, pesos) + ')' : ''} · {
          disponible <= 0
            ? (conCarga ? 'según tu carga no te quedan' : 'según el inventario no quedan')
            : (conCarga ? 'te quedan ' : 'quedan ') + disponible}
      </p>
      <div className="qty">
        <button aria-label="Menos" onClick={() => setCantidad(c => Math.max(1, c - 1))}>−</button>
        <span>{cantidad}</span>
        <button aria-label="Más" onClick={() => setCantidad(c => Math.min(99, c + 1))}>+</button>
      </div>

      <div className="vueltas">
        <button type="button" className="link" onClick={() => setBillete(b => (b === null ? 10000 : null))}>
          {billete === null ? '¿Con cuánto paga?' : 'Ocultar vueltas'}
        </button>
        {billete !== null && (
          <>
            <div className="chips">
              {[10000, 20000, 50000].map(b => (
                <button key={b} type="button" className={billete === b ? 'on' : ''}
                  onClick={() => setBillete(b)}>{pesos(b)}</button>
              ))}
            </div>
            <p className={billete < total ? 'aviso' : 'mut'}>
              {billete < total
                ? 'No alcanza, faltan ' + pesos(total - billete)
                : 'Vueltas: ' + pesos(billete - total)}
            </p>
          </>
        )}
      </div>

      <div className="pay">
        <button className="big nequi" onClick={() => pagar('NEQUI')}>Nequi</button>
        <button className="big cash" onClick={() => pagar('EFECTIVO')}>Efectivo</button>
      </div>
    </>
  )
}
