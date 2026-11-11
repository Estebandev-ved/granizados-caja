package co.granizados.pos.venta;

public enum MetodoPago {
    NEQUI, EFECTIVO,
    /** Se cobra después: no entra a la caja ni a Nequi hasta que el cliente pague (ver FiadoService). */
    FIADO,
    /** Una parte en efectivo y el resto por Nequi (ver Venta.efectivo() y Venta.nequi()). */
    MIXTO,
    /** Se regala (sello de fidelización, cortesía): baja el stock y cuenta el costo, pero no entra plata. */
    REGALO,
    /**
     * Un trabajador se toma (o compra) uno de su carga: baja el stock y cuenta el costo, no entra plata, y lo que pase
     * de los gratis del día queda en `Venta.cargoVendedor` para descontárselo de su pago.
     */
    CONSUMO,
    /**
     * Granizados de la carga de un trabajador que no aparecieron al cuadrar. Lo anota el dueño: baja el stock, no entra
     * plata y se le descuentan al trabajador al precio de venta (`Venta.cargoVendedor`).
     */
    FALTANTE
}
