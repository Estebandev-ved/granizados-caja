import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, sesion } from '../api'
import { IconoFaceId, type ModoFaceId } from '../componentes/IconoFaceId'
import { Marca } from '../componentes/Marca'
import { Personaje } from '../componentes/Personaje'
import { activarFaceId, entrarConFaceId, esCancelacion, faceIdActivado, olvidarFaceId, soportaFaceId } from '../faceid'
import { vibrar } from '../formato'

const LARGO_MAX = 8
const NO_PREGUNTAR = 'gz_faceid_no'
const BIENVENIDA = 'gz_bienvenida'

type Paso = 'faceid' | 'pin' | 'ofrecer'

export function Login({ onEntrar }: { onEntrar: () => void }) {
  const [paso, setPaso] = useState<Paso>(() => (faceIdActivado() ? 'faceid' : 'pin'))
  const [modo, setModo] = useState<ModoFaceId>('quieto')
  const [mensaje, setMensaje] = useState('')
  const intentoAutomatico = useRef(false)
  // La bienvenida sale solo la primera vez que se abre la app en este celular
  const [primeraVez] = useState(() => { try { return localStorage.getItem(BIENVENIDA) !== '1' } catch { return false } })

  /** Muestra el chulo un momento y entra, como en el iPhone. */
  const exito = useCallback((token: string) => {
    sesion.guardar(token)
    try { localStorage.setItem(BIENVENIDA, '1') } catch { /* modo privado */ }
    setModo('ok')
    setMensaje('¡Listo!')
    setTimeout(onEntrar, 750)
  }, [onEntrar])

  const conFaceId = useCallback(async (automatico = false) => {
    setModo('escaneando')
    setMensaje('Mirando…')
    try {
      exito(await entrarConFaceId())
    } catch (e) {
      if (esCancelacion(e)) {
        setModo('quieto')
        setMensaje(automatico ? 'Toca para entrar con Face ID' : 'Cancelado')
        return
      }
      if (e instanceof ApiError && e.status === 404) {
        // Quitaron el Face ID desde Ajustes: toca con PIN
        olvidarFaceId()
        setPaso('pin')
        setMensaje('Face ID ya no está activo. Entra con el PIN.')
        return
      }
      vibrar()
      setModo('error')
      setMensaje(e instanceof ApiError ? e.message : 'No se pudo. Revisa la señal.')
      setTimeout(() => setModo('quieto'), 900)
    }
  }, [exito])

  // Al abrir la app intenta Face ID solo. Si iOS pide un toque primero, queda el botón.
  useEffect(() => {
    if (paso !== 'faceid' || intentoAutomatico.current) return
    intentoAutomatico.current = true
    void conFaceId(true)
  }, [paso, conFaceId])

  const alEntrarConPin = async (token: string) => {
    sesion.guardar(token)
    let noPreguntar = false
    try { noPreguntar = localStorage.getItem(NO_PREGUNTAR) === '1' } catch { /* modo privado */ }
    if (!faceIdActivado() && !noPreguntar && await soportaFaceId()) {
      setPaso('ofrecer')
      setModo('quieto')
      setMensaje('')
      return
    }
    onEntrar()
  }

  const activar = async () => {
    setModo('escaneando')
    try {
      await activarFaceId()
      setModo('ok')
      setMensaje('Face ID activado')
      setTimeout(onEntrar, 900)
    } catch (e) {
      setModo(esCancelacion(e) ? 'quieto' : 'error')
      setMensaje(esCancelacion(e) ? 'Cancelado. Puedes activarlo después en Ajustes.' : 'No se pudo activar. Intenta desde Ajustes.')
      if (!esCancelacion(e)) setTimeout(() => setModo('quieto'), 900)
    }
  }

  const ahoraNo = () => {
    try { localStorage.setItem(NO_PREGUNTAR, '1') } catch { /* modo privado */ }
    onEntrar()
  }

  return (
    <div className="login">
      <Marca />
      {primeraVez && <Personaje nombre="bienvenida" />}

      {paso === 'faceid' && (
        <>
          <button className={'faceid-boton' + (modo === 'quieto' ? ' espera' : '')} onClick={() => void conFaceId()}
                  disabled={modo === 'escaneando' || modo === 'ok'} aria-label="Entrar con Face ID">
            <IconoFaceId modo={modo} />
          </button>
          <p className="login-msj">{mensaje || 'Toca para entrar con Face ID'}</p>
          <button className="link" onClick={() => { setPaso('pin'); setMensaje('') }}>Usar PIN</button>
        </>
      )}

      {paso === 'pin' && (
        <TecladoPin mensajeInicial={mensaje} onEntrar={alEntrarConPin}
                    onFaceId={faceIdActivado() ? () => { setPaso('faceid'); void conFaceId() } : undefined} />
      )}

      {paso === 'ofrecer' && (
        <>
          <IconoFaceId modo={modo} />
          <h2 className="login-titulo">¿Entrar con Face ID?</h2>
          <p className="login-msj">{mensaje || 'La próxima vez entras con la cara, sin escribir el PIN.'}</p>
          <div className="login-acciones">
            <button className="big primario" onClick={activar} disabled={modo === 'escaneando' || modo === 'ok'}>Activar Face ID</button>
            <button className="link" onClick={ahoraNo}>Ahora no</button>
          </div>
        </>
      )}
    </div>
  )
}

function TecladoPin({ mensajeInicial, onEntrar, onFaceId }: {
  mensajeInicial: string
  onEntrar: (token: string) => Promise<void>
  onFaceId?: () => void
}) {
  const [pin, setPin] = useState('')
  const [mensaje, setMensaje] = useState(mensajeInicial || 'Escribe tu PIN y dale ✓')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(false)

  const entrar = async () => {
    if (!pin || cargando) return
    setCargando(true)
    try {
      const { token } = await api.login(pin)
      await onEntrar(token)
    } catch (e) {
      vibrar()
      setPin('')
      setError(true)
      setTimeout(() => setError(false), 450)
      setMensaje(e instanceof ApiError ? e.message : 'Sin conexión. Necesitas señal para entrar.')
    } finally {
      setCargando(false)
    }
  }

  const tecla = (t: string) => setPin(p => (p.length < LARGO_MAX ? p + t : p))

  return (
    <>
      <p className="login-msj">{cargando ? 'Entrando…' : mensaje}</p>
      <div className={'puntos' + (error ? ' error' : '')} aria-label={`${pin.length} dígitos`}>
        {Array.from({ length: Math.max(4, pin.length) }, (_, i) => <i key={i} className={i < pin.length ? 'lleno' : ''} />)}
      </div>
      <div className="teclado">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => <button key={n} onClick={() => tecla(n)}>{n}</button>)}
        {onFaceId
          ? <button aria-label="Entrar con Face ID" className="tecla-faceid" onClick={onFaceId}><IconoFaceId modo="quieto" tamano={34} /></button>
          : <button aria-label="Borrar" onClick={() => setPin(p => p.slice(0, -1))}>⌫</button>}
        <button onClick={() => tecla('0')}>0</button>
        <button aria-label="Entrar" className="tecla-ok" onClick={entrar} disabled={!pin || cargando}>✓</button>
      </div>
      {onFaceId && <button className="link" onClick={() => setPin(p => p.slice(0, -1))}>Borrar</button>}
    </>
  )
}
