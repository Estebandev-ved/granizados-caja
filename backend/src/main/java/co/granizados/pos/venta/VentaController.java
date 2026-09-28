package co.granizados.pos.venta;

import co.granizados.pos.comun.NoEncontradoException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ventas")
public class VentaController {

    public record Respuesta(String clientUid, String estado, String error) {
    }

    public record Lote(@NotEmpty @Size(max = 200) List<VentaService.@Valid NuevaVenta> ventas) {
    }

    private final VentaService servicio;
    private final VentaRepository ventas;

    public VentaController(VentaService servicio, VentaRepository ventas) {
        this.servicio = servicio;
        this.ventas = ventas;
    }

    @PostMapping
    public Respuesta registrar(@Valid @RequestBody VentaService.NuevaVenta venta) {
        return new Respuesta(venta.clientUid(), registrarSeguro(venta).name(), null);
    }

    /**
     * Sube varias ventas de la cola del celular en una sola petición.
     * Cada una va en su propia transacción: si un sabor ya no existe, esa sale RECHAZADA y las demás entran.
     */
    @PostMapping("/lote")
    public List<Respuesta> lote(@Valid @RequestBody Lote lote) {
        return lote.ventas().stream().map(v -> {
            try {
                return new Respuesta(v.clientUid(), registrarSeguro(v).name(), null);
            } catch (NoEncontradoException e) {
                return new Respuesta(v.clientUid(), "RECHAZADA", e.getMessage());
            }
        }).toList();
    }

    @DeleteMapping("/{clientUid}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deshacer(@PathVariable String clientUid) {
        servicio.deshacer(clientUid);
    }

    /** Ventas históricas de otro sistema, en CSV (fecha;sabor;cantidad;precioUnitario[;metodo]). No toca el stock. */
    @PostMapping("/importar")
    public VentaService.ImportarResultado importar(@RequestBody String csv) {
        return servicio.importarCsv(csv);
    }

    /** Si dos reintentos de la misma venta llegan al tiempo, el UNIQUE de la base frena al segundo. */
    private VentaService.Resultado registrarSeguro(VentaService.NuevaVenta v) {
        try {
            return servicio.registrar(v);
        } catch (DataIntegrityViolationException e) {
            if (ventas.existsByClientUid(v.clientUid())) return VentaService.Resultado.REPETIDA;
            throw e;
        }
    }
}
