package co.granizados.pos.resumen;

import co.granizados.pos.comun.AppProperties;
import co.granizados.pos.venta.VentaRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Datos del negocio en el tiempo: desde cuándo vende y cuántos días lleva en operación. */
@RestController
@RequestMapping("/api/negocio")
public class NegocioController {

    /** `inicio` es el día (Bogotá) de la primera venta, o null si todavía no hay ninguna. `dias` cuenta el primer día. */
    public record Negocio(LocalDate inicio, long dias) {
    }

    private final VentaRepository ventas;
    private final Clock clock;
    private final ZoneId zona;

    public NegocioController(VentaRepository ventas, Clock clock, AppProperties props) {
        this.ventas = ventas;
        this.clock = clock;
        this.zona = props.zoneId();
    }

    @GetMapping
    @Transactional(readOnly = true)
    public Negocio negocio() {
        return ventas.primeraDesde(Instant.EPOCH)
                .map(primera -> {
                    LocalDate inicio = primera.atZone(zona).toLocalDate();
                    LocalDate hoy = LocalDate.now(clock.withZone(zona));
                    return new Negocio(inicio, Math.max(1, ChronoUnit.DAYS.between(inicio, hoy) + 1));
                })
                .orElse(new Negocio(null, 0));
    }
}
