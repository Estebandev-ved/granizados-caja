package co.granizados.pos.venta;

import co.granizados.pos.comun.NoEncontradoException;
import co.granizados.pos.producto.Producto;
import co.granizados.pos.producto.ProductoRepository;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VentaService {

    public record NuevaVenta(
            @NotBlank @Size(max = 64) String clientUid,
            @NotNull Long productoId,
            @NotNull MetodoPago metodo,
            @Min(1) @Max(99) int cantidad,
            Instant creadaEn) {

        public NuevaVenta(String clientUid, Long productoId, MetodoPago metodo, int cantidad) {
            this(clientUid, productoId, metodo, cantidad, null);
        }
    }

    /** Cuánto atrás se acepta la hora que manda el celular (ventas que se hicieron sin señal). */
    static final Duration MAX_ATRASO = Duration.ofDays(3);

    public enum Resultado { REGISTRADA, REPETIDA }

    private final VentaRepository ventas;
    private final ProductoRepository productos;
    private final ApplicationEventPublisher eventos;
    private final Clock clock;

    public VentaService(VentaRepository ventas, ProductoRepository productos,
                        ApplicationEventPublisher eventos, Clock clock) {
        this.ventas = ventas;
        this.productos = productos;
        this.eventos = eventos;
        this.clock = clock;
    }

    /**
     * Registra la venta y descuenta el stock en la misma transacción.
     * Si el clientUid ya existe no hace nada: el celular puede reintentar sin miedo a duplicar.
     */
    @Transactional
    public Resultado registrar(NuevaVenta v) {
        if (ventas.existsByClientUid(v.clientUid())) return Resultado.REPETIDA;

        Producto p = productos.findById(v.productoId())
                .orElseThrow(() -> new NoEncontradoException("Producto no encontrado: " + v.productoId()));
        String nombre = p.nombre();
        int minimo = p.getStockMinimo();

        ventas.saveAndFlush(new Venta(v.clientUid(), p, v.cantidad(), v.metodo(), cuando(v.creadaEn())));
        productos.sumarStock(p.getId(), -v.cantidad());

        int despues = productos.stockActual(p.getId()).orElseThrow();
        int antes = despues + v.cantidad();
        if (antes > minimo && despues <= minimo) {
            eventos.publishEvent(new StockBajo(p.getId(), nombre, despues, minimo));
        }
        return Resultado.REGISTRADA;
    }

    /**
     * Hora de la venta: la del celular si es creíble (la venta pudo quedar en cola sin señal),
     * si no la del servidor. Así el cierre del día cuenta cada venta en el día en que se hizo.
     */
    private Instant cuando(Instant delCelular) {
        Instant ahora = clock.instant();
        if (delCelular == null || delCelular.isAfter(ahora.plus(Duration.ofMinutes(5)))
                || delCelular.isBefore(ahora.minus(MAX_ATRASO))) {
            return ahora;
        }
        return delCelular;
    }

    /** Borra una venta puntual y devuelve las unidades al stock. */
    @Transactional
    public void deshacer(String clientUid) {
        Venta v = ventas.findByClientUid(clientUid)
                .orElseThrow(() -> new NoEncontradoException("Venta no encontrada: " + clientUid));
        Long productoId = v.getProducto().getId();
        int cantidad = v.getCantidad();
        ventas.delete(v);
        productos.sumarStock(productoId, cantidad);
    }
}
