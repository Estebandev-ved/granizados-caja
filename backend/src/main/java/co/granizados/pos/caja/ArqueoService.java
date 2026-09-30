package co.granizados.pos.caja;

import co.granizados.pos.comun.AppProperties;
import co.granizados.pos.plata.PlataService;
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
 * Si ya contaste tu plata en Mi plata, "lo esperado" es la plata que debería haber en la caja (lo que había
 * antes más lo de hoy, menos gastos y traslados); si no, es solo el efectivo vendido hoy.
 * Al cerrar, lo contado pasa a ser el nuevo punto de partida de la caja en Mi plata. Si además se dice cuánto hay
 * en la casa y en Nequi, el cierre también cuenta toda la plata (así el primer cierre ya deja el saldo armado).
 * Queda un solo cierre por día; repetirlo con el mismo `clientUid` no escribe otra vez.
 */
@Service
public class ArqueoService {

    public record NuevoArqueo(
            @NotBlank @Size(max = 64) String clientUid,
            @Min(0) long contado,
            @Size(max = 120) String nota,
            Instant creadoEn,
            @Min(0) Long casa,
            @Min(0) Long nequi) {

        /** Cierre solo con el cajón: casa y Nequi quedan como estaban. */
        public NuevoArqueo(String clientUid, long contado, String nota, Instant creadoEn) {
            this(clientUid, contado, nota, creadoEn, null, null);
        }
    }

    /** Lo que la app dice que debe haber en el cajón. */
    public record Cierre(long esperado, long contado, long diferencia, String nota) {
    }

    public enum Resultado { REGISTRADA, REPETIDA }

    private final ArqueoRepository arqueos;
    private final EstadoService estado;
    private final PlataService plata;
    private final Clock clock;
    private final ZoneId zona;

    public ArqueoService(ArqueoRepository arqueos, EstadoService estado, PlataService plata, Clock clock,
                         AppProperties props) {
        this.arqueos = arqueos;
        this.estado = estado;
        this.plata = plata;
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

        PlataService.Saldo saldo = plata.saldo();
        boolean plataContada = saldo.contadoEn() != null;
        long esperado = plataContada ? Math.max(0, saldo.caja()) : estado.resumenDe(dia).efectivo();
        Instant cuando = n.creadoEn() == null ? clock.instant() : n.creadoEn();
        Arqueo a = arqueos.findByDia(dia).orElse(null);
        if (a == null) {
            arqueos.save(new Arqueo(n.clientUid(), dia, esperado, n.contado(), limpiar(n.nota()), cuando));
        } else {
            a.actualizar(n.clientUid(), esperado, n.contado(), limpiar(n.nota()), cuando);
            arqueos.save(a);
        }
        if (plataContada || n.casa() != null || n.nequi() != null) {
            // Lo que contaste en el cajón es la verdad: la caja de Mi plata parte de ahí. Casa y Nequi se toman de
            // lo que dijiste; lo que no dijiste sigue como estaba
            long casa = n.casa() != null ? n.casa() : Math.max(0, saldo.casa());
            long nequi = n.nequi() != null ? n.nequi() : Math.max(0, saldo.nequi());
            String uid = ("ar-" + n.clientUid());
            plata.contar(new PlataService.NuevoConteo(uid.substring(0, Math.min(64, uid.length())), n.contado(), casa, nequi));
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
