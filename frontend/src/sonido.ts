/**
 * Sonidos de la caja, hechos con Web Audio (sin archivos: funcionan sin señal y en Safari 16).
 * Safari solo deja sonar después de un toque del usuario, y una venta siempre empieza con uno.
 * Se puede apagar por celular (`gz_sonido`); por defecto está prendido.
 */
const CLAVE = 'gz_sonido'

type ContextoAudio = typeof AudioContext
let contexto: AudioContext | null = null

export function sonidoPrendido(): boolean {
  try { return localStorage.getItem(CLAVE) !== '0' } catch { return true }
}

export function prenderSonido(si: boolean) {
  try { localStorage.setItem(CLAVE, si ? '1' : '0') } catch { /* modo privado */ }
}

function audio(): AudioContext | null {
  try {
    if (!contexto) {
      const Ctor: ContextoAudio | undefined = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: ContextoAudio }).webkitAudioContext
      if (!Ctor) return null
      contexto = new Ctor()
    }
    // Safari lo deja "suspendido" hasta que hay un toque
    if (contexto.state === 'suspended') void contexto.resume()
    return contexto
  } catch {
    return null
  }
}

/** Una nota suave con campana: onda seno más su armónico, sube rápido y se apaga sola. */
function nota(ac: AudioContext, hz: number, inicio: number, dur: number, volumen: number) {
  for (const [mult, vol] of [[1, 1], [2, 0.25]] as const) {
    const osc = ac.createOscillator()
    const ganancia = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = hz * mult
    const t = ac.currentTime + inicio
    ganancia.gain.setValueAtTime(0.0001, t)
    ganancia.gain.exponentialRampToValueAtTime(volumen * vol, t + 0.012)
    ganancia.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(ganancia).connect(ac.destination)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }
}

/** «¡Ding-ding!» alegre de una venta: dos notas que suben (Mi5 → La5 → Do#6, tipo caja registradora). */
export function sonidoVenta() {
  if (!sonidoPrendido()) return
  const ac = audio()
  if (!ac) return
  nota(ac, 659.25, 0, 0.28, 0.22)
  nota(ac, 880, 0.09, 0.3, 0.22)
  nota(ac, 1108.73, 0.18, 0.55, 0.2)
}

/** Fanfarria corta para un logro (meta, escalón de premio): sube en acorde mayor y termina arriba. */
export function sonidoLogro() {
  if (!sonidoPrendido()) return
  const ac = audio()
  if (!ac) return
  const notas = [523.25, 659.25, 783.99, 1046.5, 1318.51]
  notas.forEach((hz, i) => nota(ac, hz, i * 0.1, i === notas.length - 1 ? 0.9 : 0.3, 0.2))
}
