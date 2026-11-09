import { palabra, unidades, usePerfil } from '../perfil'

/** "3 granizados" o "1 producto": la cantidad con la palabra que usa el rubro del negocio. */
export function Unidades({ n }: { n: number }) {
  return <>{unidades(usePerfil(), n)}</>
}

/** Solo la palabra del rubro ("granizado", "producto"), en singular o plural. */
export function Palabra({ plural = false }: { plural?: boolean }) {
  return <>{palabra(usePerfil(), plural)}</>
}
