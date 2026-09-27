package co.granizados.pos.caja;

import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/arqueo")
public class ArqueoController {

    public record Respuesta(String clientUid, String estado, String error) {
    }

    private final ArqueoService servicio;
    private final ArqueoRepository arqueos;

    public ArqueoController(ArqueoService servicio, ArqueoRepository arqueos) {
        this.servicio = servicio;
        this.arqueos = arqueos;
    }

    /** El cierre de hoy, o `null` si todavía no lo hiciste. */
    @GetMapping
    public ArqueoService.Cierre hoy() {
        return servicio.cierreDeHoy();
    }

    @PostMapping
    public Respuesta cerrar(@Valid @RequestBody ArqueoService.NuevoArqueo n) {
        try {
            return new Respuesta(n.clientUid(), servicio.registrar(n).name(), null);
        } catch (DataIntegrityViolationException e) {
            // Dos reintentos del mismo cierre llegando al mismo tiempo: el de la derecha no rompe nada
            if (arqueos.existsByDia(servicio.hoy())) {
                return new Respuesta(n.clientUid(), "REPETIDA", null);
            }
            throw e;
        }
    }
}
