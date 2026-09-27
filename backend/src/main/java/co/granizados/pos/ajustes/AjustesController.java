package co.granizados.pos.ajustes;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/config")
public class AjustesController {

    public record NuevoValor(String valor) {
    }

    private final AjustesService servicio;

    public AjustesController(AjustesService servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public List<AjustesService.ParamDto> todos() {
        return servicio.todos();
    }

    @PutMapping("/{clave}")
    public AjustesService.ParamDto actualizar(@PathVariable String clave, @RequestBody NuevoValor cuerpo) {
        return servicio.actualizar(clave, cuerpo.valor());
    }
}
