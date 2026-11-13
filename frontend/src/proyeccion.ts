import { porGranizado, premioAl } from './premios'
import type { PremiosDia, Proyeccion } from './tipos'

// Cuánto se va a hacer el trabajador. Hoy: se mezcla el ritmo que lleva con lo que vende en un día normal suyo (al
// principio del día pesa más su historia, al final pesa más cómo va). La semana y el mes salen de lo que gana en un
// día suyo por los días que trabaja. Es un cálculo aproximado, y así se le dice.

/** Con menos días trabajados que esto no hay con qué calcular: se usa su meta o lo que lleva hoy. */
export const MIN_DIAS = 3

/** Días a la semana que se suponen cuando todavía no se sabe cuántos trabaja. */
export const DIAS_SUPUESTOS = 5

/** Antes de esto, el ritmo de hoy no dice nada (una venta en dos minutos no son treinta por hora). */
const MIN_MINUTOS = 20

export interface Estimado {
  /** Con cuántos granizados se cree que cierra hoy (null = no hay con qué calcular todavía). */
  unidadesHoy: number | null
  /** Lo que se haría hoy con esos granizados: comisión + premio − descuentos. */
  ganaHoy: number
  /** De dónde sale lo de hoy: cómo va + su historia, un día normal suyo, su meta, o solo lo que lleva. */
  base: 'ritmo' | 'historia' | 'meta' | 'hoy' | 'nada'
  semana: number
  quincena: number
  mes: number
  /** Los días a la semana con los que se hizo la cuenta, y si son un supuesto. */
  diasSemana: number
  diasSupuestos: boolean
  /** Todavía no hay suficientes días trabajados: es más un ejemplo que un cálculo. */
  pocosDatos: boolean
}

const redondear = (n: number) => Math.round(n / 500) * 500

/** Lo que lleva ganado hoy de verdad. */
export function ganadoHoy(p: PremiosDia): number {
  return p.comision + p.premio - (p.descuento ?? 0) - (p.faltantes ?? 0)
}

/** Lo que se haría hoy si cierra con `unidades` (nunca menos de las que ya vendió). */
export function ganariaHoyCon(p: PremiosDia, unidades: number): number {
  const total = Math.max(unidades, p.vendidas)
  return ganadoHoy(p) + (total - p.vendidas) * porGranizado(p) + premioAl(p, total) - p.premio
}

export function estimar(p: PremiosDia, pr: Proyeccion, ahora: Date = new Date()): Estimado {
  const conDatos = pr.dias >= MIN_DIAS
  let unidades: number | null = null
  let base: Estimado['base'] = 'nada'

  if (conDatos) {
    const normal = Math.max(pr.unidadesDia, p.vendidas)
    const transcurrido = pr.primeraHoy ? (ahora.getTime() - new Date(pr.primeraHoy).getTime()) / 60_000 : 0
    if (p.vendidas > 0 && pr.minutosDia > 0 && transcurrido >= MIN_MINUTOS) {
      const peso = Math.min(1, transcurrido / pr.minutosDia)
      const porRitmo = p.vendidas + (p.vendidas / transcurrido) * Math.max(0, pr.minutosDia - transcurrido)
      unidades = Math.round(peso * porRitmo + (1 - peso) * normal)
      base = 'ritmo'
    } else {
      unidades = normal
      base = 'historia'
    }
  } else if ((p.metaPropia ?? 0) > p.vendidas) {
    unidades = p.metaPropia ?? null
    base = 'meta'
  } else if (p.vendidas > 0) {
    unidades = p.vendidas
    base = 'hoy'
  }
  if (unidades !== null) unidades = Math.max(unidades, p.vendidas)

  const ganaHoy = unidades === null ? ganadoHoy(p) : ganariaHoyCon(p, unidades)
  const diaNormal = conDatos ? pr.ganaDia : Math.max(0, ganaHoy)
  const diasSupuestos = !conDatos || pr.diasSemana <= 0
  const diasSemana = diasSupuestos ? DIAS_SUPUESTOS : pr.diasSemana
  const semana = diaNormal * diasSemana
  return {
    unidadesHoy: unidades, ganaHoy, base,
    semana: redondear(semana), quincena: redondear(semana * 15 / 7), mes: redondear(semana * 30 / 7),
    diasSemana, diasSupuestos, pocosDatos: !conDatos,
  }
}

/** «4 días», «4,5 días», «1 día». */
export function textoDias(n: number): string {
  const t = Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
  return t + (n === 1 ? ' día' : ' días')
}
