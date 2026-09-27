package co.granizados.pos.gasto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GastoService {

    public record NuevoGasto(
            @NotBlank @Size(max = 64) String clientUid,
            @NotNull CategoriaGasto categoria,
            @Size(max = 120) String concepto,
            @Positive @Max(1_000_000_000) long monto,
            Instant creadoEn) {
    }

    /** Mismo criterio que las ventas: la hora la manda el celular, pero no más de 3 días atrás. */
    static final Duration MAX_ATRASO = Duration.ofDays(3);

    public enum Resultado { REGISTRADA, REPETIDA }

    private final GastoRepository gastos;
    private final Clock clock;

    public GastoService(GastoRepository gastos, Clock clock) {
        this.gastos = gastos;
        this.clock = clock;
    }

    @Transactional
    public Resultado registrar(NuevoGasto g) {
        if (gastos.existsByClientUid(g.clientUid())) return Resultado.REPETIDA;
        String concepto = g.concepto() == null ? "" : g.concepto().trim();
        gastos.saveAndFlush(new Gasto(g.clientUid(), g.categoria(), concepto, g.monto(), cuando(g.creadoEn())));
        return Resultado.REGISTRADA;
    }

    @Transactional
    public void borrar(String clientUid) {
        gastos.findByClientUid(clientUid).ifPresent(gastos::delete);
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
