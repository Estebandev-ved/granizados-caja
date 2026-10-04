import { describe, expect, it } from 'vitest'
import { ApiError, esRechazo } from './api'

describe('esRechazo', () => {
  it('un dato mal hecho (400, 404, 409) se descarta porque reintentar no lo arregla', () => {
    for (const status of [400, 404, 409, 422]) expect(esRechazo(new ApiError(status, 'x'))).toBe(true)
  })

  it('sesión vencida, suscripción vencida, tiempo agotado y exceso de peticiones se reintentan', () => {
    for (const status of [401, 402, 408, 429]) expect(esRechazo(new ApiError(status, 'x'))).toBe(false)
  })

  it('un error del servidor o de red también se reintenta', () => {
    expect(esRechazo(new ApiError(500, 'x'))).toBe(false)
    expect(esRechazo(new Error('sin red'))).toBe(false)
  })
})
