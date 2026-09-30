package co.granizados.pos.plata;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MetaPlataRepository extends JpaRepository<MetaPlata, Long> {

    boolean existsByClientUid(String clientUid);

    List<MetaPlata> findAllByOrderByIdAsc();
}
