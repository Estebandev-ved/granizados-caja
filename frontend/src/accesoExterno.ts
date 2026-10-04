import { sesion } from './api'

/**
 * Entrar a la caja desde Antigravity: la plataforma abre esta app con `#token=<jwt>` en la dirección
 * (en el fragmento, no en el query, para que no viaje al servidor ni quede en logs).
 * Solo se aceptan caracteres de un JWT (tres partes en base64url).
 */
export function leerTokenDelHash(hash: string): string | null {
  const m = /^#(?:[^#]*&)?token=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)(?:&.*)?$/.exec(hash)
  return m ? m[1] : null
}

/** Guarda el token que trae la dirección y la limpia, para que no quede a la vista ni en el historial. */
export function adoptarTokenDeLaUrl() {
  const token = leerTokenDelHash(window.location.hash)
  if (!token) return
  sesion.guardar(token)
  try { history.replaceState(null, '', window.location.pathname + window.location.search) } catch { /* sin history */ }
}
