package co.granizados.pos.seguridad.passkey;

import co.granizados.pos.comun.ApiErrores;
import co.granizados.pos.seguridad.AuthController;
import co.granizados.pos.seguridad.IntentosLogin;
import co.granizados.pos.seguridad.TokenService;
import com.fasterxml.jackson.annotation.JsonRawValue;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Face ID. Entrar (/login/**) es público; registrar, ver y borrar llaves pide sesión.
 * La credencial del iPhone llega como texto JSON tal cual la entrega el navegador.
 */
@RestController
@RequestMapping("/api/passkey")
public class PasskeyController {

    /** "opciones" va como JSON crudo, listo para navigator.credentials. */
    public record Opciones(String solicitud, @JsonRawValue String opciones) {
    }

    public record Respuesta(@NotBlank String solicitud, @NotBlank @Size(max = 20_000) String credencial,
                            @Size(max = 80) String nombre) {
    }

    private final PasskeyService servicio;
    private final TokenService tokens;
    private final IntentosLogin intentos;

    public PasskeyController(PasskeyService servicio, TokenService tokens, IntentosLogin intentos) {
        this.servicio = servicio;
        this.tokens = tokens;
        this.intentos = intentos;
    }

    @PostMapping("/login/opciones")
    public Opciones opcionesEntrada() {
        return opciones(servicio.opcionesEntrada());
    }

    @PostMapping("/login")
    public ResponseEntity<?> entrar(@Valid @RequestBody Respuesta r) {
        if (intentos.bloqueado()) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(new ApiErrores.Error("Muchos intentos. Espera 5 minutos."));
        }
        try {
            servicio.verificarEntrada(r.solicitud(), r.credencial());
        } catch (PasskeyService.FaceIdInvalidoException e) {
            intentos.fallo();
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ApiErrores.Error(e.getMessage()));
        }
        intentos.exito();
        return ResponseEntity.ok(new AuthController.Token(tokens.emitir()));
    }

    @GetMapping
    public List<PasskeyService.PasskeyDto> todas() {
        return servicio.todas();
    }

    @PostMapping("/registro/opciones")
    public Opciones opcionesRegistro() {
        return opciones(servicio.opcionesRegistro());
    }

    @PostMapping("/registro")
    @ResponseStatus(HttpStatus.CREATED)
    public PasskeyService.PasskeyDto registrar(@Valid @RequestBody Respuesta r) {
        return servicio.registrar(r.solicitud(), r.credencial(), r.nombre());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrar(@PathVariable Long id) {
        servicio.borrar(id);
    }

    private static Opciones opciones(PasskeyService.Opciones o) {
        return new Opciones(o.solicitud(), o.opciones());
    }
}
