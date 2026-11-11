import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Ayuda, type TemaAyuda } from './componentes/Ayuda'
import { Bienvenida, CLAVE_BIENVENIDA } from './componentes/Bienvenida'
import { PrimerosPasos } from './componentes/PrimerosPasos'
import { leerPerfil, PerfilContexto } from './perfil'
import { NumeroAnimado } from './componentes/NumeroAnimado'
import { api, sesion } from './api'
import { adjuntarComprobante } from './comprobantes'
import { AvisoActualizacion } from './componentes/AvisoActualizacion'
import { BarraLogros } from './componentes/BarraLogros'
import { BarraMeta } from './componentes/BarraMeta'
import { BarraPremios } from './componentes/BarraPremios'
import { MetaDelDia } from './componentes/MetaDelDia'
import { PagoPreferido } from './componentes/PagoPreferido'
import { NOMBRE_PAGO } from './pagos'
import { TerminosTrabajo } from './componentes/TerminosTrabajo'
import { Confeti } from './componentes/Confeti'
import { Marca } from './componentes/Marca'
import { Personaje } from './componentes/Personaje'
import { nivelAlcanzado } from './logros'
import { hitoNuevo } from './ritmo'
import { useToast, type AccionToast } from './componentes/Toast'
import { pesos, vibrar } from './formato'
import { leerPromos, promosVigentes } from './promo'
import type { Terminos } from './tipos'
import { useCaja, type EstadoSync } from './useCaja'
import { Ajustes } from './vistas/Ajustes'
import { Hoy } from './vistas/Hoy'
import { Inventario } from './vistas/Inventario'
import { Login } from './vistas/Login'
import { MiDia } from './vistas/MiDia'
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
      <AvisoActualizacion />
    </>
  )
}

const TEXTO_SYNC: Record<EstadoSync, string> = { 'al-dia': 'al día', pendiente: 'pendientes', 'sin-senal': 'sin señal' }

