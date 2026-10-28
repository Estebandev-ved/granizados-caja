import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { armarCarga, guardarCarga, leerCarga, quedaDeCarga } from '../carga'
import { diaBogota } from '../estadoLocal'
import { CargaDelDia } from '../componentes/CargaDelDia'
import { Sheet } from '../componentes/Sheet'
import { TarjetaProducto } from '../componentes/TarjetaProducto'
import { pesos, vibrar } from '../formato'
import { aplicaPromo, leerPromo, nombrePromo, promoVigente, repartirEfectivo, repartirTotal, totalMezclado, type Promo } from '../promo'
import type { Metodo, PorSabor, Producto, Tipo } from '../tipos'

interface Props {
  productos: Producto[]
  /** Lo vendido hoy por sabor: sirve para saber cuánto te queda de lo que llevas. */
  porSabor: PorSabor[]
  /** Un trabajador no arma su carga (se la da el dueño), no fía y lo que ve como stock es lo que le queda. */
  trabajador?: boolean
  /** Una línea por sabor. `total` solo viene cuando hubo promo (lo realmente cobrado en esa línea). */
  onVender: (lineas: { p: Producto; cantidad: number; total?: number; efectivo?: number }[], metodo: Metodo, fiado?: { cliente: string; telefono: string }) => void
}

type Filtro = 'todos' | Tipo
const ETIQUETA_TIPO: Record<Tipo, string> = { NORMAL: 'Normal', CREMOSO: 'Cremoso', GRANDE: 'Grande' }

export function Vender({ productos, porSabor, trabajador = false, onVender }: Props) {
  const [elegido, setElegido] = useState<Producto | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  // La promo se configura en Ajustes; aquí solo se aplica
  const [promo] = useState<Promo | null>(() => { const p = leerPromo(); return promoVigente(p) ? p : null })
  const hayPromo = !!promo && productos.some(p => aplicaPromo(promo, p))
  // Lo que llevo hoy: cuántos de cada sabor saqué a vender
  const [cargaGuardada, setCarga] = useState(() => (trabajador ? null : leerCarga()))
  // La carga de ayer no vale hoy: si la app queda abierta pasada la medianoche, no puede seguir contando
  const carga = cargaGuardada?.dia === diaBogota() ? cargaGuardada : null
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
      {!trabajador && (
        <button type="button" className={'carga-boton' + (carga ? ' on' : '')} onClick={() => setArmando(true)}>
          <b>Lo que llevo hoy</b>
          <span>{resumen ? `Te quedan ${resumen.resta} de ${resumen.llevo}` : 'Toca para anotar lo que sacas a vender'}</span>
        </button>
      )}
      {trabajador && !productos.some(p => p.stock > 0) && (
        <p className="aviso" style={{ textAlign: 'center' }}>No tienes nada cargado. Pídele al dueño que te anote lo que sacas a vender.</p>
      )}
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
          <PanelVenta p={elegido} queda={queda(elegido)} trabajador={trabajador} promo={promo && aplicaPromo(promo, elegido) ? promo : null}
            otros={promo && aplicaPromo(promo, elegido)
              ? orden.filter(o => o.id !== elegido.id && aplicaPromo(promo, o) && !agotado(o))
              : []}
            onPagar={(metodo, lineas, fiado) => {
              setElegido(null)
              onVender(lineas, metodo, fiado)
            }} />
        )}
      </Sheet>
    </section>
  )
}

