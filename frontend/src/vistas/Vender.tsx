import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { armarCarga, guardarCarga, leerCarga, quedaDeCarga } from '../carga'
import { cargoConsumo, diaBogota } from '../estadoLocal'
import { CargaDelDia } from '../componentes/CargaDelDia'
import { Sheet } from '../componentes/Sheet'
import { TarjetaProducto } from '../componentes/TarjetaProducto'
import { CampoNumero } from '../componentes/CampoNumero'
import { aEntero, pesos, vibrar } from '../formato'
import { ChuloVenta } from '../componentes/ChuloVenta'
import { BotonFoto } from '../componentes/FotoComprobante'
import { etiquetaTipo, usePerfil } from '../perfil'
import { aplicaPromo, cobrarLineas, nombrePromo, promoDe, totalConPromos, totalMezclado, type LineaCobrada, type Promo } from '../promo'
import type { Metodo, PorSabor, Producto, TarifasDia, Tipo } from '../tipos'

interface Props {
  productos: Producto[]
  /** Lo vendido hoy por sabor: sirve para saber cuánto te queda de lo que llevas. */
  porSabor: PorSabor[]
  /** Un trabajador no arma su carga (se la da el dueño), no fía y lo que ve como stock es lo que le queda. */
  trabajador?: boolean
  /** Las promociones que corren hoy (vienen del servidor, iguales para todos). */
  promos: Promo[]
  /** Solo un trabajador: lo que gana por granizado, para decirle cuánto gana con cada venta. */
  tarifas?: TarifasDia | null
  /** Solo un trabajador: cuántos puede tomarse gratis al día y cuántos lleva hoy. Con esto sale «Me lo tomo yo». */
  consumo?: { gratis: number; consumidos: number } | null
  /**
   * Una línea por sabor. `total` solo viene cuando hubo promo (lo realmente cobrado en esa línea).
   * `foto`: el comprobante de Nequi que se tomó al cobrar.
   */
  onVender: (lineas: Linea[], metodo: Metodo, fiado?: { cliente: string; telefono: string }, foto?: File) => void
}

type Linea = LineaCobrada

const CLAVE_RAPIDO = 'gz_rapido'


type Filtro = 'todos' | Tipo
const TIPOS: Tipo[] = ['NORMAL', 'CREMOSO', 'GRANDE', 'CERVEZA']

