package co.granizados.pos.plata;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConteoPlataRepository extends JpaRepository<ConteoPlata, Long> {

    boolean existsByClientUid(String clientUid);

    Optional<ConteoPlata> findFirstByOrderByCreadoEnDescIdDesc();
}
