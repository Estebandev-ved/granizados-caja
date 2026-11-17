package co.granizados.pos.calle;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Plan de la calle. Empezar y terminar una salida, ver los lugares guardados y el botón de alerta los puede usar un
 * trabajador (RolFiltro); el resumen con el mapa y las ganancias es solo del dueño.
 */
@RestController
@RequestMapping("/api/calle")
public class CalleController {

    private final CalleService servicio;

    public CalleController(CalleService servicio) {
        this.servicio = servicio;
    }

    @GetMapping("/lugares")
    public List<CalleService.LugarSimple> lugares() {
        return servicio.lugares();
    }

    @PostMapping("/salidas")
    public CalleService.Iniciada iniciar(@Valid @RequestBody CalleService.NuevaSalida cuerpo) {
        try {
            return servicio.iniciar(cuerpo);
        } catch (DataIntegrityViolationException e) {
            // Dos reintentos al mismo tiempo: el UNIQUE frena al segundo y este devuelve la salida que ya quedó
            return servicio.iniciar(cuerpo);
        }
    }

    @PostMapping("/salidas/{clientUid}/terminar")
    public CalleService.Cierre terminar(@PathVariable String clientUid, @Valid @RequestBody CalleService.CierreSalida cuerpo) {
        return servicio.terminar(clientUid, cuerpo);
    }

    @PostMapping("/sos")
    public CalleService.AlertaDto alertar(@Valid @RequestBody CalleService.NuevaAlerta cuerpo) {
        try {
            return servicio.alertar(cuerpo);
        } catch (DataIntegrityViolationException e) {
            return servicio.alertar(cuerpo);
        }
    }

    /** Solo el dueño: cada lugar con su veredicto, las salidas y las alertas. */
    @GetMapping("/resumen")
    public CalleService.Resumen resumen() {
        return servicio.resumen();
    }
}
