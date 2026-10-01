import { useState } from 'react'
import { pesos } from '../formato'
import type { Producto } from '../tipos'

/**
 * Cuántos granizados hay en total y cuánto dejarían al venderse. Se calcula con los productos que ya están en el
 * celular, así que funciona sin señal. Va discreto: una línea que se abre al tocarla.
 */
export function ResumenInventario({ productos }: { productos: Producto[] }) {
  const [abierto, setAbierto] = useState(false)

  const unidades = productos.reduce((a, p) => a + p.stock, 0)
  const invertido = productos.reduce((a, p) => a + p.stock * p.costo, 0)
  const venta = productos.reduce((a, p) => a + p.stock * p.precio, 0)
  const faltaCosto = productos.some(p => p.stock > 0 && p.costo === 0)

  return (
    <div className="resumen-inv">
      <button type="button" className="resumen-inv-fila" aria-expanded={abierto} onClick={() => setAbierto(a => !a)}>
        <span><b>{unidades}</b> granizado{unidades === 1 ? '' : 's'} en inventario</span>
        <span className="mut">{abierto ? 'Ocultar' : 'Ver ganancia'}</span>
      </button>
      {abierto && (
        <div className="resumen-inv-detalle">
          <div className="pago-fila"><span className="mut">Invertido (a costo)</span>
            <span style={{ marginLeft: 'auto' }}>{pesos(invertido)}</span></div>
          <div className="pago-fila"><span className="mut">Valor si lo vendes todo</span>
            <span style={{ marginLeft: 'auto' }}>{pesos(venta)}</span></div>
          <div className="pago-fila"><b>Ganancia que dejaría</b>
            <b style={{ marginLeft: 'auto' }}>{pesos(venta - invertido)}</b></div>
          {faltaCosto && <p className="aviso">Hay sabores sin costo: pónselo en Ajustes para que esta cuenta sea exacta.</p>}
        </div>
      )}
    </div>
  )
}
