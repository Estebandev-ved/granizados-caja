package co.granizados.pos.calle;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AlertaSosRepository extends JpaRepository<AlertaSos, Long> {

    Optional<AlertaSos> findByClientUid(String clientUid);

    List<AlertaSos> findByCreadaEnGreaterThanEqualOrderByCreadaEnDescIdDesc(Instant desde);
}
