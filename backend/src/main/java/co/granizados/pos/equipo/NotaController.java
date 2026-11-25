package co.granizados.pos.equipo;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Notas al trabajador. Las de /api/equipo son del dueño (RolFiltro no deja entrar al trabajador); las de /api/mi-turno
 * son del trabajador y siempre sobre las suyas (el id sale del token).
 */
@RestController
public class NotaController {

    private final NotaService servicio;

    public NotaController(NotaService servicio) {
        this.servicio = servicio;
    }

    @GetMapping("/api/equipo/{id}/notas")
    public List<NotaService.NotaDto> deTrabajador(@PathVariable Long id) {
        return servicio.de(id);
    }

    @PostMapping("/api/equipo/{id}/notas")
    public NotaService.NotaDto escribir(@PathVariable Long id, @Valid @RequestBody NotaService.NuevaNota nota) {
        return servicio.escribir(id, nota);
    }

    /** La misma nota a todo el equipo activo. */
    @PostMapping("/api/equipo/notas")
    public Map<String, Integer> escribirATodos(@Valid @RequestBody NotaService.NuevaNota nota) {
        return Map.of("enviadas", servicio.escribirATodos(nota));
    }

    @DeleteMapping("/api/equipo/notas/{notaId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrar(@PathVariable Long notaId) {
        servicio.borrar(notaId);
    }

    @GetMapping("/api/mi-turno/notas")
    public List<NotaService.NotaDto> mias() {
        return servicio.de(vendedor());
    }

    @PostMapping("/api/mi-turno/notas/{notaId}/leida")
    public NotaService.NotaDto leida(@PathVariable Long notaId) {
        return servicio.leer(vendedor(), notaId);
    }

    private static Long vendedor() {
        Long id = Sesion.vendedorId();
        if (id == null) throw new IllegalArgumentException("Esto es solo para un trabajador");
        return id;
    }
}
