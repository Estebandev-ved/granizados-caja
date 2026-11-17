package co.granizados.pos.calle;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SalidaCalleRepository extends JpaRepository<SalidaCalle, Long> {

    Optional<SalidaCalle> findByClientUid(String clientUid);

    List<SalidaCalle> findByInicioGreaterThanEqualOrderByInicioDescIdDesc(Instant desde);

    Optional<SalidaCalle> findFirstByVendedorIdAndFinIsNullOrderByInicioDesc(Long vendedorId);

    Optional<SalidaCalle> findFirstByVendedorIdIsNullAndFinIsNullOrderByInicioDesc();
}
