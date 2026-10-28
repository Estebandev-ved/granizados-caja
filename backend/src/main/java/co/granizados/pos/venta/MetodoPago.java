package co.granizados.pos.venta;

public enum MetodoPago {
    NEQUI, EFECTIVO,
    /** Se cobra después: no entra a la caja ni a Nequi hasta que el cliente pague (ver FiadoService). */
    FIADO,
    /** Una parte en efectivo y el resto por Nequi (ver Venta.efectivo() y Venta.nequi()). */
    MIXTO
}