function Caja({ avisar }: { avisar: (m: string, accion?: AccionToast) => void }) {
  const [vista, setVista] = useState<Vista>('vender')
  // Un trabajador solo ve Vender y su día (el servidor también se lo exige)
  const trabajador = sesion.esTrabajador
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
      const hito = hitoNuevo(estado.meta.racha + 1)
      avisar(hito ? `🏅 ${hito.nombre}: ${hito.dias} días de racha` : `🎉 ¡Meta cumplida! racha ${estado.meta.racha + 1}`)
      fin = window.setTimeout(() => setCelebrando(false), 2000)
    }, 0)
    return () => { window.clearTimeout(arranque); window.clearTimeout(fin) }
  }, [estado, avisar])

  // Un trabajador celebra al llegar a cada logro de su barra, una sola vez por logro y por día
  const metaEquipo = estado?.metaEquipo ?? null
  const nivelEquipo = metaEquipo ? nivelAlcanzado(metaEquipo) : 0
  const nivelAnterior = useRef<number | null>(null)
  const diaEquipo = estado?.dia
  useEffect(() => {
    if (!trabajador || !metaEquipo || !diaEquipo) { nivelAnterior.current = null; return }
    const antes = nivelAnterior.current
    nivelAnterior.current = nivelEquipo
    if (antes === null || nivelEquipo <= antes) return

    const clave = 'gz_logro_equipo'
    let ya = ''
    try { ya = localStorage.getItem(clave) ?? '' } catch { /* modo privado */ }
    if (ya === diaEquipo + ':' + nivelEquipo) return
    try { localStorage.setItem(clave, diaEquipo + ':' + nivelEquipo) } catch { /* modo privado */ }

    vibrar()
    const arranque = window.setTimeout(() => {
      setCelebrando(true)
      avisar(nivelEquipo === 1 ? '⭐ ¡A medio camino de la meta!'
        : nivelEquipo === 2 ? '🎉 ¡Meta cumplida!' + (metaEquipo.premio > 0 ? ' Ganaste ' + pesos(metaEquipo.premio) : '')
        : '🏆 ¡Súper meta!')
      window.setTimeout(() => setCelebrando(false), 2000)
    }, 0)
    return () => window.clearTimeout(arranque)
  }, [trabajador, metaEquipo, nivelEquipo, diaEquipo, avisar])

  // Un trabajador celebra cada escalón de premio que alcanza, una sola vez por escalón y por día
  const premios = estado?.premios ?? null
  const escalonesAlcanzados = premios ? premios.escalones.filter(e => premios.vendidas >= e.granizados).length : 0
  const premioDelDia = premios?.premio ?? 0
  const escalonAnterior = useRef<number | null>(null)
  useEffect(() => {
    if (!trabajador || !diaEquipo) { escalonAnterior.current = null; return }
    const antes = escalonAnterior.current
    escalonAnterior.current = escalonesAlcanzados
    if (antes === null || escalonesAlcanzados <= antes) return

    const clave = 'gz_escalon'
    let ya = ''
    try { ya = localStorage.getItem(clave) ?? '' } catch { /* modo privado */ }
    if (ya === diaEquipo + ':' + escalonesAlcanzados) return
    try { localStorage.setItem(clave, diaEquipo + ':' + escalonesAlcanzados) } catch { /* modo privado */ }

    vibrar()
    const arranque = window.setTimeout(() => {
      setCelebrando(true)
      avisar('🎉 ¡Ganaste ' + pesos(premioDelDia) + ' de premio!')
      window.setTimeout(() => setCelebrando(false), 2000)
    }, 0)
    return () => window.clearTimeout(arranque)
  }, [trabajador, escalonesAlcanzados, premioDelDia, diaEquipo, avisar])

  // Los términos del trabajo: tiene que aceptarlos para empezar, y otra vez si el dueño cambia tarifas o premios
  const [terminos, setTerminos] = useState<Terminos | null>(null)
  useEffect(() => {
    if (!trabajador) return
    const traer = () => { api.terminos().then(setTerminos).catch(() => { /* sin señal: se sigue trabajando */ }) }
    traer()
    const alVolver = () => { if (document.visibilityState === 'visible') traer() }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [trabajador])

  // La promo que corre hoy: viene del servidor, así el dueño la prende desde Ajustes y la venden todos
  const textoPromo = estado?.promo
  const diaEstado = estado?.dia
  const promos = useMemo(
    () => (diaEstado ? promosVigentes(leerPromos(textoPromo), diaEstado) : []),
    [textoPromo, diaEstado])

  // Bienvenida: solo al dueño, una vez, y solo si su caja está recién estrenada (sin meta ni ventas hoy)
  const [bienvenidaVista, setBienvenidaVista] = useState(() => {
    try { return !!localStorage.getItem(CLAVE_BIENVENIDA) } catch { return false }
  })
  const bienvenida = !trabajador && !bienvenidaVista && !!estado && !estado.perfil && estado.meta.valor === 0 && estado.hoy.unidades === 0
  const textoPerfilServidor = estado?.perfil
  const perfil = useMemo(() => leerPerfil(textoPerfilServidor), [textoPerfilServidor])
  const [ayuda, setAyuda] = useState(false)

  let contenido: ReactNode
  if (!estado) {
    contenido = sync === 'sin-senal'
      ? <div className="vacio"><Personaje nombre="error" />La primera vez necesitas señal para cargar los sabores.</div>
      : <div className="esqueleto" aria-busy="true" aria-label="Cargando">
          <div className="esqueleto-grid">{Array.from({ length: 6 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</div>
        </div>
  } else if (vista === 'vender') {
    contenido = <Vender productos={estado.productos} porSabor={estado.hoy.propias ?? estado.hoy.porSabor} trabajador={trabajador} promos={promos}
      consumo={trabajador && premios ? { gratis: premios.gratis, consumidos: premios.consumidos ?? 0 } : null}
      tarifas={trabajador ? premios?.tarifas ?? null : null}
      onVender={(lineas, metodo, fiado, foto) => {
      const uids = lineas.map(l => caja.vender(l.p, metodo, l.cantidad, l.total, fiado, l.efectivo))
      if (foto) {
        adjuntarComprobante(uids, foto)
          .then(() => avisar('📎 Foto del comprobante guardada'))
          .catch(() => avisar('⚠️ La venta quedó, pero no se pudo leer la foto. Agrégala en Mi día.'))
      }
      const detalle = lineas.map(l => (l.cantidad > 1 ? l.cantidad + ' ' : '') + l.p.nombre).join(' + ')
      avisar('✓ ' + detalle + ' · ' + (metodo === 'NEQUI' ? 'Nequi' : metodo === 'MIXTO' ? 'Efectivo + Nequi' : metodo === 'REGALO' ? 'Regalo 🎁' : metodo === 'CONSUMO' ? 'Te lo tomas tú 🥤' : metodo === 'FIADO' ? 'Fiado a ' + (fiado?.cliente ?? '') : 'Efectivo'),
        { texto: 'Deshacer', alTocar: () => uids.forEach(clientUid => void caja.deshacer({ clientUid })) })
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
  } else if (vista === 'hoy' && trabajador) {
    contenido = <MiDia estado={estado} pago={terminos?.frecuenciaPago ?? null} onDeshacer={caja.deshacer} avisar={avisar}
      onElegirPago={async f => {
        try {
          setTerminos(await api.elegirPago(f))
          avisar('✓ Listo, te pagamos ' + NOMBRE_PAGO[f])
        } catch (e) {
          avisar('⚠️ ' + (e instanceof Error ? e.message : 'No se pudo guardar'))
        }
      }} />
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

  if (trabajador && terminos && !terminos.aceptadaEn) {
    return (
      <main style={{ padding: '0 16px' }}>
        <TerminosTrabajo terminos={terminos} onAceptar={async () => {
          try {
            setTerminos(await api.aceptarTerminos(terminos.version))
            avisar('✓ Listo, a vender')
          } catch (e) {
            avisar('⚠️ ' + (e instanceof Error ? e.message : 'No se pudo guardar'))
            api.terminos().then(setTerminos).catch(() => { /* sin señal */ })
          }
        }} />
      </main>
    )
  }

  if (trabajador && terminos && terminos.aceptadaEn && !terminos.frecuenciaPago) {
    return (
      <main style={{ padding: '0 16px' }}>
        <PagoPreferido actual={null} onElegir={async f => {
          try {
            setTerminos(await api.elegirPago(f))
          } catch (e) {
            avisar('⚠️ ' + (e instanceof Error ? e.message : 'No se pudo guardar'))
          }
        }} />
      </main>
    )
  }

  const temaAyuda: TemaAyuda = trabajador && vista === 'hoy' ? 'dia' : vista

  return (
    <PerfilContexto.Provider value={perfil}>
      <header>
        <div className="hoy-mini">
          <NumeroAnimado valor={trabajador && premios ? Math.max(0, premios.comision + premios.premio - (premios.descuento ?? 0) - (premios.faltantes ?? 0)) : estado?.hoy.total ?? 0} formato={pesos} />
          <small>
            {trabajador && premios ? 'ganado hoy' : 'hoy'} · {estado?.hoy.unidades ?? 0} vendido{estado?.hoy.unidades === 1 ? '' : 's'}
          </small>
        </div>
        <div className="derecha">
          <div className="marca-fila">
            <Marca compacta />
            <button className="ayuda-boton" aria-label="Ayuda" onClick={() => setAyuda(true)}>?</button>
          </div>
          <div className="sync"><span className={'dot ' + sync} />{textoSync}</div>
        </div>
      </header>
      {estado && !trabajador && (
        <div className="meta-envoltorio">
          <BarraMeta total={estado.hoy.total} meta={estado.meta.valor} racha={estado.meta.racha} />
        </div>
      )}
      {estado && trabajador && metaEquipo && (
        <div className="meta-envoltorio">
          <BarraLogros meta={metaEquipo} />
        </div>
      )}
      {estado && trabajador && premios && premios.escalones.length > 0 && (
        <div className="meta-envoltorio">
          <BarraPremios premios={premios} />
        </div>
      )}
      {estado && trabajador && premios && vista === 'vender' && (
        <div className="meta-envoltorio">
          <MetaDelDia premios={premios} dia={estado.dia} onMeta={async n => {
            try {
              await api.ponerMeta(n)
              await caja.recargar()
              avisar('💪 Tu meta de hoy: ' + n)
            } catch (e) {
              avisar('⚠️ ' + (e instanceof Error ? e.message : 'No se pudo guardar, revisa la señal'))
            }
          }} />
        </div>
      )}
      <main><div className="vista" key={vista}>
        {estado && !trabajador && vista === 'vender' && <PrimerosPasos estado={estado} onIr={irA} />}
        {contenido}
      </div></main>
      <Ayuda tema={temaAyuda} abierto={ayuda} onCerrar={() => setAyuda(false)} />
      {bienvenida && <Bienvenida avisar={avisar} tieneProductos={!!estado && estado.productos.length > 0} onTerminar={destino => { setBienvenidaVista(true); caja.recargar(); if (destino === 'ajustes') irA('ajustes') }} />}
      {celebrando && <><Confeti /><div className="logro-flotante"><Personaje nombre="sofia" libre /></div></>}
      <nav>
        <BotonNav activa={vista === 'vender'} onClick={() => irA('vender')} texto="Vender">
          <path d="M7 3h10l-1.5 18h-7z" /><path d="M6 8h12" />
        </BotonNav>
        {!trabajador && (
          <BotonNav activa={vista === 'inventario'} onClick={() => irA('inventario')} texto="Inventario">
            <path d="M12 5v14M5 12h14" />
          </BotonNav>
        )}
        <BotonNav activa={vista === 'hoy'} onClick={() => irA('hoy')} texto={trabajador ? 'Mi día' : 'Hoy'}>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </BotonNav>
        {!trabajador && (
          <BotonNav activa={vista === 'reportes'} onClick={() => irA('reportes')} texto="Reportes">
            <path d="M4 20V4M4 20h16M8 16v-5M13 16V8M18 16v-9" />
          </BotonNav>
        )}
        {!trabajador && (
          <BotonNav activa={vista === 'ajustes'} onClick={() => irA('ajustes')} texto="Ajustes">
            <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
          </BotonNav>
        )}
      </nav>
    </PerfilContexto.Provider>
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
