package co.granizados.pos.venta;

/** Se publica cuando una venta deja el stock en el mínimo o por debajo (solo al cruzarlo). */
public record StockBajo(Long productoId, String nombre, int quedan, int minimo) {
}
