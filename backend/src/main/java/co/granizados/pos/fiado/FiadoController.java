package co.granizados.pos.fiado;

import co.granizados.pos.plata.LugarPlata;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
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

    /** `ids`: todas las deudas de esa persona que se están cobrando juntas. */
    public record Cobro(@NotEmpty @Size(max = 200) List<Long> ids, @NotNull LugarPlata lugar,
                        @NotBlank @Size(max = 64) String clientUid) {
    }

    public record Recordatorio(@NotEmpty @Size(max = 200) List<Long> ids) {
    }

    public record Telefono(@Size(max = 30) String telefono) {
    }

    private final FiadoService servicio;

    public FiadoController(FiadoService servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public FiadoService.Lista pendientes() {
        return servicio.pendientes();
    }

    /** Nombres que ya han fiado y su celular, para no pedirlo otra vez. */
    @GetMapping("/conocidos")
    public List<FiadoService.Conocido> conocidos() {
        return servicio.conocidos();
    }

    @PostMapping("/cobrar")
    public FiadoService.Persona cobrar(@Valid @RequestBody Cobro cobro) {
        return servicio.cobrar(cobro.ids(), cobro.lugar(), cobro.clientUid());
    }

    /** Manda el recordatorio por el bot de WhatsApp. Solo cuando el dueño toca el botón. */
    @PostMapping("/recordar")
    public FiadoService.Persona recordar(@Valid @RequestBody Recordatorio r) {
        return servicio.recordar(r.ids());
    }

    @PutMapping("/{id}/telefono")
    public FiadoService.Persona telefono(@PathVariable Long id, @Valid @RequestBody Telefono t) {
        return servicio.telefono(id, t.telefono());
    }
}
