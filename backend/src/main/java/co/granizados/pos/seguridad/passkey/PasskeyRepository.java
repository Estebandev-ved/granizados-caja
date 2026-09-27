package co.granizados.pos.seguridad.passkey;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PasskeyRepository extends JpaRepository<Passkey, Long> {

    Optional<Passkey> findByCredentialId(String credentialId);

    List<Passkey> findAllByOrderByCreadaEnDesc();
}
