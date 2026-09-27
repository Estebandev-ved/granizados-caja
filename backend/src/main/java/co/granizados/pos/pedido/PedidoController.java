package co.granizados.pos.pedido;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PedidoController {

    public record Respuesta(String estado, String error) {
    }

    private final PedidoService servicio;
    private final PedidoProveedorRepository pedidos;

    public PedidoController(PedidoService servicio, PedidoProveedorRepository pedidos) {
        this.servicio = servicio;
        this.pedidos = pedidos;
    }

    @GetMapping("/api/pedido/sugerido")
    public PedidoService.PedidoSugerido sugerido() {
        return servicio.sugerido();
    }

    /** Crea el pedido con las cantidades editadas y devuelve el link de WhatsApp listo para abrir. */
    @PostMapping("/api/pedidos")
    public PedidoService.PedidoCreado crear(@Valid @RequestBody PedidoService.Armar cuerpo) {
        return servicio.crear(cuerpo.items());
    }

    /** Historial completo, o solo los de un estado (`?estado=ENVIADO`). */
    @GetMapping("/api/pedidos")
    public List<PedidoService.PedidoDto> listar(
            @RequestParam(required = false) EstadoPedido estado) {
        return servicio.listar(estado);
    }

    /** "Llegó el pedido": suma lo que llegó. Segunda vez = REPETIDA, sin duplicar nada. */
    @PostMapping("/api/pedidos/{id}/recibido")
    public Respuesta recibido(@PathVariable Long id, @Valid @RequestBody PedidoService.Recepcion cuerpo) {
        try {
            return new Respuesta(servicio.recibir(id, cuerpo).name(), null);
        } catch (DataIntegrityViolationException e) {
            // Dos reintentos al mismo tiempo: el segundo ve que ya estaba recibido
            if (pedidos.findById(id).map(p -> p.getEstado() == EstadoPedido.RECIBIDO).orElse(false)) {
                return new Respuesta("REPETIDA", null);
            }
            throw e;
        }
    }

    @PostMapping("/api/pedidos/{id}/cancelar")
    public Respuesta cancelar(@PathVariable Long id) {
        return new Respuesta(servicio.cancelar(id).name(), null);
    }
}
