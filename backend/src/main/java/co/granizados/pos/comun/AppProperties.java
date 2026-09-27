package co.granizados.pos.comun;

import java.time.ZoneId;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuración propia de la app (sección {@code app:} del application.yml). */
@ConfigurationProperties("app")
public record AppProperties(String zona, String pin, String jwtSecret, int tokenDias, Telegram telegram, Tareas tareas,
                            Webauthn webauthn) {

    public ZoneId zoneId() {
        return ZoneId.of(zona);
    }

    public record Telegram(String token, String chatId) {
        public boolean configurado() {
            return token != null && !token.isBlank() && chatId != null && !chatId.isBlank();
        }
    }

    public record Tareas(boolean habilitadas, String cierreDiario, String pedidoSemanal) {
    }

    /**
     * Face ID (passkeys). rpId es el dominio de la app, sin https ni puerto (ej: dopamina.up.railway.app).
     * El iPhone solo acepta Face ID si la página se abrió desde uno de los orígenes permitidos.
     */
    public record Webauthn(String rpId, String nombre, List<String> origenes) {
    }
}
