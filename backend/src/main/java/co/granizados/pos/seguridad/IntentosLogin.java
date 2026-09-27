package co.granizados.pos.seguridad;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.springframework.stereotype.Component;

/** Freno contra adivinar el PIN: después de 5 intentos fallidos, bloquea 5 minutos. */
@Component
public class IntentosLogin {

    static final int MAX_FALLOS = 5;
    static final Duration BLOQUEO = Duration.ofMinutes(5);

    private final Clock clock;
    private int fallos;
    private Instant bloqueadoHasta = Instant.EPOCH;

    public IntentosLogin(Clock clock) {
        this.clock = clock;
    }

    public synchronized boolean bloqueado() {
        return clock.instant().isBefore(bloqueadoHasta);
    }

    public synchronized void fallo() {
        if (++fallos >= MAX_FALLOS) {
            bloqueadoHasta = clock.instant().plus(BLOQUEO);
            fallos = 0;
        }
    }

    public synchronized void exito() {
        fallos = 0;
    }
}
