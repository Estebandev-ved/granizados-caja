package co.granizados.pos.plata;

import co.granizados.pos.comun.NoEncontradoException;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PlataController {

    public record Respuesta(String clientUid, String estado, String error) {
    }

    private final PlataService servicio;
    private final IngresoRepository ingresos;
    private final ConteoPlataRepository conteos;

    public PlataController(PlataService servicio, IngresoRepository ingresos, ConteoPlataRepository conteos) {
        this.servicio = servicio;
        this.ingresos = ingresos;
        this.conteos = conteos;
    }

    @GetMapping("/api/plata")
    public PlataService.Saldo saldo() {
        return servicio.saldo();
    }

    @PostMapping("/api/plata/conteo")
    public Respuesta contar(@Valid @RequestBody PlataService.NuevoConteo conteo) {
        try {
            return new Respuesta(conteo.clientUid(), servicio.contar(conteo).name(), null);
        } catch (DataIntegrityViolationException e) {
            if (conteos.existsByClientUid(conteo.clientUid())) return new Respuesta(conteo.clientUid(), "REPETIDA", null);
            throw e;
        }
    }

    @PostMapping("/api/ingresos")
    public Respuesta ingreso(@Valid @RequestBody PlataService.NuevoIngreso ingreso) {
        try {
            return new Respuesta(ingreso.clientUid(), servicio.registrarIngreso(ingreso).name(), null);
        } catch (DataIntegrityViolationException e) {
            if (ingresos.existsByClientUid(ingreso.clientUid())) return new Respuesta(ingreso.clientUid(), "REPETIDA", null);
            throw e;
        }
    }

    @DeleteMapping("/api/ingresos/{clientUid}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrarIngreso(@PathVariable String clientUid) {
        if (!ingresos.existsByClientUid(clientUid)) throw new NoEncontradoException("Ingreso no encontrado: " + clientUid);
        servicio.borrarIngreso(clientUid);
    }
}
