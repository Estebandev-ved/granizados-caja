import { useEffect, useRef, useState, type ReactNode } from 'react'
import { sesion } from './api'
import { BarraMeta } from './componentes/BarraMeta'
import { Confeti } from './componentes/Confeti'
import { Marca } from './componentes/Marca'
import { Personaje } from './componentes/Personaje'
import { useToast } from './componentes/Toast'
import { pesos, vibrar } from './formato'
import { useCaja, type EstadoSync } from './useCaja'
import { Ajustes } from './vistas/Ajustes'
import { Hoy } from './vistas/Hoy'
import { Inventario } from './vistas/Inventario'
import { Login } from './vistas/Login'
import { Reportes } from './vistas/Reportes'
import { Vender } from './vistas/Vender'

type Vista = 'vender' | 'inventario' | 'hoy' | 'reportes' | 'ajustes'

export default function App() {
  const [conSesion, setConSesion] = useState(() => !!sesion.token)
  const { avisar, toast } = useToast()

  useEffect(() => {
    const alCambiar = () => setConSesion(!!sesion.token)
    window.addEventListener('gz:sesion', alCambiar)
    return () => window.removeEventListener('gz:sesion', alCambiar)
  }, [])

  return (
    <>
      {conSesion ? <Caja avisar={avisar} /> : <Login onEntrar={() => setConSesion(true)} />}
      {toast}
    </>
  )
}

const TEXTO_SYNC: Record<EstadoSync, string> = { 'al-dia': 'al día', pendiente: 'pendientes', 'sin-senal': 'sin señal' }

function Caja({ avisar }: { avisar: (m: string) => void }) {
  const [vista, setVista] = useState<Vista>('vender')
  const caja = useCaja(avisar)
  const { estado, cola, sync } = caja

  const irA = (v: Vista) => { setVista(v); window.scrollTo(0, 0) }
  const textoSync = cola.length ? `${cola.length} pendiente${cola.length > 1 ? 's' : ''}` : TEXTO_SYNC[sync]

  // Celebrar la meta una sola vez al día, y solo cuando se cruza por una venta de verdad
  const [celebrando, setCelebrando] = useState(false)
  const totalAnterior = useRef<number | null>(null)

  useEffect(() => {
    if (!estado) return
    const antes = totalAnterior.current
    totalAnterior.current = estado.hoy.total
    const valor = estado.meta.valor
    if (antes === null || valor <= 0 || antes >= valor || estado.hoy.total < valor) return

    let ya: string | null = null
    try { ya = localStorage.getItem('gz_meta_celebrada') } catch { /* modo privado */ }
    if (ya === estado.dia) return
    try { localStorage.setItem('gz_meta_celebrada', estado.dia) } catch { /* modo privado */ }

    vibrar()
    let fin: number | undefined
    // En un timeout para no montar y pintar todo en la misma pasada de React
    const arranque = window.setTimeout(() => {
      setCelebrando(true)
      avisar(`🎉 ¡Meta cumplida! racha ${estado.meta.racha + 1}`)
      fin = window.setTimeout(() => setCelebrando(false), 2000)
    }, 0)
    return () => { window.clearTimeout(arranque); window.clearTimeout(fin) }
  }, [estado, avisar])

  let contenido: ReactNode
  if (!estado) {
    contenido = <div className="vacio">
      <Personaje nombre={sync === 'sin-senal' ? 'error' : 'carga'} />
      {sync === 'sin-senal' ? 'La primera vez necesitas señal para cargar los sabores.' : 'Cargando…'}
    </div>
  } else if (vista === 'vender') {
    contenido = <Vender productos={estado.productos} onVender={(p, metodo, cantidad) => {
      caja.vender(p, metodo, cantidad)
      avisar('✓ ' + (cantidad > 1 ? cantidad + ' ' : '') + p.nombre + ' · ' + (metodo === 'NEQUI' ? 'Nequi' : 'Efectivo'))
    }} />
  } else if (vista === 'inventario') {
    contenido = <Inventario productos={estado.productos} pedido={estado.pedido}
      onReponer={(p, cantidad) => { caja.reponer(p, cantidad); avisar('+' + cantidad + ' ' + p.nombre) }}
      onContar={(p, real) => { caja.contar(p, real); avisar('✓ ' + p.nombre + ' en ' + real) }}
      onContarTodo={(ps, reales) => { caja.contarTodo(ps, reales); avisar('✓ Conteo guardado') }}
      onMerma={(p, cantidad, motivo) => { caja.mermar(p, cantidad, motivo); avisar('−' + cantidad + ' ' + p.nombre) }}
      onLlego={(pedidoId, items, pagoLugar) => {
        caja.llegoElPedido(pedidoId, items, pagoLugar)
        avisar('✓ Llegada anotada · ' + items.reduce((a, l) => a + l.cantidad, 0) + ' unidades')
      }}
      onCancelar={caja.cancelarPedido}
      avisar={avisar} />
  } else if (vista === 'hoy') {
    contenido = <Hoy estado={estado} onDeshacer={caja.deshacer} onRecargar={caja.recargar}
      onLlego={(pedidoId, items, pagoLugar) => {
        caja.llegoElPedido(pedidoId, items, pagoLugar)
        avisar('✓ Llegada anotada · ' + items.reduce((a, l) => a + l.cantidad, 0) + ' unidades')
      }}
      onCancelar={caja.cancelarPedido}
      onGasto={caja.registrarGasto}
      onCerrarCaja={caja.cerrarCaja}
      avisar={avisar} />
  } else if (vista === 'reportes') {
    contenido = <Reportes avisar={avisar} />
  } else {
    contenido = <Ajustes avisar={avisar} onCambio={caja.recargar} />
  }

  return (
    <>
      <header>
        <div className="hoy-mini">
          {pesos(estado?.hoy.total ?? 0)}
          <small>hoy · {estado?.hoy.unidades ?? 0} vendido{estado?.hoy.unidades === 1 ? '' : 's'}</small>
        </div>
        <div className="derecha">
          <Marca compacta />
          <div className="sync"><span className={'dot ' + sync} />{textoSync}</div>
        </div>
      </header>
      {estado && (
        <div className="meta-envoltorio">
          <BarraMeta total={estado.hoy.total} meta={estado.meta.valor} racha={estado.meta.racha} />
        </div>
      )}
      <main>{contenido}</main>
      {celebrando && <Confeti />}
      <nav>
        <BotonNav activa={vista === 'vender'} onClick={() => irA('vender')} texto="Vender">
          <path d="M7 3h10l-1.5 18h-7z" /><path d="M6 8h12" />
        </BotonNav>
        <BotonNav activa={vista === 'inventario'} onClick={() => irA('inventario')} texto="Inventario">
          <path d="M12 5v14M5 12h14" />
        </BotonNav>
        <BotonNav activa={vista === 'hoy'} onClick={() => irA('hoy')} texto="Hoy">
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </BotonNav>
        <BotonNav activa={vista === 'reportes'} onClick={() => irA('reportes')} texto="Reportes">
          <path d="M4 20V4M4 20h16M8 16v-5M13 16V8M18 16v-9" />
        </BotonNav>
        <BotonNav activa={vista === 'ajustes'} onClick={() => irA('ajustes')} texto="Ajustes">
          <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
        </BotonNav>
      </nav>
    </>
  )
}

function BotonNav({ activa, onClick, texto, children }: { activa: boolean; onClick: () => void; texto: string; children: ReactNode }) {
  return (
    <button className={activa ? 'on' : ''} onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{children}</svg>
      {texto}
    </button>
  )
}
