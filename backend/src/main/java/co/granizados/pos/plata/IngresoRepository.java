package co.granizados.pos.plata;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IngresoRepository extends JpaRepository<Ingreso, Long> {

    boolean existsByClientUid(String clientUid);

    Optional<Ingreso> findByClientUid(String clientUid);

    List<Ingreso> findByCreadoEnGreaterThanEqualOrderByCreadoEnDescIdDesc(Instant desde);

    List<Ingreso> findTop10ByOrderByCreadoEnDescIdDesc();
}
