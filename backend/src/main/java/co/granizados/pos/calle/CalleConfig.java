package co.granizados.pos.calle;

import co.granizados.pos.ajustes.AjustesService;
import co.granizados.pos.producto.TipoProducto;
import java.util.EnumMap;
import java.util.Map;

/**
 * Los ajustes del plan de ventas en la calle. Un precio o una comisión en 0 significa "el de siempre": así el dueño
 * solo escribe lo que cambia (por ejemplo, no hay que tocar el Grande).
 * Le llega a todos los celulares en `Estado.calle`: el trabajador solo lo aplica mientras tiene una salida abierta.
 */
public record CalleConfig(boolean activo, Map<TipoProducto, Long> precios, Map<TipoProducto, Long> comisiones,
                          long combo, long pasaje, int minimoPasaje, int bueno, int regular) {

    public static CalleConfig leer(Map<String, String> cfg) {
        Map<TipoProducto, Long> precios = new EnumMap<>(TipoProducto.class);
        Map<TipoProducto, Long> comisiones = new EnumMap<>(TipoProducto.class);
        for (TipoProducto t : TipoProducto.values()) {
            precios.put(t, (long) AjustesService.entero(cfg, "CALLE_PRECIO_" + t.name(), 0));
            comisiones.put(t, (long) AjustesService.entero(cfg, "CALLE_COM_" + t.name(), 0));
        }
        return new CalleConfig("1".equals(cfg.getOrDefault("CALLE_ACTIVO", "0").trim()), precios, comisiones,
                AjustesService.entero(cfg, "CALLE_COM_COMBO", 0), AjustesService.entero(cfg, "CALLE_PASAJE", 0),
                AjustesService.entero(cfg, "CALLE_MINIMO_PASAJE", 12), AjustesService.entero(cfg, "CALLE_BUENO", 25),
                AjustesService.entero(cfg, "CALLE_REGULAR", 15));
    }

    /** Lo que cuesta ese tipo en la calle; si no se puso precio, el de siempre. */
    public long precio(TipoProducto tipo, long deSiempre) {
        Long p = precios.get(tipo);
        return p != null && p > 0 ? p : deSiempre;
    }

    /**
     * Lo que gana el trabajador por cada uno en la calle: la tarifa de combo si se vendió en combo, si no la del tipo.
     * Si el dueño no puso ninguna, queda la de siempre (`deSiempre`, que puede ser null = su porcentaje).
     */
    public Long comision(TipoProducto tipo, boolean combo, Long deSiempre) {
        if (combo && this.combo > 0) return this.combo;
        Long c = comisiones.get(tipo);
        return c != null && c > 0 ? c : deSiempre;
    }
}
