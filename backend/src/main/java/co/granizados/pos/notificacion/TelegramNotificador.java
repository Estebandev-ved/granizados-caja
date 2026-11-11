package co.granizados.pos.notificacion;

import co.granizados.pos.comun.AppProperties;
import java.util.Map;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.util.LinkedMultiValueMap;
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

    @Override
    public void enviarArchivo(String asunto, String texto, String nombreArchivo, byte[] contenido) {
        if (telegram == null || !telegram.configurado()) {
            log.info("[aviso sin Telegram] {} ({} con {} bytes)\n{}", asunto, nombreArchivo, contenido.length, texto);
            return;
        }
        // Telegram corta el pie del archivo en 1024 caracteres: el texto largo va como mensaje aparte
        enviar(asunto, texto);
        try {
            var partes = new LinkedMultiValueMap<String, Object>();
            partes.add("chat_id", telegram.chatId());
            partes.add("caption", "💾 Copia de seguridad de tus datos. Guárdala.");
            partes.add("document", new ByteArrayResource(contenido) {
                @Override
                public String getFilename() {
                    return nombreArchivo;
                }
            });
            http.post()
                    .uri("/bot{token}/sendDocument", telegram.token())
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(partes)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("No se pudo mandar el archivo por Telegram ({}): {}", nombreArchivo, e.getMessage());
        }
    }
}
