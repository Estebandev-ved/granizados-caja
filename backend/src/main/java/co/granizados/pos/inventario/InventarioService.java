package co.granizados.pos.inventario;

import co.granizados.pos.comun.NoEncontradoException;
import co.granizados.pos.producto.Producto;
import co.granizados.pos.producto.ProductoRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Movimientos de inventario. Todo lo que cambia el stock pasa por aquí:
 *   ENTRADA suma, MERMA resta y CONTEO fija el stock real (delta = real − lo que decía la base).
 */
@Service
public class InventarioService {

    public enum Resultado { REGISTRADA, REPETIDA }

    /**
     * Un movimiento. `tipo` vacío se toma como ENTRADA, así el viejo cuerpo de /entradas sigue sirviendo.
     * `cantidad` es para ENTRADA y MERMA; `real` (el stock contado) es para CONTEO.
     */
    public record NuevoMovimiento(
            @NotBlank @Size(max = 64) String clientUid,
            @NotNull Long productoId,
            TipoMovimiento tipo,
            @Min(1) @Max(1000) Integer cantidad,
            @Min(0) @Max(1000) Integer real,
            MotivoMerma motivo,
            Long pedidoId) {

        public NuevoMovimiento(String clientUid, Long productoId, TipoMovimiento tipo,
                               Integer cantidad, Integer real, MotivoMerma motivo) {
            this(clientUid, productoId, tipo, cantidad, real, motivo, null);
        }
    }

    /** Contar todo de una vez: una lista de productos con su stock real. */
    public record Conteo(@NotEmpty @Size(max = 200) List<@Valid NuevoMovimiento> movimientos) {
    }

    private final EntradaInventarioRepository movimientos;
    private final ProductoRepository productos;
    private final Clock clock;

    public InventarioService(EntradaInventarioRepository movimientos, ProductoRepository productos, Clock clock) {
        this.movimientos = movimientos;
        this.productos = productos;
        this.clock = clock;
    }

    /** Idempotente por clientUid, igual que las ventas: el celular puede reintentar sin duplicar. */
    @Transactional
    public Resultado registrar(NuevoMovimiento m) {
        if (movimientos.existsByClientUid(m.clientUid())) return Resultado.REPETIDA;

        Producto producto = productos.findById(m.productoId())
                .orElseThrow(() -> new NoEncontradoException("Producto no encontrado: " + m.productoId()));
        TipoMovimiento tipo = m.tipo() == null ? TipoMovimiento.ENTRADA : m.tipo();
        MotivoMerma motivo = tipo == TipoMovimiento.MERMA ? m.motivo() : null;
        if (tipo == TipoMovimiento.MERMA && motivo == null) {
            throw new IllegalArgumentException("motivo: elige dañado, regalado o vencido");
        }

        int delta = switch (tipo) {
            case ENTRADA -> obligatoria(m.cantidad());
            case MERMA -> -obligatoria(m.cantidad());
            case CONTEO -> {
                if (m.real() == null) throw new IllegalArgumentException("real: falta el stock contado");
                // Se bloquea la fila para que entre el conteo y su actualización no entre una venta
                Producto bloqueado = productos.findParaActualizar(producto.getId())
                        .orElseThrow(() -> new NoEncontradoException("Producto no encontrado: " + m.productoId()));
                yield m.real() - bloqueado.getStock();
            }
            default -> throw new IllegalStateException("Tipo de movimiento desconocido: " + tipo);
        };

        // Un conteo que da 0 también se guarda: es la prueba de que el anaquel cuadraba
        movimientos.saveAndFlush(new EntradaInventario(m.clientUid(), producto, delta, tipo, motivo,
                m.pedidoId(), clock.instant()));
        if (delta != 0) productos.sumarStock(producto.getId(), delta);
        return Resultado.REGISTRADA;
    }

    private static int obligatoria(Integer cantidad) {
        if (cantidad == null) throw new IllegalArgumentException("cantidad: falta cuántas unidades");
        return cantidad;
    }
}
