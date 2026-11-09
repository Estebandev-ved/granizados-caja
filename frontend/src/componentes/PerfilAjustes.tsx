import { useState } from 'react'
import { RUBROS, textoPerfil, type Perfil, type Rubro } from '../perfil'

/** Editar el perfil del negocio desde Ajustes: nombre, rubro y qué funciones usa. */
export function PerfilAjustes({ actual, onGuardar }: { actual: Perfil; onGuardar: (p: Perfil) => Promise<void> }) {
  const [p, setP] = useState<Perfil>(actual)
  const [guardando, setGuardando] = useState(false)
  const valido = p.nombre.trim().length > 0 && textoPerfil(p).length < 400

  return (
    <>
      <h2>Perfil del negocio</h2>
      <p>El nombre sale arriba en la app y el rubro cambia las palabras que ves.</p>
      <label className="campo-etiqueta" htmlFor="perfil-nombre">Nombre del negocio</label>
      <input id="perfil-nombre" className="campo-bienvenida" maxLength={40} value={p.nombre} onChange={e => setP({ ...p, nombre: e.target.value })} />
      <span className="campo-etiqueta">Rubro</span>
      <div className="chips">
        {(Object.keys(RUBROS) as Rubro[]).map(r => (
          <button key={r} className={p.rubro === r ? 'on' : ''} onClick={() => setP({ ...p, rubro: r })}>{RUBROS[r].titulo}</button>
        ))}
      </div>
      <div className="interruptor-fila">
        <span><b>Trabajo con equipo</b><small>Muestra Equipo en Ajustes</small></span>
        <button role="switch" aria-checked={p.equipo} aria-label="Trabajo con equipo" className={'interruptor' + (p.equipo ? ' on' : '')} onClick={() => setP({ ...p, equipo: !p.equipo })}><i /></button>
      </div>
      <div className="interruptor-fila">
        <span><b>Fío a mis clientes</b><small>Muestra «Me deben» y el botón Fiado</small></span>
        <button role="switch" aria-checked={p.fiados} aria-label="Fío a mis clientes" className={'interruptor' + (p.fiados ? ' on' : '')} onClick={() => setP({ ...p, fiados: !p.fiados })}><i /></button>
      </div>
      <button className="big primario" disabled={!valido || guardando}
        onClick={async () => { setGuardando(true); try { await onGuardar(p) } finally { setGuardando(false) } }}>
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
    </>
  )
}