export function Vender({ productos, porSabor, trabajador = false, promos, consumo = null, tarifas = null, onVender }: Props) {
  const perfil = usePerfil()
  const [ok, setOk] = useState(0)
  const [elegido, setElegido] = useState<Producto | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  // La promo se configura en Ajustes y viene del servidor; aquí solo se aplica
  const enJuego = promos.filter(pr => productos.some(p => aplicaPromo(pr, p)))
  // Lo que llevo hoy: cuántos de cada sabor saqué a vender
  const [cargaGuardada, setCarga] = useState(() => (trabajador ? null : leerCarga()))
  // La carga de ayer no vale hoy: si la app queda abierta pasada la medianoche, no puede seguir contando
  const carga = cargaGuardada?.dia === diaBogota() ? cargaGuardada : null
  const [armando, setArmando] = useState(false)
  // Varios a la vez: cuando llega mucha gente, cada toque en un sabor suma uno y al final se cobra todo junto
  const [rapido, setRapido] = useState(() => { try { return localStorage.getItem(CLAVE_RAPIDO) === '1' } catch { return false } })
  const [bandeja, setBandeja] = useState<Record<number, number>>({})
  const cambiarRapido = () => {
    const nuevo = !rapido
    setRapido(nuevo)
    setBandeja({})
    try { localStorage.setItem(CLAVE_RAPIDO, nuevo ? '1' : '0') } catch { /* modo privado */ }
  }
  const sumar = (p: Producto, n: number) => {
    vibrar()
    setBandeja(b => {
      const c = Math.max(0, Math.min(99, (b[p.id] ?? 0) + n))
      const nueva = { ...b }
      if (c) nueva[p.id] = c
      else delete nueva[p.id]
      return nueva
    })
  }

  const tiposPresentes = useMemo(
    () => TIPOS.filter(t => productos.some(p => p.tipo === t)),
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
      {enJuego.length > 0 && (
        <div className="promo-aviso">
          {enJuego.map((pr, i) => <span key={i}>{i > 0 && ' · '}<b>{nombrePromo(pr, pesos)}</b></span>)}
          {' '}· promo{enJuego.length > 1 ? 's' : ''} prendida{enJuego.length > 1 ? 's' : ''}
          {tarifas && tarifas.porcentaje === null && tarifas.promo > 0 && <> · en promo ganas {pesos(tarifas.promo)} c/u</>}
        </div>
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
      <div className="modo modo-fila">
        <span>{rapido ? 'Un toque por cada uno que vendiste' : 'Toca un producto para vender'}</span>
        <button type="button" className={'chip-rapido' + (rapido ? ' on' : '')} aria-pressed={rapido} onClick={cambiarRapido}>
          ⚡ Varios a la vez
        </button>
      </div>
      {tiposPresentes.length > 1 && (
        <div className="chips categorias">
          <button className={filtro === 'todos' ? 'on' : ''} onClick={() => setFiltro('todos')}>Todos</button>
          {tiposPresentes.map(t => (
            <button key={t} className={filtro === t ? 'on' : ''} onClick={() => setFiltro(t)}>{etiquetaTipo(perfil, t)}</button>
          ))}
        </div>
      )}
      <div className="grid">
        {orden.map((p, i) => (
          <TarjetaProducto key={p.id} p={p} indice={i} restante={queda(p)} marcados={rapido ? bandeja[p.id] ?? 0 : 0}
            onClick={() => (rapido ? sumar(p, 1) : setElegido(p))} />
        ))}
        {!orden.length && <p className="mut" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px 0' }}>Nada por aquí</p>}
      </div>
      {rapido && (
        <Bandeja productos={productos} bandeja={bandeja} promos={promos} trabajador={trabajador} tarifas={tarifas}
          onQuitar={p => sumar(p, -1)} onVaciar={() => setBandeja({})}
          onCobrar={(lineas, metodo) => {
            setBandeja({})
            onVender(lineas, metodo)
            setOk(n => n + 1)
          }} />
      )}
      {ok > 0 && <ChuloVenta key={ok} />}
      <Sheet abierto={armando} onCerrar={() => setArmando(false)}>
        <CargaDelDia productos={productos} actual={carga} onGuardar={guardar} onLimpiar={limpiar} />
      </Sheet>
      <Sheet abierto={!!elegido} onCerrar={() => setElegido(null)}>
        {elegido && (
          <PanelVenta p={elegido} queda={queda(elegido)} trabajador={trabajador} consumo={trabajador ? consumo : null} tarifas={tarifas} promo={promoDe(promos, elegido)}
            otros={promoDe(promos, elegido)
              ? orden.filter(o => o.id !== elegido.id && promoDe(promos, o) === promoDe(promos, elegido) && !agotado(o))
              : []}
            onPagar={(metodo, lineas, fiado, foto) => {
              setElegido(null)
              onVender(lineas, metodo, fiado, foto)
              setOk(n => n + 1)
            }} />
        )}
      </Sheet>
    </section>
  )
}

function PanelVenta({ p, promo, otros, queda, trabajador, consumo, tarifas, onPagar }: {
  p: Producto
  tarifas: TarifasDia | null
  /** Solo un trabajador: los gratis del día y los que ya se tomó. */
  consumo: { gratis: number; consumidos: number } | null
  promo: Promo | null
  /** Otros sabores que entran en la promo: el cliente puede mezclar. */
  otros: Producto[]
  /** Lo que te queda de la carga de hoy (undefined = no hay carga, null = ese sabor no lo llevas). */
  queda?: number | null
  trabajador: boolean
  onPagar: (m: Metodo, lineas: Linea[], fiado?: { cliente: string; telefono: string }, foto?: File) => void
}) {
  const perfil = usePerfil()
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

  const pagar = (m: Metodo, fiado?: { cliente: string; telefono: string }, enEfectivo?: number, foto?: File) => {
    if (pagado.current) return
    pagado.current = true
    vibrar()
    onPagar(m, cobrarLineas(lineas, m, promo ? [promo] : [], enEfectivo), fiado, foto)
  }

  // Con carga armada manda lo que llevas en la mano; si no, el inventario de la casa
  const conCarga = queda !== undefined || trabajador // al trabajador el servidor ya le manda lo que le queda como stock
  const disponible = conCarga ? (queda ?? p.stock) : p.stock
  const lineas = [{ p, cantidad }, ...otros.filter(o => extra[o.id]).map(o => ({ p: o, cantidad: extra[o.id] }))]
  const unidades = lineas.reduce((a, l) => a + l.cantidad, 0)
  const normal = lineas.reduce((a, l) => a + l.p.precio * l.cantidad, 0)
  const total = promo ? totalMezclado(promo, lineas) : normal
  const enEfectivo = aEntero(efectivoTxt)
  const mixtoValido = enEfectivo > 0 && enEfectivo < total
  // Si se lo toma él: los gratis del día no se cobran y del siguiente en adelante va al precio de venta
  let yaTomados = consumo?.consumidos ?? 0
  let descuento = 0
  if (consumo) {
    for (const l of lineas) {
      descuento += cargoConsumo(l.p.precio, l.cantidad, consumo.gratis, yaTomados)
      yaTomados += l.cantidad
    }
  }

  return (
    <>
      <h2>{p.nombre}</h2>
      <div className="panel-total">
        {pesos(total)}
        {promo && total < normal && <small>promo {nombrePromo(promo, pesos)}</small>}
      </div>
      {tarifas && <p className="ganas-venta">Con esta venta ganas <b>{pesos(ganasCon(tarifas, cobrarLineas(lineas, 'EFECTIVO', promo ? [promo] : [])))}</b></p>}
      <p className={'panel-sub' + (disponible - cantidad < 0 ? ' aviso' : '')}>
        {unidades > cantidad ? unidades + ' unidades · ' : ''}{
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
            <div className="chips vuelto">
              {[10000, 20000, 50000, 100000].map(b => (
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
            <CampoNumero id="mixto-efectivo" miles autoFocus value={efectivoTxt} onCambio={setEfectivoTxt} placeholder="Ej. 5.000" />
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
          <BotonFoto camara onFoto={f => pagar('NEQUI', undefined, undefined, f)}>📷 Nequi con foto del comprobante</BotonFoto>
          <button type="button" className="link fiado-boton" onClick={() => setMixto(true)}>Pagó mitad y mitad (efectivo + Nequi)</button>
          {!trabajador && perfil.fiados && <button type="button" className="link fiado-boton" onClick={() => setFiando(true)}>Fiado (paga después)</button>}
          {!trabajador && <button type="button" className="link fiado-boton" onClick={() => pagar('REGALO')}>🎁 Regalo (sello de fidelidad)</button>}
          {consumo && (
            <button type="button" className="link fiado-boton" onClick={() => pagar('CONSUMO')}>
              🥤 Me lo tomo yo · {descuento > 0 ? 'se me descuentan ' + pesos(descuento) : 'gratis, es el del día'}
            </button>
          )}
        </>
      )}
    </>
  )
}

/**
 * Lo que va en "Varios a la vez": una fila por sabor (tocarla quita uno), el total con la promo si aplica y los botones
 * para cobrar todo junto. Si pagaron unos en efectivo y otros por Nequi, «Mitad y mitad» pregunta cuánto fue en efectivo.
 */
function Bandeja({ productos, bandeja, promos, trabajador, tarifas, onQuitar, onVaciar, onCobrar }: {
  tarifas: TarifasDia | null
  productos: Producto[]
  bandeja: Record<number, number>
  promos: Promo[]
  trabajador: boolean
  onQuitar: (p: Producto) => void
  onVaciar: () => void
  onCobrar: (lineas: Linea[], metodo: Metodo) => void
}) {
  const [mixto, setMixto] = useState(false)
  const [efectivoTxt, setEfectivoTxt] = useState('')
  const cobrando = useRef(false) // un doble toque no puede registrar dos veces lo mismo
  const lineas = productos.filter(p => bandeja[p.id]).map(p => ({ p, cantidad: bandeja[p.id] }))
  const unidades = lineas.reduce((a, l) => a + l.cantidad, 0)
  const normal = lineas.reduce((a, l) => a + l.p.precio * l.cantidad, 0)
  const total = totalConPromos(promos, lineas)
  const enEfectivo = aEntero(efectivoTxt)
  const mixtoValido = enEfectivo > 0 && enEfectivo < total

  const cobrar = (m: Metodo, efectivo?: number) => {
    if (cobrando.current || !lineas.length) return
    cobrando.current = true
    vibrar()
    onCobrar(cobrarLineas(lineas, m, promos, efectivo), m)
    setMixto(false)
    setEfectivoTxt('')
    window.setTimeout(() => { cobrando.current = false }, 400)
  }

  return (
    <>
      <div style={{ height: lineas.length ? 210 : 70 }} aria-hidden="true" />
      <div className="bandeja" role="region" aria-label="Varios a la vez">
        {lineas.length ? (
          <>
            <div className="bandeja-items">
              {lineas.map(l => (
                <button type="button" key={l.p.id} onClick={() => onQuitar(l.p)} aria-label={'Quitar un ' + l.p.nombre}>
                  {l.cantidad}× {l.p.sabor} <span aria-hidden="true">−</span>
                </button>
              ))}
            </div>
            <div className="bandeja-total">
              <b>{unidades} · {pesos(total)}</b>
              {total < normal && <small>con promo · ahorran {pesos(normal - total)}</small>}
              {tarifas && <small>· ganas {pesos(ganasCon(tarifas, cobrarLineas(lineas, 'EFECTIVO', promos)))}</small>}
              <button type="button" className="link" onClick={onVaciar}>Vaciar</button>
            </div>
            <div className="pay">
              <button className="big nequi" onClick={() => cobrar('NEQUI')}>Nequi</button>
              <button className="big cash" onClick={() => cobrar('EFECTIVO')}>Efectivo</button>
            </div>
            <button type="button" className="link fiado-boton" onClick={() => setMixto(true)}>Unos en efectivo y otros por Nequi</button>
          </>
        ) : (
          <p className="mut" style={{ margin: 0, textAlign: 'center' }}>
            Toca un sabor por cada granizado que vendiste{trabajador ? '' : ' (o vendiste en el rato)'}. Al final cobras todo junto.
          </p>
        )}
      </div>
      <Sheet abierto={mixto} onCerrar={() => setMixto(false)}>
        <form className="fiado-form" onSubmit={e => { e.preventDefault(); if (mixtoValido) cobrar('MIXTO', enEfectivo) }}>
          <h2>{unidades} por {pesos(total)}</h2>
          <div className="campo">
            <label htmlFor="bandeja-efectivo">¿Cuánto te pagaron en efectivo en total?</label>
            <CampoNumero id="bandeja-efectivo" miles autoFocus value={efectivoTxt} onCambio={setEfectivoTxt} placeholder="Ej. 12.000" />
          </div>
          <p className={enEfectivo >= total && enEfectivo > 0 ? 'aviso' : 'mut'}>
            {enEfectivo <= 0
              ? 'Lo que falte se cuenta como Nequi'
              : enEfectivo >= total
                ? 'Tiene que ser menos de ' + pesos(total) + ' (si todo fue en efectivo usa Efectivo)'
                : 'Efectivo ' + pesos(enEfectivo) + ' + Nequi ' + pesos(total - enEfectivo)}
          </p>
          <button className="big primario" type="submit" disabled={!mixtoValido}>Cobrar {pesos(total)}</button>
          <button className="big ghost" type="button" onClick={() => setMixto(false)}>Cancelar</button>
        </form>
      </Sheet>
    </>
  )
}

/** Lo que gana el trabajador con esas líneas: su tarifa (la de promo si se cobró por debajo del precio) o su %. */
function ganasCon(t: TarifasDia, lineas: LineaCobrada[]): number {
  return lineas.reduce((a, l) => {
    const cobrado = l.total ?? l.p.precio * l.cantidad
    if (t.porcentaje !== null) return a + Math.floor(cobrado * t.porcentaje / 100)
    const tarifa = l.p.tipo === 'CREMOSO' ? t.cremoso : l.p.tipo === 'GRANDE' ? t.grande : l.p.tipo === 'CERVEZA' ? t.cerveza : t.normal
    const enPromo = cobrado < l.p.precio * l.cantidad && t.promo > 0
    return a + (enPromo ? t.promo : tarifa) * l.cantidad
  }, 0)
}
