import { describe, expect, it } from 'vitest'
import { enlaceRecordatorio, mensajeRecordatorio, numeroWhatsApp } from './fiados'
import type { Fiado } from './tipos'

const f: Fiado = { id: 1, cliente: 'Camila', telefono: '3001234567', monto: 12000, detalle: '2 Smirnoff', creadaEn: '2026-10-01T10:00:00Z' }

describe('recordatorio de fiados por WhatsApp', () => {
  it('agrega el 57 a un celular de 10 dígitos y limpia símbolos', () => {
    expect(numeroWhatsApp('300 123-4567')).toBe('573001234567')
    expect(numeroWhatsApp('573001234567')).toBe('573001234567')
  })

  it('el mensaje dice quién, cuánto y de qué', () => {
    const m = mensajeRecordatorio(f)
    expect(m).toContain('Camila')
    expect(m).toContain('2 Smirnoff')
    expect(m).toMatch(/12\.000/)
  })

  it('arma el link solo si hay celular', () => {
    expect(enlaceRecordatorio(f)).toMatch(/^https:\/\/wa\.me\/573001234567\?text=/)
    expect(enlaceRecordatorio({ ...f, telefono: null })).toBeNull()
  })
})
