import { Sheet } from './Sheet'

export type TemaAyuda = 'vender' | 'inventario' | 'hoy' | 'reportes' | 'ajustes' | 'dia'
interface Entrada { titulo: string; pasos: string[] }

const AYUDA: Record<TemaAyuda, { titulo: string; entradas: Entrada[] }> = {
  vender: { titulo: 'Vender', entradas: [
    { titulo: 'Registrar una venta', pasos: ['Toca el producto.', 'Toca cómo te pagó: Nequi o efectivo. Listo.', 'Si te equivocas, toca «Deshacer» en el aviso de arriba.'] },
    { titulo: 'Cliente que paga mitad y mitad', pasos: ['Toca el producto y luego «Pagó mitad y mitad».', 'Escribe cuánto fue en efectivo; el resto cuenta como Nequi.'] },
    { titulo: 'Fiar o regalar', pasos: ['En el panel de venta toca «Fiado» y escribe el nombre.', 'Lo que te deben aparece en Hoy → Me deben.', 'Para regalar un producto (sello de fidelidad) toca «Regalo».'] },
    { titulo: 'Sin señal', pasos: ['Sigue vendiendo normal: las ventas quedan guardadas en el celular.', 'En la esquina dice «pendientes» y se suben solas cuando vuelve la señal.'] },
  ] },
  inventario: { titulo: 'Inventario', entradas: [
    { titulo: 'Sumar lo que llegó', pasos: ['Escoge «Sumar», toca el producto y pon la cantidad.'] },
    { titulo: 'Contar lo que hay', pasos: ['Escoge «Contar» y escribe lo que realmente tienes. La app ajusta la diferencia.'] },
    { titulo: 'Anotar una merma', pasos: ['Escoge «Merma» para lo que se dañó o se perdió; así la ganancia queda real.'] },
    { titulo: 'Pedir al proveedor', pasos: ['La app calcula cuánto pedir según lo que vendes y te arma el mensaje de WhatsApp.', 'Tú lo confirmas antes de enviar.'] },
  ] },
  hoy: { titulo: 'Hoy', entradas: [
    { titulo: 'Cómo leer el día', pasos: ['Arriba ves lo vendido y la ganancia (venta menos costo y gastos).', 'Más abajo, lo que te deben y las últimas ventas.'] },
    { titulo: 'Cerrar la caja', pasos: ['Al final del día toca «Cerrar caja», cuenta el efectivo y la app te dice si cuadra.'] },
    { titulo: 'Anotar un gasto', pasos: ['Toca «Gasto», escribe el monto y escoge la categoría (o crea la tuya con «Otra categoría»).', 'Dile de dónde salió la plata: de la caja, de Nequi o de la casa. Así Mi plata te cuadra.'] },
  ] },
  reportes: { titulo: 'Reportes', entradas: [
    { titulo: 'Ver otro período', pasos: ['Escoge el rango arriba: semana, mes o fechas a tu medida.'] },
    { titulo: 'Sacar el Excel', pasos: ['Toca «Descargar» para bajar el CSV con todas las ventas.'] },
  ] },
  ajustes: { titulo: 'Ajustes', entradas: [
    { titulo: 'Productos y precios', pasos: ['Entra a «Sabores y precios» para agregar, editar o apagar productos.'] },
    { titulo: 'Equipo', pasos: ['Crea un trabajador con su PIN, entrégale su carga del día y mira lo que le debes.'] },
    { titulo: 'Tu negocio', pasos: ['En «Perfil del negocio» cambias el nombre y qué funciones usas.'] },
  ] },
  dia: { titulo: 'Mi día', entradas: [
    { titulo: 'Cómo gano', pasos: ['Arriba ves lo que llevas ganado hoy: comisión más premios.', 'La barra te muestra cuánto falta para el siguiente premio.'] },
    { titulo: 'Si te tomas uno', pasos: ['En Vender toca el sabor y luego «Me lo tomo yo».', 'El del día es gratis; del siguiente en adelante se descuenta de tu pago.'] },
    { titulo: 'Entregar lo recaudado', pasos: ['Al cerrar, anota cuánto entregaste en efectivo y por Nequi; el dueño lo confirma.'] },
  ] },
}

/** Ayuda corta y contextual: abre en el tema de la pantalla donde estás. */
export function Ayuda({ tema, abierto, onCerrar }: { tema: TemaAyuda; abierto: boolean; onCerrar: () => void }) {
  // El trabajador solo ve lo suyo y vender; el dueño ve todo menos "Mi día"
  const resto = (Object.keys(AYUDA) as TemaAyuda[]).filter(t => t !== tema && (tema === 'dia' ? t === 'vender' : t !== 'dia'))
  const orden = [tema, ...resto]
  return (
    <Sheet abierto={abierto} onCerrar={onCerrar}>
      <h2>¿Cómo se hace?</h2>
      <p>Toca un tema. Empezamos por esta pantalla.</p>
      <div className="ayuda-lista">
        {orden.map((t, i) => (
          <div key={t} className="ayuda-grupo">
            <h3>{AYUDA[t].titulo}</h3>
            {AYUDA[t].entradas.map((e, j) => (
              <details key={e.titulo} open={i === 0 && j === 0}>
                <summary>{e.titulo}</summary>
                <ol>{e.pasos.map(p => <li key={p}>{p}</li>)}</ol>
              </details>
            ))}
          </div>
        ))}
      </div>
      <button className="big ghost" onClick={onCerrar}>Entendido</button>
    </Sheet>
  )
}
