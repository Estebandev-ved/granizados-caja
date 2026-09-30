package co.granizados.pos.plata;

import co.granizados.pos.comun.NoEncontradoException;
import jakarta.validation.Valid;
import java.util.List;
import java.util.function.Supplier;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PlataController {

    public record Respuesta(String clientUid, String estado, String error) {
    }

    private final PlataService servicio;
    private final IngresoRepository ingresos;
    private final ConteoPlataRepository conteos;
    private final TrasladoRepository traslados;
    private final MetaPlataRepository metas;
    private final AporteMetaRepository aportes;

    public PlataController(PlataService servicio, IngresoRepository ingresos, ConteoPlataRepository conteos,
                           TrasladoRepository traslados, MetaPlataRepository metas, AporteMetaRepository aportes) {
        this.servicio = servicio;
        this.ingresos = ingresos;
        this.conteos = conteos;
        this.traslados = traslados;
        this.metas = metas;
        this.aportes = aportes;
    }

    /**
     * Ejecuta la operación; si dos reintentos llegan al mismo tiempo el segundo choca con el UNIQUE
     * y se responde REPETIDA en vez de un error.
     */
    private Respuesta idempotente(String clientUid, Supplier<PlataService.Resultado> operacion, Supplier<Boolean> yaExiste) {
        try {
            return new Respuesta(clientUid, operacion.get().name(), null);
        } catch (DataIntegrityViolationException e) {
            if (yaExiste.get()) return new Respuesta(clientUid, "REPETIDA", null);
            throw e;
        }
    }

    @GetMapping("/api/plata")
    public PlataService.Saldo saldo() {
        return servicio.saldo();
    }

    @GetMapping("/api/plata/movimientos")
    public List<PlataService.Movimiento> movimientos(@RequestParam(defaultValue = "14") int dias) {
        return servicio.movimientos(dias);
    }

    @PostMapping("/api/plata/conteo")
    public Respuesta contar(@Valid @RequestBody PlataService.NuevoConteo c) {
        return idempotente(c.clientUid(), () -> servicio.contar(c), () -> conteos.existsByClientUid(c.clientUid()));
    }

    @PostMapping("/api/plata/traslado")
    public Respuesta trasladar(@Valid @RequestBody PlataService.NuevoTraslado t) {
        return idempotente(t.clientUid(), () -> servicio.trasladar(t), () -> traslados.existsByClientUid(t.clientUid()));
    }

    @PostMapping("/api/plata/metas")
    public Respuesta crearMeta(@Valid @RequestBody PlataService.NuevaMeta m) {
        return idempotente(m.clientUid(), () -> servicio.crearMeta(m), () -> metas.existsByClientUid(m.clientUid()));
    }

    @PostMapping("/api/plata/metas/{id}/aporte")
    public Respuesta aportar(@PathVariable long id, @Valid @RequestBody PlataService.NuevoAporte a) {
        return idempotente(a.clientUid(), () -> servicio.aportar(id, a), () -> aportes.existsByClientUid(a.clientUid()));
    }

    @DeleteMapping("/api/plata/metas/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrarMeta(@PathVariable long id) {
        servicio.borrarMeta(id);
    }

    @PostMapping("/api/ingresos")
    public Respuesta ingreso(@Valid @RequestBody PlataService.NuevoIngreso i) {
        return idempotente(i.clientUid(), () -> servicio.registrarIngreso(i), () -> ingresos.existsByClientUid(i.clientUid()));
    }

    @DeleteMapping("/api/ingresos/{clientUid}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrarIngreso(@PathVariable String clientUid) {
        if (!ingresos.existsByClientUid(clientUid)) throw new NoEncontradoException("Ingreso no encontrado: " + clientUid);
        servicio.borrarIngreso(clientUid);
    }
}
