package co.granizados.pos;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;

/** Reloj que las pruebas pueden poner en cualquier fecha y hora. */
public class RelojPrueba extends Clock {

    private Instant ahora;

    public RelojPrueba(Instant ahora) {
        this.ahora = ahora;
    }

    /** Ej: "2026-09-25T15:00-05:00" (hora Bogotá). */
    public void poner(String fechaHora) {
        ahora = OffsetDateTime.parse(fechaHora).toInstant();
    }

    public void avanzar(Duration d) {
        ahora = ahora.plus(d);
    }

    @Override
    public ZoneId getZone() {
        return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        RelojPrueba base = this;
        return new Clock() {
            @Override public ZoneId getZone() { return zone; }
            @Override public Clock withZone(ZoneId z) { return base.withZone(z); }
            @Override public Instant instant() { return base.instant(); }
        };
    }

    @Override
    public Instant instant() {
        return ahora;
    }
}
