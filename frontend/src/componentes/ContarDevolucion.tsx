import { useEffect, useState } from 'react'
import { api } from '../api'
import { diaBogota } from '../estadoLocal'
import { pesos } from '../formato'
import type { PorContar, Producto, ResultadoConteo, Trabajador } from '../tipos'
import { Icono } from './Icono'
import { fechaHora } from './PagoTrabajador'
import { Personaje } from './Personaje'

type Dia = 'hoy' | 'ayer'

/**
 * Al terminar el día cuentas lo que te devuelve el trabajador, sabor por sabor. La app lo compara con lo que debería
 * quedarle (lo que llevó menos lo que anotó) y lo que falte se le descuenta de su pago al precio de venta. Contar otra
 * vez no cobra dos veces. Necesita señal.
 */
export function ContarDevolucion({ t, productos, onCambio }: { t: Trabajador; productos: Producto[]; onCambio: () => void }) {
  const [dia, setDia] = useState<Dia>('hoy')
  const [datos, setDatos] = useState<PorContar | null | 'error'>(null)
  const [contados, setContados] = useState<Record<number, number>>({})
  const [resultado, setResultado] = useState<ResultadoConteo | null>(null)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const fecha = dia === 'hoy' ? diaBogota() : diaBogota(Date.now() - 86_400_000)

  useEffect(() => {
    let vivo = true
    setDatos(null)
    setResultado(null)
    setError('')
    api.porContar(t.id, fecha)
      .then(d => {
        if (!vivo) return
        setDatos(d)
        // Arranca en lo que la app dice que le queda: tú cuentas y ajustas con − y +
        setContados(Object.fromEntries(d.filas.map(f => [f.productoId, f.queda])))
      })
      .catch(() => { if (vivo) setDatos('error') })
    return () => { vivo = false }
  }, [t.id, fecha])

  const precio = (id: number) => productos.find(p => p.id === id)?.precio ?? 0
  const filas = datos && datos !== 'error' ? datos.filas : []
  const faltan = filas.reduce((a, f) => a + Math.max(0, f.queda - (contados[f.productoId] ?? f.queda)), 0)
  const descuento = filas.reduce((a, f) => a + Math.max(0, f.queda - (contados[f.productoId] ?? f.queda)) * precio(f.productoId), 0)
  const cambiar = (id: number, delta: number) => setContados(c => ({ ...c, [id]: Math.max(0, Math.min(999, (c[id] ?? 0) + delta)) }))

  const guardar = async () => {
    if (enviando || !filas.length) return
    setEnviando(true)
    setError('')
    try {
      const r = await api.contarDevolucion(t.id, fecha, filas.map(f => ({ productoId: f.productoId, devolvio: contados[f.productoId] ?? 0 })))
      setResultado(r)
      onCambio()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar, revisa la señal.')
    } finally {
      setEnviando(false)
    }
  }

  const volverAContar = () => {
    setResultado(null)
    api.porContar(t.id, fecha).then(d => {
      setDatos(d)
      setContados(Object.fromEntries(d.filas.map(f => [f.productoId, f.queda])))
    }).catch(() => setDatos('error'))
  }

  if (resultado) {
    const c = resultado.conteo
    return (
      <div className="list conteo">
        <Personaje nombre={c.faltaron > 0 ? 'error' : 'exito'} />
        {c.faltaron > 0 ? (
          <>
            <h3>Faltaron {c.faltaron}</h3>
            <p>Se le descuentan <b>{pesos(c.cobrado)}</b> de su próximo pago, al precio de venta, como dicen sus términos. Ya lo ve en Mi día.</p>
          </>
        ) : <h3>Todo cuadró ✓</h3>}
        {resultado.filas.filter(f => f.faltan > 0 || f.sobran > 0).map(f => (
          <div className="row" key={f.productoId}>
            <span>{f.nombre}</span>
            <b className={f.faltan > 0 ? 'conteo-mal' : ''}>{f.faltan > 0 ? 'faltaron ' + f.faltan + ' · −' + pesos(f.cobrado) : 'sobró ' + f.sobran}</b>
          </div>
        ))}
        {c.sobraron > 0 && (
          <p className="mut">Devolvió más de lo que dice la app: puede que anotó una venta que no hizo. Revisa sus ventas en Hoy → Ventas de hoy.</p>
        )}
        {c.faltaron > 0 && (
          <p className="mut">Si fue un error (por ejemplo, sí los vendió y te dio la plata), borra el faltante en Hoy → Ventas de hoy.</p>
        )}
        <div className="acciones">
          <button className="big ghost" onClick={volverAContar}>Contar otra vez</button>
        </div>
      </div>
    )
  }

  return (
    <div className="list conteo">
      <h3><Icono nombre="caja" /> ¿Cuánto te devolvió?</h3>
      <p className="mut" style={{ margin: '0 0 8px' }}>
        Cuenta lo que te entrega de cada sabor y ajusta con − y +. La app lo compara con lo que debería quedarle; lo que falte se le descuenta solo.
      </p>
      <div className="chips">
        <button className={dia === 'hoy' ? 'on' : ''} onClick={() => setDia('hoy')}>Lo de hoy</button>
        <button className={dia === 'ayer' ? 'on' : ''} onClick={() => setDia('ayer')}>Lo de ayer</button>
      </div>
      {datos === null && <p className="mut">Trayendo su carga…</p>}
      {datos === 'error' && <p className="aviso">No se pudo traer su carga, revisa la señal.</p>}
      {datos && datos !== 'error' && (
        <>
          {datos.ultimo && (
            <p className="conteo-ya">
              Ya lo contaste {fechaHora(datos.ultimo.contadoEn)}
              {datos.ultimo.faltaron > 0 ? ': faltaron ' + datos.ultimo.faltaron + ', se le descontaron ' + pesos(datos.ultimo.cobrado) : ': todo cuadró'}.
              {' '}Si cuentas otra vez, solo se descuenta lo que falte de más.
            </p>
          )}
          {!filas.length && <p className="mut">{dia === 'hoy' ? 'Hoy no le diste carga.' : 'Ayer no le diste carga.'}</p>}
          {filas.map(f => {
            const n = contados[f.productoId] ?? f.queda
            const dif = n - f.queda
            return (
              <div className="conteo-fila" key={f.productoId}>
                <div>
                  <b>{f.nombre}</b>
                  <small className="mut">llevó {f.llevo} · salieron {f.vendi} · le deben quedar {f.queda}</small>
                  {dif < 0 && <small className="conteo-mal">faltan {-dif} · −{pesos(-dif * precio(f.productoId))}</small>}
                  {dif > 0 && <small className="mut">sobra{dif === 1 ? '' : 'n'} {dif}</small>}
                </div>
                <div className="qty compacta">
                  <button aria-label={'Uno menos de ' + f.nombre} onClick={() => cambiar(f.productoId, -1)}>−</button>
                  <span>{n}</span>
                  <button aria-label={'Uno más de ' + f.nombre} onClick={() => cambiar(f.productoId, 1)}>+</button>
                </div>
              </div>
            )
          })}
          {error && <p className="aviso">{error}</p>}
          {filas.length > 0 && (
            <div className="acciones">
              <button className="big primario" disabled={enviando} onClick={() => void guardar()}>
                {faltan > 0 ? 'Faltan ' + faltan + ': descontarle ' + pesos(descuento) : 'Todo está: guardar el conteo'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
