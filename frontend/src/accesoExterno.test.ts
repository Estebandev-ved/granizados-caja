import { describe, expect, it } from 'vitest'
import { leerTokenDelHash } from './accesoExterno'

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJuZWdvY2lvX2lkIjo0Mn0.firma_de-prueba'

describe('leerTokenDelHash', () => {
  it('saca el token del fragmento', () => {
    expect(leerTokenDelHash('#token=' + JWT)).toBe(JWT)
  })

  it('funciona aunque haya más parámetros', () => {
    expect(leerTokenDelHash('#a=1&token=' + JWT + '&b=2')).toBe(JWT)
  })

  it('ignora lo que no parece un JWT', () => {
    expect(leerTokenDelHash('')).toBeNull()
    expect(leerTokenDelHash('#token=')).toBeNull()
    expect(leerTokenDelHash('#token=solo-una-parte')).toBeNull()
    expect(leerTokenDelHash('#token=<script>alert(1)</script>.a.b')).toBeNull()
    expect(leerTokenDelHash('#otro=' + JWT)).toBeNull()
  })
})
