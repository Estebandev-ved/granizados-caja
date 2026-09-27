package co.granizados.pos.seguridad.passkey;

import co.granizados.pos.comun.AppProperties;
import co.granizados.pos.comun.NoEncontradoException;
import com.yubico.webauthn.AssertionRequest;
import com.yubico.webauthn.AssertionResult;
import com.yubico.webauthn.FinishAssertionOptions;
import com.yubico.webauthn.FinishRegistrationOptions;
import com.yubico.webauthn.RegistrationResult;
import com.yubico.webauthn.RelyingParty;
import com.yubico.webauthn.StartAssertionOptions;
import com.yubico.webauthn.StartRegistrationOptions;
import com.yubico.webauthn.data.AuthenticatorAttachment;
import com.yubico.webauthn.data.AuthenticatorSelectionCriteria;
import com.yubico.webauthn.data.PublicKeyCredential;
import com.yubico.webauthn.data.PublicKeyCredentialCreationOptions;
import com.yubico.webauthn.data.RelyingPartyIdentity;
import com.yubico.webauthn.data.ResidentKeyRequirement;
import com.yubico.webauthn.data.UserIdentity;
import com.yubico.webauthn.data.UserVerificationRequirement;
import java.time.Clock;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Face ID con passkeys (WebAuthn).
 * 1. Registro (ya con sesión por PIN): el iPhone crea una llave, guarda la privada detrás de Face ID y nos da la pública.
 * 2. Entrada: mandamos un reto, el iPhone lo firma después de ver tu cara y verificamos la firma con la llave pública.
 */
@Service
public class PasskeyService {

    private static final Logger log = LoggerFactory.getLogger(PasskeyService.class);
    private static final long TIEMPO_MS = 60_000;

    public record Opciones(String solicitud, String opciones) {
    }

    public record PasskeyDto(Long id, String nombre, Instant creadaEn, Instant usadaEn) {
    }

    /** El Face ID no se pudo verificar (reto vencido, firma mala, llave desconocida…). */
    public static class FaceIdInvalidoException extends IllegalArgumentException { // 400 en la API
        public FaceIdInvalidoException(String mensaje) {
            super(mensaje);
        }
    }

    private final RelyingParty rp;
    private final PasskeyRepository passkeys;
    private final Clock clock;
    private final String nombreApp;
    private final SolicitudesPendientes<PublicKeyCredentialCreationOptions> registros;
    private final SolicitudesPendientes<AssertionRequest> entradas;

    public PasskeyService(RepositorioCredenciales credenciales, PasskeyRepository passkeys, AppProperties props, Clock clock) {
        AppProperties.Webauthn cfg = props.webauthn();
        this.nombreApp = cfg.nombre();
        this.rp = RelyingParty.builder()
                .identity(RelyingPartyIdentity.builder().id(cfg.rpId()).name(cfg.nombre()).build())
                .credentialRepository(credenciales)
                .origins(new HashSet<>(cfg.origenes()))
                .clock(clock)
                .build();
        this.passkeys = passkeys;
        this.clock = clock;
        this.registros = new SolicitudesPendientes<>(clock);
        this.entradas = new SolicitudesPendientes<>(clock);
        log.info("Face ID configurado para el dominio {} (orígenes {})", cfg.rpId(), cfg.origenes());
    }

    public Opciones opcionesRegistro() {
        PublicKeyCredentialCreationOptions req = rp.startRegistration(StartRegistrationOptions.builder()
                .user(UserIdentity.builder()
                        .name(RepositorioCredenciales.USUARIO)
                        .displayName(nombreApp)
                        .id(RepositorioCredenciales.USER_HANDLE)
                        .build())
                .authenticatorSelection(AuthenticatorSelectionCriteria.builder()
                        .authenticatorAttachment(AuthenticatorAttachment.PLATFORM) // el Face ID del mismo iPhone
                        .residentKey(ResidentKeyRequirement.PREFERRED)
                        .userVerification(UserVerificationRequirement.REQUIRED)
                        .build())
                .timeout(TIEMPO_MS)
                .build());
        try {
            return new Opciones(registros.guardar(req), req.toCredentialsCreateJson());
        } catch (Exception e) {
            throw new IllegalStateException("No se pudieron armar las opciones de Face ID", e);
        }
    }

    @Transactional
    public PasskeyDto registrar(String solicitud, String credencialJson, String nombre) {
        PublicKeyCredentialCreationOptions req = registros.tomar(solicitud)
                .orElseThrow(() -> new FaceIdInvalidoException("La solicitud venció, intenta otra vez"));
        try {
            RegistrationResult r = rp.finishRegistration(FinishRegistrationOptions.builder()
                    .request(req)
                    .response(PublicKeyCredential.parseRegistrationResponseJson(credencialJson))
                    .build());
            String etiqueta = nombre == null || nombre.isBlank() ? "iPhone" : nombre.trim();
            Passkey p = passkeys.save(new Passkey(r.getKeyId().getId().getBase64Url(), r.getPublicKeyCose().getBase64Url(),
                    r.getSignatureCount(), etiqueta.substring(0, Math.min(80, etiqueta.length())), clock.instant()));
            return dto(p);
        } catch (Exception e) {
            log.warn("Registro de Face ID rechazado: {}", e.getMessage());
            throw new FaceIdInvalidoException("No se pudo registrar el Face ID");
        }
    }

    public Opciones opcionesEntrada() {
        if (passkeys.count() == 0) throw new NoEncontradoException("No hay Face ID configurado. Entra con el PIN.");
        AssertionRequest req = rp.startAssertion(StartAssertionOptions.builder()
                .username(RepositorioCredenciales.USUARIO)
                .userVerification(UserVerificationRequirement.REQUIRED)
                .timeout(TIEMPO_MS)
                .build());
        try {
            return new Opciones(entradas.guardar(req), req.toCredentialsGetJson());
        } catch (Exception e) {
            throw new IllegalStateException("No se pudieron armar las opciones de Face ID", e);
        }
    }

    /** Verifica la firma del iPhone. Si es válida, la persona puede entrar. */
    @Transactional
    public void verificarEntrada(String solicitud, String credencialJson) {
        AssertionRequest req = entradas.tomar(solicitud)
                .orElseThrow(() -> new FaceIdInvalidoException("La solicitud venció, intenta otra vez"));
        AssertionResult r;
        try {
            r = rp.finishAssertion(FinishAssertionOptions.builder()
                    .request(req)
                    .response(PublicKeyCredential.parseAssertionResponseJson(credencialJson))
                    .build());
        } catch (Exception e) {
            log.warn("Entrada con Face ID rechazada: {}", e.getMessage());
            throw new FaceIdInvalidoException("Face ID no válido");
        }
        if (!r.isSuccess()) throw new FaceIdInvalidoException("Face ID no válido");
        passkeys.findByCredentialId(r.getCredential().getCredentialId().getBase64Url())
                .ifPresent(p -> p.usada(r.getSignatureCount(), clock.instant()));
    }

    @Transactional(readOnly = true)
    public List<PasskeyDto> todas() {
        return passkeys.findAllByOrderByCreadaEnDesc().stream().map(PasskeyService::dto).toList();
    }

    @Transactional
    public void borrar(Long id) {
        Passkey p = passkeys.findById(id).orElseThrow(() -> new NoEncontradoException("No existe ese Face ID"));
        passkeys.delete(p);
    }

    private static PasskeyDto dto(Passkey p) {
        return new PasskeyDto(p.getId(), p.getNombre(), p.getCreadaEn(), p.getUsadaEn());
    }
}
