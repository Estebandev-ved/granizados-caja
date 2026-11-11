import { useState } from 'react'
import { api } from '../api'
import { pesos } from '../formato'
import type { Producto, Trabajador } from '../tipos'
import { Icono } from './Icono'

/**
 * Al cuadrar, faltaron granizados de su carga y no hay cómo explicarlo: se le descuentan de su pago al precio de venta
 * (no al costo), como dicen los términos. Baja el inventario y su carga; se deshace borrándolo en Ventas de hoy.
 */
export function FaltantePanel({ t, productos, onCambio }: { t: Trabajador; productos: Producto[]; onCambio: () => void }) {
  const [abierto, setAbierto] = useState(false)
  // Primero los sabores que llevó hoy; si no tiene carga, todos
  const opciones = t.carga.length
    ? t.carga.map(f => productos.find(p => p.id === f.productoId)).filter((p): p is Producto => !!p)
    : productos
  const [elegido, setElegido] = useState<number | null>(null)
  const [cantidad, setCantidad] = useState(1)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const p = opciones.find(o => o.id === elegido) ?? null
  const valor = p ? p.precio * cantidad : 0

  const guardar = async () => {
    if (!p || enviando) return
    setEnviando(true)
    setError('')
    try {
      await api.anotarFaltante(t.id, p.id, cantidad)
      setAbierto(false)
      setElegido(null)
      setCantidad(1)
      onCambio()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar, revisa la señal.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="list">
      <h3><Icono nombre="caja" /> ¿Las cuentas no dieron?</h3>
      <p className="mut" style={{ margin: '0 0 6px' }}>
        Primero revísenlo juntos. Si falta producto y no hay cómo explicarlo, anótalo acá: se le descuenta al precio de venta, como dicen sus términos.
      </p>
      {!abierto && (
        <button className="big ghost" disabled={!t.activo} onClick={() => setAbierto(true)}>Le faltaron granizados</button>
      )}
      {abierto && (
        <>
          <div className="chips izq" role="radiogroup" aria-label="Qué sabor faltó" style={{ marginBottom: 10 }}>
            {opciones.map(o => (
              <button type="button" role="radio" aria-checked={elegido === o.id} key={o.id} className={elegido === o.id ? 'on' : ''}
                onClick={() => setElegido(o.id)}>{o.nombre}</button>
            ))}
          </div>
          <div className="qty">
            <button aria-label="Menos" onClick={() => setCantidad(c => Math.max(1, c - 1))}>−</button>
            <span>{cantidad}</span>
            <button aria-label="Más" onClick={() => setCantidad(c => Math.min(99, c + 1))}>+</button>
          </div>
          {p && <p className="mut">{cantidad} × {pesos(p.precio)} (precio de venta) = <b>{pesos(valor)}</b> que se le descuentan de su pago.</p>}
          {error && <p className="aviso">{error}</p>}
          <div className="acciones">
            <button className="big primario" disabled={!p || enviando} onClick={() => void guardar()}>
              {p ? 'Descontarle ' + pesos(valor) : 'Escoge el sabor que faltó'}
            </button>
            <button className="big ghost" onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </>
      )}
    </div>
  )
}
