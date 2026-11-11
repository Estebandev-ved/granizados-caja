package co.granizados.pos.plata;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RetiroRepository extends JpaRepository<Retiro, Long> {

    boolean existsByClientUid(String clientUid);

    Optional<Retiro> findByClientUid(String clientUid);

    List<Retiro> findByCreadoEnGreaterThanEqualOrderByCreadoEnDescIdDesc(Instant desde);

    List<Retiro> findByCreadoEnGreaterThanEqualAndCreadoEnLessThanOrderByCreadoEnDescIdDesc(Instant desde, Instant hasta);
}
