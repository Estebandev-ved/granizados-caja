import { describe, expect, it } from 'vitest'
import { enlaceRecordatorio, numeroWhatsApp, recordadoHoy } from './fiados'

const persona = { telefono: '3001234567', mensaje: 'Hola Camila 👋\nTotal: $18.000', recordadoEn: null as string | null }

describe('recordatorio de fiados por WhatsApp', () => {
  it('agrega el 57 a un celular de 10 dígitos y limpia símbolos', () => {
    expect(numeroWhatsApp('300 123-4567')).toBe('573001234567')
    expect(numeroWhatsApp('573001234567')).toBe('573001234567')
  })

  it('el link lleva el mensaje del servidor tal cual', () => {
    const link = enlaceRecordatorio(persona)
    expect(link).toMatch(/^https:\/\/wa\.me\/573001234567\?text=/)
    expect(decodeURIComponent(link!.split('text=')[1])).toBe(persona.mensaje)
  })

  it('sin celular no hay link', () => {
    expect(enlaceRecordatorio({ ...persona, telefono: null })).toBeNull()
  })

  it('sabe si ya se le recordó hoy', () => {
    const ahora = Date.parse('2026-10-15T12:00:00Z')
    expect(recordadoHoy({ recordadoEn: '2026-10-15T08:00:00Z' }, ahora)).toBe(true)
    expect(recordadoHoy({ recordadoEn: '2026-10-14T08:00:00Z' }, ahora)).toBe(false)
    expect(recordadoHoy({ recordadoEn: null }, ahora)).toBe(false)
  })
})
