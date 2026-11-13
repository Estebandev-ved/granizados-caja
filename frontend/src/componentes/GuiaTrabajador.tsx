import { useState } from 'react'
import { pesos, vibrar } from '../formato'
import { porGranizado } from '../premios'
import type { PremiosDia, Producto } from '../tipos'
import { ChuloVenta } from './ChuloVenta'
import { Personaje } from './Personaje'
import { TarjetaProducto } from './TarjetaProducto'

/** Se guarda por trabajador: si entra otro en el mismo celular, también la ve. */
const clave = (quien: string) => 'gz_guia_trabajador:' + quien

export function guiaVista(quien: string): boolean {
  try { return !!localStorage.getItem(clave(quien)) } catch { return true }
}

export function marcarGuiaVista(quien: string) {
  try { localStorage.setItem(clave(quien), '1') } catch { /* modo privado */ }
}

/** Sabores de mentiras para practicar cuando todavía no le han cargado nada. */
const DE_EJEMPLO: Producto[] = ['Smirnoff', 'Maracuyá'].map((sabor, i) => ({
  id: -1 - i, sabor, tipo: 'NORMAL', nombre: sabor, precio: 6000, costo: 0, stock: 8, stockMinimo: 0, activo: true, orden: i,
}))

const PASOS = 6

/**
 * La primera vez que entra un trabajador: una venta de práctica guiada (tocar el sabor, tocar cómo pagaron) y un vistazo
 * a lo que gana, sus premios y cómo cerrar el día. Nada de lo que toca acá se anota de verdad.
 */
