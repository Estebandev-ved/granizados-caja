package co.granizados.pos.resumen;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/estado")
public class EstadoController {

    private final EstadoService servicio;

    public EstadoController(EstadoService servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public EstadoService.Estado estado() {
        return servicio.estado();
    }
}
