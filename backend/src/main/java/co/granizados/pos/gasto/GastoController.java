package co.granizados.pos.gasto;

import co.granizados.pos.comun.NoEncontradoException;
import jakarta.validation.Valid;
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
@RequestMapping("/api/gastos")
public class GastoController {

    public record Respuesta(String clientUid, String estado, String error) {
    }

    private final GastoService servicio;
    private final GastoRepository gastos;

    public GastoController(GastoService servicio, GastoRepository gastos) {
        this.servicio = servicio;
        this.gastos = gastos;
    }

    @PostMapping
    public Respuesta registrar(@Valid @RequestBody GastoService.NuevoGasto gasto) {
        try {
            return new Respuesta(gasto.clientUid(), servicio.registrar(gasto).name(), null);
        } catch (DataIntegrityViolationException e) {
            if (gastos.existsByClientUid(gasto.clientUid())) {
                return new Respuesta(gasto.clientUid(), "REPETIDA", null);
            }
            throw e;
        }
    }

    @DeleteMapping("/{clientUid}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrar(@PathVariable String clientUid) {
        if (!gastos.existsByClientUid(clientUid)) {
            throw new NoEncontradoException("Gasto no encontrado: " + clientUid);
        }
        servicio.borrar(clientUid);
    }
}
