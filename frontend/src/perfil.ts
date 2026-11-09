import { createContext, useContext } from 'react'
import type { Tipo } from './tipos'

/** Perfil del negocio: lo llena la bienvenida y lo guarda el servidor (ajuste `PERFIL`, JSON corto). */
export type Rubro = 'granizados' | 'cafe' | 'comida' | 'otro'

export interface Perfil {
  nombre: string
  rubro: Rubro
  /** Se usan en pantalla: si no trabaja con equipo no ve Equipo; si no fía no ve Fiados. */
  equipo: boolean
  fiados: boolean
}

interface PlantillaProducto { sabor: string; tipo: Tipo; precio: number }
interface InfoRubro {
  titulo: string
  detalle: string
  /** Cómo se llama una unidad vendida, en singular. */
  unidad: string
  etiquetas: Record<Tipo, string>
  plantilla: PlantillaProducto[]
}

export const RUBROS: Record<Rubro, InfoRubro> = {
  granizados: {
    titulo: 'Granizados y bebidas', detalle: 'Sachets, cócteles, jugos', unidad: 'granizado',
    etiquetas: { NORMAL: 'Normal', CREMOSO: 'Cremoso', GRANDE: 'Grande', CERVEZA: 'Cerveza' },
    plantilla: [
      { sabor: 'Margarita', tipo: 'NORMAL', precio: 6000 }, { sabor: 'Mojito', tipo: 'NORMAL', precio: 6000 },
      { sabor: 'Piña colada', tipo: 'CREMOSO', precio: 7000 }, { sabor: 'Margarita', tipo: 'GRANDE', precio: 10000 },
    ],
  },
  cafe: {
    titulo: 'Café y panadería', detalle: 'Tinto, pan, postres', unidad: 'producto',
    etiquetas: { NORMAL: 'Sencillo', CREMOSO: 'Especial', GRANDE: 'Grande', CERVEZA: 'Cerveza' },
    plantilla: [
      { sabor: 'Tinto', tipo: 'NORMAL', precio: 2000 }, { sabor: 'Café con leche', tipo: 'NORMAL', precio: 4000 },
      { sabor: 'Capuchino', tipo: 'CREMOSO', precio: 6000 }, { sabor: 'Pan de bono', tipo: 'NORMAL', precio: 3000 },
    ],
  },
  comida: {
    titulo: 'Comida rápida', detalle: 'Empanadas, perros, papas', unidad: 'producto',
    etiquetas: { NORMAL: 'Sencillo', CREMOSO: 'Combo', GRANDE: 'Grande', CERVEZA: 'Cerveza' },
    plantilla: [
      { sabor: 'Empanada', tipo: 'NORMAL', precio: 3000 }, { sabor: 'Papas', tipo: 'NORMAL', precio: 5000 },
      { sabor: 'Perro caliente', tipo: 'CREMOSO', precio: 8000 }, { sabor: 'Hamburguesa', tipo: 'GRANDE', precio: 15000 },
    ],
  },
  otro: {
    titulo: 'Otro negocio', detalle: 'Tú agregas tus productos', unidad: 'producto',
    etiquetas: { NORMAL: 'Normal', CREMOSO: 'Especial', GRANDE: 'Grande', CERVEZA: 'Cerveza' },
    plantilla: [],
  },
}

/** Un negocio de antes del perfil se ve y se comporta como siempre: Dopamina Cocktails, con todo prendido. */
export const PERFIL_ANTIGUO: Perfil = { nombre: '', rubro: 'granizados', equipo: true, fiados: true }

export function leerPerfil(texto: string | null | undefined): Perfil {
  if (!texto) return PERFIL_ANTIGUO
  try {
    const j = JSON.parse(texto) as Partial<Perfil>
    return {
      nombre: typeof j.nombre === 'string' ? j.nombre.slice(0, 40) : '',
      rubro: j.rubro && j.rubro in RUBROS ? j.rubro : 'granizados',
      equipo: j.equipo !== false,
      fiados: j.fiados !== false,
    }
  } catch {
    return PERFIL_ANTIGUO
  }
}

export function textoPerfil(p: Perfil): string {
  return JSON.stringify({ nombre: p.nombre.trim().slice(0, 40), rubro: p.rubro, equipo: p.equipo, fiados: p.fiados })
}

/** "1 granizado", "3 granizados": la palabra del rubro con su plural. */
export function unidades(p: Perfil, n: number): string {
  const u = RUBROS[p.rubro].unidad
  return n + ' ' + u + (n === 1 ? '' : 's')
}

/** La palabra suelta, para frases armadas a mano. */
export function palabra(p: Perfil, plural = false): string {
  const u = RUBROS[p.rubro].unidad
  return plural ? u + 's' : u
}

export function etiquetaTipo(p: Perfil, t: Tipo): string {
  return RUBROS[p.rubro].etiquetas[t]
}

/** Iniciales para el monograma cuando el negocio no tiene logo: "Café Luna" → "CL". */
export function iniciales(nombre: string): string {
  const letras = nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase())
  return letras.join('') || '·'
}

export const PerfilContexto = createContext<Perfil>(PERFIL_ANTIGUO)
export const usePerfil = () => useContext(PerfilContexto)
