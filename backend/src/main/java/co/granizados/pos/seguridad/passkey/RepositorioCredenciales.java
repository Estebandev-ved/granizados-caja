package co.granizados.pos.seguridad.passkey;

import com.yubico.webauthn.CredentialRepository;
import com.yubico.webauthn.RegisteredCredential;
import com.yubico.webauthn.data.ByteArray;
import com.yubico.webauthn.data.PublicKeyCredentialDescriptor;
import com.yubico.webauthn.data.exception.Base64UrlException;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Conecta la librería de WebAuthn (Yubico) con la tabla passkey.
 * La app tiene un solo usuario (el dueño), así que el usuario y su "user handle" son fijos.
 */
@Component
public class RepositorioCredenciales implements CredentialRepository {

    public static final String USUARIO = "dueno";
    public static final ByteArray USER_HANDLE = new ByteArray("dopamina-dueno".getBytes(StandardCharsets.UTF_8));

    private final PasskeyRepository passkeys;

    public RepositorioCredenciales(PasskeyRepository passkeys) {
        this.passkeys = passkeys;
    }

    @Override
    @Transactional(readOnly = true)
    public Set<PublicKeyCredentialDescriptor> getCredentialIdsForUsername(String username) {
        if (!USUARIO.equals(username)) return Set.of();
        return passkeys.findAll().stream()
                .map(p -> PublicKeyCredentialDescriptor.builder().id(bytes(p.getCredentialId())).build())
                .collect(Collectors.toSet());
    }

    @Override
    public Optional<ByteArray> getUserHandleForUsername(String username) {
        return USUARIO.equals(username) ? Optional.of(USER_HANDLE) : Optional.empty();
    }

    @Override
    public Optional<String> getUsernameForUserHandle(ByteArray userHandle) {
        return USER_HANDLE.equals(userHandle) ? Optional.of(USUARIO) : Optional.empty();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<RegisteredCredential> lookup(ByteArray credentialId, ByteArray userHandle) {
        if (!USER_HANDLE.equals(userHandle)) return Optional.empty();
        return passkeys.findByCredentialId(credentialId.getBase64Url()).map(RepositorioCredenciales::credencial);
    }

    @Override
    @Transactional(readOnly = true)
    public Set<RegisteredCredential> lookupAll(ByteArray credentialId) {
        return passkeys.findByCredentialId(credentialId.getBase64Url())
                .map(RepositorioCredenciales::credencial).stream().collect(Collectors.toSet());
    }

    private static RegisteredCredential credencial(Passkey p) {
        return RegisteredCredential.builder()
                .credentialId(bytes(p.getCredentialId()))
                .userHandle(USER_HANDLE)
                .publicKeyCose(bytes(p.getPublicKeyCose()))
                .signatureCount(p.getSignCount())
                .build();
    }

    static ByteArray bytes(String base64Url) {
        try {
            return ByteArray.fromBase64Url(base64Url);
        } catch (Base64UrlException e) {
            throw new IllegalStateException("Llave mal guardada en la base", e);
        }
    }
}
