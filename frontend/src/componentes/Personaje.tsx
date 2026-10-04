import bienvenida from '../assets/personajes/bienvenida.svg'
import carga from '../assets/personajes/carga.svg'
import error from '../assets/personajes/error.svg'
import exito from '../assets/personajes/exito.svg'
import lucia from '../assets/personajes/personaje-lucia.svg'
import mateo from '../assets/personajes/personaje-mateo.svg'
import nova from '../assets/personajes/personaje-nova.svg'
import sofia from '../assets/personajes/personaje-sofia.svg'
import vacioDomicilios from '../assets/personajes/vacio-domicilios.svg'
import vacioPedidos from '../assets/personajes/vacio-pedidos.svg'

/** Las figuras (cuerpo entero) y las escenas del sistema de diseño NOMA. */
const FIGURAS = { sofia, nova, lucia, mateo }
const ESCENAS = { bienvenida, carga, error, exito, 'vacio-pedidos': vacioPedidos, 'vacio-domicilios': vacioDomicilios }

export type NombrePersonaje = keyof typeof FIGURAS | keyof typeof ESCENAS

/**
 * Personajes de NOMA, cada uno con su papel: Sofía (ventas y logros), Nova (guía y consejos), Lucía (atención) y
 * Mateo (domicilios). Las escenas sirven para estados vacíos, éxito, error y carga.
 * Decorativos por defecto (alt vacío): pasa `alt` si informan algo. `libre` los deja sin fondo.
 */
export function Personaje({ nombre, libre = false, alt = '' }: { nombre: NombrePersonaje; libre?: boolean; alt?: string }) {
  const figura = nombre in FIGURAS
  const src = figura ? FIGURAS[nombre as keyof typeof FIGURAS] : ESCENAS[nombre as keyof typeof ESCENAS]
  return <img src={src} alt={alt} className={'personaje' + (figura ? ' figura' : '') + (libre ? ' libre' : '')} />
}
