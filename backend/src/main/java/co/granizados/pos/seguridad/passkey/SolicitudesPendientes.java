package co.granizados.pos.seguridad.passkey;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Guarda el "reto" de Face ID entre que el servidor lo manda y el iPhone lo firma.
 * Cada solicitud sirve una sola vez y vence en 5 minutos. En memoria: la app corre en una sola instancia.
 */
class SolicitudesPendientes<T> {

    static final Duration VIGENCIA = Duration.ofMinutes(5);
    private static final SecureRandom AZAR = new SecureRandom();

    private record Pendiente<T>(T valor, Instant vence) {
    }

    private final Map<String, Pendiente<T>> pendientes = new ConcurrentHashMap<>();
    private final Clock clock;

    SolicitudesPendientes(Clock clock) {
        this.clock = clock;
    }

    String guardar(T valor) {
        Instant ahora = clock.instant();
        pendientes.values().removeIf(p -> p.vence().isBefore(ahora));
        byte[] id = new byte[18];
        AZAR.nextBytes(id);
        String clave = Base64.getUrlEncoder().withoutPadding().encodeToString(id);
        pendientes.put(clave, new Pendiente<>(valor, ahora.plus(VIGENCIA)));
        return clave;
    }

    /** La saca: no se puede usar dos veces. */
    Optional<T> tomar(String clave) {
        if (clave == null) return Optional.empty();
        Pendiente<T> p = pendientes.remove(clave);
        if (p == null || p.vence().isBefore(clock.instant())) return Optional.empty();
        return Optional.of(p.valor());
    }
}
