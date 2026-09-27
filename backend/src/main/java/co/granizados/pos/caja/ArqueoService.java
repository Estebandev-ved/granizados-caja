package co.granizados.pos.caja;

import co.granizados.pos.comun.AppProperties;
import co.granizados.pos.resumen.EstadoService;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cerrar la caja: cuánto decía la app en efectivo y cuánto había de verdad.
 * Queda un solo cierre por día; repetirlo con el mismo `clientUid` no escribe otra vez.
 */
@Service
public class ArqueoService {

    public record NuevoArqueo(
            @NotBlank @Size(max = 64) String clientUid,
            @Min(0) long contado,
            @Size(max = 120) String nota,
            Instant creadoEn) {
    }

    /** Lo que la app dice que debe haber en el cajón. */
    public record Cierre(long esperado, long contado, long diferencia, String nota) {
    }

    public enum Resultado { REGISTRADA, REPETIDA }

    private final ArqueoRepository arqueos;
    private final EstadoService estado;
    private final Clock clock;
    private final ZoneId zona;

    public ArqueoService(ArqueoRepository arqueos, EstadoService estado, Clock clock, AppProperties props) {
        this.arqueos = arqueos;
        this.estado = estado;
        this.clock = clock;
        this.zona = props.zoneId();
    }

    public LocalDate hoy() {
        return LocalDate.now(clock.withZone(zona));
    }

    @Transactional
    public Resultado registrar(NuevoArqueo n) {
        LocalDate dia = hoy();
        if (arqueos.findByClientUid(n.clientUid()).isPresent()) return Resultado.REPETIDA;

        long esperado = estado.resumenDe(dia).efectivo();
        Instant cuando = n.creadoEn() == null ? clock.instant() : n.creadoEn();
        Arqueo a = arqueos.findByDia(dia).orElse(null);
        if (a == null) {
            arqueos.save(new Arqueo(n.clientUid(), dia, esperado, n.contado(), limpiar(n.nota()), cuando));
        } else {
            a.actualizar(n.clientUid(), esperado, n.contado(), limpiar(n.nota()), cuando);
            arqueos.save(a);
        }
        return Resultado.REGISTRADA;
    }

    /** El cierre de hoy, si ya lo hiciste. */
    @Transactional(readOnly = true)
    public Cierre cierreDeHoy() {
        return arqueos.findByDia(hoy()).map(ArqueoService::de).orElse(null);
    }

    /** Los cierres de un periodo, para los reportes. */
    @Transactional(readOnly = true)
    public List<Arqueo> entre(LocalDate desde, LocalDate hasta) {
        return arqueos.findByDiaGreaterThanEqualAndDiaLessThanOrderByDiaDesc(desde, hasta);
    }

    @Transactional(readOnly = true)
    public Optional<Arqueo> porDia(LocalDate dia) {
        return arqueos.findByDia(dia);
    }

    public static Cierre de(Arqueo a) {
        return new Cierre(a.getEsperado(), a.getContado(), a.getDiferencia(), a.getNota());
    }

    private static String limpiar(String nota) {
        if (nota == null) return null;
        String t = nota.trim();
        return t.isEmpty() ? null : t;
    }
}
