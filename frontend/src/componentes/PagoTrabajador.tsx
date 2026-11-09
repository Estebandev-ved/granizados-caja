import { useState } from 'react'
import { pesos } from '../formato'
import type { DatosPagoEquipo } from '../api'
import type { MetodoPagoEquipo, PagoEquipo } from '../tipos'
import { CampoNumero } from './CampoNumero'
import { Unidades } from './Unidades'
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

/** Cómo se pagó, en pocas palabras: «Efectivo», «Nequi» o las dos partes con su monto. */
export function comoSePago(p: Pick<PagoEquipo, 'metodo' | 'monto' | 'montoEfectivo'>): string {
  if (p.metodo === 'EFECTIVO') return 'Efectivo'
  if (p.metodo === 'NEQUI') return 'Nequi'
  const efectivo = p.montoEfectivo ?? 0
  return pesos(efectivo) + ' efectivo + ' + pesos(p.monto - efectivo) + ' Nequi'
}

const METODOS_PAGO: { valor: MetodoPagoEquipo; texto: string }[] = [
  { valor: 'EFECTIVO', texto: 'Todo en efectivo' },
  { valor: 'NEQUI', texto: 'Todo por Nequi' },
  { valor: 'MIXTO', texto: 'Parte y parte' },
]

/**
 * El dueño dice "ya le pagué": cuánto, cómo (efectivo, Nequi o una parte de cada uno) y, si le da menos de lo que
 * le toca, si el resto se lo queda debiendo. Esto reinicia las cuentas del trabajador.
 */