export function GuiaTrabajador({ nombre, productos, premios, onTerminar }: {
  nombre: string
  productos: Producto[]
  premios: PremiosDia | null
  onTerminar: () => void
}) {
  const [paso, setPaso] = useState(0)
  const [elegido, setElegido] = useState<Producto | null>(null)
  const [metodo, setMetodo] = useState<'Nequi' | 'Efectivo'>('Efectivo')

  // Practica con sus sabores de verdad si ya le cargaron; si no, con dos de ejemplo
  const conCarga = productos.filter(p => p.stock > 0)
  const sabores = (conCarga.length >= 2 ? conCarga : DE_EJEMPLO).slice(0, 4)
  // Lo que deja un granizado suelto (sin promo): su % o la tarifa del tipo que escogió
  const t = premios?.tarifas
  const tipo = elegido?.tipo ?? 'NORMAL'
  const gana = !premios || !t ? 0
    : t.porcentaje !== null ? porGranizado(premios, elegido?.precio ?? 6000)
      : (tipo === 'CREMOSO' ? t.cremoso : tipo === 'GRANDE' ? t.grande : tipo === 'CERVEZA' ? t.cerveza : t.normal) || t.normal
  const primerPremio = premios?.escalones[0] ?? null

  const escoger = (p: Producto) => { vibrar(); setElegido(p); setPaso(2) }
  const cobrar = (m: 'Nequi' | 'Efectivo') => { vibrar(); setMetodo(m); setPaso(3) }

  return (
    <div className="bienvenida guia" role="dialog" aria-modal="true" aria-label="Cómo usar la app">
      <div className="bienvenida-tope">
        <div className="bienvenida-puntos" aria-label={'Paso ' + (paso + 1) + ' de ' + PASOS}>
          {Array.from({ length: PASOS }, (_, k) => <i key={k} className={k <= paso ? 'on' : ''} />)}
        </div>
        <button type="button" className="link" onClick={onTerminar}>Saltar</button>
      </div>

      <div className="bienvenida-cuerpo" key={paso}>
        {paso === 0 && <>
          <Personaje nombre="sofia" />
          <h1>{nombre ? '¡Hola, ' + nombre + '!' : '¡Hola!'}</h1>
          <p>Soy Sofía. En un minuto te muestro cómo se usa la app con una <b>venta de práctica</b>. Tranqui: nada de lo que toques acá se anota de verdad.</p>
        </>}

        {paso === 1 && <>
          <span className="guia-paso">Práctica · paso 1 de 2</span>
          <h1>Te piden un granizado</h1>
          <p>Toca el sabor que te pidieron. El número de la esquina es cuántos te quedan de ese.</p>
          <div className="grid guia-demo">
            {sabores.map((p, i) => <TarjetaProducto key={p.id} p={p} indice={i} onClick={() => escoger(p)} />)}
          </div>
          <span className="guia-dedo" aria-hidden="true">👆 toca uno</span>
        </>}

        {paso === 2 && elegido && <>
          <span className="guia-paso">Práctica · paso 2 de 2</span>
          <h1>¿Cómo te pagó?</h1>
          <p>Toca Nequi o Efectivo y ya quedó anotada. Son solo dos toques por venta.</p>
          <div className="guia-panel">
            <h2>{elegido.nombre}</h2>
            <div className="panel-total">{pesos(elegido.precio)}</div>
            {gana > 0 && <p className="ganas-venta">Con esta venta ganas <b>{pesos(gana)}</b></p>}
            <div className="pay">
              <button className="big nequi" onClick={() => cobrar('Nequi')}>Nequi</button>
              <button className="big cash" onClick={() => cobrar('Efectivo')}>Efectivo</button>
            </div>
          </div>
          <span className="guia-dedo" aria-hidden="true">👆 toca cómo pagó</span>
        </>}

        {paso === 3 && <>
          <ChuloVenta />
          <Personaje nombre="exito" />
          <h1>¡Listo, así de fácil!</h1>
          <p>
            Vendiste {elegido ? 'un ' + elegido.sabor : 'un granizado'} {metodo === 'Nequi' ? 'por Nequi' : 'en efectivo'}
            {gana > 0 && <> y te ganaste <b>{pesos(gana)}</b></>}. (Era de práctica, no se anotó.)
          </p>
          <ul className="bienvenida-lista">
            <li>¿Te equivocaste? Toca <b>Deshacer</b> en el aviso que sale abajo, o bórrala después en Mi día.</li>
            <li>¿Pagó por Nequi? Puedes tomarle <b>foto al comprobante</b>.</li>
            <li>¿Llegó mucha gente? Prende <b>⚡ Varios a la vez</b> y cobras todo junto.</li>
            <li>Sin señal sigues vendiendo: todo se sube solo cuando vuelve.</li>
          </ul>
        </>}

        {paso === 4 && <>
          <Personaje nombre="nova" />
          <h1>Tu plata, siempre a la vista</h1>
          <p>Arriba a la izquierda ves <b>lo que llevas ganado hoy</b>. Sube con cada venta.</p>
          <ul className="bienvenida-lista">
            {gana > 0 && <li>Por cada granizado ganas cerca de <b>{pesos(gana)}</b>.</li>}
            {primerPremio
              ? <li>Si vendes <b>{primerPremio.granizados}</b> en el día te ganas <b>{pesos(primerPremio.total)}</b> de premio, y hay más premios si sigues. La barra te dice cuánto te falta.</li>
              : <li>Ponte una meta al empezar: la app te dice cuánto te harías si la cumples.</li>}
            <li>En <b>Mi día</b> la app calcula cuánto te vas a hacer hoy y en la semana, según cómo vienes vendiendo.</li>
            {premios && <li>
              {premios.gratis > 0
                ? <>Tienes {premios.gratis === 1 ? 'un granizado gratis' : premios.gratis + ' granizados gratis'} al día. </>
                : <>Si te tomas uno, se descuenta de tu pago. </>}
              Anótalo tocando el sabor y luego <b>«Me lo tomo yo»</b>.
            </li>}
          </ul>
        </>}

        {paso === 5 && <>
          <Personaje nombre="sofia" />
          <h1>Al terminar tu día</h1>
          <p>Abajo tienes dos pestañas: <b>Vender</b> y <b>Mi día</b>.</p>
          <ul className="bienvenida-lista">
            <li>En <b>Mi día</b> ves tus ventas, lo que ganaste y lo que te queda de tu carga.</li>
            <li>Cuando acabes toca <b>«Terminé mi día»</b>: te dice cuánta plata entregas y qué devuelves.</li>
            <li>¿Dudas? El botón <b>?</b> de arriba te explica cada pantalla, y esta guía la puedes repetir en Mi día.</li>
          </ul>
        </>}
      </div>

      <div className="bienvenida-pie">
        {paso > 0 && paso !== 3 && <button className="big ghost" onClick={() => setPaso(paso === 2 ? 1 : paso - 1)}>Atrás</button>}
        {paso === 0 && <button className="big primario" onClick={() => setPaso(1)}>Empezar la práctica</button>}
        {(paso === 3 || paso === 4) && <button className="big primario" onClick={() => setPaso(paso + 1)}>Siguiente</button>}
        {paso === 5 && <button className="big primario" onClick={onTerminar}>¡A vender!</button>}
      </div>
    </div>
  )
}
