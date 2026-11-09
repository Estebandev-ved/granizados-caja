package co.granizados.pos.gasto;

import co.granizados.pos.comun.AppProperties;
import co.granizados.pos.comun.NoEncontradoException;
import co.granizados.pos.plata.LugarPlata;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GastoService {

    /** `categoria`: una de las de siempre (HIELO…) o un nombre propio. `lugar` nulo = salió de la caja (celulares sin actualizar). */
    public record NuevoGasto(
            @NotBlank @Size(max = 64) String clientUid,
            @NotBlank @Size(max = 20) String categoria,
            @Size(max = 120) String concepto,
            @Positive @Max(1_000_000_000) long monto,
            Instant creadoEn,
            LugarPlata lugar) {

        public NuevoGasto(String clientUid, String categoria, String concepto, long monto, Instant creadoEn) {
            this(clientUid, categoria, concepto, monto, creadoEn, null);
        }
    }

    /**
     * La hora la manda el celular. A diferencia de las ventas, un gasto se puede anotar tarde (se le escoge el día en
     * que fue), pero no más de 90 días atrás.
     */
    static final Duration MAX_ATRASO = Duration.ofDays(90);

    public enum Resultado { REGISTRADA, REPETIDA }

    private final GastoRepository gastos;
    private final Clock clock;
    private final ZoneId zona;

    public GastoService(GastoRepository gastos, Clock clock, AppProperties props) {
        this.gastos = gastos;
        this.clock = clock;
        this.zona = props.zoneId();
    }

    @Transactional
    public Resultado registrar(NuevoGasto g) {
        if (gastos.existsByClientUid(g.clientUid())) return Resultado.REPETIDA;
        String concepto = g.concepto() == null ? "" : g.concepto().trim();
        gastos.saveAndFlush(new Gasto(g.clientUid(), g.categoria().trim(), concepto, g.monto(),
                g.lugar() == null ? LugarPlata.CAJA : g.lugar(), cuando(g.creadoEn())));
        return Resultado.REGISTRADA;
    }

    @Transactional
    public void borrar(String clientUid) {
        gastos.findByClientUid(clientUid).ifPresent(gastos::delete);
    }

    /**
     * El gasto se anotó otro día: lo pasa al día en que de verdad fue (día de Bogotá), para que no le baje la ganancia
     * al día en que se escribió. Queda al mediodía de ese día; si es hoy, a la hora de ahora.
     */
    @Transactional
    public void cambiarDia(String clientUid, LocalDate dia) {
        Gasto g = gastos.findByClientUid(clientUid)
                .orElseThrow(() -> new NoEncontradoException("Gasto no encontrado: " + clientUid));
        Instant ahora = clock.instant();
        LocalDate hoy = LocalDate.ofInstant(ahora, zona);
        if (dia.isAfter(hoy)) throw new IllegalArgumentException("Ese día todavía no llega");
        if (dia.isBefore(hoy.minusDays(MAX_ATRASO.toDays()))) {
            throw new IllegalArgumentException("Solo se puede mover hasta " + MAX_ATRASO.toDays() + " días atrás");
        }
        g.moverA(dia.equals(hoy) ? ahora : dia.atTime(LocalTime.NOON).atZone(zona).toInstant());
        gastos.save(g);
    }

    private Instant cuando(Instant delCelular) {
        Instant ahora = clock.instant();
        if (delCelular == null || delCelular.isAfter(ahora.plus(Duration.ofMinutes(5)))
                || delCelular.isBefore(ahora.minus(MAX_ATRASO))) {
            return ahora;
        }
        return delCelular;
    }
}
