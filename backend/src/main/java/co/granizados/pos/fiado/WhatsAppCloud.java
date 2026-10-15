package co.granizados.pos.fiado;

import co.granizados.pos.comun.AppProperties;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Manda mensajes por la WhatsApp Cloud API de Meta. Para escribirle primero a alguien Meta solo deja usar una
 * plantilla aprobada, por eso aquí solo existe enviarPlantilla. Sin credenciales queda apagado.
 */
@Component
public class WhatsAppCloud {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppCloud.class);

    private final AppProperties.Whatsapp config;
    private final RestClient http = RestClient.create("https://graph.facebook.com/v21.0");

    public WhatsAppCloud(AppProperties props) {
        this.config = props.whatsapp();
    }

    public boolean activo() {
        return config != null && config.configurado();
    }

    /** Manda la plantilla con sus variables en orden ({{1}}, {{2}}…). Lanza IllegalArgumentException si Meta la rechaza. */
    public void enviarPlantilla(String telefono, List<String> variables) {
        if (!activo()) throw new IllegalArgumentException("El bot de WhatsApp está apagado");
        List<Map<String, String>> parametros = variables.stream().map(v -> Map.of("type", "text", "text", v)).toList();
        Map<String, Object> cuerpo = Map.of(
                "messaging_product", "whatsapp",
                "to", telefono,
                "type", "template",
                "template", Map.of(
                        "name", config.plantilla(),
                        "language", Map.of("code", config.idioma()),
                        "components", List.of(Map.of("type", "body", "parameters", parametros))));
        try {
            http.post()
                    .uri("/{id}/messages", config.phoneId())
                    .header("Authorization", "Bearer " + config.token())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(cuerpo)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("WhatsApp no aceptó el mensaje: {}", e.getMessage());
            throw new IllegalArgumentException("WhatsApp no aceptó el mensaje. Revisa el número, la plantilla y el token.");
        }
    }
}
