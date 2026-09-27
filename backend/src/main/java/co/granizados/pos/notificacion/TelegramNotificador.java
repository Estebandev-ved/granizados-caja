package co.granizados.pos.notificacion;

import co.granizados.pos.comun.AppProperties;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Manda los avisos por Telegram. Si no está configurado, solo los deja en el log. */
@Component
public class TelegramNotificador implements Notificador {

    private static final Logger log = LoggerFactory.getLogger(TelegramNotificador.class);

    private final AppProperties.Telegram telegram;
    private final RestClient http = RestClient.create("https://api.telegram.org");

    public TelegramNotificador(AppProperties props) {
        this.telegram = props.telegram();
    }

    @Override
    public void enviar(String asunto, String texto) {
        if (telegram == null || !telegram.configurado()) {
            log.info("[aviso sin Telegram] {}\n{}", asunto, texto);
            return;
        }
        try {
            http.post()
                    .uri("/bot{token}/sendMessage", telegram.token())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("chat_id", telegram.chatId(), "text", asunto + "\n\n" + texto,
                            "disable_web_page_preview", true))
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("No se pudo mandar el aviso por Telegram ({}): {}", asunto, e.getMessage());
        }
    }
}
