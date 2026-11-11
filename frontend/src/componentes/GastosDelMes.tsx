import { useState } from 'react'
import { api } from '../api'
import { diaBogota } from '../estadoLocal'
import { pesos } from '../formato'
import { categoriasParaElegir } from '../reportes'
import { avanceDelMes, leerTopes, porDiaQueQueda, serializarTopes, type Topes } from '../topes'
import type { Estado } from '../tipos'
import { CampoNumero } from './CampoNumero'
import { Icono } from './Icono'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/**
 * Hoy → Gastos del mes: en qué se te va la plata este mes, categoría por categoría, contra el tope que le pongas a
 * cada una. Avisa lo que ya se pasó o va casi, y cuánto te queda por día para no pasarte.
 */
export function GastosDelMes({ estado, avisar, onRecargar }: {
  estado: Estado
  avisar: (m: string) => void
  onRecargar: () => Promise<void>
}) {
  const topes = leerTopes(estado.topesGasto)
  const avance = avanceDelMes(estado.gastosMes, topes)
  const total = Object.values(estado.gastosMes ?? {}).reduce((a, n) => a + n, 0)
  const [editando, setEditando] = useState(false)
  const [verTodo, setVerTodo] = useState(false)
  const hoy = diaBogota()
  const mes = MESES[Number(hoy.slice(5, 7)) - 1]
  const pasadas = avance.filter(a => a.estado === 'pasado')
  const casi = avance.filter(a => a.estado === 'casi')
  const visibles = verTodo ? avance : avance.slice(0, 4)

  return (
    <div className="list gastos-mes">
      <h3><Icono nombre="moneda" /> Gastos de {mes}</h3>
      <div className="gastos-mes-total">
        <b>{pesos(total)}</b>
        <span className="mut">{Object.keys(topes).length ? 'gastado este mes' : 'gastado este mes · ponle topes para que te avise'}</span>
      </div>

      {pasadas.length > 0 && (
        <p className="aviso">Te pasaste en {pasadas.map(a => a.nombre + ' (' + pesos(a.gastado - a.tope) + ' de más)').join(', ')}.</p>
      )}
      {casi.map(a => (
        <p className="mut" key={a.categoria}>
          {a.nombre} va en el {a.pct}%: te quedan {pesos(a.tope - a.gastado)}, unos {pesos(porDiaQueQueda(a, hoy))} por día hasta fin de mes.
        </p>
      ))}

      {editando ? (
        <EditarTopes actuales={topes} usadas={[...(estado.categoriasGasto ?? []), ...Object.keys(topes)]}
          onCancelar={() => setEditando(false)}
          onGuardar={async nuevos => {
            try {
              await api.guardarConfig('TOPES_GASTO', serializarTopes(nuevos))
              await onRecargar()
              setEditando(false)
              avisar('✓ Topes guardados')
            } catch (e) {
              avisar('⚠️ ' + (e instanceof Error ? e.message : 'No se pudo guardar, revisa la señal'))
            }
          }} />
      ) : (
        <>
          {visibles.map(a => (
            <div className="tope-fila" key={a.categoria}>
              <div className="sabor-cabeza">
                <span>{a.nombre}</span>
                <b className={a.estado === 'pasado' ? 'aviso' : ''}>{pesos(a.gastado)}{a.tope > 0 && <span className="mut"> de {pesos(a.tope)}</span>}</b>
              </div>
              {a.tope > 0 && (
                <div className={'tope-pista ' + a.estado}>
                  <div className="tope-barra" style={{ width: Math.min(100, a.pct) + '%' }} />
                </div>
              )}
            </div>
          ))}
          {!avance.length && <p className="mut" style={{ margin: 0 }}>Todavía no hay gastos este mes.</p>}
          {avance.length > 4 && (
            <button type="button" className="chip-link" onClick={() => setVerTodo(v => !v)}>{verTodo ? 'Ver menos' : 'Ver todas (' + avance.length + ')'}</button>
          )}
          <button className="big ghost" style={{ marginTop: 10 }} onClick={() => setEditando(true)}>
            {Object.keys(topes).length ? 'Cambiar los topes' : 'Ponerle tope a cada gasto'}
          </button>
        </>
      )}
    </div>
  )
}

function EditarTopes({ actuales, usadas, onGuardar, onCancelar }: {
  actuales: Topes
  usadas: string[]
  onGuardar: (t: Topes) => Promise<void>
  onCancelar: () => void
}) {
  const categorias = categoriasParaElegir(usadas)
  const [valores, setValores] = useState<Record<string, string>>(
    () => Object.fromEntries(categorias.map(c => [c.valor, actuales[c.valor] ? String(actuales[c.valor]) : ''])))
  const [guardando, setGuardando] = useState(false)

  return (
    <form onSubmit={async e => {
      e.preventDefault()
      if (guardando) return
      setGuardando(true)
      const nuevos: Topes = {}
      for (const [c, v] of Object.entries(valores)) if (Number(v) > 0) nuevos[c] = Number(v)
      await onGuardar(nuevos)
      setGuardando(false)
    }}>
      <p className="mut">¿Cuánto quieres gastar como máximo al mes en cada cosa? Deja vacío lo que no quieras controlar.</p>
      {categorias.map(c => (
        <div className="campo tope-campo" key={c.valor}>
          <label htmlFor={'tope-' + c.valor}>{c.texto}</label>
          <CampoNumero id={'tope-' + c.valor} miles max={9} placeholder="Sin tope" value={valores[c.valor] ?? ''}
            onCambio={v => setValores(x => ({ ...x, [c.valor]: v }))} />
        </div>
      ))}
      <div className="acciones">
        <button className="big primario" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar topes'}</button>
        <button className="big ghost" type="button" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  )
}
