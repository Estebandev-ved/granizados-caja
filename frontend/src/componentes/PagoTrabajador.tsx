import { useState } from 'react'
import { pesos } from '../formato'
import type { MetodoPagoEquipo, PagoEquipo } from '../tipos'
import { CampoNumero } from './CampoNumero'
import { Personaje } from './Personaje'

export function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' })
}

export const ETIQUETA_PAGO: Record<PagoEquipo['estado'], string> = {
  PENDIENTE: 'Esperando que confirme',
  CONFIRMADO: 'Confirmado',
  DISPUTADO: 'Dice que no le llegó',
  ANULADO: 'Anulado',
}

/** El dueño dice "ya le pagué": escoge cómo y confirma. Esto reinicia las cuentas del trabajador. */
export function PagarTrabajador({ nombre, comision, bonos, unidades, onPagar }: {
  nombre: string
  comision: number
  bonos: number
  unidades: number
  onPagar: (metodo: MetodoPagoEquipo, monto: number) => Promise<void>
}) {
  const [metodo, setMetodo] = useState<MetodoPagoEquipo>('EFECTIVO')
  const [enviando, setEnviando] = useState(false)
  const debido = comision + bonos
  const [texto, setTexto] = useState(String(debido))
  const monto = Number(texto) || 0

  const pagar = async () => {
    if (enviando || monto <= 0) return
    setEnviando(true)
    try {
      await onPagar(metodo, monto)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <h2>Pagarle a {nombre}</h2>
      <div className="pago-monto">
        <span>Le corresponde por {unidades} granizado{unidades === 1 ? '' : 's'}</span>
        <b>{pesos(debido)}</b>
        {bonos > 0 && <span className="mut">{pesos(comision)} de comisión + {pesos(bonos)} de premios</span>}
      </div>
      <div className="campo">
        <label htmlFor="pago-monto">¿Cuánto le das?</label>
        <CampoNumero id="pago-monto" max={9} value={texto} onCambio={setTexto} />
        {monto !== debido && monto > 0 && (
          <span className="mut">
            {monto < debido ? 'Le das ' + pesos(debido - monto) + ' menos de lo que le corresponde.' : 'Le das ' + pesos(monto - debido) + ' más de lo que le corresponde.'}
            {' '}Sus cuentas arrancan de cero igual.
          </span>
        )}
      </div>
      <div className="campo">
        <label>¿De dónde sale la plata?</label>
        <div className="chips" role="radiogroup">
          <button type="button" role="radio" aria-checked={metodo === 'EFECTIVO'} className={metodo === 'EFECTIVO' ? 'on' : ''}
            onClick={() => setMetodo('EFECTIVO')}>De la caja, en efectivo</button>
          <button type="button" role="radio" aria-checked={metodo === 'NEQUI'} className={metodo === 'NEQUI' ? 'on' : ''}
            onClick={() => setMetodo('NEQUI')}>Por Nequi</button>
        </div>
      </div>
      <p className="mut">
        Sus cuentas arrancan de cero desde ahora. A {nombre} le llega la pregunta «¿te pagaron?» en su celular
        {metodo === 'EFECTIVO' ? ' y firma un paz y salvo aceptando que recibió la plata.' : ' y confirma que le llegó el Nequi.'}
      </p>
      <div className="acciones">
        <button className="big primario" disabled={enviando || monto <= 0} onClick={() => void pagar()}>
          {enviando ? 'Guardando…' : monto > 0 ? 'Sí, ya le pagué ' + pesos(monto) : 'Escribe el monto'}
        </button>
      </div>
    </>
  )
}

/** Lo que ve el trabajador: «el dueño dice que te pagó, ¿es cierto?». En efectivo, firma el paz y salvo con su nombre. */
export function ConfirmarPago({ pago, onResponder }: {
  pago: PagoEquipo
  onResponder: (recibido: boolean, firma?: string) => Promise<void>
}) {
  const [firma, setFirma] = useState('')
  const [acepto, setAcepto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [negando, setNegando] = useState(false)
  const efectivo = pago.metodo === 'EFECTIVO'
  const listo = !efectivo || (acepto && firma.trim().length >= 3)

  const responder = async (recibido: boolean) => {
    if (enviando) return
    setEnviando(true)
    try {
      await onResponder(recibido, recibido && efectivo ? firma.trim() : undefined)
    } finally {
      setEnviando(false)
    }
  }

  if (negando) {
    return (
      <>
        <Personaje nombre="nova" libre />
        <h2>¿No te han pagado?</h2>
        <p>Le avisamos al dueño que no recibiste los {pesos(pago.monto)}. Él lo revisa contigo.</p>
        <div className="acciones">
          <button className="big peligro" disabled={enviando} onClick={() => void responder(false)}>Sí, no me han pagado</button>
          <button className="big ghost" onClick={() => setNegando(false)}>Volver</button>
        </div>
      </>
    )
  }

  return (
    <>
      <h2>¿Te pagaron {pesos(pago.monto)}?</h2>
      <p>
        El dueño dice que te pagó {efectivo ? 'en efectivo' : 'por Nequi'} tus comisiones{pago.bonos > 0 ? ' y premios' : ''} de {pago.unidades} granizado{pago.unidades === 1 ? '' : 's'}.
      </p>
      {efectivo && pago.texto && (
        <div className="paz-y-salvo">
          {pago.texto.split('\n').map((l, i) => i === 0 ? <h3 key={i}>{l}</h3> : <p key={i}>{l}</p>)}
          <div className="campo">
            <label htmlFor="paz-firma">Tu firma: escribe tu nombre completo</label>
            <input id="paz-firma" maxLength={80} autoComplete="name" value={firma} onChange={e => setFirma(e.target.value)}
              placeholder="Nombre y apellido" />
          </div>
          <label className="terminos-check">
            <input type="checkbox" checked={acepto} onChange={e => setAcepto(e.target.checked)} />
            <span>Recibí la plata y acepto el paz y salvo.</span>
          </label>
        </div>
      )}
      <div className="acciones">
        <button className="big primario" disabled={!listo || enviando} onClick={() => void responder(true)}>
          {enviando ? 'Guardando…' : efectivo ? 'Firmar y confirmar' : 'Sí, me llegó'}
        </button>
        <button className="big ghost" disabled={enviando} onClick={() => setNegando(true)}>No me han pagado</button>
      </div>
    </>
  )
}