function PanelVenta({ p, promo, otros, queda, trabajador, onPagar }: {
  p: Producto
  promo: Promo | null
  /** Otros sabores que entran en la promo: el cliente puede mezclar. */
  otros: Producto[]
  /** Lo que te queda de la carga de hoy (undefined = no hay carga, null = ese sabor no lo llevas). */
  queda?: number | null
  trabajador: boolean
  onPagar: (m: Metodo, lineas: { p: Producto; cantidad: number; total?: number; efectivo?: number }[], fiado?: { cliente: string; telefono: string }) => void
}) {
  const [fiando, setFiando] = useState(false)
  const [cliente, setCliente] = useState('')
  const [telefono, setTelefono] = useState('')
  // Los que ya han fiado: al escribir su nombre se llena solo el celular (sin señal simplemente no hay sugerencias)
  const [conocidos, setConocidos] = useState<{ cliente: string; telefono: string | null }[]>([])
  useEffect(() => {
    if (fiando) api.fiadosConocidos().then(setConocidos).catch(() => { /* sin señal */ })
  }, [fiando])
  const elegirNombre = (nombre: string) => {
    setCliente(nombre)
    const conocido = conocidos.find(c => c.cliente.trim().toLowerCase() === nombre.trim().toLowerCase())
    if (conocido?.telefono && !telefono) setTelefono(conocido.telefono)
  }
  const [cantidad, setCantidad] = useState(1)
  const [extra, setExtra] = useState<Record<number, number>>({})
  const [mezclando, setMezclando] = useState(false)
  const [billete, setBillete] = useState<number | null>(null)
  const [mixto, setMixto] = useState(false)
  const [efectivoTxt, setEfectivoTxt] = useState('')
  const pagado = useRef(false) // un doble toque en Nequi no puede registrar dos ventas

  const pagar = (m: Metodo, fiado?: { cliente: string; telefono: string }, enEfectivo?: number) => {
    if (pagado.current) return
    pagado.current = true
    vibrar()
    // Si mezcló sabores, el total del combo se reparte entre las líneas (la API guarda una venta por sabor)
    const partes = repartirTotal(lineas, total)
    // Pago dividido: lo pagado en efectivo se reparte igual entre las líneas, el resto de cada una es Nequi
    const efectivos = m === 'MIXTO' && enEfectivo !== undefined ? repartirEfectivo(partes, enEfectivo) : []
    onPagar(m, lineas.map((l, i) => ({
      p: l.p, cantidad: l.cantidad, total: promo && partes[i] < l.p.precio * l.cantidad ? partes[i] : undefined,
      efectivo: m === 'MIXTO' ? efectivos[i] : undefined,
    })), fiado)
  }

  // Con carga armada manda lo que llevas en la mano; si no, el inventario de la casa
  const conCarga = queda !== undefined || trabajador // al trabajador el servidor ya le manda lo que le queda como stock
  const disponible = conCarga ? (queda ?? p.stock) : p.stock
  const lineas = [{ p, cantidad }, ...otros.filter(o => extra[o.id]).map(o => ({ p: o, cantidad: extra[o.id] }))]
  const unidades = lineas.reduce((a, l) => a + l.cantidad, 0)
  const normal = lineas.reduce((a, l) => a + l.p.precio * l.cantidad, 0)
  const total = promo ? totalMezclado(promo, lineas) : normal
  const enEfectivo = Number(efectivoTxt.replace(/\D/g, '')) || 0
  const mixtoValido = enEfectivo > 0 && enEfectivo < total

  return (
    <>
      <h2>{p.nombre}</h2>
      <p className={disponible - cantidad < 0 ? 'aviso' : ''}>
        {unidades > cantidad ? unidades + ' unidades · ' : ''}{pesos(total)}{promo && total < normal ? ' (promo ' + nombrePromo(promo, pesos) + ')' : ''} · {
          disponible <= 0
            ? (conCarga ? 'según tu carga no te quedan' : 'según el inventario no quedan')
            : (conCarga ? 'te quedan ' : 'quedan ') + disponible}
      </p>
      <div className="qty">
        <button aria-label="Menos" onClick={() => setCantidad(c => Math.max(1, c - 1))}>−</button>
        <span>{cantidad}</span>
        <button aria-label="Más" onClick={() => setCantidad(c => Math.min(99, c + 1))}>+</button>
      </div>

      {otros.length > 0 && (
        <div className="vueltas">
          <button type="button" className="link" onClick={() => setMezclando(m => !m)}>
            {mezclando ? 'Ocultar otros sabores' : `¿Otro sabor en la promo ${promo ? nombrePromo(promo, pesos) : ''}?`}
          </button>
          {(mezclando || unidades > cantidad) && (
            <div className="list">
              {otros.map(o => (
                <div className="row" key={o.id}>
                  <span>{o.nombre}</span>
                  <span className="mini">
                    <button aria-label={'Menos ' + o.nombre}
                      onClick={() => setExtra(e => ({ ...e, [o.id]: Math.max(0, (e[o.id] ?? 0) - 1) }))}>−</button>
                    <b>{extra[o.id] ?? 0}</b>
                    <button aria-label={'Más ' + o.nombre}
                      onClick={() => setExtra(e => ({ ...e, [o.id]: Math.min(99, (e[o.id] ?? 0) + 1) }))}>+</button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {fiando ? (
        <form className="fiado-form" onSubmit={e => {
          e.preventDefault()
          if (cliente.trim()) pagar('FIADO', { cliente: cliente.trim(), telefono: telefono.replace(/\D/g, '') })
        }}>
          <div className="campo">
            <label htmlFor="fiado-nombre">¿Quién se lo lleva fiado?</label>
            <input id="fiado-nombre" autoFocus maxLength={60} value={cliente} list="fiado-conocidos" autoComplete="off"
              onChange={e => elegirNombre(e.target.value)} placeholder="Nombre" />
            <datalist id="fiado-conocidos">
              {conocidos.map(c => <option key={c.cliente} value={c.cliente} />)}
            </datalist>
          </div>
          <div className="campo">
            <label htmlFor="fiado-cel">Su celular (para recordarle por WhatsApp)</label>
            <input id="fiado-cel" inputMode="tel" maxLength={20} value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Si ya fió antes, sale solo" />
          </div>
          <button className="big primario" type="submit" disabled={!cliente.trim()}>Fiar {pesos(total)}</button>
          <button className="big ghost" type="button" onClick={() => setFiando(false)}>Cancelar</button>
        </form>
      ) : mixto ? (
        <form className="fiado-form" onSubmit={e => {
          e.preventDefault()
          if (mixtoValido) pagar('MIXTO', undefined, enEfectivo)
        }}>
          <div className="campo">
            <label htmlFor="mixto-efectivo">¿Cuánto pagó en efectivo?</label>
            <input id="mixto-efectivo" autoFocus inputMode="numeric" maxLength={9} autoComplete="off" value={efectivoTxt}
              onChange={e => setEfectivoTxt(e.target.value)} placeholder="Ej. 5000" />
          </div>
          <p className={enEfectivo >= total && enEfectivo > 0 ? 'aviso' : 'mut'}>
            {enEfectivo <= 0
              ? 'Total ' + pesos(total) + ' · lo que falte se cobra por Nequi'
              : enEfectivo >= total
                ? 'Tiene que ser menos de ' + pesos(total) + ' (si pagó todo en efectivo usa Efectivo)'
                : 'Efectivo ' + pesos(enEfectivo) + ' + Nequi ' + pesos(total - enEfectivo)}
          </p>
          <button className="big primario" type="submit" disabled={!mixtoValido}>Cobrar {pesos(total)}</button>
          <button className="big ghost" type="button" onClick={() => setMixto(false)}>Cancelar</button>
        </form>
      ) : (
        <>
          <div className="pay">
            <button className="big nequi" onClick={() => pagar('NEQUI')}>Nequi</button>
            <button className="big cash" onClick={() => pagar('EFECTIVO')}>Efectivo</button>
          </div>
          <button type="button" className="link fiado-boton" onClick={() => setMixto(true)}>Pagó mitad y mitad (efectivo + Nequi)</button>
          {!trabajador && <button type="button" className="link fiado-boton" onClick={() => setFiando(true)}>Fiado (paga después)</button>}
        </>
      )}
    </>
  )
}
