import { describe, expect, it } from 'vitest'
import { PERFIL_ANTIGUO, etiquetaTipo, iniciales, leerPerfil, palabra, textoPerfil, unidades } from './perfil'

describe('perfil del negocio', () => {
  it('sin perfil guardado se comporta como siempre: todo prendido', () => {
    expect(leerPerfil(null)).toEqual(PERFIL_ANTIGUO)
    expect(leerPerfil('')).toEqual(PERFIL_ANTIGUO)
    expect(PERFIL_ANTIGUO.equipo && PERFIL_ANTIGUO.fiados).toBe(true)
  })

  it('un JSON dañado no rompe la app', () => {
    expect(leerPerfil('{no es json')).toEqual(PERFIL_ANTIGUO)
  })

  it('guarda y lee lo mismo, y recorta el nombre', () => {
    const p = { nombre: '  Café Luna  ', rubro: 'cafe' as const, equipo: false, fiados: true }
    const leido = leerPerfil(textoPerfil(p))
    expect(leido).toEqual({ nombre: 'Café Luna', rubro: 'cafe', equipo: false, fiados: true })
    expect(textoPerfil({ ...p, nombre: 'x'.repeat(100) }).length).toBeLessThan(500)
  })

  it('un rubro desconocido cae en granizados', () => {
    expect(leerPerfil('{"rubro":"inventado"}').rubro).toBe('granizados')
  })

  it('usa la palabra del rubro y su plural', () => {
    expect(unidades(PERFIL_ANTIGUO, 1)).toBe('1 granizado')
    expect(unidades(PERFIL_ANTIGUO, 3)).toBe('3 granizados')
    expect(palabra({ ...PERFIL_ANTIGUO, rubro: 'cafe' }, true)).toBe('productos')
    expect(etiquetaTipo({ ...PERFIL_ANTIGUO, rubro: 'comida' }, 'CREMOSO')).toBe('Combo')
  })

  it('arma iniciales para el monograma', () => {
    expect(iniciales('Café Luna')).toBe('CL')
    expect(iniciales('dopamina')).toBe('D')
    expect(iniciales('   ')).toBe('·')
  })
})
