package co.granizados.pos.equipo;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
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

    @PostMapping("/cierre")
    @ResponseStatus(HttpStatus.OK)
    public EquipoService.CierreTurno cerrar() {
        Long vendedor = Sesion.vendedorId();
        if (vendedor == null) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "El cierre del día es de los trabajadores");
        return servicio.cerrarTurno(vendedor);
    }
}
