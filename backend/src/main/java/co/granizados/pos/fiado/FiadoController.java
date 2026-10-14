package co.granizados.pos.fiado;

import co.granizados.pos.plata.LugarPlata;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/fiados")
public class FiadoController {

    public record Cobro(@NotNull LugarPlata lugar, @NotBlank @Size(max = 64) String clientUid) {
    }

    public record Telefono(@Size(max = 30) String telefono) {
    }

    private final FiadoService servicio;

    public FiadoController(FiadoService servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public List<FiadoService.DeudaDto> pendientes() {
        return servicio.pendientes();
    }

    @PostMapping("/{id}/cobrar")
    public FiadoService.DeudaDto cobrar(@PathVariable Long id, @Valid @RequestBody Cobro cobro) {
        return servicio.cobrar(id, cobro.lugar(), cobro.clientUid());
    }

    @PutMapping("/{id}/telefono")
    public FiadoService.DeudaDto telefono(@PathVariable Long id, @Valid @RequestBody Telefono t) {
        return servicio.telefono(id, t.telefono());
    }
}
