package co.granizados.pos.plata;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TrasladoRepository extends JpaRepository<Traslado, Long> {

    boolean existsByClientUid(String clientUid);

    List<Traslado> findByCreadoEnGreaterThanEqualOrderByCreadoEnDescIdDesc(Instant desde);
}