export function PagarTrabajador({ nombre, comision, bonos, unidades, saldoAnterior = 0, consumos = 0, onPagar }: {
  nombre: string
  comision: number
  bonos: number
  unidades: number
  /** Lo que quedó pendiente de su último pago. */
  saldoAnterior?: number
  /** Lo que se le descuenta por los granizados que se tomó. */
  consumos?: number
  onPagar: (pago: DatosPagoEquipo) => Promise<void>
}) {
  const [metodo, setMetodo] = useState<MetodoPagoEquipo>('EFECTIVO')
  const [enviando, setEnviando] = useState(false)
  const debido = comision + bonos + saldoAnterior - consumos
  const [texto, setTexto] = useState(String(debido))
  const [textoEfectivo, setTextoEfectivo] = useState('')
  const [quedaDebiendo, setQuedaDebiendo] = useState(true)
  const monto = Number(texto) || 0
  const enEfectivo = Number(textoEfectivo) || 0
  const porNequi = monto - enEfectivo
  const falta = debido - monto
  const mixtoMal = metodo === 'MIXTO' && (enEfectivo <= 0 || enEfectivo >= monto)
  const recibeEfectivo = metodo !== 'NEQUI'

  const pagar = async () => {
    if (enviando || monto <= 0 || mixtoMal) return
    setEnviando(true)
    try {
      await onPagar({ metodo, monto, montoEfectivo: metodo === 'MIXTO' ? enEfectivo : undefined, quedaDebiendo: falta > 0 && quedaDebiendo })
    } finally {
      setEnviando(false)
    }
  }

  const partes = [
    comision > 0 || bonos > 0 ? pesos(comision) + ' de comisión' : '',
    bonos > 0 ? pesos(bonos) + ' de premios' : '',
    saldoAnterior > 0 ? pesos(saldoAnterior) + ' que le quedaste debiendo' : '',
  ].filter(Boolean)
  const desglose = partes.join(' + ') + (consumos > 0 ? ' − ' + pesos(consumos) + ' de lo que se tomó' : '')

  return (
    <>
      <h2>Pagarle a {nombre}</h2>
      <div className="pago-monto">
        <span>Le corresponde por <Unidades n={unidades} /></span>
        <b>{pesos(debido)}</b>
        {(partes.length > 1 || consumos > 0) && <span className="mut">{desglose}</span>}
      </div>
      <div className="campo">
        <label htmlFor="pago-monto">¿Cuánto le das en total?</label>
        <CampoNumero id="pago-monto" miles max={9} value={texto} onCambio={setTexto} />
      </div>
      <div className="campo">
        <label>¿Cómo le pagas?</label>
        <div className="chips izq" role="radiogroup" aria-label="Cómo le pagas">
          {METODOS_PAGO.map(m => (
            <button type="button" role="radio" aria-checked={metodo === m.valor} key={m.valor}
              className={metodo === m.valor ? 'on' : ''} onClick={() => setMetodo(m.valor)}>{m.texto}</button>
          ))}
        </div>
      </div>
      {metodo === 'MIXTO' && (
        <div className="campo">
          <label htmlFor="pago-efectivo">¿Cuánto de eso en efectivo?</label>
          <CampoNumero id="pago-efectivo" miles max={9} placeholder="0" value={textoEfectivo} onCambio={setTextoEfectivo} />
          {enEfectivo > 0 && enEfectivo < monto
            ? <div className="pago-partes"><span>Efectivo <b>{pesos(enEfectivo)}</b></span><span>Nequi <b>{pesos(porNequi)}</b></span></div>
            : <small>{enEfectivo >= monto && monto > 0 ? 'Tiene que ser menos que los ' + pesos(monto) + ' del total.' : 'El resto se cuenta como Nequi.'}</small>}
        </div>
      )}
      {monto > 0 && falta > 0 && (
        <div className="campo">
          <label>¿Y los {pesos(falta)} que faltan?</label>
          <div className="chips izq" role="radiogroup" aria-label="Qué pasa con lo que falta">
            <button type="button" role="radio" aria-checked={quedaDebiendo} className={quedaDebiendo ? 'on' : ''}
              onClick={() => setQuedaDebiendo(true)}>Se los pago después</button>
            <button type="button" role="radio" aria-checked={!quedaDebiendo} className={!quedaDebiendo ? 'on' : ''}
              onClick={() => setQuedaDebiendo(false)}>No se los debo</button>
          </div>
          <small>
            {quedaDebiendo
              ? 'Quedan pendientes: te siguen saliendo en «Por pagarle» para que se los des después, en efectivo o por Nequi.'
              : 'Sus cuentas arrancan de cero: esa plata ya no se le debe (por ejemplo, un descuento que acordaron).'}
          </small>
        </div>
      )}
      {monto > debido && <p className="mut">Le das {pesos(monto - debido)} más de lo que le corresponde.</p>}
      <p className="mut">
        {falta > 0 && quedaDebiendo ? 'Lo de hoy queda anotado como abono.' : 'Sus cuentas arrancan de cero desde ahora.'}
        {' '}A {nombre} le llega la pregunta «¿te pagaron?» en su celular
        {recibeEfectivo ? ' y firma un paz y salvo aceptando que recibió la plata.' : ' y confirma que le llegó el Nequi.'}
      </p>
      <div className="acciones">
        <button className="big primario" disabled={enviando || monto <= 0 || mixtoMal} onClick={() => void pagar()}>
          {enviando ? 'Guardando…' : monto <= 0 ? 'Escribe el monto' : mixtoMal ? 'Escribe cuánto fue en efectivo' : 'Sí, ya le pagué ' + pesos(monto)}
        </button>
      </div>
    </>
  )
}

/** Lo que ve el trabajador: «el dueño dice que te pagó, ¿es cierto?». Si recibió efectivo, firma el paz y salvo con su nombre. */
export function ConfirmarPago({ pago, onResponder }: {
  pago: PagoEquipo
  onResponder: (recibido: boolean, firma?: string) => Promise<void>
}) {
  const [firma, setFirma] = useState('')
  const [acepto, setAcepto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [negando, setNegando] = useState(false)
  const efectivo = pago.metodo !== 'NEQUI' // recibió efectivo, todo o una parte: firma el paz y salvo
  const parteEfectivo = pago.montoEfectivo ?? 0
  const pendiente = pago.saldo ?? 0
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
        El dueño dice que te pagó {pago.metodo === 'MIXTO' ? pesos(parteEfectivo) + ' en efectivo y ' + pesos(pago.monto - parteEfectivo) + ' por Nequi por' : pago.metodo === 'EFECTIVO' ? 'en efectivo' : 'por Nequi'} tus comisiones{pago.bonos > 0 ? ' y premios' : ''} de {pago.unidades} granizado{pago.unidades === 1 ? '' : 's'}.
      </p>
      {(pago.consumos ?? 0) > 0 && <p className="mut">Ya van descontados {pesos(pago.consumos ?? 0)} de los granizados que te tomaste.</p>}
      {pendiente > 0 && <p className="mut">Es un abono: te quedan debiendo {pesos(pendiente)}, que te pagan después.</p>}
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
