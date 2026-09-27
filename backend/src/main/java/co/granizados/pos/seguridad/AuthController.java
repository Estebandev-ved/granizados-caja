package co.granizados.pos.seguridad;

import co.granizados.pos.comun.ApiErrores;
import co.granizados.pos.comun.AppProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record Login(@NotBlank String pin) {
    }

    public record Token(String token) {
    }

    private final AppProperties props;
    private final TokenService tokens;
    private final IntentosLogin intentos;

    public AuthController(AppProperties props, TokenService tokens, IntentosLogin intentos) {
        this.props = props;
        this.tokens = tokens;
        this.intentos = intentos;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody Login login) {
        if (intentos.bloqueado()) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(new ApiErrores.Error("Muchos intentos. Espera 5 minutos."));
        }
        // Comparación en tiempo constante para no filtrar el PIN por tiempos de respuesta
        boolean ok = MessageDigest.isEqual(
                login.pin().getBytes(StandardCharsets.UTF_8), props.pin().getBytes(StandardCharsets.UTF_8));
        if (!ok) {
            intentos.fallo();
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ApiErrores.Error("PIN incorrecto"));
        }
        intentos.exito();
        return ResponseEntity.ok(new Token(tokens.emitir()));
    }
}
