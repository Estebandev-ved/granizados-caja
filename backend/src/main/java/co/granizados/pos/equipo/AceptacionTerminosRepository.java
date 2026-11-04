package co.granizados.pos.equipo;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AceptacionTerminosRepository extends JpaRepository<AceptacionTerminos, Long> {

    Optional<AceptacionTerminos> findFirstByVendedorIdAndVersion(Long vendedorId, String version);
}
