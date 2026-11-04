package co.granizados.pos.equipo;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Lo único de gestión que hace un trabajador: cerrar su día (RolFiltro le deja pasar solo acá). */
@RestController
@RequestMapping("/api/mi-turno")
public class TurnoController {

    private final EquipoService servicio;

    public TurnoController(EquipoService servicio) {
        this.servicio = servicio;
    }

    public record Aceptar(@NotBlank @Size(max = 64) String version) {
    }

    /** Los términos del trabajo con las tarifas de hoy, y si ya los aceptó. */
    @GetMapping("/terminos")
    public EquipoService.Terminos terminos() {
        return servicio.terminos(vendedor());
    }

    /** El trabajador acepta la versión que acaba de leer; queda guardada con fecha y hora. */
    @PostMapping("/terminos/aceptar")
    public EquipoService.Terminos aceptar(@Valid @RequestBody Aceptar cuerpo) {
        return servicio.aceptar(vendedor(), cuerpo.version());
    }

    private static Long vendedor() {
        Long vendedor = Sesion.vendedorId();
        if (vendedor == null) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Esto es de los trabajadores");
        return vendedor;
    }

    @PostMapping("/cierre")
    @ResponseStatus(HttpStatus.OK)
    public EquipoService.CierreTurno cerrar() {
        return servicio.cerrarTurno(vendedor());
    }
}
