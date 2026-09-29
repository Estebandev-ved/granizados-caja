import {
  browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startAuthentication, startRegistration,
} from '@simplewebauthn/browser'
import { api } from './api'

// Face ID con passkeys (WebAuthn): el iPhone guarda una llave detrás de Face ID y firma un reto para entrar.
// La animación de Face ID que sale en pantalla es la del propio iOS.
// Solo funciona en HTTPS (Railway) o en localhost.

const CLAVE = 'gz_faceid'

export async function soportaFaceId(): Promise<boolean> {
  if (!browserSupportsWebAuthn()) return false
  try {
    return await platformAuthenticatorIsAvailable()
  } catch {
    return false
  }
}

/** ¿Este celular ya tiene Face ID activado para la app? */
export function faceIdActivado(): boolean {
  try { return localStorage.getItem(CLAVE) === '1' } catch { return false }
}

export function olvidarFaceId() {
  try { localStorage.removeItem(CLAVE) } catch { /* modo privado */ }
}

function nombreDispositivo(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows'
  return 'Este dispositivo'
}

/** Registra el Face ID de este celular. Hay que tener sesión (se hace justo después de entrar con el PIN). */
export async function activarFaceId(): Promise<void> {
  const { solicitud, opciones } = await api.passkeyRegistroOpciones()
  const credencial = await startRegistration({ optionsJSON: opciones.publicKey })
  await api.passkeyRegistrar({ solicitud, credencial: JSON.stringify(credencial), nombre: nombreDispositivo() })
  try { localStorage.setItem(CLAVE, '1') } catch { /* modo privado */ }
}

/** Pide Face ID y devuelve el token de sesión. */
export async function entrarConFaceId(): Promise<string> {
  const { solicitud, opciones } = await api.passkeyEntradaOpciones()
  const credencial = await startAuthentication({ optionsJSON: opciones.publicKey })
  const { token } = await api.passkeyEntrar({ solicitud, credencial: JSON.stringify(credencial) })
  return token
}

/** La persona canceló el Face ID o iOS no lo dejó abrir solo (sin toque). No es un error de verdad. */
export function esCancelacion(e: unknown): boolean {
  const nombres = [(e as Error)?.name, ((e as { cause?: Error })?.cause)?.name]
  return nombres.includes('NotAllowedError') || nombres.includes('AbortError')
}

/** El rpId del backend (WEBAUTHN_RP_ID) no coincide con el dominio desde el que se abrió la página. */
export function esErrorDeDominio(e: unknown): boolean {
  const nombres = [(e as Error)?.name, ((e as { cause?: Error })?.cause)?.name]
  return nombres.includes('SecurityError')
}
