package co.granizados.pos.inventario;

import co.granizados.pos.comun.NoEncontradoException;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/inventario")
public class InventarioController {

    public record Respuesta(String clientUid, String estado, String error) {
    }

    private final InventarioService servicio;
    private final EntradaInventarioRepository movimientos;

    public InventarioController(InventarioService servicio, EntradaInventarioRepository movimientos) {
        this.servicio = servicio;
        this.movimientos = movimientos;
    }

    /** Un movimiento. `/entradas` queda como alias para lo que ya estaba en la cola de los celulares. */
    @PostMapping({"/movimientos", "/entradas"})
    public Respuesta movimiento(@Valid @RequestBody InventarioService.NuevoMovimiento movimiento) {
        try {
            return new Respuesta(movimiento.clientUid(), servicio.registrar(movimiento).name(), null);
        } catch (DataIntegrityViolationException e) {
            if (movimientos.existsByClientUid(movimiento.clientUid())) {
                return new Respuesta(movimiento.clientUid(), "REPETIDA", null);
            }
            throw e;
        }
    }

    /** Contar todo de una vez. Cada producto va en su transacción: uno que no exista no frena a los demás. */
    @PostMapping("/conteo")
    public List<Respuesta> conteo(@Valid @RequestBody InventarioService.Conteo cuerpo) {
        return cuerpo.movimientos().stream().map(m -> {
            try {
                return new Respuesta(m.clientUid(), servicio.registrar(m).name(), null);
            } catch (NoEncontradoException e) {
                return new Respuesta(m.clientUid(), "RECHAZADA", e.getMessage());
            } catch (DataIntegrityViolationException e) {
                if (movimientos.existsByClientUid(m.clientUid())) {
                    return new Respuesta(m.clientUid(), "REPETIDA", null);
                }
                throw e;
            }
        }).toList();
    }
}
